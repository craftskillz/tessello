import { execFile } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { parseArgs } from "node:util";
import { MARKETPLACE, prepareListing, TERMS, type GitHubAccess, type Listing } from "./listing.ts";

export interface GhResult {
  code: number;
  stdout: string;
  stderr: string;
}
/** Runs gh with these arguments. */
export type Gh = (args: string[]) => Promise<GhResult>;
export interface PublishDeps {
  /** null when gh is not installed or not logged in. */
  gh: Gh | null;
  github: GitHubAccess;
  /** Where relative paths are read and the listing is written; also where `git remote get-url origin` runs. */
  cwd: string;
  /** Runs git in cwd; default execFile("git"). Tests can stub it. */
  git?: (args: string[]) => Promise<GhResult>;
  /** Waits this long between two tries; default setTimeout. Tests make it instant. */
  wait?: (ms: number) => Promise<void>;
}

export const PUBLISH_USAGE = `Usage: tessello publish <package.zip> --url <URL> [options]

Options:
  --url <URL>               Where you published this exact .zip (required).
  --source <repo URL>       https://github.com/<owner>/<repo>, for a new Module (default: the git remote "origin").
  --license <SPDX>          For a new Module (default: the license GitHub reports for the source).
  --tag <tag>               A tag for the listing; repeat it for several. Replaces the previous tags.
  --marketplace <owner/name> The Marketplace repository (default: ${MARKETPLACE}).
  --accept-terms            You have read PUBLISHING.md and accept its terms.
  --out <folder>            Where to write the listing when no pull request is opened (default: ./tessello-listing).
  --dry-run                 Check everything and write the listing, but open no pull request.`;

/** What happens to the pull request, from the decision of the same check as the CI. */
const NEXT: Record<Listing["decision"], string> = {
  approval: "a new Module, so the pull request awaits the Maintainer's Approval; it is listed once approved.",
  merge: "the pull request is merged automatically once the CI passes.",
  maintainer: "this change goes to the Maintainer, who merges it by hand.",
  refuse: "the CI would refuse this pull request.",
};

interface Output {
  out(text: string): void;
  err(text: string): void;
}

/** Prepares or updates a listing and opens the pull request. Exit code: 0 done, 1 refused or failed, 2 usage error. */
export async function publishCommand(args: string[], output: Output, deps: PublishDeps): Promise<number> {
  let parsed;
  try {
    parsed = parseArgs({
      args,
      allowPositionals: true,
      options: {
        url: { type: "string" },
        source: { type: "string" },
        license: { type: "string" },
        tag: { type: "string", multiple: true },
        marketplace: { type: "string" },
        "accept-terms": { type: "boolean" },
        out: { type: "string" },
        "dry-run": { type: "boolean" },
      },
    });
  } catch (e) {
    output.err(`${(e as Error).message}\n\n${PUBLISH_USAGE}`);
    return 2;
  }
  const { values, positionals } = parsed;
  if (positionals.length !== 1 || !values.url) {
    output.err(PUBLISH_USAGE);
    return 2;
  }
  const marketplace = values.marketplace ?? MARKETPLACE;
  if (!values["accept-terms"]) {
    output.err(`Publishing means accepting the terms: read https://github.com/${marketplace}/blob/main/PUBLISHING.md, then run this command again with --accept-terms (ticking the box in the pull request is your acceptance).`);
    return 2;
  }

  let zip: Uint8Array;
  try {
    zip = new Uint8Array(await readFile(resolve(deps.cwd, positionals[0]!)));
  } catch (e) {
    output.err(`Cannot read "${positionals[0]}": ${(e as Error).message}`);
    return 2;
  }

  const author = await authorOf(deps.gh);
  const prepared = await prepareListing({ zip, url: values.url, marketplace, author, github: deps.github, source: values.source ?? (await sourceFromGit(deps)), license: values.license, tags: values.tag });
  if (!prepared.ok) {
    for (const problem of prepared.problems) output.err(`✗ ${problem}`);
    return 1;
  }
  const { listing } = prepared;

  for (const note of listing.notes) output.out(`Note: ${note}`);
  output.out(`${listing.entry.id} ${listing.version}: ${NEXT[listing.decision]}`);

  const outFolder = resolve(deps.cwd, values.out ?? "tessello-listing");
  if (deps.gh && !values["dry-run"]) {
    return openPullRequest({ gh: deps.gh, marketplace, listing, author, output, save: () => writeListing(outFolder, listing), wait: deps.wait ?? ((ms) => new Promise((done) => setTimeout(done, ms))) });
  }

  const written = await writeListing(outFolder, listing);
  output.out(`Listing written to ${written}`);
  if (!deps.gh) {
    output.out(
      [
        "To publish it by hand:",
        `  1. fork ${marketplace} on GitHub;`,
        `  2. add that file at ${listing.path} in your fork;`,
        `  3. open a pull request to ${marketplace};`,
        "  4. tick the box saying you have read PUBLISHING.md and accept its terms.",
      ].join("\n"),
    );
  }
  return 0;
}

async function writeListing(folder: string, listing: Listing): Promise<string> {
  const file = join(folder, listing.path);
  await mkdir(dirname(file), { recursive: true });
  await writeFile(file, listing.json);
  return file;
}

/** The GitHub account gh is logged in with, or null without gh. */
async function authorOf(gh: Gh | null): Promise<{ login: string; id: number } | null> {
  if (!gh) return null;
  const result = await gh(["api", "user"]);
  if (result.code !== 0) return null;
  try {
    const { login, id } = JSON.parse(result.stdout);
    return typeof login === "string" && typeof id === "number" ? { login, id } : null;
  } catch {
    return null;
  }
}

