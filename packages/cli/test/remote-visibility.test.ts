import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { checkVisibility, githubRepoOf, visibilityFor, type VisibilityFetch, type VisibilityMemo } from "../src/remote-visibility.ts";

describe("githubRepoOf", () => {
  test("accepts the SSH and HTTPS forms of a github.com remote", () => {
    const forms = [
      "git@github.com:o/r.git",
      "git@github.com:o/r",
      "ssh://git@github.com/o/r.git",
      "ssh://git@github.com:22/o/r.git",
      "https://github.com/o/r",
      "https://github.com/o/r/",
      "https://user@github.com/o/r.git",
      "http://github.com/o/r",
      "https://GitHub.com/o/r.git",
      "  https://github.com/o/r.git  ",
    ];
    for (const form of forms) assert.deepEqual(githubRepoOf(form), { owner: "o", repo: "r" }, form);
  });

  test("keeps dots, dashes and underscores in names", () => {
    assert.deepEqual(githubRepoOf("https://github.com/my-org/my_repo.js.git"), { owner: "my-org", repo: "my_repo.js" });
  });

  test("rejects other hosts, extra segments, local paths and names that could alter the API URL", () => {
    const forms = [
      "",
      "   ",
      "git@gitlab.com:o/r.git",
      "https://github.com.evil.com/o/r",
      "https://evil.com/github.com/o/r",
      "https://github.example.com/o/r",
      "https://github.com/o",
      "https://github.com/o/r/extra",
      "git@github.com:o/r/extra.git",
      "/srv/git/r.git",
      "../r.git",
      "file:///tmp/github.com/o/r",
      "https://github.com/o/..",
      "https://github.com/o/r%2Fx",
      "https://github.com/o?x/r",
    ];
    for (const form of forms) assert.equal(githubRepoOf(form), null, form);
  });
});

const answer = (status: number, body: unknown) => async () => ({ status, json: async () => body });

describe("checkVisibility", () => {
  test("a 200 with private false is public", async () => {
    assert.equal(await checkVisibility("git@github.com:o/r.git", answer(200, { private: false })), "public");
  });

  test("any other answer is unknown", async () => {
    const cases: [number, unknown][] = [[404, { message: "Not Found" }], [403, {}], [500, {}], [200, { private: true }], [200, {}], [200, null], [200, "x"]];
    for (const [status, body] of cases) assert.equal(await checkVisibility("https://github.com/o/r", answer(status, body)), "unknown", `${status} ${JSON.stringify(body)}`);
  });

  test("a body that is not JSON is unknown", async () => {
    const fetch: VisibilityFetch = async () => ({ status: 200, json: async () => { throw new SyntaxError("bad"); } });
    assert.equal(await checkVisibility("https://github.com/o/r", fetch), "unknown");
  });

  test("asks the anonymous API for the repository", async () => {
    const calls: { url: string; headers: Record<string, string>; signal: AbortSignal }[] = [];
    await checkVisibility("git@github.com:o/r.git", async (url, init) => {
      calls.push({ url, ...init });
      return { status: 404, json: async () => ({}) };
    });
    assert.equal(calls.length, 1);
    assert.equal(calls[0]!.url, "https://api.github.com/repos/o/r");
    assert.deepEqual(calls[0]!.headers, { Accept: "application/vnd.github+json", "User-Agent": "tessello-sync" });
    assert.ok(calls[0]!.signal instanceof AbortSignal);
  });

  test("another host is unknown without any request", async () => {
    let calls = 0;
    const fetch: VisibilityFetch = async () => (calls++, { status: 200, json: async () => ({ private: false }) });
    assert.equal(await checkVisibility("git@gitlab.com:o/r.git", fetch), "unknown");
    assert.equal(calls, 0);
  });

  test("null when there was no answer (offline)", async () => {
    assert.equal(await checkVisibility("https://github.com/o/r", async () => { throw new TypeError("fetch failed"); }), null);
  });
});

describe("visibilityFor", () => {
  const T0 = new Date("2026-03-01T10:00:00.000Z");
  const HOUR = 3_600_000;
  const GH = "https://github.com/o/r";
  function recorder(next: () => Promise<{ status: number; json(): Promise<unknown> }>) {
    const calls: string[] = [];
    const fetch: VisibilityFetch = async (url) => (calls.push(url), next());
    return { calls, fetch };
  }
  const pub = () => Promise.resolve({ status: 200, json: async () => ({ private: false }) });
  const offline = () => Promise.reject(new TypeError("fetch failed"));

  test("checks at startup, then keeps the value for an hour", async () => {
    const { calls, fetch } = recorder(pub);
    const memo: VisibilityMemo = {};
    const first = await visibilityFor(GH, undefined, memo, T0, fetch);
    assert.equal(first, "public");
    assert.equal(await visibilityFor(GH, first, memo, new Date(T0.getTime() + HOUR - 1), fetch), "public");
    assert.equal(calls.length, 1);
    await visibilityFor(GH, first, memo, new Date(T0.getTime() + HOUR), fetch);
    assert.equal(calls.length, 2);
  });

  test("checks again when the remote changes", async () => {
    const { calls, fetch } = recorder(pub);
    const memo: VisibilityMemo = {};
    await visibilityFor(GH, undefined, memo, T0, fetch);
    await visibilityFor("https://github.com/o/other", "public", memo, T0, fetch);
    assert.equal(calls.length, 2);
  });

  test("offline keeps the previous value, and is retried at the next round", async () => {
    const { calls, fetch } = recorder(offline);
    const memo: VisibilityMemo = {};
    assert.equal(await visibilityFor(GH, "public", memo, T0, fetch), "public");
    assert.equal(await visibilityFor(GH, "public", memo, new Date(T0.getTime() + 1000), fetch), "public");
    assert.equal(calls.length, 2);
    assert.equal(await visibilityFor(GH, undefined, memo, T0, fetch), undefined);
  });

  test("offline after a remote change is unknown", async () => {
    const ok = recorder(pub);
    const memo: VisibilityMemo = {};
    await visibilityFor(GH, undefined, memo, T0, ok.fetch);
    const down = recorder(offline);
    assert.equal(await visibilityFor("https://github.com/o/other", "public", memo, T0, down.fetch), "unknown");
  });

  test("an empty remote has no visibility and no request", async () => {
    const { calls, fetch } = recorder(pub);
    assert.equal(await visibilityFor("  ", "public", {}, T0, fetch), undefined);
    assert.equal(calls.length, 0);
  });

  test("a remote emptied then set back within the hour is checked again", async () => {
    const { calls, fetch } = recorder(pub);
    const memo: VisibilityMemo = {};
    await visibilityFor(GH, undefined, memo, T0, fetch);
    await visibilityFor("", "public", memo, T0, fetch);
    assert.equal(await visibilityFor(GH, undefined, memo, T0, fetch), "public");
    assert.equal(calls.length, 2);
  });

  test("a non-GitHub remote is unknown without any request", async () => {
    const { calls, fetch } = recorder(pub);
    assert.equal(await visibilityFor("/srv/git/r.git", undefined, {}, T0, fetch), "unknown");
    assert.equal(calls.length, 0);
  });
});
