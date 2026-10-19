import assert from "node:assert/strict";
import { mkdtemp, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { after, test } from "node:test";
import { run } from "../src/cli.ts";

const at = (path: string) => fileURLToPath(new URL(`../../../${path}`, import.meta.url));

async function passesTheValidator(path: string) {
  const out: string[] = [];
  const code = await run(["validate", path], { out: (text) => out.push(text), err: (text) => out.push(text) });
  assert.equal(code, 0, out.join("\n"));
  assert.match(out.join("\n"), /✓ 0 warnings: this Module is installable\./);
}

for (const name of ["notes", "meteo"]) {
  test(`the example Module "${name}" passes the Validator without error or warning`, () => passesTheValidator(at(`examples/${name}`)));
}

// A sample Module is built from its sources: its `scripts/build.ts` exports `buildPackage(out)`, which writes the package.
const built = await mkdtemp(join(tmpdir(), "tessello-samples-"));
after(() => rm(built, { recursive: true, force: true }));

const samples = (await readdir(at("sample-modules"), { withFileTypes: true })).filter((entry) => entry.isDirectory());
for (const { name } of samples) {
  test(`the sample Module "${name}", once built, passes the Validator without error or warning`, async () => {
    const { buildPackage } = await import(at(`sample-modules/${name}/scripts/build.ts`));
    await passesTheValidator(await buildPackage(join(built, name)));
  });
}