interface Opening {
  gh: Gh;
  marketplace: string;
  listing: Listing;
  author: { login: string; id: number } | null;
  output: Output;
  /** Writes the listing to the out folder, so nothing is lost when a step fails. */
  save(): Promise<string>;
  wait(ms: number): Promise<void>;
}

/** A new fork is tried this many times, this long apart: 30 s in all. */
const FORK_TRIES = 10;
const FORK_WAIT_MS = 3000;

/** Opens the pull request through gh, only with `gh api`, `gh repo` and `gh pr`. */
async function openPullRequest(opening: Opening): Promise<number> {
  const { gh, marketplace, listing, author, output } = opening;
  const stop = async (step: string, result: GhResult): Promise<number> => {
    output.err(`✗ ${step} failed: ${result.stderr.trim() || result.stdout.trim() || `gh exited with ${result.code}`}`);
    output.err(`The listing was written to ${await opening.save()} so nothing is lost.`);
    return 1;
  };
  if (!author) return stop("Reading your GitHub account with `gh api user`", { code: 1, stdout: "", stderr: "run `gh auth login`, or use --dry-run" });
  const login = author.login;
  const repoName = marketplace.split("/")[1] ?? marketplace;

  const pushed = await gh(["api", `repos/${marketplace}`, "--jq", ".permissions.push"]);
  if (pushed.code !== 0) return stop("Reading your permissions on the Marketplace", pushed);
  const push = pushed.stdout.trim() === "true";
  const target = push ? marketplace : `${login}/${repoName}`;

  if (!push) {
    const fork = await gh(["repo", "fork", marketplace, "--clone=false", "--default-branch-only"]);
    if (fork.code !== 0) return stop(`Forking ${marketplace}`, fork);
    // GitHub creates a new fork in the background: it is synced again until it is ready.
    let sync = await gh(["repo", "sync", target, "--source", marketplace, "--branch", "main"]);
    for (let tries = 1; sync.code !== 0 && tries < FORK_TRIES; tries++) {
      await opening.wait(FORK_WAIT_MS);
      sync = await gh(["repo", "sync", target, "--source", marketplace, "--branch", "main"]);
    }
    if (sync.code !== 0) return stop(`Syncing ${target} with ${marketplace}`, sync);
  }

  const base = await gh(["api", `repos/${target}/git/ref/heads/main`, "--jq", ".object.sha"]);
  if (base.code !== 0) return stop(`Reading the main branch of ${target}`, base);

  const branch = `publish/${listing.folder.replace("/", "-")}-${listing.version}`;
  const created = await gh(["api", "-X", "POST", `repos/${target}/git/refs`, "-f", `ref=refs/heads/${branch}`, "-f", `sha=${base.stdout.trim()}`]);
  // The branch of an earlier run that stopped half-way is reused: the listing on it is updated.
  if (created.code !== 0 && !/already exists/i.test(created.stderr)) return stop(`Creating the branch ${branch} in ${target}`, created);

  const existing = await gh(["api", `repos/${target}/contents/${listing.path}?ref=${branch}`, "--jq", ".sha"]);
  const fileSha = existing.code === 0 ? existing.stdout.trim() : "";
  const title = `${listing.entry.id} ${listing.version}`;
  const put = await gh([
    "api", "-X", "PUT", `repos/${target}/contents/${listing.path}`,
    "-f", `message=${title}`,
    "-f", `content=${Buffer.from(listing.json).toString("base64")}`,
    "-f", `branch=${branch}`,
    ...(fileSha ? ["-f", `sha=${fileSha}`] : []),
  ]);
  if (put.code !== 0) return stop(`Adding ${listing.path} to ${target}`, put);

  const what = listing.change === "new-module" ? "a new Module" : `a new version (${listing.version})`;
  const body = [
    "<!-- One pull request changes one listing folder, modules/<namespace>/<name>/, and nothing else. -->",
    "",
    `**Module:** \`${listing.entry.id}\``,
    "",
    `**What this pull request does:** ${what}`,
    "",
    `- [x] ${TERMS}`,
    "",
    "Opened with `tessello publish`.",
  ].join("\n");
  const pr = await gh(["pr", "create", "--repo", marketplace, "--base", "main", "--head", push ? branch : `${login}:${branch}`, "--title", title, "--body", body]);
  const open = /already exists:\s*(\S+)/.exec(pr.stderr);
  if (pr.code !== 0 && open) output.out(`A pull request for this version is already open: ${open[1]}`);
  else if (pr.code !== 0) return stop("Opening the pull request", pr);
  else output.out(pr.stdout.trim());
  output.out(`Next: ${NEXT[listing.decision]}`);
  return 0;
}

/** The GitHub repository of the git remote "origin" in cwd, as https://github.com/<owner>/<repo>, or undefined. */
async function sourceFromGit(deps: PublishDeps): Promise<string | undefined> {
  const git = deps.git ?? ((args: string[]) => execCommand("git", args, deps.cwd));
  const result = await git(["remote", "get-url", "origin"]).catch(() => null);
  if (!result || result.code !== 0) return undefined;
  const match = /^(?:git@github\.com:|https:\/\/github\.com\/)([A-Za-z0-9-]+)\/([A-Za-z0-9._-]+?)(?:\.git)?\/?$/.exec(result.stdout.trim());
  return match ? `https://github.com/${match[1]}/${match[2]}` : undefined;
}

/** Runs a program with these arguments, never through a shell. Resolves with its exit code and output. */
export function execCommand(file: string, args: string[], cwd?: string): Promise<GhResult> {
  return new Promise((done) => {
    execFile(file, args, { cwd }, (error, stdout, stderr) => {
      done({ code: error ? (typeof error.code === "number" ? error.code : 1) : 0, stdout, stderr });
    });
  });
}
