import assert from "node:assert/strict";
import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, test } from "node:test";
import { strToU8, zipSync } from "fflate";
import { run } from "../src/cli.ts";

const MANIFEST = {
  convention: 1,
  id: "@yassine/weather",
  name: "Weather",
  version: "1.0.0",
  icon: "icon.svg",
  view: { entry: "view/index.html" },
  guide: "guide.md",
};
const VIEW = `<script>parent.postMessage({ tessello: 1, type: "ready", id: "1" }, "*")</script>`;

async function moduleFolder(manifest: object = MANIFEST): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), "tessello-cli-"));
  await mkdir(join(dir, "view"));
  await writeFile(join(dir, "manifest.json"), JSON.stringify(manifest));
  await writeFile(join(dir, "icon.svg"), "<svg/>");
  await writeFile(join(dir, "view", "index.html"), VIEW);
  await writeFile(join(dir, "guide.md"), "# Weather");
  await writeFile(join(dir, ".DS_Store"), "junk");
  return dir;
}

async function cli(...args: string[]) {
  const out: string[] = [];
  const err: string[] = [];
  const code = await run(args, { out: (t) => out.push(t), err: (t) => err.push(t) });
  return { code, out: out.join("\n"), err: err.join("\n") };
}

describe("tessello validate", () => {
  test("valid folder exits 0", async () => {
    const result = await cli("validate", await moduleFolder());
    assert.equal(result.code, 0);
    assert.match(result.out, /@yassine\/weather 1\.0\.0/);
    assert.match(result.out, /✓ 0 warnings: this Module is installable\./);
  });

  test("invalid folder exits 1 and lists errors with their codes", async () => {
    const result = await cli("validate", await moduleFolder({ ...MANIFEST, widget: { entry: "view/index.html", size: "big" } }));
    assert.equal(result.code, 1);
    assert.match(result.out, /✗ .*"big"; expected "S", "M" or "L"\. \[manifest\/invalid-widget-size\]/);
    assert.match(result.out, /1 error, 0 warnings: this Module is not installable\./);
  });

  test("validates a .zip archive", async () => {
    const dir = await mkdtemp(join(tmpdir(), "tessello-cli-"));
    const zipPath = join(dir, "weather.zip");
    await writeFile(
      zipPath,
      zipSync({ "manifest.json": strToU8(JSON.stringify(MANIFEST)), "icon.svg": strToU8("<svg/>"), "view/index.html": strToU8(VIEW), "guide.md": strToU8("# Weather") }),
    );
    assert.equal((await cli("validate", zipPath)).code, 0);
  });

  test("--json prints the raw report", async () => {
    const result = await cli("validate", await moduleFolder(), "--json");
    assert.equal(JSON.parse(result.out).valid, true);
  });

  test("missing path is a usage error", async () => {
    const result = await cli("validate", join(tmpdir(), "does-not-exist-tessello"));
    assert.equal(result.code, 2);
    assert.match(result.err, /Cannot read/);
  });

  test("unknown command is a usage error", async () => {
    const result = await cli("frobnicate");
    assert.equal(result.code, 2);
    assert.match(result.err, /Unknown command "frobnicate"/);
  });
});

describe("tessello publish through run", () => {
  test("the help lists publish", async () => {
    assert.match((await cli("--help")).out, /publish <package\.zip> --url <URL>/);
  });

  test("publish without arguments is a usage error", async () => {
    const result = await cli("publish");
    assert.equal(result.code, 2);
    assert.match(result.err, /Usage: tessello publish/);
  });

  test("publish hands its dependencies over: without --accept-terms nothing is called", async () => {
    const out: string[] = [];
    const err: string[] = [];
    const gh = async () => assert.fail("gh must not be called");
    const code = await run(["publish", "weather.zip", "--url", "https://example.test/w.zip"], { out: (t) => out.push(t), err: (t) => err.push(t) }, { gh, cwd: tmpdir() });
    assert.equal(code, 2);
    assert.match(err.join("\n"), /PUBLISHING\.md/);
  });
});
