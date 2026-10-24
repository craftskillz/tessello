import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { strFromU8, strToU8, unzipSync as unzip, zipSync } from "fflate";
import { buildIndex, type Entry, sha256, type IndexModule, type MarketplaceIndex, type Namespaces } from "@tessello/marketplace";
import {
  createHost,
  createMemoryIndexSource,
  createMemoryPersistence,
  type MemoryPersistence,
  type Theme,
} from "../src/index.ts";

const THEME: Theme = {
  mode: "light",
  colors: { background: "#ffffff", surface: "#f4f5f7", text: "#16181d", textMuted: "#5f6670", accent: "#2f6fec", border: "#d9dce1" },
};
const ICON = "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 1 1'/>";
const NOTES_URL = "https://example.org/notes-1.0.0.zip";
const NOW = new Date("2026-10-23T10:00:00.000Z");

/** The package of Notes, zipped; `version` and `extra` make other bytes. */
const notesZip = (version = "1.0.0", extra = "") =>
  zipSync({
    "manifest.json": strToU8(
      JSON.stringify({
        convention: 1,
        id: "@craftskillz/notes",
        name: "Notes",
        version,
        icon: "icon.svg",
        view: { entry: "view/index.html" },
        guide: "guide.md",
      }),
    ),
    "icon.svg": strToU8(ICON),
    "view/index.html": strToU8("<!doctype html>"),
    "guide.md": strToU8(`# Notes${extra}`),
  });

/** An index listing Notes 1.0.0 as `zip` (and any other module given). */
async function indexOf(zip: Uint8Array, ...others: IndexModule[]): Promise<MarketplaceIndex> {
  const hash = await sha256(zip);
  const notes: IndexModule = {
    id: "@craftskillz/notes",
    creator: "@craftskillz",
    source: "https://github.com/craftskillz/notes",
    license: "MIT",
    tags: ["writing"],
    screenshots: [],
    versions: [{ version: "1.0.0", url: NOTES_URL, sha256: hash }],
    state: "listed",
    latest: {
      version: "1.0.0",
      url: NOTES_URL,
      sha256: hash,
      name: "Notes",
      description: "Write things down",
      icon: "modules/craftskillz/notes/1.0.0/icon.svg",
      convention: 1,
      permissions: {},
      widget: null,
      guide: { path: "guide.md", markdown: "# Notes", images: {} },
    },
  };
  return { format: 1, generatedAt: "2026-10-22T00:00:00.000Z", modules: [notes, ...others] };
}

function setup(index?: MarketplaceIndex, persistence: MemoryPersistence = createMemoryPersistence()) {
  const source = createMemoryIndexSource(index);
  const host = createHost({ persistence, locale: "en-US", theme: THEME, openView() {}, marketplace: { source, now: () => NOW } });
  return { source, host, persistence };
}

