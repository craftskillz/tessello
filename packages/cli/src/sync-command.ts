import { execFile } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdir, readFile, readdir, rename, stat, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { acquireLock, type LockDeps } from "./sync-lock.ts";

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

const USAGE = "Usage: tessello sync [--once] [folder]";

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

/** What one round reports. */
export interface RoundResult {
  status: SyncStatus | null;
  committed: boolean;
  /** Seconds to wait before the next round: the configured interval brought within bounds. */
  intervalSeconds: number;
  /** The quiet period put the commit off to the next round. */
  postponed?: true;
  problem?: ProblemKind;
  /** What to tell the User about the problem. */
  message?: string;
}

const DEFAULT_INTERVAL_SECONDS = 60;
const MIN_INTERVAL_SECONDS = 10;
const MAX_INTERVAL_SECONDS = 3600;
/** A changed file younger than this is probably still being written: its commit waits for the next round. */
const QUIET_MS = 10_000;

/** The interval between rounds: the configured one brought within [10, 3600], 60 without a valid config. */
export function intervalOf(config: SyncConfig | null): number {
  const value = config?.intervalSeconds;
  if (typeof value !== "number" || !Number.isFinite(value)) return DEFAULT_INTERVAL_SECONDS;
  return Math.min(MAX_INTERVAL_SECONDS, Math.max(MIN_INTERVAL_SECONDS, value));
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
      intervalSeconds: DEFAULT_INTERVAL_SECONDS,
      problem: "not-a-modules-folder",
      message: notAModulesFolder(root),
    };
  }

  const previous = await readStatus(root);
  const installed = await Promise.all(registry.modules.map(async (m) => ({ id: m.id, name: await nameOf(root, m), folder: m.folder })));
  const ownRepositories = await ownRepositoriesOf(root);
  const status: SyncStatus = { heartbeat: now.toISOString(), installed, ownRepositories };
  if (previous?.lastCommit) status.lastCommit = previous.lastCommit;

  let interval = DEFAULT_INTERVAL_SECONDS;
  const finish = async (committed: boolean, problem?: { kind: ProblemKind; message: string }, postponed = false): Promise<RoundResult> => {
    if (problem) {
      const since = previous?.problem?.kind === problem.kind ? previous.problem.since : now.toISOString();
      status.problem = { ...problem, since };
    }
    await writeStatus(root, status);
    return { status, committed, intervalSeconds: interval, ...(postponed && { postponed: true as const }), ...(problem && { problem: problem.kind, message: problem.message }) };
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

  interval = intervalOf(config);
  const rules = ignoreRules(config, ownRepositories);
  const wroteGitignore = await writeGitignore(root, rules);

  // Another git (the User's, an editor) is working: the next round will see what it leaves.
  if (existsSync(join(root, ".git", "index.lock"))) return finish(false);

  // A file still being written would be committed half done: wait for the next round (the heartbeat is written anyway).
  if (await hasRecentChange(git, root, now, wroteGitignore)) return finish(false, undefined, true);

  const commit = await commitChanges(git, root, registry, rules, now);
  if (commit) status.lastCommit = commit;
  return finish(commit !== null);
}

function notAModulesFolder(root: string): string {
  return `"${root}" is not a Modules folder: .tessello/modules.json is missing or unreadable. Choose it in the Host first.`;
}

/** What the continuous loop depends on besides git and the clock; tests replace them so that nothing really sleeps. */
export interface LoopDeps extends SyncDeps {
  /** Waits `ms`, or less when the signal aborts. Never rejects. */
  sleep: (ms: number, signal: AbortSignal) => Promise<void>;
  /** Receives one line per round that did something. */
  log: (line: string) => void;
}

async function interruptibleSleep(ms: number, signal: AbortSignal): Promise<void> {
  try {
    await delay(ms, undefined, { signal });
  } catch {
    // Aborted: that is the way out of the wait, not a failure.
  }
}

/**
 * Rounds until `signal` aborts. The signal is only looked at between rounds, so a round already running finishes (and
 * its status is written) before the loop stops. The interval comes from each round, hence a changed config applies
 * at the next wait.
 */
export async function syncLoop(folder: string, signal: AbortSignal, deps: Partial<LoopDeps> = {}): Promise<void> {
  const now = deps.now ?? (() => new Date());
  const sleep = deps.sleep ?? interruptibleSleep;
  const log = deps.log ?? (() => {});
  while (!signal.aborted) {
    let seconds = DEFAULT_INTERVAL_SECONDS;
    try {
      const result = await syncOnce(folder, deps);
      seconds = result.intervalSeconds;
      const last = result.status?.lastCommit;
      if (result.committed && last) log(`${now().toISOString()} Committed ${last.sha}: ${last.modules.join(", ") || "no Module data"}`);
      else if (result.problem) log(`${now().toISOString()} ${result.message ?? result.problem}`);
    } catch (error) {
      // An unexpected git failure must not end a backup that runs for days: say it and try again next round.
      log(`${now().toISOString()} Round failed: ${(error as Error).message}`);
    }
    if (signal.aborted) return;
    await sleep(seconds * 1000, signal);
  }
}

