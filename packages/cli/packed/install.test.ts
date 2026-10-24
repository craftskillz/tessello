// The published packages as a Creator gets them: built, packed by npm, installed in a folder outside this repository.
// Nothing is published. Run with `npm run test:packed` (it needs npm and, the first time, the registry for fflate and marked).

import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdir, mkdtemp, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { after, before, describe, test } from "node:test";
import { promisify } from "node:util";
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

  test("their type declarations are found by TypeScript", async () => {
    const source = `
      import { connect, type ConnectedModule } from "@tessello/sdk";
      import { validateZip, type ValidationReport } from "@tessello/convention";
      import { parseEntry } from "@tessello/marketplace";
      const host: Promise<ConnectedModule> = connect();
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
