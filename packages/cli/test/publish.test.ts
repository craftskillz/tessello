import assert from "node:assert/strict";
import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, before, beforeEach, describe, test } from "node:test";
import { MARKETPLACE, TERMS } from "../src/listing.ts";
import { publishCommand, type Gh, type GhResult, type PublishDeps } from "../src/publish-command.ts";
import { CORS, githubServer, URL_1, zipOf } from "./github-server.ts";

const gh = githubServer();
before(() => gh.start());
after(() => gh.stop());
beforeEach(() => gh.reset());

const ok = (stdout = ""): GhResult => ({ code: 0, stdout, stderr: "" });
const failed = (stderr: string): GhResult => ({ code: 1, stdout: "", stderr });
const NO_REMOTE = async () => failed("fatal: No such remote 'origin'");

type Script = Record<string, GhResult | ((args: string[]) => GhResult)>;
/** A fake gh: answers by the start of the joined arguments, first match in the script, and records every call. */
function fakeGh(script: Script): { gh: Gh; calls: string[][] } {
  const calls: string[][] = [];
  return {
    calls,
    gh: async (args) => {
      calls.push(args);
      const line = args.join(" ");
      const key = Object.keys(script).find((k) => line.startsWith(k));
      const answer = key === undefined ? failed(`unexpected gh call: ${line}`) : script[key]!;
      return typeof answer === "function" ? answer(args) : answer;
    },
  };
}

const PR_URL = "https://github.com/craftskillz/tessello-marketplace/pull/12";
/** A gh where everything works; `push` says whether the account can push to the Marketplace. `more` comes first. */
function workingGh(push: boolean, more: Script = {}) {
  const defaults: Script = {
    "api user": ok(JSON.stringify({ login: "jane", id: 7 })),
    [`api repos/${MARKETPLACE} --jq`]: ok(push ? "true\n" : "false\n"),
    "repo fork": ok(),
    "repo sync": ok(),
    "api repos/": ok("abc123\n"),
    "api -X POST": ok(),
    "api -X PUT": ok(),
    "pr create": ok(`${PR_URL}\n`),
  };
  return fakeGh({ ...more, ...Object.fromEntries(Object.entries(defaults).filter(([k]) => !(k in more))) });
}

let cwd = "";
let out: string[] = [];
let err: string[] = [];
const output = { out: (t: string) => void out.push(t), err: (t: string) => void err.push(t) };
beforeEach(async () => {
  cwd = await mkdtemp(join(tmpdir(), "tessello-publish-"));
  out = [];
  err = [];
});

function deps(more: Partial<PublishDeps> = {}): PublishDeps {
  return { gh: null, github: gh.access(), cwd, git: NO_REMOTE, ...more };
}
async function zipFile(zip = zipOf(), name = "weather.zip"): Promise<string> {
  await writeFile(join(cwd, name), zip);
  return name;
}
const BASE = ["--url", URL_1, "--source", "https://github.com/jane/weather", "--accept-terms"];

