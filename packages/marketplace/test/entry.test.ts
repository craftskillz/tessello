import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { parseEntry } from "../src/index.ts";

const SHA = "a".repeat(64);

function version(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return { version: "1.0.0", url: "https://github.com/yassine/weather/releases/download/v1.0.0/weather.zip", sha256: SHA, ...overrides };
}

function entry(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: "@yassine/weather",
    source: "https://github.com/yassine/weather",
    license: "MIT",
    versions: [version()],
    ...overrides,
  };
}

const codes = (raw: unknown) => parseEntry(raw).issues.map((issue) => issue.code);

describe("a valid entry", () => {
  test("has no issue and is returned as a normalised copy", () => {
    const raw = entry({ tags: ["weather"], screenshots: ["a.png", "b.WEBP"] });
    const result = parseEntry(raw);
    assert.deepEqual(result.issues, []);
    assert.deepEqual(result.entry, {
      id: "@yassine/weather",
      source: "https://github.com/yassine/weather",
      license: "MIT",
      tags: ["weather"],
      screenshots: ["a.png", "b.WEBP"],
      versions: [version()],
    });
    assert.notEqual(result.entry, raw);
  });

  test("may be withdrawn or banned, at module and version level", () => {
    const result = parseEntry(entry({ withdrawn: true, versions: [version({ banned: "malware" }), version({ version: "1.1.0", withdrawn: true })] }));
    assert.deepEqual(result.issues, []);
    assert.equal(result.entry?.withdrawn, true);
    assert.equal(result.entry?.versions[0].banned, "malware");
    assert.equal(result.entry?.versions[1].withdrawn, true);
  });
});

