import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { HEADERS, type HeaderRule, headersFile, headersFor } from "../scripts/headers.ts";

describe("the _headers file", () => {
  test("lists each path, then its indented headers, with a blank line between rules and a trailing newline", () => {
    const text = headersFile([
      { path: "/*", headers: { "X-A": "1", "X-B": "2" } },
      { path: "/sw.js", headers: { "Cache-Control": "no-cache" } },
    ]);
    assert.equal(text, "/*\n  X-A: 1\n  X-B: 2\n\n/sw.js\n  Cache-Control: no-cache\n");
  });
});

describe("the headers served for a path", () => {
  const rules: HeaderRule[] = [
    { path: "/*", headers: { "X-All": "all", "X-Over": "first" } },
    { path: "/docs/*", headers: { "X-Docs": "docs" } },
    { path: "/sw.js", headers: { "X-Over": "second" } },
  ];

  test("the /* rule matches every path", () => {
    assert.deepEqual(headersFor("/", rules), { "X-All": "all", "X-Over": "first" });
    assert.deepEqual(headersFor("/a/b.js", rules), { "X-All": "all", "X-Over": "first" });
  });

  test("a splat rule matches its folder and everything below it, nothing else", () => {
    assert.equal(headersFor("/docs/", rules)["X-Docs"], "docs");
    assert.equal(headersFor("/docs/a/b.html", rules)["X-Docs"], "docs");
    assert.equal(headersFor("/docsy", rules)["X-Docs"], undefined);
    assert.equal(headersFor("/other/", rules)["X-Docs"], undefined);
  });

  test("an exact rule matches only its path", () => {
    assert.equal(headersFor("/sw.js", rules)["X-Over"], "second");
    assert.equal(headersFor("/sw.js.map", rules)["X-Over"], "first");
  });

  test("a later rule wins over an earlier one", () => {
    assert.deepEqual(headersFor("/sw.js", rules), { "X-All": "all", "X-Over": "second" });
  });

  test("a path no rule matches gets no header", () => {
    assert.deepEqual(headersFor("/x", [{ path: "/y", headers: { "X-A": "1" } }]), {});
  });
});

describe("the Host's headers", () => {
  test("every path gets the frame-src CSP, and nothing else restricts what the Modules load (ADR 0005)", () => {
    for (const path of ["/", "/index.html", "/main.js"]) {
      assert.equal(headersFor(path, HEADERS)["Content-Security-Policy"], "frame-src 'none'");
    }
  });

  test("the service worker is always revalidated", () => {
    assert.equal(headersFor("/sw.js")["Cache-Control"], "no-cache");
    assert.equal(headersFor("/main.js")["Cache-Control"], undefined);
  });
});
