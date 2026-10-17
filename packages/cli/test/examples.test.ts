import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
import { test } from "node:test";
import { run } from "../src/cli.ts";

const example = (name: string) => fileURLToPath(new URL(`../../../examples/${name}`, import.meta.url));

for (const name of ["notes"]) {
  test(`the example Module "${name}" passes the Validator without error or warning`, async () => {
    const out: string[] = [];
    const code = await run(["validate", example(name)], { out: (text) => out.push(text), err: (text) => out.push(text) });
    assert.equal(code, 0, out.join("\n"));
    assert.match(out.join("\n"), /✓ 0 warnings: this Module is installable\./);
  });
}
