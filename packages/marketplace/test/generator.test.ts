import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { describe, test } from "node:test";
import { strToU8, zipSync } from "fflate";
import { buildIndex, describedVersion, searchModules, type IndexInput, type Entry, type EntryVersion, type Namespaces } from "../src/index.ts";

const READY_VIEW = `<!doctype html><script>parent.postMessage({ tessello: 1, type: "ready", id: "1" }, "*")</script>`;
const PNG = Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3]);
const GENERATED_AT = new Date("2026-05-01T08:30:00Z");

const sha256 = (bytes: Uint8Array) => createHash("sha256").update(bytes).digest("hex");

/** A real, valid Module package whose Manifest can be overridden. */
function zip(id: string, version: string, manifest: Record<string, unknown> = {}, guide = "# Guide\n\nHello.\n"): Uint8Array {
  return zipSync({
    "manifest.json": strToU8(
      JSON.stringify({
        convention: 1,
        id,
        name: "Weather",
        version,
        icon: "icon.svg",
        view: { entry: "view/index.html" },
        guide: "guide.md",
        ...manifest,
      }),
    ),
    "icon.svg": strToU8("<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 1 1'/>"),
    "view/index.html": strToU8(READY_VIEW),
    "widget/index.html": strToU8(READY_VIEW),
    "guide.md": strToU8(guide),
    "docs/shot.png": PNG,
  });
}

const listed = (id: string, version: string, bytes: Uint8Array, extra: Partial<EntryVersion> = {}): EntryVersion => ({
  version,
  url: `https://example.org/${id.slice(1).replace("/", "-")}-${version}.zip`,
  sha256: sha256(bytes),
  ...extra,
});

/** An index input from entries and their packages; each package is keyed "<id>@<version>". */
function input(
  listings: Array<{ entry: Entry; files?: Map<string, Uint8Array> }>,
  packages: Array<[string, Uint8Array]> = [],
  namespaces?: Namespaces,
): IndexInput {
  return {
    ...(namespaces ? { namespaces } : {}),
    listings: listings.map(({ entry, files }) => ({ entry, files: files ?? new Map() })),
    packages: new Map(packages),
    generatedAt: GENERATED_AT,
  };
}

const WEATHER_1 = zip("@yassine/weather", "1.0.0", {
  description: "Forecasts for your cities.",
  permissions: { network: ["https://api.weather.example"] },
  widget: { entry: "widget/index.html", size: "M" },
}, "# Weather\n\n![Forecast](docs/shot.png)\n![Missing](docs/none.png)\n![Remote](https://example.org/x.png)\n");

const weather = (overrides: Partial<Entry> = {}): Entry => ({
  id: "@yassine/weather",
  source: "https://github.com/yassine/weather",
  license: "MIT",
  versions: [listed("@yassine/weather", "1.0.0", WEATHER_1)],
  ...overrides,
});

