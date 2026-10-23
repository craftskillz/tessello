import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtemp, readFile } from "node:fs/promises";
import { createServer, type IncomingMessage, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, before, describe, test } from "node:test";
import { strToU8, zipSync } from "fflate";
import { download, openPullRequest, runCheck, type GitHubOptions } from "../scripts/check-pull-request.ts";

const READY_VIEW = `<!doctype html><script>parent.postMessage({ tessello: 1, type: "ready", id: "1" }, "*")</script>`;
const PACKAGE = zipSync({
  "manifest.json": strToU8(JSON.stringify({ convention: 1, id: "@yassine/weather", name: "Weather", version: "1.0.0", icon: "icon.svg", view: { entry: "view/index.html" }, guide: "guide.md" })),
  "icon.svg": strToU8("<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 1 1'/>"),
  "view/index.html": strToU8(READY_VIEW),
  "guide.md": strToU8("# Weather\n"),
});
const PACKAGE_URL = "https://github.com/yassine/weather/releases/download/v1.0.0/weather.zip";
const ENTRY = JSON.stringify({
  id: "@yassine/weather",
  source: "https://github.com/yassine/weather",
  license: "MIT",
  versions: [{ version: "1.0.0", url: PACKAGE_URL, sha256: createHash("sha256").update(PACKAGE).digest("hex") }],
});

const BASE = "main";
const HEAD = "0123abc";
const FOLDER = "modules/yassine/weather";
const BIG = new Uint8Array(2000).fill(7);

type Node = { type: "file"; bytes: Uint8Array; big?: boolean } | { type: "symlink" | "dir" | "submodule" } | { type: "dir"; children: string[] };

/** The repository under check, as GitHub shows it: what each ref holds, and the pull request. */
const refs: Record<string, Record<string, Node>> = {
  [BASE]: {},
  [HEAD]: {
    [`${FOLDER}`]: { type: "dir", children: ["entry.json", "link.png", "docs", "big.bin"] },
    [`${FOLDER}/entry.json`]: { type: "file", bytes: strToU8(ENTRY) },
    [`${FOLDER}/link.png`]: { type: "symlink" },
    [`${FOLDER}/docs`]: { type: "dir" },
    [`${FOLDER}/big.bin`]: { type: "file", bytes: BIG, big: true },
    "has space/a b.txt": { type: "file", bytes: strToU8("spaced") },
  },
};
let pullFiles: object[] = [{ filename: `${FOLDER}/entry.json`, status: "added" }];
const PULL = { user: { login: "yassine", id: 42 }, head: { sha: HEAD }, base: { ref: BASE }, body: "Adds Weather.\n\n- [x] I have read PUBLISHING.md and accept its terms.\n" };
let pull: object = PULL;
const requests: { method: string; url: string; headers: IncomingMessage["headers"] }[] = [];

function route(req: IncomingMessage): { status: number; body?: unknown; raw?: Uint8Array } {
  const url = new URL(req.url ?? "/", "http://fake");
  const path = decodeURIComponent(url.pathname);
  let match: RegExpExecArray | null;
  if (path === "/repos/market/place/pulls/7") return { status: 200, body: pull };
  if (path === "/repos/market/place/pulls/8") return { status: 500, body: { message: "boom" } };
  if (path === "/repos/market/place/pulls/7/files") {
    const page = Number(url.searchParams.get("page"));
    const size = Number(url.searchParams.get("per_page"));
    return { status: 200, body: pullFiles.slice((page - 1) * size, page * size) };
  }
  if ((match = /^\/repos\/market\/place\/contents\/(.*)$/.exec(path))) {
    const node = refs[url.searchParams.get("ref") ?? ""]?.[match[1]!];
    if (!node) return { status: 404, body: { message: "Not Found" } };
    if ("children" in node) return { status: 200, body: node.children.map((name) => ({ name, path: `${match![1]}/${name}`, type: (refs[url.searchParams.get("ref")!]![`${match![1]}/${name}`] ?? { type: "file" }).type })) };
    if (node.type !== "file") return { status: 200, body: { type: node.type, name: match[1] } };
    if (node.big && req.headers.accept?.includes("raw")) return { status: 200, raw: node.bytes };
    const encoded = node.big ? { encoding: "none", content: "" } : { encoding: "base64", content: Buffer.from(node.bytes).toString("base64").replace(/(.{60})/g, "$1\n") };
    return { status: 200, body: { type: "file", name: match[1], ...encoded } };
  }
  if (path === "/users/yassine") return { status: 200, body: { login: "yassine", id: 42, type: "User" } };
  if (path === "/users/acme") return { status: 200, body: { login: "acme", id: 5, type: "Organization" } };
  if (path === "/users/robot") return { status: 200, body: { login: "robot", id: 6, type: "Bot" } };
  if (path === "/orgs/acme/public_members/yassine") return { status: 204 };
  if (path === "/repos/yassine/weather") return { status: 200, body: { private: false, license: { spdx_id: "MIT" } } };
  if (path === "/repos/yassine/noassertion") return { status: 200, body: { private: true, license: { spdx_id: "NOASSERTION" } } };
  if (path === "/repos/yassine/nolicense") return { status: 200, body: { private: false, license: null } };
  return { status: 404, body: { message: "Not Found" } };
}

