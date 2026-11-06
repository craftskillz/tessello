import { execFile } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdir, readFile, readdir, rename, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";

export type ProblemKind = "push-rejected" | "auth" | "remote-unreachable" | "git-missing" | "not-a-modules-folder" | "no-config";

/** What the Git Integration Module writes under the key `config` (ADR 0020). */
export interface SyncConfig {
  remote: string;
  push: boolean;
  intervalSeconds: number;
  dataModules: string[];
}

/** What this command writes under the key `status`, for the Git Integration Module to show. */
export interface SyncStatus {
  heartbeat: string;
  installed: { id: string; name: string; folder: string }[];
  /** Top-level folders holding their own `.git`, sorted. */
  ownRepositories: string[];
  lastCommit?: { sha: string; at: string; modules: string[] };
  problem?: { kind: ProblemKind; message: string; since: string };
}

export interface SyncDeps {
  /** The git binary. */
  git: string;
  now: () => Date;
}

interface Output {
  out: (text: string) => void;
  err: (text: string) => void;
}

const USAGE = "Usage: tessello sync --once [folder]";

// The channel with the Git Integration Module is its storage (ADR 0020). The CLI cannot depend on the private host
// package, so these names are the ones the Host's `keyFileName` gives to the keys `config` and `status`; a test
// checks that they still agree.
const NAMESPACE = "@craftskillz";
const NAME = "git-integration";
const INTEGRATION_DIR = [".tessello", "data", NAMESPACE, NAME];
const CONFIG_FILE = "config.json";
const STATUS_FILE = "status.json";
// No `.json` at the end: the Host would take a half-written file for a key.
const STATUS_TMP = "status.tessello-sync-tmp";

const SECTION_START = "# >>> tessello sync";
const SECTION_END = "# <<< tessello sync";
const COMMIT_IDENTITY = ["-c", "user.name=tessello sync", "-c", "user.email=sync@tessello.invalid"];

interface Registry {
  modules: { id: string; folder: string }[];
}

interface RoundResult {
  status: SyncStatus | null;
  committed: boolean;
  problem?: ProblemKind;
  /** What to tell the User about the problem. */
  message?: string;
}

/** One round. Never throws for the expected problems: returns them. */
export async function syncOnce(folder: string, deps: Partial<SyncDeps> = {}): Promise<RoundResult> {
  const git = deps.git ?? "git";
  const now = (deps.now ?? (() => new Date()))();
  const root = resolve(folder);

  const registry = await readRegistry(root);
  if (!registry) {
    return {
      status: null,
      committed: false,
      problem: "not-a-modules-folder",
      message: `"${root}" is not a Modules folder: .tessello/modules.json is missing or unreadable. Choose it in the Host first.`,
    };
  }

  const previous = await readStatus(root);
  const installed = await Promise.all(registry.modules.map(async (m) => ({ id: m.id, name: await nameOf(root, m), folder: m.folder })));
  const ownRepositories = await ownRepositoriesOf(root);
  const status: SyncStatus = { heartbeat: now.toISOString(), installed, ownRepositories };
  if (previous?.lastCommit) status.lastCommit = previous.lastCommit;

  const finish = async (committed: boolean, problem?: { kind: ProblemKind; message: string }): Promise<RoundResult> => {
    if (problem) {
      const since = previous?.problem?.kind === problem.kind ? previous.problem.since : now.toISOString();
      status.problem = { ...problem, since };
    }
    await writeStatus(root, status);
    return { status, committed, ...(problem && { problem: problem.kind, message: problem.message }) };
  };

  const version = await runGit(git, ["--version"], root);
  if (version.missing) return finish(false, { kind: "git-missing", message: `Cannot run "${git}": install git to back up your Modules folder.` });

  if (!existsSync(join(root, ".git"))) {
    const init = await runGit(git, ["init", "-b", "main"], root);
    if (init.code !== 0) throw new Error(`git init failed: ${init.stderr.trim()}`);
  }

  const config = await readConfig(root);
  if (!config) {
    return finish(false, {
      kind: "no-config",
      message: "The Git Integration Module has not saved a valid configuration yet. Open it in Tessello and save its settings.",
    });
  }

  const rules = ignoreRules(config, ownRepositories);
  await writeGitignore(root, rules);

  // Another git (the User's, an editor) is working: the next round will see what it leaves.
  if (existsSync(join(root, ".git", "index.lock"))) return finish(false);

  const commit = await commitChanges(git, root, registry, rules, now);
  if (commit) status.lastCommit = commit;
  return finish(commit !== null);
}

