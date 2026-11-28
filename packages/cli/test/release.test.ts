import assert from "node:assert/strict";
import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { beforeEach, describe, test } from "node:test";
import type { GhResult } from "../src/publish-command.ts";
import { listPublished, releaseCommand, type ReleaseDeps } from "../src/release-command.ts";

const ok = (stdout = ""): GhResult => ({ code: 0, stdout, stderr: "" });
const failed = (stdout: string): GhResult => ({ code: 1, stdout, stderr: "" });

const MANIFEST = '{\n  "convention": 1,\n  "id": "@craftskillz/pomodoro",\n  "version": "1.0.0",\n  "name": "Pomodoro"\n}\n';
const SCRIPTS = { build: "vite build", test: "node --test", "test:browser": "npm run build && node --test e2e", typecheck: "tsc" };
const URL_1_1 = "https://craftskillz.github.io/tessello-pomodoro/1.1.0.zip";

type Script = Record<string, GhResult>;
/** Answers by the start of "file args…": first match in `script`, then a working repository on main whose CI has not run. */
function answers(script: Script): Script {
  const defaults: Script = {
    "git branch --show-current": ok("main\n"),
    "git status --porcelain": ok(""),
    "git rev-parse": ok("abc\n"),
    "git remote get-url origin": ok("git@github.com:craftskillz/tessello-pomodoro.git\n"),
    "gh run list --workflow ci.yml": ok(""),
    "gh run list --workflow release.yml": ok("42\n"),
    "gh run view 42": ok("completed success\n"),
    "npm version minor": ok("v1.1.0\n"),
    "": ok(),
  };
  return { ...script, ...Object.fromEntries(Object.entries(defaults).filter(([key]) => !(key in script))) };
}

let cwd = "";
let out: string[] = [];
let err: string[] = [];
let calls: string[] = [];
let published: string[][] = [];
let asked: string[] = [];
const output = { out: (t: string) => void out.push(t), err: (t: string) => void err.push(t) };

beforeEach(async () => {
  cwd = await mkdtemp(join(tmpdir(), "tessello-release-"));
  await writeFile(join(cwd, "package.json"), JSON.stringify({ name: "pomodoro", version: "1.0.0", scripts: SCRIPTS }));
  await writeFile(join(cwd, "manifest.json"), MANIFEST);
  out = [];
  err = [];
  calls = [];
  published = [];
  asked = [];
});

function deps(script: Script = {}, more: Partial<ReleaseDeps> = {}): ReleaseDeps {
  const all = answers(script);
  return {
    cwd,
    run: async (file, args) => {
      const line = [file, ...args].join(" ");
      calls.push(line);
      return all[Object.keys(all).find((key) => line.startsWith(key))!]!;
    },
    ask: async (question) => {
      asked.push(question);
      return "y";
    },
    fetch: async () => ({ ok: true, bytes: async () => new Uint8Array([1, 2, 3]) }),
    publish: async (args) => {
      published.push(args);
      return 0;
    },
    validate: async () => ({ valid: true, text: "" }),
    wait: async () => {},
    now: () => 0,
    ...more,
  };
}

/** The steps that ran, in order: the programs a release runs, without the questions it asks git and gh. */
const steps = () => calls.filter((line) => !/^(git (branch|status|rev-parse|remote)|gh )/.test(line));