let server: Server;
let options: GitHubOptions;

before(async () => {
  server = createServer((req, res) => {
    requests.push({ method: req.method ?? "", url: req.url ?? "", headers: req.headers });
    const { status, body, raw } = route(req);
    res.writeHead(status, { "content-type": raw ? "application/octet-stream" : "application/json" });
    res.end(raw ?? (body === undefined ? undefined : JSON.stringify(body)));
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  options = {
    repository: "market/place",
    pullRequest: 7,
    token: "secret-token",
    apiUrl: `http://127.0.0.1:${(server.address() as AddressInfo).port}`,
    download: async (url) => (url === PACKAGE_URL ? PACKAGE : null),
  };
});
after(() => server.close());

describe("running the check", () => {
  test("writes result.json and comment.md for a new Module", async () => {
    refs[HEAD]![FOLDER] = { type: "dir", children: ["entry.json"] };
    const out = join(await mkdtemp(join(tmpdir(), "tessello-check-")), "check");
    const check = await runCheck({ ...options, out });
    assert.equal(check.decision, "approval");
    const result = JSON.parse(await readFile(join(out, "result.json"), "utf8"));
    assert.deepEqual(result, {
      decision: "approval",
      folder: "yassine/weather",
      change: "new-module",
      head: HEAD,
      namespace: { name: "yassine", record: { account: "yassine", id: 42, state: "active" } },
      issues: [],
    });
    const comment = await readFile(join(out, "comment.md"), "utf8");
    assert.equal(comment, check.comment);
    assert.match(comment, /^<!-- tessello-marketplace-check -->/);
  });

  test("refuses a pull request whose description does not accept the terms", async () => {
    pull = { ...PULL, body: null };
    try {
      const out = join(await mkdtemp(join(tmpdir(), "tessello-check-")), "check");
      const check = await runCheck({ ...options, out });
      assert.deepEqual(check.issues.map((i) => i.code), ["pull-request/terms-not-accepted"]);
      assert.equal(JSON.parse(await readFile(join(out, "result.json"), "utf8")).decision, "refuse");
    } finally {
      pull = PULL;
    }
  });
});

describe("the pull request", () => {
  test("is read with the token and the GitHub headers", async () => {
    requests.length = 0;
    const opened = await openPullRequest(options);
    assert.deepEqual(opened.author, { login: "yassine", id: 42 });
    assert.equal(opened.head, HEAD);
    assert.match(opened.body, /accept its terms/);
    const [request] = requests;
    assert.equal(request!.headers.authorization, "Bearer secret-token");
    assert.equal(request!.headers.accept, "application/vnd.github+json");
    assert.equal(request!.headers["x-github-api-version"], "2022-11-28");
    assert.ok(request!.headers["user-agent"]);
  });

  test("with no description has an empty body", async () => {
    pull = { ...PULL, body: null };
    try {
      assert.equal((await openPullRequest(options)).body, "");
    } finally {
      pull = PULL;
    }
  });

  test("that GitHub fails to serve throws, naming the endpoint and the status", async () => {
    await assert.rejects(openPullRequest({ ...options, pullRequest: 8 }), /500.*\/repos\/market\/place\/pulls\/8/);
  });

  test("changed files are read page after page, with renames", async () => {
    const saved = pullFiles;
    pullFiles = Array.from({ length: 205 }, (_, i) => (i === 204 ? { filename: "new/name.txt", previous_filename: "old/name.txt" } : { filename: `f${i}.txt` }));
    try {
      const { source } = await openPullRequest(options);
      const changed = await source.changedFiles();
      assert.equal(changed.length, 205);
      assert.deepEqual(changed[0], { path: "f0.txt" });
      assert.deepEqual(changed[204], { path: "new/name.txt", previousPath: "old/name.txt" });
    } finally {
      pullFiles = saved;
    }
  });

  test("changed files filling a page exactly end on the empty page after it", async () => {
    const saved = pullFiles;
    pullFiles = Array.from({ length: 100 }, (_, i) => ({ filename: `f${i}.txt` }));
    try {
      assert.equal((await (await openPullRequest(options)).source.changedFiles()).length, 100);
    } finally {
      pullFiles = saved;
    }
  });
});

describe("the files", () => {
  test("are read from the head by its sha, and from the base by its branch", async () => {
    const { source } = await openPullRequest(options);
    requests.length = 0;
    assert.equal(new TextDecoder().decode((await source.file("head", `${FOLDER}/entry.json`))!), ENTRY);
    assert.equal(await source.file("base", `${FOLDER}/entry.json`), null);
    assert.deepEqual(requests.map((r) => new URL(r.url, "http://x").searchParams.get("ref")), [HEAD, BASE]);
  });

  test("keep the slashes of their path and encode the rest", async () => {
    const { source } = await openPullRequest(options);
    requests.length = 0;
    assert.equal(new TextDecoder().decode((await source.file("head", "has space/a b.txt"))!), "spaced");
    assert.ok(requests[0]!.url.startsWith("/repos/market/place/contents/has%20space/a%20b.txt?"));
  });

  test("over 1 MB come back raw, when the JSON carries no content", async () => {
    const { source } = await openPullRequest(options);
    assert.deepEqual(await source.file("head", `${FOLDER}/big.bin`), BIG);
  });

  test("that are absent, folders or symlinks are null", async () => {
    const { source } = await openPullRequest(options);
    assert.equal(await source.file("head", "nothing.txt"), null);
    assert.equal(await source.file("head", FOLDER), null);
    assert.equal(await source.file("head", `${FOLDER}/link.png`), null);
  });
});

describe("a folder", () => {
  test("gives its files, and the names of its sub-folders and symlinks", async () => {
    refs[HEAD]![FOLDER] = { type: "dir", children: ["entry.json", "link.png", "docs", "big.bin"] };
    const { source } = await openPullRequest(options);
    const { files, others } = await source.folder("head", FOLDER);
    assert.deepEqual([...files.keys()].sort(), ["big.bin", "entry.json"]);
    assert.deepEqual(files.get("big.bin"), BIG);
    assert.deepEqual(others.sort(), ["docs", "link.png"]);
  });

  test("that does not exist is empty", async () => {
    const { source } = await openPullRequest(options);
    const { files, others } = await source.folder("base", FOLDER);
    assert.equal(files.size, 0);
    assert.deepEqual(others, []);
  });
});

describe("the GitHub facts", () => {
  test("accounts are Users or Organizations, a Bot counting as a User, and null when unknown", async () => {
    const { source } = await openPullRequest(options);
    assert.deepEqual(await source.account("yassine"), { login: "yassine", id: 42, type: "User" });
    assert.deepEqual(await source.account("acme"), { login: "acme", id: 5, type: "Organization" });
    assert.deepEqual(await source.account("robot"), { login: "robot", id: 6, type: "User" });
    assert.equal(await source.account("ghost"), null);
  });

  test("public membership is a 204 or a 404", async () => {
    const { source } = await openPullRequest(options);
    assert.equal(await source.isPublicMember("acme", "yassine"), true);
    assert.equal(await source.isPublicMember("acme", "ghost"), false);
  });

  test("repositories give their visibility and SPDX licence, null when unknown or not asserted", async () => {
    const { source } = await openPullRequest(options);
    assert.deepEqual(await source.repository("yassine", "weather"), { private: false, license: "MIT" });
    assert.deepEqual(await source.repository("yassine", "noassertion"), { private: true, license: null });
    assert.deepEqual(await source.repository("yassine", "nolicense"), { private: false, license: null });
    assert.equal(await source.repository("yassine", "ghost"), null);
  });
});

describe("downloading a package", () => {
  const body = (chunks: Uint8Array[], headers: Record<string, string> = {}) => async () =>
    new Response(new ReadableStream({ start(c) { for (const chunk of chunks) c.enqueue(chunk); c.close(); } }), { headers });

  test("reads an https URL, without credentials", async () => {
    let init: RequestInit | undefined;
    const bytes = await download("https://example.org/a.zip", { fetch: async (_url, i) => ((init = i), new Response(Uint8Array.of(1, 2, 3))) });
    assert.deepEqual(bytes && [...bytes], [1, 2, 3]);
    assert.equal(init?.headers, undefined);
    assert.ok(init?.signal);
  });

  test("never requests another scheme", async () => {
    let called = false;
    const fetchSpy = async () => ((called = true), new Response("x"));
    assert.equal(await download("http://example.org/a.zip", { fetch: fetchSpy }), null);
    assert.equal(await download("file:///etc/passwd", { fetch: fetchSpy }), null);
    assert.equal(await download("not a url", { fetch: fetchSpy }), null);
    assert.equal(called, false);
  });

  test("gives up on a failure or a non-2xx answer", async () => {
    assert.equal(await download("https://example.org/a.zip", { fetch: async () => new Response("no", { status: 404 }) }), null);
    assert.equal(await download("https://example.org/a.zip", { fetch: async () => { throw new Error("offline"); } }), null);
  });

  test("gives up on a content-length over the limit", async () => {
    assert.equal(await download("https://example.org/a.zip", { maxBytes: 10, fetch: body([Uint8Array.of(1)], { "content-length": "11" }) }), null);
  });

  test("gives up on a stream over the limit, whatever it announces", async () => {
    assert.equal(await download("https://example.org/a.zip", { maxBytes: 10, fetch: body([new Uint8Array(6), new Uint8Array(6)]) }), null);
    assert.notEqual(await download("https://example.org/a.zip", { maxBytes: 12, fetch: body([new Uint8Array(6), new Uint8Array(6)]) }), null);
  });

  test("gives up when it takes too long", async () => {
    const hang = (_url: unknown, init?: RequestInit) => new Promise<Response>((_, reject) => init?.signal?.addEventListener("abort", () => reject(new Error("aborted"))));
    assert.equal(await download("https://example.org/a.zip", { timeoutMs: 20, fetch: hang as typeof fetch }), null);
  });
});
