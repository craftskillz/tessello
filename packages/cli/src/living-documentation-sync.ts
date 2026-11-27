import { existsSync } from "node:fs";
import { mkdir, readFile, realpath, rename, stat, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { basename, isAbsolute, join, relative, resolve, sep } from "node:path";
import { COMMIT_IDENTITY, QUIET_MS, runGit, shortened, type GitResult } from "./git.ts";

export type LivingDocumentationProblemKind = "not-found" | "not-a-repository" | "commit-failed";

/** What this command writes under the key `syncStatus`, for the Living Documentation Module to show. */
export interface LivingDocumentationStatus {
  heartbeat: string;
  /** By Project id; only the Projects found in a repository named in this round. */
  projects: Record<
    string,
    {
      repository: string;
      lastCommit?: { at: string; id: string; documents: string[] };
      problem?: { kind: LivingDocumentationProblemKind; message: string; since: string };
    }
  >;
}

export interface LivingDocumentationDeps {
  /** The git binary. */
  git: string;
  now: () => Date;
  /** What `~` stands for in a Project's location. */
  home: string;
}

/** What one round reports: a line per commit, and the message of each problem (what `--once` fails on). */
export interface LivingDocumentationResult {
  lines: string[];
  problems: string[];
}

// The channel with the Module is its storage (ADR 0020). The CLI cannot depend on the private host package, so these
// names are the ones the Host's `keyFileName` gives to the keys `sync` and `syncStatus`; a test checks that they agree.
export const STORAGE_DIR = [".tessello", "data", "@craftskillz", "living-documentation"];
const SYNC_FILE = "sync.json";
export const STATUS_FILE = "sync%53tatus.json";
// No `.json` at the end: the Host would take a half-written file for a key.
const STATUS_TMP = "sync.tessello-sync-tmp";
const MAX_SUBJECT = 100;

/** A Project the Module declared under the key `sync`. */
interface Entry {
  id: string;
  repository: string;
  /** Folder of the Project inside its repository ("" = the repository itself). Absent while the Module does not know it. */
  path?: string;
  location?: string;
}

/** A Project found in a repository, with its folder inside it ("" = the repository itself). */
interface Match {
  entry: Entry;
  path: string;
}

type Previous = LivingDocumentationStatus["projects"][string];
type Outcome =
  /** Nothing went wrong, whether or not a commit was made. */
  | { kind: "fine"; commit?: { id: string; changed: string[] } }
  /** The repository's git was busy: everything stays as it was. */
  | { kind: "kept" }
  | { kind: "problem"; problem: { kind: LivingDocumentationProblemKind; message: string } };

/**
 * One round over the repositories named with `--living-documentation`: commits each Project folder of the Living
 * Documentation Module found in them (and nothing else), then writes `syncStatus`. Never throws for the expected
 * problems: returns them. Never pushes, pulls, merges or forces.
 */
export async function syncLivingDocumentation(
  modulesRoot: string,
  repositories: string[],
  deps: Partial<LivingDocumentationDeps> = {},
): Promise<LivingDocumentationResult> {
  const git = deps.git ?? "git";
  const now = (deps.now ?? (() => new Date()))();
  const home = deps.home ?? homedir();
  const root = resolve(modulesRoot);
  const dir = join(root, ...STORAGE_DIR);

  const entries = await readEntries(dir);
  const previous = await readPrevious(dir);
  const result: LivingDocumentationResult = { lines: [], problems: [] };
  const status: LivingDocumentationStatus = { heartbeat: now.toISOString(), projects: {} };
  const taken = new Set<string>();

  for (const name of repositories) {
    const repository = resolve(name);
    const real = await realOf(repository);
    const matches: Match[] = [];
    for (const entry of entries.filter((e) => !taken.has(e.id))) {
      const match = await matchOf(entry, repository, real, home);
      if (match) matches.push(match);
    }
    for (const { entry } of matches) taken.add(entry.id);

    const fail = (message: string): Outcome => ({ kind: "problem", problem: { kind: !existsSync(repository) ? "not-found" : "not-a-repository", message } });
    let outcome: Outcome;
    if (!existsSync(repository)) outcome = fail(`Cannot sync ${name}: the folder does not exist.`);
    // Before the Projects: a folder that is no repository is worth saying whether or not a Project is in it.
    else if (!existsSync(join(repository, ".git"))) outcome = fail(`Cannot sync ${name}: it is not a git repository (no .git).`);
    else if (matches.length === 0) {
      result.problems.push(
        `Cannot sync ${name}: no Living Documentation Project is configured in this repository. In Living Documentation, open Project settings › Repository and connect this repository to the Project.`,
      );
      continue;
    } else outcome = await syncRepository(git, repository, matches, now);

    if (outcome.kind === "problem") result.problems.push(outcome.problem.message);
    if (outcome.kind === "fine" && outcome.commit) {
      const { id, changed } = outcome.commit;
      result.lines.push(`${now.toISOString()} Committed ${id} in ${name}: ${documentsOf(changed).join(", ") || `${changed.length} files`}`);
    }

    for (const { entry, path } of matches) {
      const before = previous[entry.id];
      const next: Previous = { repository };
      if (before?.lastCommit) next.lastCommit = before.lastCommit;
      if (outcome.kind === "kept" && before?.problem) next.problem = before.problem;
      if (outcome.kind === "problem") {
        const since = before?.problem?.kind === outcome.problem.kind ? before.problem.since : now.toISOString();
        next.problem = { ...outcome.problem, since };
      }
      if (outcome.kind === "fine" && outcome.commit) {
        const documents = documentsOf(outcome.commit.changed.filter((file) => inside(file, path)));
        if (outcome.commit.changed.some((file) => inside(file, path))) next.lastCommit = { at: now.toISOString(), id: outcome.commit.id, documents };
      }
      status.projects[entry.id] = next;
    }
  }

  await writeStatus(dir, status);
  return result;
}

/** The Project's folder inside `repository`, or null when this repository is not its one. */
async function matchOf(entry: Entry, repository: string, real: string, home: string): Promise<Match | null> {
  if (entry.location) {
    const location = await realOf(resolve(entry.location === "~" || entry.location.startsWith("~/") ? join(home, entry.location.slice(1)) : entry.location));
    const path = relative(real, location);
    // `..foo` is a folder of the repository; only `..` itself, or `../…`, leaves it.
    if (path === "" || (path !== ".." && !path.startsWith(`..${sep}`) && !isAbsolute(path))) return { entry, path: path.split(sep).join("/") };
  }
  if (basename(repository) === entry.repository && typeof entry.path === "string" && existsSync(join(repository, entry.path))) {
    return { entry, path: entry.path };
  }
  return null;
}

/** The real path (symlinks followed, so `/tmp/x` and `/private/tmp/x` agree), or the path itself when it does not exist. */
const realOf = (path: string) => realpath(path).catch(() => path);

const inside = (file: string, path: string) => path === "" || file === path || file.startsWith(`${path}/`);
const documentsOf = (files: string[]) => files.filter((file) => /\.md$/i.test(file)).sort();

/** The commit of the Projects' folders of one repository, or why there is none. */
async function syncRepository(git: string, repository: string, matches: Match[], now: Date): Promise<Outcome> {
  // A Project folder named `docs[1]` or `:x` must match only itself, never as a glob or a pathspec magic.
  const run = (args: string[]) => runGit(git, ["--literal-pathspecs", ...args], repository);
  // Another git (the User's, an editor) is working: the next round will see what it leaves. `.git` is a file in a
  // worktree or a submodule, so git says where its lock is.
  const lock = (await run(["rev-parse", "--git-path", "index.lock"])).stdout.trim();
  if (lock && existsSync(resolve(repository, lock))) return { kind: "kept" };

  const paths = [...new Set(matches.map((m) => m.path))];
  const status = await run(["status", "--porcelain", "-z", "--untracked-files=all", "--", ...paths.map(pathspec)]);
  if (status.missing) return { kind: "problem", problem: { kind: "commit-failed", message: `Cannot run "${git}": install git to sync Living Documentation.` } };
  const entries = status.stdout.split("\0").filter(Boolean);
  const files: string[] = [];
  for (let i = 0; i < entries.length; i++) {
    const entry = entries[i]!;
    files.push(entry.slice(3));
    // A rename or copy is followed by its original path as its own entry.
    if (entry[0] === "R" || entry[0] === "C" || entry[1] === "R" || entry[1] === "C") files.push(entries[++i]!);
  }
  if (files.length === 0) return { kind: "fine" };

  // A file still being written would be committed half done: wait for the next round.
  for (const file of files) {
    try {
      if (Math.abs(now.getTime() - (await stat(join(repository, file))).mtimeMs) < QUIET_MS) return { kind: "fine" };
    } catch {
      // Deleted: nothing to wait for.
    }
  }

  // Only the folders that have changes: git refuses a pathspec that matches nothing it knows.
  const touched = paths.filter((path) => files.some((file) => inside(file, path)));
  const specs = touched.map(pathspec);
  const add = await run(["add", "-A", "--", ...specs]);
  if (add.code !== 0) return failed(repository, add);
  const changed = (await run(["diff", "--cached", "--no-renames", "--name-only", "-z", "--", ...specs])).stdout.split("\0").filter(Boolean);
  if (changed.length === 0) return { kind: "fine" };

  // Both are needed: with a name and no email (or the reverse) `git commit` fails.
  const configured = async (key: string) => (await run(["config", key])).stdout.trim() !== "";
  const identity = (await configured("user.email")) && (await configured("user.name")) ? [] : COMMIT_IDENTITY;
  // `--only`: what the developer staged elsewhere stays staged and out of this commit.
  const commit = await run([...identity, "commit", "--no-verify", "-m", subjectOf(changed), "--only", "--", ...specs]);
  if (commit.code !== 0) return failed(repository, commit, "commit");
  const id = (await run(["rev-parse", "--short", "HEAD"])).stdout.trim();
  return { kind: "fine", commit: { id, changed } };
}

const failed = (repository: string, result: GitResult, command = "add"): Outcome => ({
  kind: "problem",
  problem: { kind: "commit-failed", message: `git ${command} failed in ${repository}: ${shortened(result.stderr.trim() || result.stdout.trim())}` },
});

const pathspec = (path: string) => (path === "" ? "." : path);

/** The commit message: the Documents changed, cut with their count when the list is long. */
function subjectOf(changed: string[]): string {
  const documents = documentsOf(changed);
  if (documents.length === 0) return `Living Documentation: ${changed.length} files`;
  let subject = "Living Documentation:";
  let shown = 0;
  for (const document of documents) {
    const next = `${subject}${shown === 0 ? " " : ", "}${document}`;
    if (shown > 0 && next.length > MAX_SUBJECT) break;
    subject = next;
    shown++;
  }
  return shown < documents.length ? `${subject}, … (+${documents.length - shown} more)` : subject;
}

/** The Projects of the key `sync`; what is malformed is dropped. */
async function readEntries(dir: string): Promise<Entry[]> {
  const value = (await readKey(dir, SYNC_FILE, "sync")) as { projects?: unknown } | undefined;
  if (!Array.isArray(value?.projects)) return [];
  return value.projects.flatMap((p: any): Entry[] => {
    if (typeof p?.id !== "string" || typeof p?.repository !== "string") return [];
    const entry: Entry = { id: p.id, repository: p.repository };
    if (typeof p.path === "string") entry.path = p.path;
    if (typeof p.location === "string" && p.location !== "") entry.location = p.location;
    return [entry];
  });
}

async function readPrevious(dir: string): Promise<LivingDocumentationStatus["projects"]> {
  const value = (await readKey(dir, STATUS_FILE, "syncStatus")) as Partial<LivingDocumentationStatus> | undefined;
  return value?.projects && typeof value.projects === "object" ? value.projects : {};
}

/** The value stored under a key by the Host: `{ key, value }`, or undefined when absent, unreadable or another key. */
async function readKey(dir: string, file: string, key: string): Promise<unknown> {
  try {
    const parsed = JSON.parse(await readFile(join(dir, file), "utf8"));
    return parsed?.key === key ? parsed.value : undefined;
  } catch {
    return undefined;
  }
}

/** Written then renamed, so that the Host never reads half a file. */
async function writeStatus(dir: string, status: LivingDocumentationStatus): Promise<void> {
  await mkdir(dir, { recursive: true });
  await writeFile(join(dir, STATUS_TMP), JSON.stringify({ key: "syncStatus", value: status }, null, 2) + "\n");
  await rename(join(dir, STATUS_TMP), join(dir, STATUS_FILE));
}
