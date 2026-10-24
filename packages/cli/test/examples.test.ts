import assert from "node:assert/strict";
import { readdir } from "node:fs/promises";
import { basename } from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "node:test";
import { run } from "../src/cli.ts";

const at = (path: string) => fileURLToPath(new URL(`../../../${path}`, import.meta.url));

async function passesTheValidator(path: string) {
  const out: string[] = [];
  const code = await run(["validate", path], { out: (text) => out.push(text), err: (text) => out.push(text) });
  assert.equal(code, 0, out.join("\n"));
  assert.match(out.join("\n"), /✓ 0 warnings: this Module is installable\./);
}

for (const name of ["notes", "meteo", "prometheus"]) {
  test(`the example Module "${name}" passes the Validator without error or warning`, () => passesTheValidator(at(`examples/${name}`)));
}

// The published Modules of @craftskillz, kept as zipped packages in the Host's browser-test fixtures.
const fixtures = (await readdir(at("packages/host/e2e/fixtures"))).filter((file) => file.endsWith(".zip"));
for (const file of fixtures) {
  const name = basename(file, ".zip");
  test(`the published Module "${name}" passes the Validator without error or warning`, () =>
    passesTheValidator(at(`packages/host/e2e/fixtures/${file}`)));
}