describe("the Marketplace as the Host reads it", () => {
  test("opening the screen fetches the index and keeps the copy with its date", async () => {
    const index = await indexOf(notesZip());
    const { host, persistence, source } = setup(index);
    const reading = await host.readMarketplace();
    assert.ok(reading.status === "online");
    assert.deepEqual(reading.index, index);
    assert.equal(reading.receivedAt, NOW.toISOString());
    assert.equal(source.fetches, 1);
    assert.deepEqual(await persistence.marketplace.read(), { index, receivedAt: NOW.toISOString() });
  });

  test("offline, the last copy is shown with the date it was received", async () => {
    const index = await indexOf(notesZip());
    const { host, source } = setup(index);
    await host.readMarketplace();
    source.offline = true;
    const reading = await host.readMarketplace();
    assert.ok(reading.status === "offline");
    assert.deepEqual(reading.index, index);
    assert.equal(reading.receivedAt, NOW.toISOString());
  });

  test("offline with no copy, the Marketplace is unavailable", async () => {
    const { host, source } = setup(await indexOf(notesZip()));
    source.offline = true;
    assert.deepEqual(await host.readMarketplace(), { status: "unavailable" });
  });

  test("without a Marketplace configured, it is unavailable", async () => {
    const host = createHost({ persistence: createMemoryPersistence(), locale: "en-US", theme: THEME, openView() {} });
    assert.deepEqual(await host.readMarketplace(), { status: "unavailable" });
  });

  test("search uses the Marketplace's own search and Permission filter, and never finds a withdrawn or banned Module", async () => {
    const base = await indexOf(notesZip());
    const [notes] = base.modules;
    const other = (name: string, patch: Partial<IndexModule>): IndexModule => ({
      ...notes,
      id: `@craftskillz/${name}`,
      latest: { ...notes.latest!, name },
      ...patch,
    });
    const index: MarketplaceIndex = {
      ...base,
      modules: [
        notes,
        other("weather", { latest: { ...notes.latest!, name: "Weather", permissions: { network: ["https://api.example.com"] } } }),
        other("old", { state: "withdrawn" }),
        other("evil", { state: "banned", reason: "malware" }),
      ],
    };
    const { host } = setup(index);
    const reading = await host.readMarketplace();
    assert.ok(reading.status === "online");
    assert.deepEqual(reading.search().map((m) => m.id), ["@craftskillz/notes", "@craftskillz/weather"]);
    assert.deepEqual(reading.search({ query: "weather" }).map((m) => m.id), ["@craftskillz/weather"]);
    assert.deepEqual(reading.search({ accepts: [] }).map((m) => m.id), ["@craftskillz/notes"]);
  });
});

const registered = async (persistence: MemoryPersistence) => (await persistence.registry.read())[0];

describe("packages from the Marketplace screen", () => {
  test("a package that no longer matches the release is refused, and nothing is written", async () => {
    const index = await indexOf(notesZip());
    const { host, persistence } = setup(index);
    const result = await host.inspectRelease(index.modules[0].latest!, notesZip("1.0.0", " tampered"));
    assert.ok(result.status === "mismatch");
    assert.equal(result.expected, index.modules[0].latest!.sha256);
    assert.equal(result.actual, await sha256(notesZip("1.0.0", " tampered")));
    assert.deepEqual(persistence.disk.size, 0);
    assert.deepEqual(await persistence.registry.read(), []);
  });

  test("a matching package is inspected like any .zip, carries its provenance, and records it on install", async () => {
    const zip = notesZip();
    const index = await indexOf(zip);
    const { host, persistence } = setup(index);
    const release = index.modules[0].latest!;
    const inspection = await host.inspectRelease(release, zip);
    assert.ok(inspection.status === "valid");
    const provenance = { source: "marketplace", version: "1.0.0", sha256: release.sha256 };
    assert.deepEqual(inspection.provenance, provenance);
    assert.equal(persistence.disk.size, 0);
    await inspection.install();
    assert.deepEqual((await registered(persistence)).provenance, provenance);
  });

  test("a matching package that does not comply is invalid, as for any .zip", async () => {
    const zip = zipSync({ "manifest.json": strToU8("{}") });
    const index = await indexOf(zip);
    const { host } = setup(index);
    const inspection = await host.inspectRelease(index.modules[0].latest!, zip);
    assert.equal(inspection.status, "invalid");
  });
});