describe("entry errors", () => {
  test("not an object", () => {
    for (const raw of [null, "x", 3, [], undefined]) {
      const result = parseEntry(raw);
      assert.deepEqual(result.issues.map((i) => i.code), ["entry/invalid-json"]);
      assert.equal(result.entry, null);
      assert.equal(result.issues[0].file, "entry.json");
    }
  });

  test("unknown fields, at top level and in a version", () => {
    assert.deepEqual(codes(entry({ name: "x" })), ["entry/unknown-field"]);
    const issues = parseEntry(entry({ versions: [version({ size: 3 })] })).issues;
    assert.deepEqual(issues.map((i) => i.code), ["entry/unknown-field"]);
    assert.equal(issues[0].version, "1.0.0");
    assert.match(issues[0].message, /"size"/);
  });

  test("missing required fields", () => {
    for (const name of ["id", "source", "license", "versions"]) {
      const raw = entry();
      delete raw[name];
      assert.deepEqual(codes(raw), ["entry/missing-field"], name);
    }
    for (const name of ["version", "url", "sha256"]) {
      const v = version();
      delete v[name];
      assert.deepEqual(codes(entry({ versions: [v] })), ["entry/missing-field"], name);
    }
  });

  test("wrong JSON types", () => {
    assert.deepEqual(codes(entry({ id: 3 })), ["entry/invalid-type"]);
    assert.deepEqual(codes(entry({ source: null })), ["entry/invalid-type"]);
    assert.deepEqual(codes(entry({ license: [] })), ["entry/invalid-type"]);
    assert.deepEqual(codes(entry({ tags: "a" })), ["entry/invalid-type"]);
    assert.deepEqual(codes(entry({ tags: [1] })), ["entry/invalid-type"]);
    assert.deepEqual(codes(entry({ screenshots: {} })), ["entry/invalid-type"]);
    assert.deepEqual(codes(entry({ versions: {} })), ["entry/invalid-type"]);
    assert.deepEqual(codes(entry({ versions: ["1.0.0"] })), ["entry/invalid-type"]);
    assert.deepEqual(codes(entry({ versions: [version({ url: 3 })] })), ["entry/invalid-type"]);
  });

  test("id must be a Module Identifier", () => {
    assert.deepEqual(codes(entry({ id: "weather" })), ["entry/invalid-id"]);
    assert.deepEqual(codes(entry({ id: "@Yassine/weather" })), ["entry/invalid-id"]);
  });

  test("source must be exactly a GitHub repository URL", () => {
    for (const source of [
      "http://github.com/a/b",
      "https://github.com/a/b/",
      "https://github.com/a/b.git",
      "https://github.com/a/b/tree/main",
      "https://github.com/a",
      "https://gitlab.com/a/b",
      "",
    ]) {
      assert.deepEqual(codes(entry({ source })), ["entry/invalid-source"], source);
    }
    assert.deepEqual(codes(entry({ source: "https://github.com/A-b1/my.repo_x-y" })), []);
  });

  test("license must not be empty", () => {
    assert.deepEqual(codes(entry({ license: "" })), ["entry/invalid-license"]);
  });

  test("tags: format, count and duplicates", () => {
    assert.deepEqual(codes(entry({ tags: ["Weather"] })), ["entry/invalid-tag"]);
    assert.deepEqual(codes(entry({ tags: ["-a"] })), ["entry/invalid-tag"]);
    assert.deepEqual(codes(entry({ tags: ["a".repeat(33)] })), ["entry/invalid-tag"]);
    assert.deepEqual(codes(entry({ tags: ["a", "a"] })), ["entry/duplicate-tag"]);
    const eleven = Array.from({ length: 11 }, (_, i) => `t${i}`);
    assert.deepEqual(codes(entry({ tags: eleven })), ["entry/too-many-tags"]);
    assert.deepEqual(codes(entry({ tags: eleven.slice(0, 10) })), []);
  });

  test("screenshots: plain PNG or WebP names, count and duplicates", () => {
    for (const name of ["a.jpg", "a/b.png", "a\\b.png", "..", ".", "", "png"]) {
      const issues = parseEntry(entry({ screenshots: [name] })).issues;
      assert.deepEqual(issues.map((i) => i.code), ["entry/invalid-screenshot"], name);
      assert.equal(issues[0].file, name);
    }
    assert.deepEqual(codes(entry({ screenshots: ["a.png", "a.png"] })), ["entry/duplicate-screenshot"]);
    assert.deepEqual(codes(entry({ screenshots: ["a.png", "b.png", "c.png", "d.png"] })), ["entry/too-many-screenshots"]);
    assert.deepEqual(codes(entry({ screenshots: ["a.png", "b.png", "c.webp"] })), []);
  });

  test("versions: at least one", () => {
    assert.deepEqual(codes(entry({ versions: [] })), ["entry/no-versions"]);
  });

  test("a version has a semver, a URL and a lowercase SHA-256", () => {
    const only = (overrides: Record<string, unknown>) => parseEntry(entry({ versions: [version(overrides)] })).issues;
    assert.deepEqual(only({ version: "1.0" }).map((i) => i.code), ["entry/invalid-version"]);
    assert.deepEqual(only({ url: "not a url" }).map((i) => i.code), ["entry/invalid-url"]);
    assert.deepEqual(only({ url: "http://example.com/a.zip" }), []);
    for (const sha256 of ["abc", "A".repeat(64), "g".repeat(64)]) {
      const issues = only({ sha256 });
      assert.deepEqual(issues.map((i) => i.code), ["entry/invalid-sha256"]);
      assert.equal(issues[0].version, "1.0.0");
    }
  });

  test("the same version twice", () => {
    const issues = parseEntry(entry({ versions: [version(), version()] })).issues;
    assert.deepEqual(issues.map((i) => i.code), ["entry/duplicate-version"]);
    assert.equal(issues[0].version, "1.0.0");
  });

  test("withdrawn must be true and banned a non-empty string", () => {
    assert.deepEqual(codes(entry({ withdrawn: false })), ["entry/invalid-withdrawn"]);
    assert.deepEqual(codes(entry({ withdrawn: "yes" })), ["entry/invalid-withdrawn"]);
    assert.deepEqual(codes(entry({ banned: "" })), ["entry/invalid-banned"]);
    assert.deepEqual(codes(entry({ banned: true })), ["entry/invalid-banned"]);
    assert.deepEqual(codes(entry({ versions: [version({ withdrawn: 1 })] })), ["entry/invalid-withdrawn"]);
    assert.deepEqual(codes(entry({ versions: [version({ banned: "" })] })), ["entry/invalid-banned"]);
  });

  test("collects every issue and returns no entry", () => {
    const result = parseEntry(entry({ id: "x", license: "", extra: 1 }));
    assert.deepEqual(result.issues.map((i) => i.code).sort(), ["entry/invalid-id", "entry/invalid-license", "entry/unknown-field"]);
    assert.equal(result.entry, null);
    assert.ok(result.issues.every((i) => i.file === "entry.json" || i.file === undefined));
  });
});
