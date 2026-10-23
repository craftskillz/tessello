import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { describe, test } from "node:test";
import { strToU8, zipSync } from "fflate";
import { verifyEntry, type Entry, type VerifyInput } from "../src/index.ts";

const READY_VIEW = `<!doctype html><script>parent.postMessage({ tessello: 1, type: "ready", id: "1" }, "*")</script>`;
const PNG = Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3]);
const WEBP = Uint8Array.from([0x52, 0x49, 0x46, 0x46, 9, 9, 9, 9, 0x57, 0x45, 0x42, 0x50, 1, 2]);

const sha256 = (bytes: Uint8Array) => createHash("sha256").update(bytes).digest("hex");

/** A real, valid Module package whose Manifest can be overridden. */
function zip(manifestOverrides: Record<string, unknown> = {}): Uint8Array {
  return zipSync({
    "manifest.json": strToU8(
      JSON.stringify({
        convention: 1,
        id: "@yassine/weather",
        name: "Weather",
        version: "1.0.0",
        icon: "icon.svg",
        view: { entry: "view/index.html" },
        guide: "guide.md",
        ...manifestOverrides,
      }),
    ),
    "icon.svg": strToU8("<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 1 1'/>"),
    "view/index.html": strToU8(READY_VIEW),
    "guide.md": strToU8("# Weather\n\nAdd a city to see its forecast.\n"),
  });
}

/** The listing of a version whose package is `bytes`. */
function listed(version: string, bytes: Uint8Array) {
  return { version, url: `https://github.com/yassine/weather/releases/download/v${version}/weather.zip`, sha256: sha256(bytes) };
}

const PACKAGE_1_0_0 = zip();

function entry(overrides: Partial<Entry> = {}): Entry {
  return {
    id: "@yassine/weather",
    source: "https://github.com/yassine/weather",
    license: "MIT",
    versions: [listed("1.0.0", PACKAGE_1_0_0)],
    ...overrides,
  };
}

/** A valid pull request creating a new Module; each test overrides one thing. */
function input(overrides: Partial<VerifyInput> = {}): VerifyInput {
  return {
    folder: "yassine/weather",
    entry: entry(),
    previous: null,
    packages: new Map([["1.0.0", PACKAGE_1_0_0]]),
    files: new Map(),
    github: {
      author: { login: "yassine", id: 42 },
      namespaceAccount: { login: "yassine", id: 42, type: "User" },
      authorIsPublicMember: false,
      source: { private: false, license: "MIT" },
    },
    namespaces: {},
    ...overrides,
  };
}

const codes = async (overrides: Partial<VerifyInput> = {}) => (await verifyEntry(input(overrides))).issues.map((issue) => issue.code);

describe("a valid pull request", () => {
  test("creating a new Module has no issue", async () => {
    const verdict = await verifyEntry(input());
    assert.deepEqual(verdict.issues, []);
    assert.equal(verdict.ok, true);
    assert.equal(verdict.change, "new-module");
  });
});

describe("an unreadable entry.json", () => {
  test("is refused with the parser's issues and no change type", async () => {
    const verdict = await verifyEntry(input({ entry: { id: "nope" } }));
    assert.equal(verdict.ok, false);
    assert.equal(verdict.change, null);
    assert.ok(verdict.issues.some((issue) => issue.code === "entry/invalid-id"));
  });
});

describe("the folder", () => {
  test("must match the entry id", async () => {
    const verdict = await verifyEntry(input({ folder: "yassine/forecast" }));
    assert.deepEqual(verdict.issues.map((issue) => issue.code), ["entry/folder-mismatch"]);
    assert.match(verdict.issues[0]!.message, /@yassine\/weather/);
    assert.match(verdict.issues[0]!.message, /yassine\/forecast/);
    assert.equal(verdict.ok, false);
  });
});

