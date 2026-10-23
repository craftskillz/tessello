import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { describe, test } from "node:test";
import { strToU8, zipSync } from "fflate";
import {
  checkPullRequest,
  type ChangedFile,
  type Entry,
  type Namespaces,
  type PullRequestSource,
} from "../src/index.ts";

const READY_VIEW = `<!doctype html><script>parent.postMessage({ tessello: 1, type: "ready", id: "1" }, "*")</script>`;
const PNG = Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3]);

const sha256 = (bytes: Uint8Array) => createHash("sha256").update(bytes).digest("hex");
const json = (value: unknown) => strToU8(JSON.stringify(value));

/** A real, valid Module package of the given version. */
function zip(version: string): Uint8Array {
  return zipSync({
    "manifest.json": json({
      convention: 1,
      id: "@yassine/weather",
      name: "Weather",
      version,
      icon: "icon.svg",
      view: { entry: "view/index.html" },
      guide: "guide.md",
    }),
    "icon.svg": strToU8("<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 1 1'/>"),
    "view/index.html": strToU8(READY_VIEW),
    "guide.md": strToU8("# Weather\n\nAdd a city to see its forecast.\n"),
  });
}

const urlOf = (version: string) => `https://github.com/yassine/weather/releases/download/v${version}/weather.zip`;
const PACKAGES = new Map(["1.0.0", "1.1.0"].map((version) => [urlOf(version), zip(version)]));

function listed(version: string) {
  return { version, url: urlOf(version), sha256: sha256(PACKAGES.get(urlOf(version))!) };
}

function entry(overrides: Partial<Entry> = {}): Entry {
  return {
    id: "@yassine/weather",
    source: "https://github.com/yassine/weather",
    license: "MIT",
    versions: [listed("1.0.0")],
    ...overrides,
  };
}

type Files = Record<string, Uint8Array>;

interface Scenario {
  /** Files at the base / head of the pull request, by path from the repository root. */
  base: Files;
  head: Files;
  /** Folders of the head holding something else than regular files. */
  others: Record<string, string[]>;
  changed: ChangedFile[];
  accounts: Record<string, { login: string; id: number; type: "User" | "Organization" }>;
  members: string[];
  /** Logins with write access to the Marketplace repository. */
  maintainers: string[];
  repositories: Record<string, { private: boolean; license: string | null }>;
  downloads: Map<string, Uint8Array>;
  /** The pull request description. */
  body: string;
}

const FOLDER = "modules/yassine/weather";
const TERMS_TICKED = "Adds my Module.\n\n- [x] I have read PUBLISHING.md and accept its terms.\n";

/** A valid pull request creating a new Module; each test overrides one thing. */
function scenario(overrides: Partial<Scenario> = {}): Scenario {
  return {
    base: {},
    head: { [`${FOLDER}/entry.json`]: json(entry()) },
    others: {},
    changed: [{ path: `${FOLDER}/entry.json` }],
    accounts: { yassine: { login: "yassine", id: 42, type: "User" } },
    members: [],
    maintainers: [],
    repositories: { "yassine/weather": { private: false, license: "MIT" } },
    downloads: PACKAGES,
    body: TERMS_TICKED,
    ...overrides,
  };
}

interface Run {
  result: Awaited<ReturnType<typeof checkPullRequest>>;
  /** Every call the CI made to the source, as "kind arg…". */
  calls: string[];
}

/** Runs the check against an in-memory source, recording what it asked for. */
async function run(overrides: Partial<Scenario> = {}, author = { login: "yassine", id: 42 }): Promise<Run> {
  const s = scenario(overrides);
  const calls: string[] = [];
  const source: PullRequestSource = {
    async changedFiles() {
      return s.changed;
    },
    async file(side, path) {
      calls.push(`file ${side} ${path}`);
      return (side === "base" ? s.base : s.head)[path] ?? null;
    },
    async folder(side, path) {
      const files = new Map<string, Uint8Array>();
      for (const [full, bytes] of Object.entries(side === "base" ? s.base : s.head)) {
        if (full.startsWith(`${path}/`) && !full.slice(path.length + 1).includes("/")) files.set(full.slice(path.length + 1), bytes);
      }
      return { files, others: side === "head" ? (s.others[path] ?? []) : [] };
    },
    async account(login) {
      calls.push(`account ${login}`);
      return s.accounts[login] ?? null;
    },
    async isPublicMember(organization, login) {
      calls.push(`member ${organization} ${login}`);
      return s.members.includes(login);
    },
    async isMaintainer(login) {
      calls.push(`maintainer ${login}`);
      return s.maintainers.includes(login);
    },
    async repository(owner, name) {
      return s.repositories[`${owner}/${name}`] ?? null;
    },
    async download(url) {
      calls.push(`download ${url}`);
      return s.downloads.get(url) ?? null;
    },
  };
  return { result: await checkPullRequest({ author, body: s.body, source }), calls };
}