/** `tessello sync --once [folder]`: 0 when the round ran without problem, 1 on a problem (message on err), 2 on a usage error. */
export async function syncCommand(args: string[], output: Output, deps: Partial<SyncDeps> = {}): Promise<number> {
  const once = args.includes("--once");
  const rest = args.filter((arg) => arg !== "--once");
  if (rest.length > 1 || rest.some((arg) => arg.startsWith("-"))) {
    output.err(USAGE);
    return 2;
  }
  if (!once) {
    output.err(`The continuous mode is not available yet: use \`tessello sync --once [folder]\`.\n${USAGE}`);
    return 2;
  }
  const result = await syncOnce(rest[0] ?? process.cwd(), deps);
  if (result.problem) {
    output.err(result.message ?? `Sync failed: ${result.problem}.`);
    return 1;
  }
  const last = result.status?.lastCommit;
  output.out(result.committed && last ? `Committed ${last.sha}.` : "Nothing to commit.");
  return 0;
}

/** Commits what changed; describes the commit, or null when there was nothing to commit. */
async function commitChanges(
  git: string,
  root: string,
  registry: Registry,
  rules: string[],
  now: Date,
): Promise<SyncStatus["lastCommit"] | null> {
  // What the command's own rules now exclude leaves the index (a Module taken out of dataModules, a folder that became
  // a repository); the files stay on disk. Only these rules: a file the User ignores later stays tracked, as git would.
  const excludes = rules.map((rule) => `--exclude=${rule}`);
  const ignored = (await runGit(git, ["ls-files", "-ci", "-z", ...excludes], root)).stdout.split("\0").filter(Boolean);
  if (ignored.length > 0) await runGit(git, ["rm", "--cached", "-r", "--quiet", "--ignore-unmatch", "--", ...ignored], root);

  await runGit(git, ["add", "-A"], root);
  const changed = (await runGit(git, ["diff", "--cached", "--name-only", "-z"], root)).stdout.split("\0").filter(Boolean);
  if (changed.length === 0) return null;

  const folders = new Map(registry.modules.map((m) => [m.folder, m.id]));
  const labels = new Set<string>();
  const moduleIds = new Set<string>();
  for (const path of changed) {
    const parts = path.split("/");
    const isData = parts[0] === ".tessello" && parts[1] === "data" && parts.length > 4;
    const id = folders.get(parts[0]!) ?? (isData ? `${parts[2]}/${parts[3]}` : undefined);
    if (id) {
      labels.add(id);
      moduleIds.add(id);
    } else if (path === ".tessello/home.json") labels.add("home");
    else if (path === ".tessello/modules.json") labels.add("registry");
  }
  const names = [...labels].sort();
  const message = names.length > 0 ? `tessello sync: ${names.join(", ")}` : "tessello sync";

  const identity = (await runGit(git, ["config", "user.email"], root)).stdout.trim() ? [] : COMMIT_IDENTITY;
  const commit = await runGit(git, [...identity, "commit", "-m", message], root);
  if (commit.code !== 0) throw new Error(`git commit failed: ${commit.stderr.trim() || commit.stdout.trim()}`);
  const sha = (await runGit(git, ["rev-parse", "--short", "HEAD"], root)).stdout.trim();
  return { sha, at: now.toISOString(), modules: [...moduleIds].sort() };
}

/** What the command keeps out of the repository, in `.gitignore` syntax. */
function ignoreRules(config: SyncConfig, ownRepositories: string[]): string[] {
  const data = "/.tessello/data";
  const own = `${data}/${NAMESPACE}/${NAME}`;
  return [
    // Default-deny: the data of a Module that is not chosen, uninstalled or unknown never enters the repository.
    `${data}/*/*/`,
    ...[...new Set(config.dataModules)].sort().map((id) => `!${data}/${id}/`),
    `!${own}/`,
    `${own}/${STATUS_FILE}`,
    "/.tessello/sync.lock",
    "*.crswap",
    ".DS_Store",
    "*.tessello-sync-tmp",
    ...ownRepositories.map((name) => `/${name}/`),
  ];
}