describe("provenance", () => {
  const link = async (url: string, zip: Uint8Array, index?: MarketplaceIndex) => {
    const context = setup(index ?? (await indexOf(notesZip())));
    const inspection = await context.host.inspectZip(zip, { url });
    assert.ok(inspection.status === "valid");
    await inspection.install();
    return registered(context.persistence);
  };

  test("an install link whose URL and package are those of a version of the index is from the Marketplace", async () => {
    const module = await link(NOTES_URL, notesZip());
    assert.deepEqual(module.provenance, { source: "marketplace", version: "1.0.0", sha256: await sha256(notesZip()) });
  });

  test("the index copy answers an install link when the Marketplace cannot be reached", async () => {
    const { host, source, persistence } = setup(await indexOf(notesZip()));
    await host.readMarketplace();
    source.offline = true;
    const inspection = await host.inspectZip(notesZip(), { url: NOTES_URL });
    assert.ok(inspection.status === "valid");
    await inspection.install();
    assert.equal((await registered(persistence)).provenance?.source, "marketplace");
  });

  test("the same URL serving other bytes is an ordinary URL install", async () => {
    const module = await link(NOTES_URL, notesZip("1.0.0", " other"));
    assert.equal(module.provenance, undefined);
  });

  test("the package of the index served from another URL is an ordinary URL install", async () => {
    const module = await link("https://elsewhere.example/notes.zip", notesZip());
    assert.equal(module.provenance, undefined);
  });

  test("a banned version has no provenance", async () => {
    const index = await indexOf(notesZip());
    index.modules[0].versions[0].banned = "malware";
    const module = await link(NOTES_URL, notesZip(), index);
    assert.equal(module.provenance, undefined);
  });

  test("a local .zip never has provenance and never reads the index", async () => {
    const { host, source, persistence } = setup(await indexOf(notesZip()));
    const inspection = await host.inspectZip(notesZip());
    assert.ok(inspection.status === "valid");
    assert.equal(inspection.provenance, null);
    await inspection.install();
    assert.equal((await registered(persistence)).provenance, undefined);
    assert.equal(source.fetches, 0);
  });

  test("a folder of the Modules folder never has provenance, whatever its bytes", async () => {
    const { host, persistence } = setup(await indexOf(notesZip()));
    persistence.disk.set("notes", new Map(Object.entries(unzip(notesZip()))));
    const inspection = await host.inspectFolder("notes");
    assert.ok(inspection.status === "valid");
    await inspection.install();
    assert.equal((await registered(persistence)).provenance, undefined);
  });

  async function fromMarketplace() {
    const index = await indexOf(notesZip());
    const context = setup(index);
    const inspection = await context.host.inspectRelease(index.modules[0].latest!, notesZip());
    assert.ok(inspection.status === "valid");
    await inspection.install();
    return context;
  }

  test("updating from a local .zip removes the provenance: the Module is local now", async () => {
    const { host, persistence } = await fromMarketplace();
    const inspection = await host.inspectZip(notesZip("1.1.0"));
    assert.ok(inspection.status === "update");
    assert.equal(inspection.provenance, null);
    await inspection.update();
    const module = await registered(persistence);
    assert.equal(module.version, "1.1.0");
    assert.equal(module.provenance, undefined);
  });

  test("updating from the Marketplace sets the provenance of the incoming version", async () => {
    const { host, persistence } = await fromMarketplace();
    const next = notesZip("1.1.0");
    const release = { ...(await indexOf(notesZip())).modules[0].latest!, version: "1.1.0", sha256: await sha256(next) };
    const inspection = await host.inspectRelease(release, next);
    assert.ok(inspection.status === "update");
    assert.deepEqual(inspection.provenance, { source: "marketplace", version: "1.1.0", sha256: release.sha256 });
    await inspection.update();
    assert.deepEqual((await registered(persistence)).provenance, inspection.provenance);
  });

  test("editing the version of the folder by hand drops the provenance when the Module opens", async () => {
    const { host, persistence } = await fromMarketplace();
    assert.ok((await host.open("@craftskillz/notes")).status === "ready");
    assert.equal((await registered(persistence)).provenance?.source, "marketplace");
    const files = persistence.disk.get("notes")!;
    const manifest = JSON.parse(strFromU8(files.get("manifest.json")!));
    files.set("manifest.json", strToU8(JSON.stringify({ ...manifest, version: "1.0.1" })));
    assert.ok((await host.open("@craftskillz/notes")).status === "ready");
    const module = await registered(persistence);
    assert.equal(module.version, "1.0.1");
    assert.equal(module.provenance, undefined);
  });
});