/** What `syncCommand` accepts besides the round's: the loop's and the lock's, and the signal that stops it. */
export interface SyncCommandDeps extends LoopDeps {
  /** Stops the continuous mode; by default Ctrl+C (SIGINT) and SIGTERM do. */
  signal: AbortSignal;
  lock: Partial<LockDeps>;
}

/**
 * `tessello sync [--once] [folder]`: one round with `--once`, otherwise rounds in the foreground until Ctrl+C.
 * 0 when it ran (once: without problem), 1 on a problem or when another instance holds the folder (message on err),
 * 2 on a usage error.
 */
export async function syncCommand(args: string[], output: Output, deps: Partial<SyncCommandDeps> = {}): Promise<number> {
  const once = args.includes("--once");
  const rest = args.filter((arg) => arg !== "--once");
  if (rest.length > 1 || rest.some((arg) => arg.startsWith("-"))) {
    output.err(USAGE);
    return 2;
  }
  const root = resolve(rest[0] ?? process.cwd());

  // Checked before the lock, which lives in `.tessello/`: a wrong folder must not get one created.
  if (!(await readRegistry(root))) {
    output.err(notAModulesFolder(root));
    return 1;
  }

  const lock = await acquireLock(root, deps.lock);
  if (!lock.acquired) {
    output.err(`Another tessello sync (PID ${lock.pid}) is already running on "${root}".`);
    return 1;
  }
  try {
    if (once) {
      const result = await syncOnce(root, deps);
      if (result.problem) {
        output.err(result.message ?? `Sync failed: ${result.problem}.`);
        return 1;
      }
      const last = result.status?.lastCommit;
      output.out(result.committed && last ? `Committed ${last.sha}.` : "Nothing to commit.");
      return 0;
    }

    output.out(`Syncing "${root}" round after round. Press Ctrl+C to stop.`);
    const controller = new AbortController();
    const stop = () => controller.abort();
    const external = deps.signal;
    if (external) {
      if (external.aborted) stop();
      else external.addEventListener("abort", stop, { once: true });
    } else {
      process.once("SIGINT", stop);
      process.once("SIGTERM", stop);
    }
    try {
      await syncLoop(root, controller.signal, { ...deps, log: deps.log ?? output.out });
    } finally {
      external?.removeEventListener("abort", stop);
      process.off("SIGINT", stop);
      process.off("SIGTERM", stop);
    }
    return 0;
  } finally {
    await lock.release();
  }
}

/**
 * Whether a changed file (per `git status`) was modified within the quiet period. The difference is absolute on purpose:
 * a file dated in the future (clock skew, copied file) must not block commits forever. Deleted files have no date, and
 * `.gitignore` is skipped when the command rewrote its section in this very round (a User's edit alone still waits).
 */
async function hasRecentChange(git: string, root: string, now: Date, wroteGitignore: boolean): Promise<boolean> {
  const entries = (await runGit(git, ["status", "--porcelain", "-z", "--untracked-files=all"], root)).stdout.split("\0").filter(Boolean);
  for (let i = 0; i < entries.length; i++) {
    const entry = entries[i]!;
    // A rename or copy is followed by its original path as its own entry: not a changed file, skip it.
    if (entry[0] === "R" || entry[0] === "C" || entry[1] === "R" || entry[1] === "C") i++;
    const path = entry.slice(3);
    if (path === ".gitignore" && wroteGitignore) continue;
    try {
      if (Math.abs(now.getTime() - (await stat(join(root, path))).mtimeMs) < QUIET_MS) return true;
    } catch {
      // Deleted: nothing to wait for.
    }
  }
  return false;
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
    // The lock and the stale lock a takeover moves aside for an instant.
    "/.tessello/sync.lock*",
    "*.crswap",
    ".DS_Store",
    "*.tessello-sync-tmp",
    ...ownRepositories.map((name) => `/${name}/`),
  ];
}

/** The section of `.gitignore` this command owns; the User's lines around it are left byte for byte. True when the file was rewritten. */
async function writeGitignore(root: string, rules: string[]): Promise<boolean> {
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
  if (next === current) return false;
  await writeFile(path, next);
  return true;
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