const codes = async (overrides: Partial<Scenario> = {}, author?: { login: string; id: number }) =>
  (await run(overrides, author)).result.issues.map((issue) => issue.code);

describe("a valid pull request", () => {
  test("creating a new Module awaits the Approval and records its namespace", async () => {
    const { result } = await run();
    assert.deepEqual(result.issues, []);
    assert.equal(result.folder, "yassine/weather");
    assert.equal(result.change, "new-module");
    assert.equal(result.decision, "approval");
    assert.deepEqual(result.namespace, { name: "yassine", record: { account: "yassine", id: 42, state: "active" } });
  });
});

describe("the changed files", () => {
  test("outside modules/<namespace>/<name>/ are refused without verifying anything", async () => {
    const { result, calls } = await run({ changed: [{ path: `${FOLDER}/entry.json` }, { path: "README.md" }, { path: "namespaces.json" }] });
    assert.equal(result.decision, "refuse");
    assert.equal(result.folder, null);
    assert.deepEqual(result.issues.map((i) => [i.code, i.file]), [
      ["pull-request/outside-listing", "README.md"],
      ["pull-request/outside-listing", "namespaces.json"],
    ]);
    assert.deepEqual(calls, []);
  });

  test("deeper than the listing folder are refused", async () => {
    assert.deepEqual(await codes({ changed: [{ path: `${FOLDER}/sub/a.png` }] }), ["pull-request/outside-listing"]);
  });

  test("renamed from outside the listing are refused through their previous path", async () => {
    const changed = [{ path: `${FOLDER}/canvas.png`, previousPath: "images/canvas.png" }];
    const { result } = await run({ changed });
    assert.deepEqual(result.issues.map((i) => [i.code, i.file]), [["pull-request/outside-listing", "images/canvas.png"]]);
  });

  test("in two listing folders are refused", async () => {
    const changed = [{ path: `${FOLDER}/entry.json` }, { path: "modules/yassine/forecast/entry.json" }];
    const { result } = await run({ changed });
    assert.deepEqual(result.issues.map((i) => [i.code, i.file]), [["pull-request/several-listings", undefined]]);
    assert.equal(result.folder, null);
    assert.equal(result.decision, "refuse");
  });

  test("none at all are refused", async () => {
    const { result } = await run({ changed: [] });
    assert.deepEqual(result.issues.map((i) => [i.code, i.file]), [["pull-request/no-listing", undefined]]);
    assert.equal(result.decision, "refuse");
  });
});

describe("the head folder", () => {
  test("holding anything but files is refused", async () => {
    const { result } = await run({ others: { [FOLDER]: ["docs", "link.png"] } });
    assert.deepEqual(result.issues.filter((i) => i.code === "pull-request/unexpected-file").map((i) => i.file), ["docs", "link.png"]);
    assert.equal(result.decision, "refuse");
  });

  test("without entry.json is refused: a listing is withdrawn, never deleted", async () => {
    const { result } = await run({ base: { [`${FOLDER}/entry.json`]: json(entry()) }, head: {}, changed: [{ path: `${FOLDER}/entry.json` }] });
    assert.deepEqual(result.issues.map((i) => i.code), ["pull-request/listing-removed"]);
    assert.equal(result.decision, "refuse");
    assert.equal(result.change, null);
  });

  test("with an entry.json that is not JSON is refused", async () => {
    const { result } = await run({ head: { [`${FOLDER}/entry.json`]: strToU8("{ nope") } });
    assert.deepEqual(result.issues.map((i) => i.code), ["entry/invalid-json"]);
    assert.equal(result.change, null);
    assert.equal(result.decision, "refuse");
  });

  test("with an entry.json that is not UTF-8 is refused", async () => {
    assert.deepEqual(await codes({ head: { [`${FOLDER}/entry.json`]: Uint8Array.from([0xff, 0xfe, 0x7b]) } }), ["entry/invalid-json"]);
  });
});

