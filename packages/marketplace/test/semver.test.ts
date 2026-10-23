import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { compareVersions } from "../src/index.ts";

describe("compareVersions", () => {
  test("compares major, minor and patch numerically", () => {
    assert.ok(compareVersions("1.0.0", "2.0.0") < 0);
    assert.ok(compareVersions("1.10.0", "1.9.0") > 0);
    assert.ok(compareVersions("1.2.3", "1.2.10") < 0);
    assert.equal(compareVersions("1.2.3", "1.2.3"), 0);
  });

  test("ranks a pre-release below its release", () => {
    assert.ok(compareVersions("1.0.0-alpha", "1.0.0") < 0);
    assert.ok(compareVersions("1.0.0", "1.0.0-rc.1") > 0);
    assert.ok(compareVersions("1.0.0-beta", "1.1.0-alpha") < 0);
  });

  test("orders pre-release identifiers: numbers numerically, then below words, shorter sets first", () => {
    const ascending = ["1.0.0-alpha", "1.0.0-alpha.1", "1.0.0-alpha.beta", "1.0.0-beta", "1.0.0-beta.2", "1.0.0-beta.11", "1.0.0-rc.1", "1.0.0"];
    for (let i = 0; i < ascending.length - 1; i++) {
      assert.ok(compareVersions(ascending[i] as string, ascending[i + 1] as string) < 0, `${ascending[i]} < ${ascending[i + 1]}`);
      assert.ok(compareVersions(ascending[i + 1] as string, ascending[i] as string) > 0);
    }
    assert.equal(compareVersions("1.0.0-alpha.1", "1.0.0-alpha.1"), 0);
  });

  test("keeps hyphens inside pre-release identifiers", () => {
    assert.ok(compareVersions("1.0.0-alpha-1", "1.0.0-alpha-2") < 0);
  });
});
