// `tessello release <bump>`: a new version of the Module of the current folder, from its checks to its listing on the
// Marketplace. `tessello publish` with no package lists the version already published. Both are what the `just publish`
// and `just marketplace` recipes of a Module run, so that a fix to them reaches every Module with a new version of this CLI.

import { spawn } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createInterface } from "node:readline/promises";
import { parseArgs } from "node:util";
import { MARKETPLACE } from "./listing.ts";
import type { GhResult } from "./publish-command.ts";

export const RELEASE_USAGE = `Usage: tessello release <major|minor|patch|fix> [--no-list]

In a Module's repository, on an up-to-date main with everything committed: installs the locked dependencies,
runs the checks, raises the version in package.json, package-lock.json and manifest.json, commits, tags
v<version> and pushes, waits for the Release workflow, then offers to list the version on the Marketplace.

Options:
  --no-list   Stop once the version is published; list it later with \`tessello publish\`.`;

const BUMPS = { major: "major", minor: "minor", patch: "patch", fix: "patch" } as const;

/** The release workflow is looked for this many times, this long apart, after the tag is pushed: a minute in all. */
const WORKFLOW_TRIES = 30;
const WORKFLOW_WAIT_MS = 2000;
/** A running workflow is looked at again this long after: they take a minute or two. */
const WATCH_WAIT_MS = 5000;
/** GitHub Pages serves a new file a minute or so after the workflow: it is tried this many times, this long apart. */
const PAGES_TRIES = 60;
const PAGES_WAIT_MS = 5000;

export interface Output {
  out(text: string): void;
  err(text: string): void;
}

export interface ReleaseDeps {
  /** The Module's repository. */
  cwd: string;
  /** Runs a program in cwd and returns its exit code and its output, never through a shell. */
  run(file: string, args: string[]): Promise<GhResult>;
  /** Asks the person at the terminal; resolves with "" when nobody can answer. */
  ask(question: string): Promise<string>;
  /** Fetches the published package. */
  fetch(url: string): Promise<{ ok: boolean; bytes(): Promise<Uint8Array> }>;
  /** Runs `tessello publish` with these arguments; resolves with its exit code. */
  publish(args: string[]): Promise<number>;
  /** Validates a Module folder; resolves with the report to print and whether it is installable. */
  validate(folder: string): Promise<{ valid: boolean; text: string }>;
  wait(ms: number): Promise<void>;
  /** Milliseconds, to say how long a step took. */
  now(): number;
}

/** Thrown by a step that failed, after it said why. */
class Stop extends Error {}

/** Releases a new version. Exit code: 0 done, 1 a step failed, 2 usage error. */
export async function releaseCommand(args: string[], output: Output, deps: ReleaseDeps): Promise<number> {
  let parsed;
  try {
    parsed = parseArgs({ args, allowPositionals: true, options: { "no-list": { type: "boolean" } } });
  } catch (e) {
    output.err(`${(e as Error).message}\n\n${RELEASE_USAGE}`);
    return 2;
  }
  const bump = parsed.positionals[0];
  if (parsed.positionals.length !== 1 || !(bump! in BUMPS)) {
    output.err(RELEASE_USAGE);
    return 2;
  }
  try {
    const version = await release(BUMPS[bump as keyof typeof BUMPS], output, deps);
    if (parsed.values["no-list"]) {
      output.out(`Not listed. Run \`tessello publish\` (\`just marketplace\`) when you are ready.`);
      return 0;
    }
    return await listPublished([], output, deps, version);
  } catch (e) {
    if (e instanceof Stop) return 1;
    throw e;
  }
}