describe("from a listing to the index", () => {
  test("describes the newest version with what its Manifest says, and copies the assets", async () => {
    const generated = await buildIndex(
      input(
        [{ entry: weather({ tags: ["weather"], screenshots: ["main.png"] }), files: new Map([["main.png", PNG]]) }],
        [["@yassine/weather@1.0.0", WEATHER_1]],
      ),
    );

    assert.deepEqual(generated.issues, []);
    assert.equal(generated.index.format, 1);
    assert.equal(generated.index.generatedAt, "2026-05-01T08:30:00.000Z");
    const [module] = generated.index.modules;
    assert.equal(module.id, "@yassine/weather");
    assert.equal(module.creator, "@yassine");
    assert.equal(module.source, "https://github.com/yassine/weather");
    assert.equal(module.license, "MIT");
    assert.deepEqual(module.tags, ["weather"]);
    assert.deepEqual(module.screenshots, ["modules/yassine/weather/main.png"]);
    assert.equal(module.state, "listed");
    assert.deepEqual(module.versions, weather().versions);
    assert.deepEqual(module.latest, {
      version: "1.0.0",
      url: weather().versions[0].url,
      sha256: sha256(WEATHER_1),
      name: "Weather",
      description: "Forecasts for your cities.",
      icon: "modules/yassine/weather/1.0.0/icon.svg",
      convention: 1,
      permissions: { network: ["https://api.weather.example"] },
      widget: { size: "M" },
      guide: {
        path: "guide.md",
        markdown: "# Weather\n\n![Forecast](docs/shot.png)\n![Missing](docs/none.png)\n![Remote](https://example.org/x.png)\n",
        images: { "docs/shot.png": "modules/yassine/weather/1.0.0/docs/shot.png" },
      },
    });
    assert.deepEqual([...generated.assets.keys()].sort(), [
      "modules/yassine/weather/1.0.0/docs/shot.png",
      "modules/yassine/weather/1.0.0/icon.svg",
      "modules/yassine/weather/main.png",
    ]);
    assert.deepEqual(generated.assets.get("modules/yassine/weather/main.png"), PNG);
    JSON.stringify(generated.index);
  });

  test("sorts the Modules by id and tags none as an empty list", async () => {
    const other = zip("@abel/clock", "0.1.0", { name: "Clock" });
    const generated = await buildIndex(
      input(
        [
          { entry: weather() },
          { entry: { id: "@abel/clock", source: "https://github.com/abel/clock", license: "MIT", versions: [listed("@abel/clock", "0.1.0", other)] } },
        ],
        [
          ["@yassine/weather@1.0.0", WEATHER_1],
          ["@abel/clock@0.1.0", other],
        ],
      ),
    );
    assert.deepEqual(generated.index.modules.map((module) => module.id), ["@abel/clock", "@yassine/weather"]);
    assert.deepEqual(generated.index.modules[0].tags, []);
    assert.deepEqual(generated.index.modules[0].latest?.permissions, {});
    assert.equal(generated.index.modules[0].latest?.widget, null);
    assert.equal(generated.index.modules[0].latest?.description, undefined);
  });

  test("keeps a banned Module with its reason, and a Ban wins over a Withdrawal", async () => {
    const { index } = await buildIndex(
      input([{ entry: weather({ banned: "Exfiltrates data.", withdrawn: true }) }], [["@yassine/weather@1.0.0", WEATHER_1]]),
    );
    assert.equal(index.modules[0].state, "banned");
    assert.equal(index.modules[0].reason, "Exfiltrates data.");
    assert.equal(index.modules[0].latest?.version, "1.0.0");
    assert.deepEqual(searchModules(index.modules), []);
  });

  describe("the state of its Namespace", () => {
    const record = (state: "active" | "frozen" | "banned", reason?: string) => ({
      yassine: { account: "yassine", id: 1, state, ...(reason !== undefined ? { reason } : {}) },
    });
    const build = (entry: Entry, namespaces: Namespaces) =>
      buildIndex(input([{ entry }], [["@yassine/weather@1.0.0", WEATHER_1]], namespaces));

    test("bans a listed Module of a banned Namespace, with the Namespace's reason", async () => {
      const { index } = await build(weather(), record("banned", "Impersonation."));
      assert.equal(index.modules[0].state, "banned");
      assert.equal(index.modules[0].reason, "Impersonation.");
      assert.equal(index.modules[0].latest?.version, "1.0.0");
      assert.deepEqual(searchModules(index.modules), []);
    });

    test("keeps the Module's own Ban reason over the Namespace's", async () => {
      const { index } = await build(weather({ banned: "Exfiltrates data." }), record("banned", "Impersonation."));
      assert.equal(index.modules[0].reason, "Exfiltrates data.");
    });

    test("bans a withdrawn Module of a banned Namespace", async () => {
      const { index } = await build(weather({ withdrawn: true }), record("banned", "Impersonation."));
      assert.equal(index.modules[0].state, "banned");
      assert.equal(index.modules[0].reason, "Impersonation.");
    });

    test("gives a reason when the banned Namespace has none", async () => {
      const { index } = await build(weather(), record("banned"));
      assert.equal(index.modules[0].reason, "The Namespace @yassine is banned.");
    });

    test("changes nothing for an active or frozen Namespace", async () => {
      for (const state of ["active", "frozen"] as const) {
        const { index } = await build(weather(), record(state, "ignored"));
        assert.equal(index.modules[0].state, "listed");
        assert.equal(index.modules[0].reason, undefined);
        assert.equal(searchModules(index.modules).length, 1);
      }
    });

    test("leaves the Modules of other Namespaces alone", async () => {
      const { index } = await build(weather(), { other: { account: "other", id: 2, state: "banned", reason: "x" } });
      assert.equal(index.modules[0].state, "listed");
    });
  });

  test("keeps a withdrawn Module with its state", async () => {
    const { index } = await buildIndex(input([{ entry: weather({ withdrawn: true }) }], [["@yassine/weather@1.0.0", WEATHER_1]]));
    assert.equal(index.modules[0].state, "withdrawn");
    assert.equal(index.modules[0].reason, undefined);
    assert.deepEqual(searchModules(index.modules), []);
  });

  test("describes the previous version when the newest is banned or withdrawn", async () => {
    const v2 = zip("@yassine/weather", "2.0.0");
    const v3 = zip("@yassine/weather", "3.0.0");
    const entry = weather({
      versions: [
        listed("@yassine/weather", "1.0.0", WEATHER_1),
        listed("@yassine/weather", "2.0.0", v2),
        listed("@yassine/weather", "3.0.0", v3, { banned: "Malicious." }),
      ],
    });
    const { index, issues } = await buildIndex(input([{ entry }], [["@yassine/weather@2.0.0", v2]]));
    assert.deepEqual(issues, []);
    assert.equal(index.modules[0].state, "listed");
    assert.equal(index.modules[0].latest?.version, "2.0.0");
    assert.equal(index.modules[0].versions[2].banned, "Malicious.");
    assert.equal(searchModules(index.modules).length, 1);
  });

  test("has no latest, and is not searchable, when every version is withdrawn or banned", async () => {
    const entry = weather({ versions: [listed("@yassine/weather", "1.0.0", WEATHER_1, { withdrawn: true })] });
    const { index, issues } = await buildIndex(input([{ entry }]));
    assert.deepEqual(issues, []);
    assert.equal(index.modules[0].state, "listed");
    assert.equal(index.modules[0].latest, null);
    assert.deepEqual(searchModules(index.modules), []);
  });

  test("never describes a package that is not the listed one", async () => {
    const tampered = zip("@yassine/weather", "1.0.0", { name: "Evil" });
    const { index, issues, assets } = await buildIndex(input([{ entry: weather() }], [["@yassine/weather@1.0.0", tampered]]));
    assert.equal(index.modules[0].latest, null);
    assert.deepEqual(issues.map((i) => [i.code, i.version]), [["index/sha256-mismatch", "1.0.0"]]);
    assert.equal(assets.size, 0);
  });

  test("reports a package that was not downloaded", async () => {
    const { index, issues } = await buildIndex(input([{ entry: weather() }]));
    assert.equal(index.modules[0].latest, null);
    assert.deepEqual(issues.map((i) => i.code), ["index/package-missing"]);
  });

  test("reports a package that is not a valid Module", async () => {
    const junk = Uint8Array.from([1, 2, 3]);
    const entry = weather({ versions: [listed("@yassine/weather", "1.0.0", junk)] });
    const { index, issues } = await buildIndex(input([{ entry }], [["@yassine/weather@1.0.0", junk]]));
    assert.equal(index.modules[0].latest, null);
    assert.deepEqual(issues.map((i) => i.code), ["index/invalid-package"]);
  });

  test("leaves out a screenshot absent from the listing folder", async () => {
    const { index, issues } = await buildIndex(
      input([{ entry: weather({ screenshots: ["a.png", "b.png"] }), files: new Map([["b.png", PNG]]) }], [["@yassine/weather@1.0.0", WEATHER_1]]),
    );
    assert.deepEqual(index.modules[0].screenshots, ["modules/yassine/weather/b.png"]);
    assert.deepEqual(issues.map((i) => [i.code, i.file]), [["index/screenshot-missing", "a.png"]]);
  });
});