describe("the base", () => {
  test("an unreadable namespaces.json makes the check throw", async () => {
    await assert.rejects(run({ base: { "namespaces.json": strToU8("{ nope") } }), /namespaces\.json/);
  });

  test("an unreadable previous entry.json makes the check throw", async () => {
    await assert.rejects(run({ base: { [`${FOLDER}/entry.json`]: strToU8("{ nope") } }), /entry\.json/);
  });
});

describe("the GitHub facts", () => {
  test("a User namespace owned by someone else is refused, without asking about membership", async () => {
    const { result, calls } = await run({}, { login: "mallory", id: 7 });
    assert.deepEqual(result.issues.map((i) => i.code), ["namespace/not-owner"]);
    assert.equal(result.decision, "refuse");
    assert.ok(!calls.some((c) => c.startsWith("member")));
  });

  test("an organisation namespace is accepted for a public member", async () => {
    const accounts = { yassine: { login: "yassine", id: 99, type: "Organization" as const } };
    const { result, calls } = await run({ accounts, members: ["mallory"] }, { login: "mallory", id: 7 });
    assert.deepEqual(result.issues, []);
    assert.ok(calls.includes("member yassine mallory"));
    assert.equal(result.namespace?.record.id, 99);
  });

  test("an organisation namespace is refused for anyone else", async () => {
    const accounts = { yassine: { login: "yassine", id: 99, type: "Organization" as const } };
    assert.deepEqual(await codes({ accounts }, { login: "mallory", id: 7 }), ["namespace/not-owner"]);
  });

  test("a namespace without a GitHub account is refused", async () => {
    assert.deepEqual(await codes({ accounts: {} }), ["namespace/no-account"]);
  });

  test("the source repository is looked up from the entry's source", async () => {
    assert.deepEqual(await codes({ repositories: { "yassine/weather": { private: true, license: "MIT" } } }), ["source/private"]);
    assert.deepEqual(await codes({ repositories: {} }), ["source/not-found"]);
  });

  test("a licence differing from GitHub's is refused", async () => {
    assert.deepEqual(await codes({ repositories: { "yassine/weather": { private: false, license: "Apache-2.0" } } }), ["license/mismatch"]);
  });
});

describe("the packages", () => {
  test("only the new versions are downloaded", async () => {
    const previous = entry();
    const next = entry({ versions: [listed("1.0.0"), listed("1.1.0")] });
    const { result, calls } = await run({
      base: { [`${FOLDER}/entry.json`]: json(previous) },
      head: { [`${FOLDER}/entry.json`]: json(next) },
    });
    assert.deepEqual(result.issues, []);
    assert.deepEqual(calls.filter((c) => c.startsWith("download")), [`download ${urlOf("1.1.0")}`]);
  });

  test("a URL that is not https is never fetched", async () => {
    const insecure = entry({ versions: [{ ...listed("1.0.0"), url: "http://example.com/weather.zip" }] });
    const { result, calls } = await run({ head: { [`${FOLDER}/entry.json`]: json(insecure) } });
    assert.ok(result.issues.some((i) => i.code === "version/insecure-url"));
    assert.deepEqual(calls.filter((c) => c.startsWith("download")), []);
  });

  test("a failed download is reported as a missing package", async () => {
    assert.deepEqual(await codes({ downloads: new Map() }), ["version/package-missing"]);
  });

  test("a downloaded package with the wrong checksum is refused", async () => {
    const wrong = entry({ versions: [{ ...listed("1.0.0"), sha256: "0".repeat(64) }] });
    assert.deepEqual(await codes({ head: { [`${FOLDER}/entry.json`]: json(wrong) } }), ["version/sha256-mismatch"]);
  });

  test("the other files of the folder are the screenshots to check", async () => {
    const shot = entry({ screenshots: ["canvas.png"] });
    const head = { [`${FOLDER}/entry.json`]: json(shot), [`${FOLDER}/canvas.png`]: PNG };
    assert.deepEqual(await codes({ head }), []);
    assert.deepEqual(await codes({ head: { [`${FOLDER}/entry.json`]: json(shot) } }), ["screenshot/missing"]);
  });
});