describe("the namespace", () => {
  test("@tessello is reserved", async () => {
    const bytes = zip({ id: "@tessello/weather" });
    const reserved = entry({ id: "@tessello/weather", versions: [listed("1.0.0", bytes)] });
    assert.deepEqual(await codes({ folder: "tessello/weather", entry: reserved, packages: new Map([["1.0.0", bytes]]) }), ["namespace/reserved"]);
  });

  test("must be the name of a GitHub account", async () => {
    const github = { ...input().github, namespaceAccount: null };
    assert.deepEqual(await codes({ github }), ["namespace/no-account"]);
  });

  test("of a user account belongs to that user only", async () => {
    const github = { ...input().github, author: { login: "mallory", id: 666 } };
    assert.deepEqual(await codes({ github }), ["namespace/not-owner"]);
  });

  test("of an organisation is open to its public members", async () => {
    const organisation = { login: "yassine", id: 42, type: "Organization" as const };
    const outsider = { ...input().github, author: { login: "mallory", id: 666 }, namespaceAccount: organisation };
    assert.deepEqual(await codes({ github: outsider }), ["namespace/not-owner"]);
    assert.deepEqual(await codes({ github: { ...outsider, authorIsPublicMember: true } }), []);
  });

  test("recorded with another account id is not inherited by a newcomer of the same name", async () => {
    const namespaces = { yassine: { account: "yassine", id: 7, state: "active" as const } };
    assert.deepEqual(await codes({ namespaces }), ["namespace/id-mismatch"]);
    assert.deepEqual(await codes({ namespaces: { yassine: { ...namespaces.yassine, id: 42 } } }), []);
  });
});

describe("the source and the licence", () => {
  const github = (source: VerifyInput["github"]["source"]) => ({ ...input().github, source });

  test("the source repository must exist", async () => {
    assert.deepEqual(await codes({ github: github(null) }), ["source/not-found"]);
  });

  test("the source repository must be public", async () => {
    assert.deepEqual(await codes({ github: github({ private: true, license: "MIT" }) }), ["source/private"]);
  });

  test("the declared licence must be OSI-approved", async () => {
    const verdict = await verifyEntry(input({ entry: entry({ license: "Proprietary" }), github: github({ private: false, license: "Proprietary" }) }));
    assert.deepEqual(verdict.issues.map((issue) => issue.code), ["license/not-osi"]);
    assert.match(verdict.issues[0]!.message, /"Proprietary"/);
  });

  test("GitHub must report a licence for the source", async () => {
    assert.deepEqual(await codes({ github: github({ private: false, license: null }) }), ["license/not-reported"]);
  });

  test("GitHub must report the declared licence", async () => {
    assert.deepEqual(await codes({ github: github({ private: false, license: "Apache-2.0" }) }), ["license/mismatch"]);
  });
});

describe("new versions", () => {
  const PACKAGE_1_1_0 = zip({ version: "1.1.0" });
  const PACKAGE_2_0_0 = zip({ version: "2.0.0" });
  const previous = entry();
  const withNew = (...added: ReturnType<typeof listed>[]) => entry({ versions: [...previous.versions, ...added] });

  test("a version greater than the published ones is accepted", async () => {
    const verdict = await verifyEntry(
      input({ entry: withNew(listed("1.1.0", PACKAGE_1_1_0)), previous, packages: new Map([["1.1.0", PACKAGE_1_1_0]]) }),
    );
    assert.deepEqual(verdict.issues, []);
    assert.equal(verdict.change, "new-version");
  });

  test("a version not greater than a published one is refused", async () => {
    const old = zip({ version: "0.9.0" });
    const verdict = await verifyEntry(input({ entry: withNew(listed("0.9.0", old)), previous, packages: new Map([["0.9.0", old]]) }));
    assert.deepEqual(verdict.issues.map((issue) => issue.code), ["version/not-greater"]);
    assert.equal(verdict.issues[0]!.version, "0.9.0");
  });

  test("the same version is refused, a pre-release of the published release too", async () => {
    const pre = zip({ version: "1.0.0-rc.1" });
    const verdict = await verifyEntry(input({ entry: withNew(listed("1.0.0-rc.1", pre)), previous, packages: new Map([["1.0.0-rc.1", pre]]) }));
    assert.deepEqual(verdict.issues.map((issue) => issue.code), ["version/not-greater"]);
  });

  test("several new versions must be in increasing order", async () => {
    const packages = new Map([["2.0.0", PACKAGE_2_0_0], ["1.1.0", PACKAGE_1_1_0]]);
    const verdict = await verifyEntry(input({ entry: withNew(listed("2.0.0", PACKAGE_2_0_0), listed("1.1.0", PACKAGE_1_1_0)), previous, packages }));
    assert.deepEqual(verdict.issues.map((issue) => issue.code), ["version/not-greater"]);
    assert.equal(verdict.issues[0]!.version, "1.1.0");
  });

  test("all versions of a new Module are new, so they must be increasing too", async () => {
    const packages = new Map([["1.0.0", PACKAGE_1_0_0], ["0.5.0", zip({ version: "0.5.0" })]]);
    const bad = entry({ versions: [listed("1.0.0", PACKAGE_1_0_0), listed("0.5.0", packages.get("0.5.0")!)] });
    assert.deepEqual(await codes({ entry: bad, packages }), ["version/not-greater"]);
  });

  test("its URL must be https", async () => {
    const bad = entry({ versions: [{ ...listed("1.0.0", PACKAGE_1_0_0), url: "http://example.com/weather.zip" }] });
    assert.deepEqual(await codes({ entry: bad }), ["version/insecure-url"]);
  });

  test("its package must be provided", async () => {
    assert.deepEqual(await codes({ packages: new Map() }), ["version/package-missing"]);
  });

  test("its package must have the listed SHA-256", async () => {
    const bad = entry({ versions: [{ ...listed("1.0.0", PACKAGE_1_0_0), sha256: "0".repeat(64) }] });
    const verdict = await verifyEntry(input({ entry: bad }));
    assert.deepEqual(verdict.issues.map((issue) => issue.code), ["version/sha256-mismatch"]);
    assert.equal(verdict.issues[0]!.version, "1.0.0");
    assert.match(verdict.issues[0]!.message, new RegExp(sha256(PACKAGE_1_0_0)));
  });
});

