// The published packages as a Creator gets them: built, packed by npm, installed in a folder outside this repository.
// Nothing is published. Run with `npm run test:packed` (it needs npm and, the first time, the registry for fflate and marked).

import assert from "node:assert/strict";
import { type ChildProcess, execFile, spawn } from "node:child_process";
import { mkdir, mkdtemp, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { after, before, describe, test } from "node:test";
import { promisify } from "node:util";
import { chooseFolder, dropFile, readFolder, registry, showLauncher, useHost, writeFolder, zipExample } from "../../host/e2e/browser.ts";
import { buildPackages, distOf, PUBLISHED } from "../../../scripts/build-packages.ts";

const exec = promisify(execFile);
const at = (path: string) => fileURLToPath(new URL(`../../../${path}`, import.meta.url));

let project: string;
const tarballs = new Map<string, string>();

before(async () => {
  await buildPackages();
  project = await mkdtemp(join(tmpdir(), "tessello-packed-"));
  for (const name of PUBLISHED) {
    const { stdout } = await exec("npm", ["pack", "--json", "--pack-destination", project, distOf(name)]);
    tarballs.set(name, join(project, JSON.parse(stdout)[0].filename));
  }
  await writeFile(join(project, "package.json"), JSON.stringify({ name: "a-creator", private: true, type: "module" }));
  await exec("npm", ["install", "--no-audit", "--no-fund", "--prefer-offline", ...tarballs.values()], { cwd: project });
});
after(() => rm(project, { recursive: true, force: true }));

// After the hook above, which builds the Host this one serves: this copy stands for the Host at its hosted address.
const hosted = useHost();

async function tessello(...args: string[]) {
  try {
    const { stdout } = await exec(join(project, "node_modules/.bin/tessello"), args, { cwd: project });
    return { code: 0, out: stdout };
  } catch (e) {
    const failure = e as { code: number; stdout: string; stderr: string };
    return { code: failure.code, out: failure.stdout + failure.stderr };
  }
}

describe("the packages as npm packs them", () => {
  test("hold JavaScript, never the TypeScript sources, the tests or the scripts", async () => {
    for (const [name, tarball] of tarballs) {
      const { stdout } = await exec("tar", ["-tzf", tarball]);
      const files = stdout.trim().split("\n").map((line) => line.replace(/^package\//, ""));
      assert.ok(files.includes("package.json") && files.includes("LICENSE") && files.includes("README.md"), name);
      for (const file of files) assert.doesNotMatch(file, /(?<!\.d)\.ts$|^(src|test|scripts)\//, `${name}: ${file}`);
    }
  });
});

describe("installed outside this repository", () => {
  test("`tessello validate` accepts an installable Module from another folder", async () => {
    const result = await tessello("validate", at("examples/notes"));
    assert.equal(result.code, 0, result.out);
    assert.match(result.out, /this Module is installable/);
  });

  test("`tessello validate` exits with 1 on a Module that is not installable", async () => {
    const broken = join(project, "broken");
    await mkdir(broken);
    await writeFile(join(broken, "manifest.json"), "{");
    const result = await tessello("validate", broken, "--json");
    assert.equal(result.code, 1, result.out);
    assert.equal(JSON.parse(result.out).valid, false);
  });

  test("the SDK, the Validator and the Marketplace are imported by their package names", async () => {
    const script = `
      import { connect, TesselloError } from "@tessello/sdk";
      import { validatePackage } from "@tessello/convention";
      import { verifyEntry, buildIndex } from "@tessello/marketplace";
      const report = validatePackage(new Map([["manifest.json", new TextEncoder().encode("{")]]));
      console.log([typeof connect, typeof TesselloError, typeof verifyEntry, typeof buildIndex, report.valid].join(" "));`;
    await writeFile(join(project, "imports.js"), script);
    const { stdout } = await exec(process.execPath, ["imports.js"], { cwd: project });
    assert.equal(stdout.trim(), "function function function function false");
  });

  test("the SDK's Test Host connects the SDK, with nothing installed but the SDK", async () => {
    const script = `
      import { connect } from "@tessello/sdk";
      import { createTestHost, until } from "@tessello/sdk/testing";
      const host = createTestHost({ storage: { notes: ["milk"] } });
      const view = await connect({ transport: host.mount({ surface: "view" }).transport });
      await view.storage.set("count", 1);
      console.log(JSON.stringify([await view.storage.get("notes"), await until(() => host.storage.get("count"))]));`;
    await writeFile(join(project, "testing.js"), script);
    const { stdout } = await exec(process.execPath, ["testing.js"], { cwd: project });
    assert.equal(stdout.trim(), '[["milk"],1]');
    const sdk = JSON.parse(await readFile(join(project, "node_modules/@tessello/sdk/package.json"), "utf8"));
    assert.equal(sdk.dependencies, undefined);
  });

  test("their type declarations are found by TypeScript", async () => {
    const source = `
      import { connect, type ConnectedModule } from "@tessello/sdk";
      import { validateZip, type ValidationReport } from "@tessello/convention";
      import { parseEntry } from "@tessello/marketplace";
      import { createTestHost, type TestHost } from "@tessello/sdk/testing";
      const testHost: TestHost = createTestHost({ theme: "dark" });
      const host: Promise<ConnectedModule> = connect({ transport: testHost.mount({ surface: "view" }).transport });
      const report: ValidationReport = validateZip(new Uint8Array());
      export { host, report, parseEntry };`;
    await writeFile(join(project, "types.ts"), source);
    const tsc = at("node_modules/typescript/bin/tsc");
    const options = ["--noEmit", "--strict", "--module", "nodenext", "--target", "es2022", "--lib", "es2022,dom"];
    await exec(process.execPath, [tsc, ...options, "types.ts"], { cwd: project });
  });

  test("the SDK's single file imports nothing, so a Module copies it as it is", async () => {
    const dir = join(project, "node_modules/@tessello/sdk");
    assert.ok((await readdir(dir)).includes("tessello-sdk.js"));
    const code = await readFile(join(dir, "tessello-sdk.js"), "utf8");
    assert.doesNotMatch(code, /^\s*import\b|\bimport\s*\(|\brequire\s*\(/m);
    assert.match(code, /export\s*\{[^}]*\bconnect\b/);
  });
});

/** A port nothing listens on now. */
const freePort = () =>
  new Promise<number>((resolve) => {
    const probe = createServer().listen(0, "127.0.0.1", () => {
      const { port } = probe.address() as { port: number };
      probe.close(() => resolve(port));
    });
  });

describe("`tessello serve`, installed outside this repository", () => {
  let serving: ChildProcess;
  let port: number;
  let address: string;

  before(async () => {
    port = await freePort();
    address = `http://127.0.0.1:${port}/`;
    serving = spawn(join(project, "node_modules/.bin/tessello"), ["serve", "--port", String(port)], { cwd: project });
    await new Promise<void>((resolve, reject) => {
      serving.stdout!.on("data", (data) => String(data).includes(address) && resolve());
      serving.once("exit", (code) => reject(new Error(`tessello serve exited with ${code}`)));
    });
  });
  after(() => void serving.kill());

  test("the package holds the Host, without its source map", async () => {
    const { stdout } = await exec("tar", ["-tzf", tarballs.get("cli")!]);
    for (const file of ["index.html", "main.js", "style.css", "sw.js", "_headers"]) assert.ok(stdout.includes(`package/host/${file}`), file);
    assert.doesNotMatch(stdout, /\.map$/m);
  });

  test("serves the Host with the headers Cloudflare gets", async () => {
    const page = await fetch(address);
    assert.equal(page.status, 200);
    assert.equal(page.headers.get("content-security-policy"), "frame-src 'none'");
    assert.equal((await fetch(`${address}sw.js`)).headers.get("cache-control"), "no-cache");
  });

  test("says so when the port is already in use, and exits with 1", async () => {
    const result = await tessello("serve", "--port", String(port));
    assert.equal(result.code, 1, result.out);
    assert.match(result.out, /already in use/);
  });

  test("with every outside domain blocked, finds the Modules of the folder, then opens once it has stopped", async () => {
    // The hosted address, where the User installed a Module.
    const hostedPage = await hosted.newPage();
    await dropFile(hostedPage, "Notes.zip", await zipExample("notes"));
    await hostedPage.getByRole("dialog", { name: "Install Notes?" }).getByRole("button", { name: "Accept and install" }).click();
    await hostedPage.locator("iframe[title='Notes']").waitFor();
    const { modules } = await registry(hostedPage);
    const files = await readFolder(hostedPage, "modules");

    // The same folder on disk, at the local address: browser tests get a private folder per address, so it is copied.
    const blocked: string[] = [];
    const page = await hosted.newPage({
      address,
      choose: false,
      prepare: async (page) => {
        await page.context().route("**/*", (route) => {
          if (route.request().url().startsWith(address)) return route.continue();
          blocked.push(route.request().url());
          return route.abort();
        });
      },
    });
    await writeFolder(page, "modules", files);
    await chooseFolder(page);

    assert.deepEqual((await registry(page)).modules, modules);
    await (await showLauncher(page)).getByRole("button", { name: "Notes" }).click();
    await page.locator("iframe[title='Notes']").waitFor();
    assert.equal(await page.getByRole("dialog", { name: "Install Notes?" }).count(), 0);
    assert.deepEqual(blocked.filter((url) => !url.startsWith("https://tessello-marketplace.pages.dev/")), []);

    await page.waitForFunction(() => navigator.serviceWorker?.controller);
    const stopped = new Promise((resolve) => serving.once("exit", resolve));
    serving.kill();
    await stopped;
    const reloaded = await page.reload();
    assert.equal(reloaded?.fromServiceWorker(), true);
    await (await showLauncher(page)).getByRole("button", { name: "Notes" }).click();
    await page.locator("iframe[title='Notes']").waitFor();
  });
});