describe("tessello release", () => {
  test("a bump other than major, minor, patch or fix is a usage error", async () => {
    assert.equal(await releaseCommand([], output, deps()), 2);
    assert.equal(await releaseCommand(["huge"], output, deps()), 2);
    assert.deepEqual(calls, []);
  });

  test("checks, raises the version in the three files, commits, tags, pushes, waits for the workflow, then lists it", async () => {
    assert.equal(await releaseCommand(["minor"], output, deps()), 0, err.join("\n"));
    assert.deepEqual(steps(), [
      "git pull --ff-only --quiet",
      "npm ci --no-audit --no-fund",
      "npm run typecheck",
      "npm test",
      "npm run test:browser",
      "npm version minor --no-git-tag-version",
      "git commit --quiet -am Release 1.1.0",
      "git tag v1.1.0",
      "git push --quiet origin main v1.1.0",
    ]);
    assert.equal(await readFile(join(cwd, "manifest.json"), "utf8"), MANIFEST.replace('"1.0.0"', '"1.1.0"'));
    for (const each of ["→ Pulling main…", "→ Unit tests…", "→ Waiting for the Release workflow…", "v1.1.0 pushed: the Release workflow publishes it on GitHub Pages."]) {
      assert.ok(out.includes(each), `"${each}" in ${JSON.stringify(out)}`);
    }
    assert.equal(asked.length, 1, "it asks for the terms");
    assert.equal(published.length, 1);
    const [file, ...rest] = published[0]!;
    assert.match(file!, /1\.1\.0\.zip$/);
    assert.deepEqual(rest, ["--url", URL_1_1, "--accept-terms"]);
  });

  test("fix is a patch; a Module without browser tests is built before it is validated", async () => {
    await writeFile(join(cwd, "package.json"), JSON.stringify({ scripts: { build: "x", test: "y" } }));
    assert.equal(await releaseCommand(["fix", "--no-list"], output, deps({ "npm version patch": ok("v1.0.1\n"), "gh run list --workflow release.yml": ok("42\n") })), 0, err.join("\n"));
    assert.deepEqual(steps().slice(0, 5), ["git pull --ff-only --quiet", "npm ci --no-audit --no-fund", "npm test", "npm run build", "npm version patch --no-git-tag-version"]);
    assert.equal(published.length, 0, "--no-list lists nothing");
  });

  test("the browser tests are not run again when the CI passed on this very commit, pushed", async () => {
    assert.equal(await releaseCommand(["minor", "--no-list"], output, deps({ "gh run list --workflow ci.yml": ok("success\n") })), 0, err.join("\n"));
    assert.ok(!steps().includes("npm run test:browser"));
    assert.ok(steps().includes("npm run build"));
    assert.ok(out.includes("→ Browser tests: already passed in the CI for this commit, not run again."));
  });

  test("a commit not pushed yet runs its browser tests here, whatever the CI said of another", async () => {
    const script = { "git rev-parse HEAD": ok("local\n"), "gh run list --workflow ci.yml": ok("success\n") };
    assert.equal(await releaseCommand(["minor", "--no-list"], output, deps(script)), 0, err.join("\n"));
    assert.ok(steps().includes("npm run test:browser"));
  });

  test("outside main, or with changes to commit, nothing runs", async () => {
    assert.equal(await releaseCommand(["minor"], output, deps({ "git branch --show-current": ok("feature\n") })), 1);
    assert.deepEqual(err, ["✗ Release from main."]);
    err = [];
    assert.equal(await releaseCommand(["minor"], output, deps({ "git status --porcelain": ok(" M a.ts\n") })), 1);
    assert.deepEqual(err, ["✗ Commit or stash your changes first."]);
    assert.deepEqual(steps(), []);
  });

  test("a failing check shows what it wrote and stops before the version is raised", async () => {
    assert.equal(await releaseCommand(["minor"], output, deps({ "npm test": failed("✖ the timer counts down\n") })), 1);
    assert.deepEqual(err, ["✖ the timer counts down", "✗ Unit tests failed (npm test)."]);
    assert.ok(!steps().some((line) => line.startsWith("npm version")));
    assert.equal(await readFile(join(cwd, "manifest.json"), "utf8"), MANIFEST);
  });

  test("a package that is not installable stops before the version is raised", async () => {
    const code = await releaseCommand(["minor"], output, deps({}, { validate: async () => ({ valid: false, text: "✗ manifest.json: icon is missing" }) }));
    assert.equal(code, 1);
    assert.deepEqual(err, ["✗ manifest.json: icon is missing", "✗ The package in dist/ is not installable."]);
    assert.ok(!steps().some((line) => line.startsWith("npm version")));
  });

  test("a failed Release workflow is said, and nothing is listed", async () => {
    assert.equal(await releaseCommand(["minor"], output, deps({ "gh run view 42": ok("completed failure\n") })), 1);
    assert.deepEqual(err, ["✗ The Release workflow failed: see `gh run view 42 --log-failed`."]);
    assert.equal(published.length, 0);
  });
});

describe("tessello publish, without a package", () => {
  test("lists the version of manifest.json from the GitHub Pages of origin, once the terms are accepted", async () => {
    assert.equal(await listPublished(["--dry-run"], output, deps()), 0);
    assert.match(out[0]!, /^Listing 1\.0\.0 on the Marketplace means accepting its terms: https:\/\/github\.com\/craftskillz\/tessello-marketplace\/blob\/main\/PUBLISHING\.md$/);
    assert.deepEqual(published[0]!.slice(1), ["--url", "https://craftskillz.github.io/tessello-pomodoro/1.0.0.zip", "--dry-run", "--accept-terms"]);
  });

  test("with --accept-terms it does not ask; without a yes it lists nothing", async () => {
    await listPublished(["--accept-terms"], output, deps());
    assert.deepEqual(asked, []);
    assert.equal(published.length, 1);
    published = [];
    assert.equal(await listPublished([], output, deps({}, { ask: async () => "" })), 0);
    assert.equal(published.length, 0);
    assert.equal(out.at(-1), "Not listed. Run `tessello publish` (`just marketplace`) when you are ready.");
  });

  test("waits for GitHub Pages to serve the package, and says so when it never does", async () => {
    let tries = 0;
    const late = { fetch: async () => ({ ok: ++tries > 3, bytes: async () => new Uint8Array([1]) }) };
    assert.equal(await listPublished(["--accept-terms"], output, deps({}, late)), 0);
    assert.equal(tries, 4);
    const never = { fetch: async () => ({ ok: false, bytes: async () => new Uint8Array() }) };
    assert.equal(await listPublished(["--accept-terms"], output, deps({}, never)), 1);
    assert.deepEqual(err, ["✗ https://craftskillz.github.io/tessello-pomodoro/1.0.0.zip is not online: is the Release workflow of v1.0.0 green?"]);
  });

  test("a remote origin that is not on GitHub is a usage error", async () => {
    assert.equal(await listPublished([], output, deps({ "git remote get-url origin": ok("https://gitlab.com/a/b.git\n") })), 2);
    assert.equal(published.length, 0);
  });
});
