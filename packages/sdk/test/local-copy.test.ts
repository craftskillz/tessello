import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import { buildLocalCopy, LOCAL_COPIES } from "../scripts/build-local-copy.ts";

test("every example Module ships the current SDK as its local copy (run `npm run build:sdk` after changing the SDK)", async () => {
  const expected = await buildLocalCopy();
  for (const path of LOCAL_COPIES) {
    assert.equal(await readFile(path, "utf8"), expected, path);
  }
});