describe("searching the index", () => {
  async function modules() {
    const defs: Array<[string, string, Record<string, unknown>, string[]]> = [
      ["@yassine/weather", "Weather", { description: "Forecasts for your cities.", permissions: { network: ["https://api.example"] } }, ["meteo"]],
      ["@abel/clock", "World Clock", { description: "Time zones." }, ["time", "tools"]],
      ["@abel/lan-sync", "LAN Sync", { permissions: { localNetwork: ["http://192.168.1.10"] } }, []],
    ];
    const listings = [];
    const packages: Array<[string, Uint8Array]> = [];
    for (const [id, name, manifest, tags] of defs) {
      const bytes = zip(id, "1.0.0", { name, ...manifest });
      listings.push({ entry: { id, source: "https://github.com/x/y", license: "MIT", tags, versions: [listed(id, "1.0.0", bytes)] } });
      packages.push([`${id}@1.0.0`, bytes]);
    }
    return (await buildIndex(input(listings, packages))).index.modules;
  }
  const ids = (found: Array<{ id: string }>) => found.map((module) => module.id);

  test("returns every listed Module for an empty query, in index order", async () => {
    const all = await modules();
    assert.deepEqual(ids(searchModules(all)), ["@abel/clock", "@abel/lan-sync", "@yassine/weather"]);
    assert.deepEqual(ids(searchModules(all, { query: "  " })), ["@abel/clock", "@abel/lan-sync", "@yassine/weather"]);
  });

  test("matches a word in the name, description, tags, creator or id, ignoring case", async () => {
    const all = await modules();
    assert.deepEqual(ids(searchModules(all, { query: "WEATHER" })), ["@yassine/weather"]);
    assert.deepEqual(ids(searchModules(all, { query: "cities" })), ["@yassine/weather"]);
    assert.deepEqual(ids(searchModules(all, { query: "tools" })), ["@abel/clock"]);
    assert.deepEqual(ids(searchModules(all, { query: "@yassine" })), ["@yassine/weather"]);
    assert.deepEqual(ids(searchModules(all, { query: "lan-sync" })), ["@abel/lan-sync"]);
  });

  test("requires every word of the query", async () => {
    const all = await modules();
    assert.deepEqual(ids(searchModules(all, { query: "abel clock" })), ["@abel/clock"]);
    assert.deepEqual(ids(searchModules(all, { query: "abel weather" })), []);
  });

  test("keeps only the Modules whose Permissions the User accepts", async () => {
    const all = await modules();
    assert.deepEqual(ids(searchModules(all, { accepts: [] })), ["@abel/clock"]);
    assert.deepEqual(ids(searchModules(all, { accepts: ["network"] })), ["@abel/clock", "@yassine/weather"]);
    assert.deepEqual(ids(searchModules(all, { accepts: ["network", "localNetwork"] })).length, 3);
    assert.deepEqual(ids(searchModules(all, { accepts: ["network"], query: "sync" })), []);
  });
});

describe("the version a listing is described by", () => {
  test("is the newest one that is neither withdrawn nor banned", () => {
    const v = (version: string, extra: Partial<EntryVersion> = {}): EntryVersion => ({ version, url: "https://example.org/x.zip", sha256: "0".repeat(64), ...extra });
    const entry = (versions: EntryVersion[]): Entry => ({ id: "@a/b", source: "https://github.com/a/b", license: "MIT", versions });
    assert.equal(describedVersion(entry([v("1.0.0"), v("1.1.0"), v("1.2.0", { withdrawn: true }), v("1.3.0", { banned: "x" })]))?.version, "1.1.0");
    assert.equal(describedVersion(entry([v("1.0.0", { withdrawn: true })])), undefined);
  });
});