describe("what the Host tells of the Modules installed from the Marketplace", () => {
  const HOUR_MS = 60 * 60 * 1000;

  /** Notes 1.0.0 installed from the Marketplace screen (or, `local`, from a .zip), with a clock the test moves. */
  async function installed({ local = false } = {}) {
    const zip = notesZip();
    const index = await indexOf(zip);
    const clock = { now: NOW };
    const persistence = createMemoryPersistence();
    const source = createMemoryIndexSource(index);
    const host = createHost({ persistence, locale: "en-US", theme: THEME, openView() {}, marketplace: { source, now: () => clock.now } });
    const inspection = local ? await host.inspectZip(zip) : await host.inspectRelease(index.modules[0].latest!, zip);
    assert.ok(inspection.status === "valid");
    await inspection.install();
    return { host, source, persistence, clock, index };
  }

  /** `index` with a newer version of Notes published, which becomes its `latest`. */
  async function withRelease(index: MarketplaceIndex, version: string): Promise<MarketplaceIndex> {
    const next = structuredClone(index);
    const [notes] = next.modules;
    const hash = await sha256(notesZip(version));
    const url = `https://example.org/notes-${version}.zip`;
    notes.versions.push({ version, url, sha256: hash });
    notes.latest = { ...notes.latest!, version, url, sha256: hash };
    return next;
  }

  test("the Host's start reads the index at most once a day", async () => {
    const { host, source, clock } = await installed();
    assert.equal(source.fetches, 0);
    await host.checkMarketplace();
    assert.equal(source.fetches, 1);
    await host.checkMarketplace();
    clock.now = new Date(NOW.getTime() + 23 * HOUR_MS);
    await host.checkMarketplace();
    assert.equal(source.fetches, 1);
    clock.now = new Date(NOW.getTime() + 25 * HOUR_MS);
    await host.checkMarketplace();
    assert.equal(source.fetches, 2);
  });

  test("unreachable at the start, the Host keeps its copy and tries again at the next start", async () => {
    const { host, source, persistence } = await installed();
    source.offline = true;
    await host.checkMarketplace();
    assert.equal(await persistence.marketplace.read(), null);
    source.offline = false;
    await host.checkMarketplace();
    assert.equal(source.fetches, 2);
    assert.ok(await persistence.marketplace.read());
  });

  test("with no Module from the Marketplace, the Host's start never reads the index", async () => {
    const { host, source } = await installed({ local: true });
    await host.checkMarketplace();
    assert.equal(source.fetches, 0);
  });

  test("a newer version is offered, and nothing is updated", async () => {
    const { host, source, persistence, index } = await installed();
    source.index = await withRelease(index, "1.1.0");
    await host.checkMarketplace();
    const notices = await host.marketplaceNotices();
    assert.deepEqual(notices, [{ id: "@craftskillz/notes", version: "1.0.0", update: source.index.modules[0].latest, ban: null, withdrawal: null }]);
    assert.equal((await registered(persistence)).version, "1.0.0");
  });

  test("the installed version, when it is the newest, gives no notice", async () => {
    const { host } = await installed();
    await host.checkMarketplace();
    assert.deepEqual(await host.marketplaceNotices(), []);
  });

  test("a banned version gives its reason and recommends the newest version", async () => {
    const { host, source, index } = await installed();
    const next = await withRelease(index, "1.1.0");
    next.modules[0].versions[0].banned = "Sends your notes away.";
    source.index = next;
    await host.checkMarketplace();
    const [notice] = await host.marketplaceNotices();
    assert.deepEqual(notice.ban, { scope: "version", reason: "Sends your notes away.", recommended: next.modules[0].latest });
    assert.deepEqual(notice.update, next.modules[0].latest);
    assert.equal(notice.withdrawal, null);
  });

  test("a banned version with no newer one recommends nothing", async () => {
    const { host, source, index } = await installed();
    const next = structuredClone(index);
    next.modules[0].versions[0].banned = "Sends your notes away.";
    next.modules[0].latest = null;
    source.index = next;
    await host.checkMarketplace();
    const [notice] = await host.marketplaceNotices();
    assert.deepEqual(notice.ban, { scope: "version", reason: "Sends your notes away.", recommended: null });
    assert.equal(notice.update, null);
  });

  test("a banned Module gives its reason, offers no update, and keeps running", async () => {
    const { host, source, index, persistence } = await installed();
    const next = await withRelease(index, "1.1.0");
    next.modules[0].state = "banned";
    next.modules[0].reason = "Malware.";
    source.index = next;
    await host.checkMarketplace();
    assert.deepEqual(await host.marketplaceNotices(), [
      { id: "@craftskillz/notes", version: "1.0.0", update: null, ban: { scope: "module", reason: "Malware.", recommended: null }, withdrawal: null },
    ]);
    assert.equal((await host.open("@craftskillz/notes")).status, "ready");
    assert.equal((await persistence.registry.read()).length, 1);
  });

  test("a banned Namespace bans its Modules, as the Index Generator writes it", async () => {
    const zip = notesZip();
    const entry: Entry = {
      id: "@craftskillz/notes",
      source: "https://github.com/craftskillz/notes",
      license: "MIT",
      versions: [{ version: "1.0.0", url: NOTES_URL, sha256: await sha256(zip) }],
    };
    const generate = async (namespaces: Namespaces) =>
      (
        await buildIndex({
          listings: [{ entry, files: new Map() }],
          packages: new Map([["@craftskillz/notes@1.0.0", zip]]),
          generatedAt: NOW,
          namespaces,
        })
      ).index;
    const index = await generate({ craftskillz: { account: "craftskillz", id: 1, state: "active" } });
    const { host, source } = setup(index);
    const inspection = await host.inspectRelease(index.modules[0].latest!, zip);
    assert.ok(inspection.status === "valid");
    await inspection.install();
    source.index = await generate({ craftskillz: { account: "craftskillz", id: 1, state: "banned", reason: "Spam." } });
    await host.checkMarketplace();
    const [notice] = await host.marketplaceNotices();
    assert.deepEqual(notice.ban, { scope: "module", reason: "Spam.", recommended: null });
  });

  test("a withdrawn Module gives a neutral note, and no update", async () => {
    const { host, source, index } = await installed();
    const next = await withRelease(index, "1.1.0");
    next.modules[0].state = "withdrawn";
    source.index = next;
    await host.checkMarketplace();
    assert.deepEqual(await host.marketplaceNotices(), [
      { id: "@craftskillz/notes", version: "1.0.0", update: null, ban: null, withdrawal: { scope: "module" } },
    ]);
  });

  test("a withdrawn version gives a neutral note, and offers the newer version", async () => {
    const { host, source, index } = await installed();
    const next = await withRelease(index, "1.1.0");
    next.modules[0].versions[0].withdrawn = true;
    source.index = next;
    await host.checkMarketplace();
    const [notice] = await host.marketplaceNotices();
    assert.deepEqual(notice.withdrawal, { scope: "version" });
    assert.equal(notice.ban, null);
    assert.deepEqual(notice.update, next.modules[0].latest);
  });

  test("a local Module with the Module ID of a listing gets no notice, whatever the index says", async () => {
    const { host, source, index } = await installed({ local: true });
    const next = await withRelease(index, "1.1.0");
    next.modules[0].state = "banned";
    next.modules[0].reason = "Malware.";
    source.index = next;
    await host.readMarketplace();
    assert.deepEqual(await host.marketplaceNotices(), []);
  });

  test("before any copy of the index, there is no notice", async () => {
    const { host } = await installed();
    assert.deepEqual(await host.marketplaceNotices(), []);
  });
});