async function release(bump: string, output: Output, deps: ReleaseDeps): Promise<string> {
  const fail = (message: string): never => {
    output.err(`✗ ${message}`);
    throw new Stop();
  };
  const git = (...args: string[]) => deps.run("git", args);
  /** Runs one step quietly, says how long it took, and shows its output when it fails. */
  const step = async (title: string, file: string, args: string[]): Promise<string> => {
    output.out(`→ ${title}…`);
    const started = deps.now();
    const result = await deps.run(file, args);
    if (result.code !== 0) {
      const said = `${result.stdout}${result.stderr}`.trim();
      if (said) output.err(said);
      fail(`${title} failed (${[file, ...args].join(" ")}).`);
    }
    output.out(`  ✓ ${seconds(deps.now() - started)}`);
    return result.stdout;
  };

  const scripts = (await readJson(join(deps.cwd, "package.json"), fail)).scripts ?? {};
  await readJson(join(deps.cwd, "manifest.json"), fail);
  const branch = await git("branch", "--show-current");
  if (branch.code !== 0) fail(`${deps.cwd} is not a git repository.`);
  if (branch.stdout.trim() !== "main") fail("Release from main.");
  if ((await git("status", "--porcelain")).stdout.trim() !== "") fail("Commit or stash your changes first.");

  await step("Pulling main", "git", ["pull", "--ff-only", "--quiet"]);
  // Exactly the locked dependencies, then the checks, before anything is tagged: a broken version is never published.
  await step("Installing the locked dependencies", "npm", ["ci", "--no-audit", "--no-fund"]);
  if (scripts.typecheck) await step("Type checking", "npm", ["run", "typecheck"]);
  if (scripts.test) await step("Unit tests", "npm", ["test"]);
  // The browser tests are the longest step: when the CI already ran them on this very commit, they are not run again.
  const browser = Boolean(scripts["test:browser"]);
  const passedInCi = browser && (await greenInCi(deps));
  if (passedInCi) output.out("→ Browser tests: already passed in the CI for this commit, not run again.");
  else if (browser) await step("Browser tests (they build the package first; the longest step)", "npm", ["run", "test:browser"]);
  if (scripts.build && (!browser || passedInCi)) await step("Building the package", "npm", ["run", "build"]);

  output.out("→ Validating the package…");
  const report = await deps.validate(join(deps.cwd, "dist"));
  if (!report.valid) {
    output.err(report.text);
    fail("The package in dist/ is not installable.");
  }

  // package.json and package-lock.json through npm, then the Manifest, so that all three keep the same version.
  const version = (await step("Raising the version", "npm", ["version", bump, "--no-git-tag-version"])).trim().replace(/^v/, "");
  const manifestPath = join(deps.cwd, "manifest.json");
  // Only the value of "version" changes, so that the rest of the Manifest keeps its layout.
  await writeFile(manifestPath, (await readFile(manifestPath, "utf8")).replace(/("version"\s*:\s*)"[^"]*"/, `$1"${version}"`));
  await step(`Committing "Release ${version}"`, "git", ["commit", "--quiet", "-am", `Release ${version}`]);
  await step(`Tagging v${version}`, "git", ["tag", `v${version}`]);
  await step("Pushing main and the tag", "git", ["push", "--quiet", "origin", "main", `v${version}`]);
  output.out(`v${version} pushed: the Release workflow publishes it on GitHub Pages.`);
  await watchReleaseWorkflow(version, output, deps, fail);
  return version;
}

/** Whether the CI workflow already passed for HEAD, pushed as it is. */
async function greenInCi(deps: ReleaseDeps): Promise<boolean> {
  const head = (await deps.run("git", ["rev-parse", "HEAD"])).stdout.trim();
  const upstream = (await deps.run("git", ["rev-parse", "origin/main"])).stdout.trim();
  if (!head || head !== upstream) return false;
  const runs = await deps.run("gh", ["run", "list", "--workflow", "ci.yml", "--commit", head, "--json", "conclusion", "--jq", ".[].conclusion"]);
  return runs.code === 0 && runs.stdout.split("\n").some((line) => line.trim() === "success");
}

async function watchReleaseWorkflow(version: string, output: Output, deps: ReleaseDeps, fail: (message: string) => never): Promise<void> {
  // The workflow starts a few seconds after the tag arrives.
  let id = "";
  for (let tries = 0; !id && tries < WORKFLOW_TRIES; tries++) {
    if (tries > 0) await deps.wait(WORKFLOW_WAIT_MS);
    const found = await deps.run("gh", ["run", "list", "--workflow", "release.yml", "--branch", `v${version}`, "--json", "databaseId", "--jq", ".[0].databaseId // empty"]);
    if (found.code === 0) id = found.stdout.trim();
  }
  if (!id) {
    output.out("The Release workflow could not be followed (is `gh` logged in?): see the Actions tab of the repository.");
    return;
  }
  output.out("→ Waiting for the Release workflow…");
  const started = deps.now();
  for (;;) {
    const state = await deps.run("gh", ["run", "view", id, "--json", "status,conclusion", "--jq", '.status + " " + .conclusion']);
    const [status, conclusion] = state.stdout.trim().split(" ");
    if (state.code === 0 && status === "completed") {
      if (conclusion !== "success") fail(`The Release workflow failed: see \`gh run view ${id} --log-failed\`.`);
      output.out(`  ✓ ${seconds(deps.now() - started)}`);
      return;
    }
    await deps.wait(WATCH_WAIT_MS);
  }
}

/**
 * `tessello publish` with no package: lists the version of manifest.json, downloaded from the GitHub Pages of the git remote
 * "origin" (the published bytes, never a local build: the listing pins their SHA-256). Without --accept-terms it asks.
 */
export async function listPublished(args: string[], output: Output, deps: ReleaseDeps, known?: string): Promise<number> {
  const marketplace = valueOf(args, "--marketplace") ?? MARKETPLACE;
  const terms = `https://github.com/${marketplace}/blob/main/PUBLISHING.md`;
  let version = known;
  if (!version) {
    try {
      version = String(JSON.parse(await readFile(join(deps.cwd, "manifest.json"), "utf8")).version ?? "");
    } catch {
      version = "";
    }
  }
  const origin = (await deps.run("git", ["remote", "get-url", "origin"])).stdout.trim();
  const slug = /^(?:git@github\.com:|https:\/\/github\.com\/)([A-Za-z0-9-]+)\/([A-Za-z0-9._-]+?)(?:\.git)?\/?$/.exec(origin);
  if (!version || !slug) {
    output.err("✗ Run it in a Module's repository (a manifest.json, a remote origin on GitHub), or give the package: tessello publish <package.zip> --url <URL> (see tessello publish --help).");
    return 2;
  }
  const url = `https://${slug[1]!.toLowerCase()}.github.io/${slug[2]}/${version}.zip`;

  if (!args.includes("--accept-terms")) {
    output.out(`Listing ${version} on the Marketplace means accepting its terms: ${terms}`);
    const answer = (await deps.ask("Have you read them, and do you accept them? [y/N] ")).trim().toLowerCase();
    if (answer !== "y" && answer !== "yes") {
      output.out("Not listed. Run `tessello publish` (`just marketplace`) when you are ready.");
      return 0;
    }
  }

  let zip: Uint8Array | null = null;
  for (let tries = 0; !zip && tries < PAGES_TRIES; tries++) {
    if (tries > 0) await deps.wait(PAGES_WAIT_MS);
    const response = await deps.fetch(url).catch(() => null);
    if (response?.ok) zip = await response.bytes();
  }
  if (!zip) {
    output.err(`✗ ${url} is not online: is the Release workflow of v${version} green?`);
    return 1;
  }
  const work = await mkdtemp(join(tmpdir(), "tessello-release-"));
  try {
    const file = join(work, `${version}.zip`);
    await writeFile(file, zip);
    return await deps.publish([file, "--url", url, ...args.filter((arg) => arg !== "--accept-terms"), "--accept-terms"]);
  } finally {
    await rm(work, { recursive: true, force: true });
  }
}

function valueOf(args: string[], option: string): string | undefined {
  const at = args.indexOf(option);
  if (at >= 0) return args[at + 1];
  return args.find((arg) => arg.startsWith(`${option}=`))?.slice(option.length + 1);
}

async function readJson(path: string, fail: (message: string) => never): Promise<Record<string, any>> {
  try {
    return JSON.parse(await readFile(path, "utf8"));
  } catch (e) {
    return fail(`Run it in a Module's repository: cannot read ${path} (${(e as Error).message}).`);
  }
}

const seconds = (ms: number) => (ms < 60_000 ? `${Math.round(ms / 1000)} s` : `${Math.floor(ms / 60_000)} min ${Math.round((ms % 60_000) / 1000)} s`);

/** Runs a program in `cwd`, its output captured (it is shown only when it fails), never through a shell. */
export function runQuiet(file: string, args: string[], cwd: string): Promise<GhResult> {
  return new Promise((done) => {
    const child = spawn(file, args, { cwd, stdio: ["ignore", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => (stdout += chunk));
    child.stderr.on("data", (chunk) => (stderr += chunk));
    child.on("error", (error) => done({ code: 127, stdout, stderr: `${stderr}${error.message}` }));
    child.on("close", (code) => done({ code: code ?? 1, stdout, stderr }));
  });
}

/** Asks on the terminal; "" when the input is not a terminal (nobody to answer). */
export async function askTerminal(question: string): Promise<string> {
  if (!process.stdin.isTTY) return "";
  const terminal = createInterface({ input: process.stdin, output: process.stdout });
  try {
    return await terminal.question(question);
  } finally {
    terminal.close();
  }
}