describe("the decision", () => {
  const base = { [`${FOLDER}/entry.json`]: json(entry()) };
  const decide = async (next: Entry, extra: Partial<Scenario> = {}) =>
    (await run({ base, head: { [`${FOLDER}/entry.json`]: json(next) }, ...extra })).result;

  test("a new version merges automatically", async () => {
    const result = await decide(entry({ versions: [listed("1.0.0"), listed("1.1.0")] }));
    assert.equal(result.change, "new-version");
    assert.equal(result.decision, "merge");
    assert.equal(result.namespace, null);
  });

  test("a metadata change merges automatically", async () => {
    const result = await decide(entry({ tags: ["weather"] }));
    assert.equal(result.change, "metadata");
    assert.equal(result.decision, "merge");
  });

  test("a withdrawal by the owner merges automatically", async () => {
    const result = await decide(entry({ withdrawn: true }));
    assert.equal(result.change, "withdrawal");
    assert.equal(result.decision, "merge");
  });

  test("any other change goes to the Maintainer", async () => {
    const withdrawn = { [`${FOLDER}/entry.json`]: json(entry({ withdrawn: true })) };
    const result = (await run({ base: withdrawn, head: { [`${FOLDER}/entry.json`]: json(entry()) } })).result;
    assert.equal(result.change, "other");
    assert.equal(result.decision, "maintainer");
  });

  test("a Ban by a non-maintainer is refused", async () => {
    const result = await decide(entry({ banned: "malware" }));
    assert.equal(result.change, "ban");
    assert.equal(result.decision, "refuse");
    assert.deepEqual(result.issues.map((i) => i.code), ["ban/maintainer-only"]);
  });

  test("a Ban by the Maintainer, in someone else's namespace, goes to the Maintainer", async () => {
    const { result } = await run(
      { base, head: { [`${FOLDER}/entry.json`]: json(entry({ banned: "malware" })) }, maintainers: ["boss"] },
      { login: "boss", id: 1 },
    );
    assert.deepEqual(result.issues, []);
    assert.equal(result.change, "ban");
    assert.equal(result.decision, "maintainer");
  });

  test("an issue refuses whatever the change", async () => {
    const result = await decide(entry({ tags: ["Bad Tag"] }));
    assert.equal(result.decision, "refuse");
  });

  test("a new Module of a namespace already recorded adds no namespace", async () => {
    const namespaces: Namespaces = { yassine: { account: "yassine", id: 42, state: "active" } };
    const { result } = await run({ base: { "namespaces.json": json(namespaces) } });
    assert.equal(result.decision, "approval");
    assert.equal(result.namespace, null);
  });

  test("a refused new Module adds no namespace", async () => {
    const { result } = await run({ downloads: new Map() });
    assert.equal(result.namespace, null);
  });
});