describe("published versions", () => {
  const previous = entry();
  const none = { packages: new Map<string, Uint8Array>(), previous };

  test("cannot be removed", async () => {
    const other = zip({ version: "1.1.0" });
    const next = entry({ versions: [listed("1.1.0", other)] });
    const verdict = await verifyEntry(input({ ...none, entry: next, packages: new Map([["1.1.0", other]]) }));
    assert.deepEqual(verdict.issues.map((issue) => issue.code), ["version/published-removed"]);
    assert.equal(verdict.issues[0]!.version, "1.0.0");
  });

  test("cannot change their URL", async () => {
    const next = entry({ versions: [{ ...listed("1.0.0", PACKAGE_1_0_0), url: "https://example.com/other.zip" }] });
    const verdict = await verifyEntry(input({ ...none, entry: next }));
    assert.deepEqual(verdict.issues.map((issue) => issue.code), ["version/published-changed"]);
    assert.equal(verdict.issues[0]!.version, "1.0.0");
  });

  test("cannot change their SHA-256", async () => {
    const next = entry({ versions: [{ ...listed("1.0.0", PACKAGE_1_0_0), sha256: "f".repeat(64) }] });
    assert.deepEqual((await verifyEntry(input({ ...none, entry: next }))).issues.map((issue) => issue.code), ["version/published-changed"]);
  });

  test("are not downloaded again when they are unchanged", async () => {
    assert.deepEqual(await codes(none), []);
  });
});

describe("the change type", () => {
  const previous = entry({ tags: ["weather"], screenshots: ["a.png"] });
  const change = async (next: Entry, packages: Map<string, Uint8Array> = new Map()) =>
    (await verifyEntry(input({ entry: next, previous, packages, files: new Map([["a.png", PNG], ["b.png", PNG]]) }))).change;

  test("is metadata when only tags or screenshots change", async () => {
    assert.equal(await change(entry({ tags: ["forecast"], screenshots: ["a.png"] })), "metadata");
    assert.equal(await change(entry({ tags: ["weather"], screenshots: ["a.png", "b.png"] })), "metadata");
    assert.equal(await change(previous), "metadata");
  });

  test("is new-version when a version is added, even with tags changed", async () => {
    const added = zip({ version: "1.1.0" });
    const next = entry({ tags: ["forecast"], screenshots: ["a.png"], versions: [...previous.versions, listed("1.1.0", added)] });
    assert.equal(await change(next, new Map([["1.1.0", added]])), "new-version");
  });

  test("is other when the id, the source or the licence changes", async () => {
    assert.equal(await change({ ...previous, source: "https://github.com/yassine/forecast" }), "other");
    assert.equal(await change({ ...previous, license: "Apache-2.0" }), "other");
    assert.equal(await change({ ...previous, id: "@yassine/forecast" }), "other");
  });

  test("is other when a withdrawn or banned flag changes, at module or version level", async () => {
    const [published] = previous.versions;
    assert.equal(await change({ ...previous, withdrawn: true }), "other");
    assert.equal(await change({ ...previous, banned: "malware" }), "other");
    assert.equal(await change({ ...previous, versions: [{ ...published!, withdrawn: true }] }), "other");
    assert.equal(await change({ ...previous, versions: [{ ...published!, banned: "malware" }] }), "other");
  });

  test("is other when a published version is removed or changed, even if a version is added", async () => {
    const added = zip({ version: "1.1.0" });
    const next = entry({ versions: [{ ...listed("1.0.0", PACKAGE_1_0_0), url: "https://example.com/x.zip" }, listed("1.1.0", added)] });
    assert.equal(await change(next, new Map([["1.1.0", added]])), "other");
  });

  test("is known even when the entry has other issues", async () => {
    const verdict = await verifyEntry(input({ entry: entry({ license: "Proprietary" }), previous, files: new Map([["a.png", PNG]]) }));
    assert.equal(verdict.ok, false);
    assert.equal(verdict.change, "other");
  });
});

