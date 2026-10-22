import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { strFromU8, strToU8, unzipSync, zipSync } from "fflate";
import { connect } from "@tessello/sdk";
import { createHost, createMemoryPersistence, type Host, type MemoryPersistence, type Theme } from "../src/index.ts";
import { mountFrame } from "./memory-channel.ts";

const THEME: Theme = {
  mode: "light",
  colors: { background: "#ffffff", surface: "#f4f5f7", text: "#16181d", textMuted: "#5f6670", accent: "#2f6fec", border: "#d9dce1" },
};
const PAGE = `<!doctype html><script>parent.postMessage({ tessello: 1, type: "ready", id: "1" }, "*")</script>`;

const newHost = (persistence = createMemoryPersistence()) =>
  createHost({ persistence, locale: "en-US", theme: THEME, openView: () => {} });

/** A Module's folder, with a Widget. */
function moduleFiles(id: string, name: string, manifest: object = {}) {
  return new Map(
    Object.entries({
      "manifest.json": JSON.stringify({
        convention: 1,
        id,
        name,
        version: "1.0.0",
        icon: "icon.svg",
        view: { entry: "view/index.html" },
        widget: { entry: "widget/index.html", size: "S" },
        guide: "guide.md",
        ...manifest,
      }),
      "icon.svg": "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 1 1'/>",
      "view/index.html": PAGE,
      "widget/index.html": PAGE,
      "guide.md": `# ${name}`,
    }).map(([path, content]) => [path, strToU8(content)]),
  );
}

/** Places and activates these Modules, in this order: `[folder, id, name, manifest]`. */
async function withModules(modules: [string, string, string, object?][], persistence = createMemoryPersistence()) {
  const host = newHost(persistence);
  for (const [folder, id, name, manifest] of modules) {
    persistence.disk.set(folder, moduleFiles(id, name, manifest));
    const inspection = await host.inspectFolder(folder);
    assert.ok(inspection.status === "valid");
    await inspection.install();
  }
  return { host, persistence };
}

/** The storage of a Module, as its View sees it through the SDK. */
async function storageOf(host: Host, id: string) {
  const module = await connect({ transport: mountFrame(host, { module: { id, version: "1.0.0" }, surface: "view" }).transport });
  return module.storage;
}

/** What the Launcher shows and what each active Module stores, to compare two spaces. */
async function spaceOf(host: Host) {
  const modules = await host.modules();
  const data: Record<string, Record<string, unknown>> = {};
  for (const entry of modules) {
    if (entry.status !== "active") continue;
    const storage = await storageOf(host, entry.id!);
    data[entry.id!] = Object.fromEntries(await Promise.all((await storage.keys()).map(async (key) => [key, await storage.get(key)])));
  }
  return {
    modules: modules.map(({ status, folder, id, name, permissions }) => ({ status, folder, id, name, permissions })),
    home: (await host.home()).map((widget) => widget.id),
    data,
  };
}

/** Notes and Weather activated, the Home rearranged, and data in both. */
async function aSpace() {
  const { host, persistence } = await withModules([
    ["notes", "@craftskillz/notes", "Notes"],
    ["weather", "@test/weather", "Weather", { permissions: { network: ["https://api.example.com"] } }],
  ]);
  await host.arrangeHome(["@test/weather", "@craftskillz/notes"]);
  await (await storageOf(host, "@craftskillz/notes")).set("notes", [{ text: "Buy milk" }]);
  const weather = await storageOf(host, "@test/weather");
  await weather.set("cities", ["Paris", "Rabat"]);
  await weather.set("unit", "celsius");
  return { host, persistence };
}

/** Imports an export into a host, accepting the Permissions. */
async function importInto(host: Host, file: Uint8Array) {
  const inspection = await host.inspectSpace(file);
  assert.ok(inspection.status === "valid", JSON.stringify(inspection));
  await inspection.import();
  return inspection;
}