/** The section of `.gitignore` this command owns; the User's lines around it are left byte for byte. */
async function writeGitignore(root: string, rules: string[]): Promise<void> {
  const section = [SECTION_START, "# Generated at every round: edit the lines outside this section.", ...rules, SECTION_END].join("\n");
  const path = join(root, ".gitignore");
  const current = existsSync(path) ? await readFile(path, "utf8") : null;

  let next: string;
  const start = current?.indexOf(SECTION_START) ?? -1;
  const end = start >= 0 ? current!.indexOf(SECTION_END, start) : -1;
  if (current === null) next = `${section}\n`;
  else if (start >= 0 && end >= 0) next = current.slice(0, start) + section + current.slice(end + SECTION_END.length);
  // A section whose end was deleted runs to the end of the file.
  else if (start >= 0) next = `${current.slice(0, start)}${section}\n`;
  else next = `${current}${current === "" || current.endsWith("\n") ? "" : "\n"}${section}\n`;
  if (next !== current) await writeFile(path, next);
}

async function ownRepositoriesOf(root: string): Promise<string[]> {
  const entries = await readdir(root, { withFileTypes: true });
  return entries
    .filter((e) => e.isDirectory() && e.name !== ".git" && e.name !== ".tessello" && existsSync(join(root, e.name, ".git")))
    .map((e) => e.name)
    .sort();
}

async function nameOf(root: string, module: { id: string; folder: string }): Promise<string> {
  try {
    const manifest = JSON.parse(await readFile(join(root, module.folder, "manifest.json"), "utf8"));
    return typeof manifest.name === "string" && manifest.name ? manifest.name : module.id;
  } catch {
    return module.id;
  }
}

async function readRegistry(root: string): Promise<Registry | null> {
  try {
    const parsed = JSON.parse(await readFile(join(root, ".tessello", "modules.json"), "utf8"));
    if (!Array.isArray(parsed?.modules)) return null;
    return { modules: parsed.modules.filter((m: any) => typeof m?.id === "string" && typeof m?.folder === "string") };
  } catch {
    return null;
  }
}

/** The value stored under a key by the Host: `{ key, value }`, or undefined when absent, unreadable or another key. */
async function readKey(root: string, file: string, key: string): Promise<unknown> {
  try {
    const parsed = JSON.parse(await readFile(join(root, ...INTEGRATION_DIR, file), "utf8"));
    return parsed?.key === key ? parsed.value : undefined;
  } catch {
    return undefined;
  }
}

async function readConfig(root: string): Promise<SyncConfig | null> {
  const value = (await readKey(root, CONFIG_FILE, "config")) as Partial<SyncConfig> | null | undefined;
  const valid =
    value !== null &&
    typeof value === "object" &&
    typeof value.remote === "string" &&
    typeof value.push === "boolean" &&
    typeof value.intervalSeconds === "number" &&
    Array.isArray(value.dataModules) &&
    value.dataModules.every((id) => typeof id === "string");
  return valid ? (value as SyncConfig) : null;
}

async function readStatus(root: string): Promise<SyncStatus | null> {
  const value = await readKey(root, STATUS_FILE, "status");
  return value && typeof value === "object" ? (value as SyncStatus) : null;
}

/** Written then renamed, so that the Host never reads half a file. */
async function writeStatus(root: string, status: SyncStatus): Promise<void> {
  const dir = join(root, ...INTEGRATION_DIR);
  await mkdir(dir, { recursive: true });
  await writeFile(join(dir, STATUS_TMP), JSON.stringify({ key: "status", value: status }, null, 2) + "\n");
  await rename(join(dir, STATUS_TMP), join(dir, STATUS_FILE));
}

interface GitResult {
  code: number;
  stdout: string;
  stderr: string;
  /** The binary could not be started. */
  missing: boolean;
}

function runGit(git: string, args: string[], cwd: string): Promise<GitResult> {
  return new Promise((done) => {
    execFile(git, args, { cwd, encoding: "utf8", maxBuffer: 256 * 1024 * 1024 }, (error, stdout, stderr) => {
      const code = error ? (typeof error.code === "number" ? error.code : 1) : 0;
      done({ code, stdout, stderr, missing: (error as NodeJS.ErrnoException | null)?.code === "ENOENT" });
    });
  });
}