describe("the package of a new version", () => {
  const verdictFor = (bytes: Uint8Array) =>
    verifyEntry(input({ entry: entry({ versions: [listed("1.0.0", bytes)] }), packages: new Map([["1.0.0", bytes]]) }));

  test("is refused with the Validator's errors, code and file included", async () => {
    const bytes = zip({ icon: "missing.svg" });
    const verdict = await verifyEntry(
      input({ entry: entry({ versions: [listed("1.0.0", bytes)] }), packages: new Map([["1.0.0", bytes]]) }),
    );
    assert.equal(verdict.ok, false);
    const [first] = verdict.issues;
    assert.equal(first!.version, "1.0.0");
    assert.match(first!.code, /^manifest\//);
    assert.ok(first!.message.length > 0);
  });

  test("is refused when it is not a .zip, and is not otherwise looked at", async () => {
    const verdict = await verdictFor(strToU8("not a zip"));
    assert.deepEqual(verdict.issues.map((issue) => issue.code), ["package/invalid-zip"]);
  });

  test("ignores the Validator's warnings", async () => {
    const bytes = zip({ description: "x".repeat(10) });
    assert.equal((await verdictFor(bytes)).ok, true);
  });

  test("must have the entry's id as Manifest id", async () => {
    const verdict = await verdictFor(zip({ id: "@yassine/forecast" }));
    assert.deepEqual(verdict.issues.map((issue) => [issue.code, issue.file]), [["version/id-mismatch", undefined]]);
    assert.equal(verdict.issues[0]!.version, "1.0.0");
  });

  test("must have the listed version as Manifest version", async () => {
    const verdict = await verdictFor(zip({ version: "1.0.1" }));
    assert.deepEqual(verdict.issues.map((issue) => [issue.code, issue.file]), [["version/version-mismatch", undefined]]);
  });

  test("is not checked when its SHA-256 differs", async () => {
    const bytes = strToU8("not a zip");
    const bad = entry({ versions: [{ ...listed("1.0.0", bytes), sha256: "0".repeat(64) }] });
    const verdict = await verifyEntry(input({ entry: bad, packages: new Map([["1.0.0", bytes]]) }));
    assert.deepEqual(verdict.issues.map((issue) => issue.code), ["version/sha256-mismatch"]);
  });
});

describe("screenshots", () => {
  const listing = (files: [string, Uint8Array][], names = files.map(([name]) => name)) =>
    verifyEntry(input({ entry: entry({ screenshots: names }), files: new Map(files) }));
  const codesOf = async (verdict: ReturnType<typeof listing>) => (await verdict).issues.map((issue) => `${issue.code} ${issue.file}`);

  test("valid PNG and WebP files are accepted", async () => {
    assert.deepEqual((await listing([["a.png", PNG], ["b.webp", WEBP]])).issues, []);
  });

  test("must be present in the listing folder", async () => {
    assert.deepEqual(await codesOf(listing([], ["a.png"])), ["screenshot/missing a.png"]);
  });

  test("must not exceed 500 KB", async () => {
    const big = new Uint8Array(500 * 1024 + 1);
    big.set(PNG);
    assert.deepEqual(await codesOf(listing([["a.png", big]])), ["screenshot/too-large a.png"]);
    const exact = new Uint8Array(500 * 1024);
    exact.set(PNG);
    assert.deepEqual(await codesOf(listing([["a.png", exact]])), []);
  });

  test("must really be the image their extension says", async () => {
    assert.deepEqual(await codesOf(listing([["a.png", WEBP]])), ["screenshot/invalid-image a.png"]);
    assert.deepEqual(await codesOf(listing([["a.webp", PNG]])), ["screenshot/invalid-image a.webp"]);
    assert.deepEqual(await codesOf(listing([["A.PNG", PNG]])), []);
  });

  test("are all checked, not only the new ones", async () => {
    const verdict = await verifyEntry(input({ entry: entry({ screenshots: ["a.png"] }), previous: entry({ screenshots: ["a.png"] }), files: new Map() }));
    assert.deepEqual(verdict.issues.map((issue) => issue.code), ["screenshot/missing"]);
  });
});
