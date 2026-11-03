import assert from "node:assert/strict";
import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { Server } from "node:http";
import { request } from "node:http";
import { createServer as createNetServer } from "node:net";
import { after, describe, test } from "node:test";
import { strToU8, zipSync } from "fflate";
import { run } from "../src/cli.ts";
import { DEFAULT_PORT } from "../src/serve-command.ts";

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

describe("tessello serve", () => {
  const servers: Server[] = [];
  after(() => servers.forEach((server) => server.close()));

  /** A built site inside a folder that also holds a file the site must never serve. */
  async function site(): Promise<string> {
    const parent = await mkdtemp(join(tmpdir(), "tessello-serve-"));
    const root = join(parent, "host");
    await mkdir(root);
    await writeFile(join(parent, "secret.txt"), "secret");
    await writeFile(join(root, "index.html"), "<h1>Host</h1>");
    await writeFile(join(root, "sw.js"), "");
    await writeFile(join(root, "_headers"), "/*\n  X-All: all\n\n/sw.js\n  Cache-Control: no-cache\n");
    return root;
  }

  async function serve(hostDir: string, ...args: string[]) {
    const out: string[] = [];
    const err: string[] = [];
    const code = await run(["serve", ...args], { out: (t) => out.push(t), err: (t) => err.push(t) }, {
      hostDir,
      onServing: (server) => servers.push(server),
    });
    return { code, out: out.join("\n"), err: err.join("\n"), url: /http:\/\/\S+\//.exec(out.join("\n"))?.[0] ?? "" };
  }

  /** The port of a server started on a free one by the test. */
  async function running(hostDir: string) {
    const free = await new Promise<number>((resolve) => {
      const probe = createNetServer().listen(0, "127.0.0.1", () => {
        const { port } = probe.address() as { port: number };
        probe.close(() => resolve(port));
      });
    });
    return { port: free, ...(await serve(hostDir, "--port", String(free))) };
  }

  /** The status of a request sent exactly as written, without the normalizing that `fetch` does. */
  const rawStatus = (url: string, path: string) =>
    new Promise<number>((resolve, reject) => {
      const { hostname, port } = new URL(url);
      request({ hostname, port, path }, (response) => {
        response.resume();
        resolve(response.statusCode!);
      }).on("error", reject).end();
    });

  test("keeps the same default port, which is part of the address the User's folder permission belongs to", () => {
    assert.equal(DEFAULT_PORT, 7355);
  });

  test("serves the site on 127.0.0.1 only, with the headers of its _headers file", async () => {
    const { code, url, port } = await running(await site());
    assert.equal(code, 0);
    assert.equal(url, `http://127.0.0.1:${port}/`);
    const page = await fetch(url);
    assert.equal(await page.text(), "<h1>Host</h1>");
    assert.equal(page.headers.get("x-all"), "all");
    assert.equal((await fetch(`${url}sw.js`)).headers.get("cache-control"), "no-cache");
    const address = servers.at(-1)!.address() as { address: string };
    assert.equal(address.address, "127.0.0.1");
  });

  test("redirects /index.html to /, as Cloudflare Pages does", async () => {
    const { url } = await running(await site());
    const response = await fetch(`${url}index.html`, { redirect: "manual" });
    assert.equal(response.status, 308);
    assert.equal(response.headers.get("location"), "/");
  });

  test("answers 404 for a missing file, _headers and anything outside the site", async () => {
    const { url } = await running(await site());
    assert.equal((await fetch(`${url}nothing.js`)).status, 404);
    assert.equal((await fetch(`${url}_headers`)).status, 404);
    for (const path of ["/../secret.txt", "/..%2fsecret.txt", "/%2e%2e/secret.txt"]) assert.equal(await rawStatus(url, path), 404, path);
  });

  test("a port already in use is an error that names it, exit 1, rather than another port", async () => {
    const root = await site();
    const { port } = await running(root);
    const result = await serve(root, "--port", String(port));
    assert.equal(result.code, 1);
    assert.match(result.err, new RegExp(`Port ${port} is already in use`));
  });

  test("wrong arguments are a usage error, exit 2", async () => {
    const root = await site();
    for (const args of [["--port"], ["--port", "abc"], ["--port", "0"], ["--port", "70000"], ["other"]]) {
      const result = await serve(root, ...args);
      assert.equal(result.code, 2, args.join(" "));
      assert.match(result.err, /Usage: tessello serve/);
    }
  });

  test("without the Host's files, it says so and exits with 1", async () => {
    const result = await serve(join(tmpdir(), "tessello-no-such-host"), "--port", "7356");
    assert.equal(result.code, 1);
    assert.match(result.err, /The Host's files are not in/);
  });
});