describe("tessello publish", () => {
  test("without --accept-terms it says where to read the terms and does nothing else", async () => {
    const zip = await zipFile();
    const fake = workingGh(true);
    const code = await publishCommand([zip, "--url", URL_1], output, deps({ gh: fake.gh }));
    assert.equal(code, 2);
    assert.match(err.join("\n"), new RegExp(`https://github.com/${MARKETPLACE}/blob/main/PUBLISHING.md`));
    assert.match(err.join("\n"), /--accept-terms/);
    assert.deepEqual(fake.calls, []);
    assert.deepEqual(gh.requests, []);
  });

  test("usage errors print the usage and exit 2", async () => {
    for (const args of [[], ["weather.zip"], ["--url", URL_1], ["weather.zip", "--url", URL_1, "--bogus"], ["a.zip", "b.zip", "--url", URL_1]]) {
      err = [];
      assert.equal(await publishCommand(args, output, deps()), 2, args.join(" "));
      assert.match(err.join("\n"), /Usage: tessello publish/);
    }
  });

  test("an unreadable zip is a usage error", async () => {
    assert.equal(await publishCommand(["missing.zip", ...BASE], output, deps()), 2);
    assert.match(err.join("\n"), /Cannot read "missing\.zip"/);
  });

  test("a problem found by the listing check is printed and exits 1", async () => {
    const zip = await zipFile();
    gh.marketplace();
    gh.host(zipOf({ name: "Other" }));
    assert.equal(await publishCommand([zip, ...BASE], output, deps()), 1);
    assert.match(err.join("\n"), /^✗ .*serves other bytes/m);
  });

  test("without gh the listing is written and the steps by hand are printed", async () => {
    const zip = await zipFile();
    gh.marketplace();
    gh.host(zipOf());
    assert.equal(await publishCommand([zip, ...BASE], output, deps()), 0);
    const written = join(cwd, "tessello-listing", "modules", "jane", "weather", "entry.json");
    const entry = JSON.parse(await readFile(written, "utf8"));
    assert.equal(entry.id, "@jane/weather");
    const text = out.join("\n");
    assert.ok(text.includes(written));
    assert.match(text, /awaits the Maintainer's Approval/);
    assert.match(text, new RegExp(`fork ${MARKETPLACE}`));
    assert.match(text, /add that file at modules\/jane\/weather\/entry\.json/);
    assert.match(text, /open a pull request/);
    assert.match(text, /tick the box/);
  });

  test("--out chooses the folder", async () => {
    const zip = await zipFile();
    gh.marketplace();
    gh.host(zipOf());
    assert.equal(await publishCommand([zip, ...BASE, "--out", "elsewhere"], output, deps()), 0);
    assert.ok(JSON.parse(await readFile(join(cwd, "elsewhere", "modules", "jane", "weather", "entry.json"), "utf8")));
  });

  test("--dry-run with gh knows the author, writes the listing and opens nothing", async () => {
    const zip = await zipFile();
    gh.marketplace();
    gh.host(zipOf());
    const fake = workingGh(true);
    assert.equal(await publishCommand([zip, ...BASE, "--dry-run"], output, deps({ gh: fake.gh })), 0);
    assert.deepEqual(fake.calls, [["api", "user"]]);
    await readFile(join(cwd, "tessello-listing", "modules", "jane", "weather", "entry.json"), "utf8");
    assert.doesNotMatch(out.join("\n"), /by hand/);
  });

  test("an author who does not own the Namespace is refused", async () => {
    const zip = await zipFile();
    gh.marketplace();
    gh.host(zipOf());
    const fake = workingGh(true, { "api user": ok(JSON.stringify({ login: "mallory", id: 9 })) });
    assert.equal(await publishCommand([zip, ...BASE], output, deps({ gh: fake.gh })), 1);
    assert.match(err.join("\n"), /belongs to the GitHub account/);
  });

  const BRANCH = "publish/jane-weather-1.0.0";
  const PATH = "modules/jane/weather/entry.json";
  const noFileYet = (target: string): Script => ({ [`api repos/${target}/contents/${PATH}`]: failed("HTTP 404") });

  test("a Maintainer opens the pull request from a branch of the Marketplace itself", async () => {
    const zip = await zipFile();
    gh.marketplace();
    gh.host(zipOf());
    const fake = workingGh(true, noFileYet(MARKETPLACE));
    assert.equal(await publishCommand([zip, ...BASE], output, deps({ gh: fake.gh })), 0);
    const [user, push, ref, branch, file, put, pr] = fake.calls;
    assert.deepEqual(user, ["api", "user"]);
    assert.deepEqual(push, ["api", `repos/${MARKETPLACE}`, "--jq", ".permissions.push"]);
    assert.deepEqual(ref, ["api", `repos/${MARKETPLACE}/git/ref/heads/main`, "--jq", ".object.sha"]);
    assert.deepEqual(branch, ["api", "-X", "POST", `repos/${MARKETPLACE}/git/refs`, "-f", `ref=refs/heads/${BRANCH}`, "-f", "sha=abc123"]);
    assert.deepEqual(file, ["api", `repos/${MARKETPLACE}/contents/${PATH}?ref=${BRANCH}`, "--jq", ".sha"]);
    assert.equal(put?.slice(0, 4).join(" "), `api -X PUT repos/${MARKETPLACE}/contents/${PATH}`);
    assert.ok(put?.includes("message=@jane/weather 1.0.0"));
    assert.ok(put?.includes(`branch=${BRANCH}`));
    assert.ok(!put?.some((a) => a.startsWith("sha=")));
    const content = put?.find((a) => a.startsWith("content="))?.slice("content=".length) ?? "";
    assert.equal(JSON.parse(Buffer.from(content, "base64").toString("utf8")).id, "@jane/weather");
    await assert.rejects(readFile(join(cwd, "tessello-listing", PATH)), "nothing is written when the pull request is opened");
    assert.equal(fake.calls.length, 7);
    assert.ok(!fake.calls.some((c) => c[0] === "repo"), "no fork");
    assert.deepEqual(pr?.slice(0, 9), ["pr", "create", "--repo", MARKETPLACE, "--base", "main", "--head", BRANCH, "--title"]);
    assert.equal(pr?.[9], "@jane/weather 1.0.0");
    assert.match(out.join("\n"), new RegExp(PR_URL));
    assert.match(out.join("\n"), /Approval/);
  });

  test("a Creator forks, syncs and opens the pull request from login:branch", async () => {
    const zip = await zipFile();
    gh.marketplace();
    gh.host(zipOf());
    const fake = workingGh(false, noFileYet("jane/tessello-marketplace"));
    assert.equal(await publishCommand([zip, ...BASE], output, deps({ gh: fake.gh })), 0);
    const lines = fake.calls.map((c) => c.slice(0, 4).join(" "));
    assert.deepEqual(fake.calls[2], ["repo", "fork", MARKETPLACE, "--clone=false", "--default-branch-only"]);
    assert.deepEqual(fake.calls[3], ["repo", "sync", "jane/tessello-marketplace", "--source", MARKETPLACE, "--branch", "main"]);
    assert.deepEqual(fake.calls[4], ["api", "repos/jane/tessello-marketplace/git/ref/heads/main", "--jq", ".object.sha"]);
    assert.ok(lines.includes("api -X POST repos/jane/tessello-marketplace/git/refs"));
    const pr = fake.calls.at(-1)!;
    assert.equal(pr[pr.indexOf("--head") + 1], `jane:${BRANCH}`);
    assert.equal(pr[pr.indexOf("--repo") + 1], MARKETPLACE);
  });

  test("the pull request body names the Module and ticks the box", async () => {
    const zip = await zipFile();
    gh.marketplace();
    gh.host(zipOf());
    const fake = workingGh(true, noFileYet(MARKETPLACE));
    await publishCommand([zip, ...BASE], output, deps({ gh: fake.gh }));
    const pr = fake.calls.at(-1)!;
    const body = pr[pr.indexOf("--body") + 1]!;
    assert.match(body, /\*\*Module:\*\* `@jane\/weather`/);
    assert.match(body, /\*\*What this pull request does:\*\* a new Module/);
    assert.ok(body.includes(`- [x] ${TERMS}`));
    assert.match(body, /Opened with `tessello publish`\./);
  });

  test("a new version on an existing file passes the file's sha", async () => {
    const zip = await zipFile(zipOf({ version: "1.1.0" }));
    const url = "https://packages.test/weather-1.1.0.zip";
    gh.marketplace();
    gh.host(zipOf({ version: "1.1.0" }), CORS, "/host/weather-1.1.0.zip");
    gh.routes[`/repos/${MARKETPLACE}/contents/${PATH}?ref=main`] = { json: { id: "@jane/weather", source: "https://github.com/jane/weather", license: "MIT", versions: [{ version: "1.0.0", url: URL_1, sha256: "a".repeat(64) }] } };
    gh.routes[`/repos/${MARKETPLACE}/contents/modules/jane/weather?ref=main`] = { json: [{ type: "file", name: "entry.json", path: PATH }] };
    const fake = workingGh(true, { [`api repos/${MARKETPLACE}/contents/${PATH}?ref=`]: ok("filesha9\n") });
    assert.equal(await publishCommand([zip, "--url", url, "--accept-terms"], output, deps({ gh: fake.gh })), 0);
    const put = fake.calls.find((c) => c[2] === "PUT")!;
    assert.ok(put.includes("sha=filesha9"));
    const pr = fake.calls.at(-1)!;
    assert.match(pr[pr.indexOf("--body") + 1]!, /a new version \(1\.1\.0\)/);
    assert.equal(pr[pr.indexOf("--title") + 1], "@jane/weather 1.1.0");
    assert.match(out.join("\n"), /merged automatically once the CI passes/);
  });

  test("a rerun reuses the branch it created, updating the listing on it", async () => {
    const zip = await zipFile();
    gh.marketplace();
    gh.host(zipOf());
    const fake = workingGh(true, {
      "api -X POST": failed("gh: Reference already exists (HTTP 422)"),
      [`api repos/${MARKETPLACE}/contents/${PATH}?ref=${BRANCH}`]: ok("f00d\n"),
    });
    assert.equal(await publishCommand([zip, ...BASE], output, deps({ gh: fake.gh })), 0);
    const put = fake.calls.find((c) => c.includes("PUT"))!;
    assert.ok(put.includes("sha=f00d"));
    assert.ok(fake.calls.some((c) => c[0] === "pr"));
  });

  test("a pull request already open for the branch is shown, and the listing on it is updated", async () => {
    const zip = await zipFile();
    gh.marketplace();
    gh.host(zipOf());
    const fake = workingGh(true, {
      ...noFileYet(MARKETPLACE),
      "pr create": failed(`a pull request for branch "${BRANCH}" into branch "main" already exists:\n${PR_URL}`),
    });
    assert.equal(await publishCommand([zip, ...BASE], output, deps({ gh: fake.gh })), 0);
    assert.match(out.join("\n"), new RegExp(`already open: ${PR_URL}`));
  });

  test("a branch that cannot be created for another reason stops with exit 1 and keeps the listing", async () => {
    const zip = await zipFile();
    gh.marketplace();
    gh.host(zipOf());
    const fake = workingGh(true, { "api -X POST": failed("HTTP 403: Resource not accessible") });
    assert.equal(await publishCommand([zip, ...BASE], output, deps({ gh: fake.gh })), 1);
    assert.match(err.join("\n"), /HTTP 403/);
    assert.ok(await readFile(join(cwd, "tessello-listing", PATH), "utf8"));
    assert.ok(!fake.calls.some((c) => c[0] === "pr"));
  });

  test("a fork GitHub is still creating is synced again until it is ready", async () => {
    const zip = await zipFile();
    gh.marketplace();
    gh.host(zipOf());
    let syncs = 0;
    const waits: number[] = [];
    const fake = workingGh(false, { ...noFileYet("jane/tessello-marketplace"), "repo sync": () => (++syncs < 3 ? failed("HTTP 404: Not Found") : ok()) });
    assert.equal(await publishCommand([zip, ...BASE], output, deps({ gh: fake.gh, wait: async (ms) => void waits.push(ms) })), 0);
    assert.equal(syncs, 3);
    assert.equal(waits.length, 2);
  });

  test("a fork that never becomes ready stops with gh's message", async () => {
    const zip = await zipFile();
    gh.marketplace();
    gh.host(zipOf());
    const fake = workingGh(false, { "repo sync": failed("HTTP 404: Not Found") });
    assert.equal(await publishCommand([zip, ...BASE], output, deps({ gh: fake.gh, wait: async () => {} })), 1);
    assert.match(err.join("\n"), /Syncing jane\/tessello-marketplace with craftskillz\/tessello-marketplace failed: HTTP 404: Not Found/);
    assert.ok(!fake.calls.some((c) => c[0] === "pr"));
  });

  test("any other gh failure prints the step and gh's message, and keeps the listing", async () => {
    const zip = await zipFile();
    gh.marketplace();
    gh.host(zipOf());
    const fake = workingGh(false, { "repo fork": failed("HTTP 403: forbidden") });
    assert.equal(await publishCommand([zip, ...BASE], output, deps({ gh: fake.gh })), 1);
    assert.match(err.join("\n"), /Forking craftskillz\/tessello-marketplace failed: HTTP 403: forbidden/);
    assert.ok(await readFile(join(cwd, "tessello-listing", PATH), "utf8"));
  });

  test("the source defaults to the git remote, normalised from the ssh form", async () => {
    const zip = await zipFile();
    gh.marketplace();
    gh.host(zipOf());
    const asked: string[][] = [];
    const git = async (args: string[]) => (asked.push(args), ok("git@github.com:jane/weather.git\n"));
    assert.equal(await publishCommand([zip, "--url", URL_1, "--accept-terms"], output, deps({ git })), 0);
    assert.deepEqual(asked, [["remote", "get-url", "origin"]]);
    const entry = JSON.parse(await readFile(join(cwd, "tessello-listing", PATH), "utf8"));
    assert.equal(entry.source, "https://github.com/jane/weather");
  });

  test("an https remote with .git is normalised, and a non-GitHub remote is ignored", async () => {
    const zip = await zipFile();
    gh.marketplace();
    gh.host(zipOf());
    const git = async () => ok("https://github.com/jane/weather.git\n");
    assert.equal(await publishCommand([zip, "--url", URL_1, "--accept-terms"], output, deps({ git })), 0);
    err = [];
    const elsewhere = async () => ok("https://gitlab.com/jane/weather.git\n");
    assert.equal(await publishCommand([zip, "--url", URL_1, "--accept-terms"], output, deps({ git: elsewhere })), 1);
    assert.match(err.join("\n"), /--source/);
  });

  test("when gh cannot tell who is logged in, the listing is kept and the pull request is not opened", async () => {
    const zip = await zipFile();
    gh.marketplace();
    gh.host(zipOf());
    const fake = workingGh(true, { "api user": failed("HTTP 401") });
    assert.equal(await publishCommand([zip, ...BASE], output, deps({ gh: fake.gh })), 1);
    assert.match(err.join("\n"), /gh api user/);
    assert.ok(await readFile(join(cwd, "tessello-listing", PATH), "utf8"));
    assert.ok(!fake.calls.some((c) => c[0] === "pr"));
  });
});