describe("the comment", () => {
  const MARKER = "<!-- tessello-marketplace-check -->";

  test("starts with the marker and names the Module and the decision", async () => {
    const { result } = await run();
    assert.ok(result.comment.startsWith(`${MARKER}\n`));
    assert.match(result.comment.split("\n")[1]!, /@yassine\/weather.*approval/i);
  });

  test("says what each decision means", async () => {
    const approval = (await run()).result.comment;
    assert.match(approval, /awaits the Maintainer's Approval/);
    assert.match(approval, /sole discretion/);
    assert.match(approval, /no guarantee/);

    const base = { [`${FOLDER}/entry.json`]: json(entry()) };
    const merged = (await run({ base, head: { [`${FOLDER}/entry.json`]: json(entry({ tags: ["weather"] })) } })).result.comment;
    assert.match(merged, /merged automatically/);

    const maintainer = (await run({ base: { [`${FOLDER}/entry.json`]: json(entry({ withdrawn: true })) }, head: { [`${FOLDER}/entry.json`]: json(entry()) } })).result.comment;
    assert.match(maintainer, /goes to the Maintainer/);

    const refused = (await run({ changed: [] })).result.comment;
    assert.match(refused, /fix the issues and push again/i);
  });

  test("tells a frozen Namespace to the Maintainer", async () => {
    const namespaces: Namespaces = { yassine: { account: "yassine", id: 7, state: "active" } };
    const { result } = await run({ base: { "namespaces.json": json(namespaces) } });
    assert.equal(result.decision, "refuse");
    assert.equal(result.freeze, "yassine");
    assert.match(result.comment, /frozen/);
    assert.match(result.comment, /Maintainer is notified/);
  });

  test("a Namespace that is not frozen has no freeze", async () => {
    assert.equal((await run()).result.freeze, null);
    assert.equal((await run({ changed: [] })).result.freeze, null);
  });

  test("lists the issues with their code and version or file", async () => {
    const { result } = await run({ others: { [FOLDER]: ["docs"] }, downloads: new Map() });
    assert.match(result.comment, /`pull-request\/unexpected-file`.*`docs`/);
    assert.match(result.comment, /`version\/package-missing`.*1\.0\.0/);
  });

  test("neutralises HTML and mentions coming from the pull request", async () => {
    const hostile = entry({ tags: ["<img src=x onerror=alert(1)> @maintainer &amp;"] });
    const { result } = await run({ head: { [`${FOLDER}/entry.json`]: json(hostile) } });
    assert.ok(!result.comment.includes("<img"));
    assert.ok(result.comment.includes("&lt;img"));
    assert.ok(result.comment.includes("&amp;amp;"));
    assert.ok(!result.comment.includes("@maintainer"));
    assert.ok(result.comment.includes("@​maintainer"));
  });
});

describe("the acceptance of the terms", () => {
  const MISSING = "pull-request/terms-not-accepted";

  test("a ticked box, however it is written, is the acceptance", async () => {
    for (const body of ["- [x] I have read PUBLISHING.md and accept its terms.", "* [X] I have read PUBLISHING.md and accept its terms.", "text\r\n   - [x] I have read PUBLISHING.md and accept its terms.  \r\nmore"]) {
      assert.deepEqual(await codes({ body }), [], body);
    }
  });

  test("an unticked, absent or altered box is refused", async () => {
    for (const body of ["", "- [ ] I have read PUBLISHING.md and accept its terms.", "- [x] I have read PUBLISHING.md.", "I have read PUBLISHING.md and accept its terms."]) {
      const { result } = await run({ body });
      assert.deepEqual(result.issues.map((i) => i.code), [MISSING], body);
      assert.equal(result.decision, "refuse");
      assert.equal(result.namespace, null);
    }
  });

  test("is about the description, not a file of the listing", async () => {
    const { result } = await run({ body: "" });
    assert.deepEqual(result.issues.map((i) => [i.code, i.file]), [[MISSING, undefined]]);
    assert.ok(!result.comment.includes("entry.json"), result.comment);
  });

  test("is reported next to the other issues, without skipping the verification", async () => {
    const { result } = await run({ body: "", others: { [FOLDER]: ["docs"] } });
    assert.deepEqual(result.issues.map((i) => i.code), ["pull-request/unexpected-file", MISSING]);
  });

  test("is also reported when the changed files are refused", async () => {
    const { result } = await run({ body: "", changed: [{ path: "README.md" }] });
    assert.deepEqual(result.issues.map((i) => i.code), ["pull-request/outside-listing", MISSING]);
  });

  test("is also reported when the listing is gone or unreadable", async () => {
    assert.deepEqual(await codes({ body: "", head: {} }), ["pull-request/listing-removed", MISSING]);
    assert.deepEqual(await codes({ body: "", head: { [`${FOLDER}/entry.json`]: strToU8("{ nope") } }), ["entry/invalid-json", MISSING]);
  });

  test("tells the Creator which box to tick", async () => {
    const { result } = await run({ body: "" });
    assert.ok(result.comment.includes('Tick the box "I have read PUBLISHING.md and accept its terms." in the pull request description.'));
  });
});