describe("export and import of the space", () => {
  test("importing an export into an empty space gives back exactly the exported space", async () => {
    const { host } = await aSpace();
    const exported = await host.exportSpace();

    const other = newHost();
    await importInto(other, exported.file);

    assert.deepEqual(await spaceOf(other), await spaceOf(host));
    assert.deepEqual(await spaceOf(other), {
      modules: [
        { status: "active", folder: "notes", id: "@craftskillz/notes", name: "Notes", permissions: {} },
        { status: "active", folder: "weather", id: "@test/weather", name: "Weather", permissions: { network: ["https://api.example.com"] } },
      ],
      home: ["@test/weather", "@craftskillz/notes"],
      data: {
        "@craftskillz/notes": { notes: [{ text: "Buy milk" }] },
        "@test/weather": { cities: ["Paris", "Rabat"], unit: "celsius" },
      },
    });
  });

  test("before activating them, the import shows each Module with the Permissions the User had granted, and writes nothing", async () => {
    const { host } = await aSpace();
    const other = newHost();
    const inspection = await other.inspectSpace((await host.exportSpace()).file);

    assert.ok(inspection.status === "valid");
    assert.deepEqual(
      inspection.modules.map(({ manifest, permissions, installed }) => ({ name: manifest.name, permissions, installed })),
      [
        { name: "Notes", permissions: {}, installed: false },
        { name: "Weather", permissions: { network: ["https://api.example.com"] }, installed: false },
      ],
    );
    assert.equal(new TextDecoder().decode(inspection.modules[0].icon.bytes), "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 1 1'/>");
    assert.deepEqual(await spaceOf(other), { modules: [], home: [], data: {} }, "declining is not calling import()");
  });

  describe("a file that cannot be imported whole is refused with an explanation, and changes nothing", () => {
    /** An export of `aSpace()` changed by `tamper`, which gets its files, the description parsed. */
    async function tampered(tamper: (files: Record<string, Uint8Array>, description: any) => void) {
      const { host } = await aSpace();
      const files = unzipSync((await host.exportSpace()).file);
      const description = JSON.parse(strFromU8(files["tessello-space.json"]));
      tamper(files, description);
      files["tessello-space.json"] = strToU8(JSON.stringify(description));
      return zipSync(files);
    }

    /** Imports into a space holding Photos, and returns why the file was refused. */
    async function refusal(file: Uint8Array) {
      const { host } = await withModules([["photos", "@test/photos", "Photos"]]);
      await (await storageOf(host, "@test/photos")).set("album", "Holidays");
      const before = await spaceOf(host);
      const inspection = await host.inspectSpace(file);
      assert.ok(inspection.status === "invalid");
      assert.deepEqual(await spaceOf(host), before);
      return inspection;
    }

    test("a file that is not a .zip", async () => {
      assert.equal((await refusal(strToU8("hello"))).problem, "The file is not a readable .zip archive.");
    });

    test("a .zip that is not an export, such as a Module's package", async () => {
      const inspection = await refusal(zipSync(Object.fromEntries(moduleFiles("@test/photos", "Photos"))));
      assert.match(inspection.problem, /not an export of Tessello/);
    });

    test("an export holding a Module that no longer passes the Validator, with the Validator's report", async () => {
      const inspection = await refusal(
        await tampered((files) => {
          delete files["modules/weather/guide.md"];
        }),
      );
      assert.equal(inspection.problem, "@test/weather does not comply with the Convention.");
      assert.ok(inspection.report?.issues.some((issue) => issue.severity === "error" && issue.message.includes("guide.md")));
    });

    test("an export granting a Permission that is not an origin", async () => {
      const inspection = await refusal(
        await tampered((_, description) => {
          description.modules[1].permissions = { network: ["https://api.example.com; script-src *"] };
        }),
      );
      assert.match(inspection.problem, /^The Permission "network" granted to @test\/weather/);
    });

    test("an export whose folder name could not be written to the Modules folder", async () => {
      const inspection = await refusal(
        await tampered((files, description) => {
          for (const path of Object.keys(files)) {
            if (path.startsWith("modules/notes/")) files[path.replace("modules/notes/", "modules/no:tes/")] = files[path];
          }
          description.modules[0].folder = "no:tes";
        }),
      );
      assert.match(inspection.problem, /@craftskillz\/notes has no valid folder name/);
    });

    test("an archive that would be too large once decompressed is refused before being decompressed", async () => {
      const inspection = await refusal(
        await tampered((files) => {
          files["modules/notes/huge.bin"] = new Uint8Array(11 * 1024 * 1024);
        }),
      );
      assert.match(inspection.problem, /too large/);
    });

    test("an export whose data goes beyond what a Module may store", async () => {
      const inspection = await refusal(
        await tampered((_, description) => {
          description.modules[0].data.big = "x".repeat(1024 * 1024 + 1);
        }),
      );
      assert.match(inspection.problem, /^The data of @craftskillz\/notes: the value of "big" is larger than/);
    });
  });

  test("into a space that is not empty, the import adds the Modules not installed and leaves the installed ones as they are", async () => {
    const { host } = await aSpace();
    const exported = (await host.exportSpace()).file;

    // Another space: Weather 2.0 with its own data, Photos, and a folder already named "notes".
    const { host: other, persistence } = await withModules([
      ["photos", "@test/photos", "Photos"],
      ["weather", "@test/weather", "Weather", { version: "2.0.0", permissions: { network: ["https://other.example.com"] } }],
    ]);
    await (await storageOf(other, "@test/weather")).set("cities", ["Oslo"]);
    persistence.disk.set("notes", moduleFiles("@test/someone-else", "Someone else's notes"));

    const inspection = await other.inspectSpace(exported);
    assert.ok(inspection.status === "valid");
    assert.deepEqual(
      inspection.modules.map(({ manifest, installed }) => ({ id: manifest.id, installed })),
      [
        { id: "@craftskillz/notes", installed: false },
        { id: "@test/weather", installed: true },
      ],
    );
    await inspection.import();

    assert.deepEqual(await spaceOf(other), {
      modules: [
        { status: "active", folder: "photos", id: "@test/photos", name: "Photos", permissions: {} },
        { status: "active", folder: "weather", id: "@test/weather", name: "Weather", permissions: { network: ["https://other.example.com"] } },
        { status: "active", folder: "notes-2", id: "@craftskillz/notes", name: "Notes", permissions: {} },
        { status: "new", folder: "notes", id: "@test/someone-else", name: "Someone else's notes", permissions: null },
      ],
      home: ["@test/photos", "@test/weather", "@craftskillz/notes"],
      data: {
        "@test/photos": {},
        "@test/weather": { cities: ["Oslo"] },
        "@craftskillz/notes": { notes: [{ text: "Buy milk" }] },
      },
    });
    assert.equal(JSON.parse(strFromU8(persistence.disk.get("weather")!.get("manifest.json")!)).version, "2.0.0", "its code is kept");
  });

  test("the export leaves out a registered Module whose folder is gone, and says so", async () => {
    const { host, persistence } = await aSpace();
    persistence.disk.delete("notes");
    const exported = await host.exportSpace();
    assert.deepEqual(exported.missing, ["@craftskillz/notes"]);

    const other = newHost();
    await importInto(other, exported.file);
    assert.deepEqual((await other.modules()).map((entry) => entry.id), ["@test/weather"]);
    assert.deepEqual((await spaceOf(other)).home, ["@test/weather"]);
  });

  test("the import grants only the Permissions the Module declares: an export cannot widen them", async () => {
    const { host } = await aSpace();
    const files = unzipSync((await host.exportSpace()).file);
    const description = JSON.parse(strFromU8(files["tessello-space.json"]));
    description.modules[1].permissions = { network: ["https://api.example.com", "https://tracker.example.net"] };
    files["tessello-space.json"] = strToU8(JSON.stringify(description));

    const other = newHost();
    const inspection = await importInto(other, zipSync(files));
    assert.deepEqual(inspection.modules[1].permissions, { network: ["https://api.example.com"] });
    assert.deepEqual((await other.modules())[1].permissions, { network: ["https://api.example.com"] });
  });
});

