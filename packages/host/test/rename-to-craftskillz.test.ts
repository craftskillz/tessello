import assert from "node:assert/strict";
import { mkdir, mkdtemp, readdir, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { describe, test } from "node:test";
import { strFromU8, strToU8, unzipSync } from "fflate";
import { createHost, createMemoryPersistence, type Theme } from "@tessello/host-core";
import { renameModulesFolder, renameSpaceExport } from "../scripts/rename-to-craftskillz.ts";

const json = (value: unknown) => `${JSON.stringify(value, null, 2)}\n`;

const manifest = (id: string, name: string) =>
  json({ convention: 1, id, name, version: "1.0.0", icon: "icon.svg", view: { entry: "view/index.html" }, guide: "guide.md" });

/** A Modules folder as the Host writes it: path → content. */
async function aModulesFolder(files: Record<string, string>) {
  const root = await mkdtemp(join(tmpdir(), "tessello-rename-"));
  for (const [path, content] of Object.entries(files)) {
    await mkdir(dirname(join(root, path)), { recursive: true });
    await writeFile(join(root, path), content);
  }
  return root;
}

/** Every file under `folder`: path → content. */
async function filesOf(folder: string) {
  const files: Record<string, string> = {};
  for (const entry of await readdir(folder, { recursive: true, withFileTypes: true })) {
    if (!entry.isFile()) continue;
    const path = join(entry.parentPath, entry.name);
    files[path.slice(folder.length + 1)] = await readFile(path, "utf8");
  }
  return files;
}

/** Notes, under its old Module ID, next to a Module of someone else, both with data and on the Home. */
const NOTES_AND_WEATHER = {
  "notes/manifest.json": manifest("@tessello/notes", "Notes"),
  "notes/guide.md": "# Notes",
  "weather/manifest.json": manifest("@test/weather", "Weather"),
  ".tessello/modules.json": json({
    modules: [
      { id: "@tessello/notes", folder: "notes", version: "1.0.0", permissions: {} },
      { id: "@test/weather", folder: "weather", version: "1.0.0", permissions: { network: ["https://api.example.com"] } },
    ],
  }),
  ".tessello/home.json": json({ widgets: ["@test/weather", "@tessello/notes"] }),
  ".tessello/data/@tessello/notes/notes.json": json({ key: "notes", value: [{ text: "Buy milk" }] }),
  ".tessello/data/@test/weather/cities.json": json({ key: "cities", value: ["Paris"] }),
};

describe("renaming the Modules of a Modules folder under @craftskillz", () => {
  test("the registry entry, the data, the Home and the Manifest of a renamed Module take its new Module ID", async () => {
    const root = await aModulesFolder(NOTES_AND_WEATHER);

    await renameModulesFolder(root, { apply: true });

    const files = await filesOf(root);
    assert.deepEqual(JSON.parse(files[".tessello/modules.json"]), {
      modules: [
        { id: "@craftskillz/notes", folder: "notes", version: "1.0.0", permissions: {} },
        { id: "@test/weather", folder: "weather", version: "1.0.0", permissions: { network: ["https://api.example.com"] } },
      ],
    });
    assert.deepEqual(JSON.parse(files[".tessello/home.json"]), { widgets: ["@test/weather", "@craftskillz/notes"] });
    assert.equal(files[".tessello/data/@craftskillz/notes/notes.json"], json({ key: "notes", value: [{ text: "Buy milk" }] }));
    assert.deepEqual(await readdir(join(root, ".tessello/data")), ["@craftskillz", "@test"]);
    assert.equal(files[".tessello/data/@test/weather/cities.json"], json({ key: "cities", value: ["Paris"] }));
    assert.equal(JSON.parse(files["notes/manifest.json"]).id, "@craftskillz/notes");
    assert.equal(files["notes/guide.md"], "# Notes");
    assert.equal(files["weather/manifest.json"], manifest("@test/weather", "Weather"));
  });

  test("before changing anything, a copy of .tessello/ and of the Manifests it rewrites is kept in a hidden folder", async () => {
    const root = await aModulesFolder(NOTES_AND_WEATHER);

    const report = await renameModulesFolder(root, { apply: true });

    assert.ok(report.status === "applied");
    assert.match(report.backup, /^\.tessello-backup-\d{8}-\d{6}$/);
    const backup = await filesOf(join(root, report.backup));
    assert.deepEqual(backup, {
      ...Object.fromEntries(Object.entries(NOTES_AND_WEATHER).filter(([path]) => path.startsWith(".tessello/"))),
      "notes/manifest.json": manifest("@tessello/notes", "Notes"),
    });
  });

  test("a dry run lists what would change and writes nothing", async () => {
    const root = await aModulesFolder(NOTES_AND_WEATHER);

    const report = await renameModulesFolder(root, { apply: false });

    assert.deepEqual(report, {
      status: "planned",
      changes: [
        "registry: @tessello/notes → @craftskillz/notes",
        "Home: @tessello/notes → @craftskillz/notes",
        "data: .tessello/data/@tessello/notes → .tessello/data/@craftskillz/notes",
        "Manifest: notes/manifest.json → @craftskillz/notes",
      ],
    });
    assert.deepEqual(await filesOf(root), NOTES_AND_WEATHER);
    assert.deepEqual(await readdir(join(root, ".tessello/data")), ["@tessello", "@test"]);
  });

  test("when a new Module ID already has data, is registered or is declared by a folder, nothing is changed and the conflicts are named", async () => {
    const withData = {
      ...NOTES_AND_WEATHER,
      ".tessello/data/@craftskillz/notes/notes.json": json({ key: "notes", value: [] }),
    };
    const withEntry = {
      ...NOTES_AND_WEATHER,
      ".tessello/modules.json": json({
        modules: [
          { id: "@tessello/notes", folder: "notes", version: "1.0.0", permissions: {} },
          { id: "@craftskillz/notes", folder: "notes-2", version: "1.1.0", permissions: {} },
        ],
      }),
    };
    const withFolder = { ...NOTES_AND_WEATHER, "notes-2/manifest.json": manifest("@craftskillz/notes", "Notes") };
    for (const files of [withData, withEntry, withFolder]) {
      const root = await aModulesFolder(files);

      const report = await renameModulesFolder(root, { apply: true });

      assert.deepEqual(report, { status: "conflict", conflicts: ["@craftskillz/notes"] });
      assert.deepEqual(await filesOf(root), files);
    }
  });

  test("a Module already on the Home under its new Module ID is not placed there twice", async () => {
    const root = await aModulesFolder({
      ...NOTES_AND_WEATHER,
      ".tessello/home.json": json({ widgets: ["@craftskillz/notes", "@test/weather", "@tessello/notes"] }),
    });

    await renameModulesFolder(root, { apply: true });

    assert.deepEqual(JSON.parse(await readFile(join(root, ".tessello/home.json"), "utf8")), { widgets: ["@craftskillz/notes", "@test/weather"] });
  });

  test("a Modules folder without .tessello/ still has the Manifests of its Modules renamed", async () => {
    const root = await aModulesFolder({ "notes/manifest.json": manifest("@tessello/notes", "Notes") });

    const report = await renameModulesFolder(root, { apply: true });

    assert.ok(report.status === "applied");
    assert.equal(JSON.parse(await readFile(join(root, "notes/manifest.json"), "utf8")).id, "@craftskillz/notes");
    assert.deepEqual(await filesOf(join(root, report.backup)), { "notes/manifest.json": manifest("@tessello/notes", "Notes") });
  });

  test("a Modules folder without any old Module ID is left as it is, without a backup", async () => {
    const files = { "weather/manifest.json": manifest("@test/weather", "Weather"), ".tessello/modules.json": json({ modules: [] }) };
    const root = await aModulesFolder(files);

    assert.deepEqual(await renameModulesFolder(root, { apply: true }), { status: "unchanged" });
    assert.deepEqual(await filesOf(root), files);
  });
});

const THEME: Theme = {
  mode: "light",
  colors: { background: "#ffffff", surface: "#f4f5f7", text: "#16181d", textMuted: "#5f6670", accent: "#2f6fec", border: "#d9dce1" },
};
const PAGE = "<!doctype html><p>Notes</p>";

const aSpace = (persistence = createMemoryPersistence()) => ({
  persistence,
  host: createHost({ persistence, locale: "en-US", theme: THEME, openView: () => {} }),
});

/** Installs a Module from a folder of the memory Modules folder. */
async function install(space: ReturnType<typeof aSpace>, folder: string, id: string, name: string) {
  space.persistence.disk.set(
    folder,
    new Map(
      Object.entries({
        "manifest.json": manifest(id, name),
        "icon.svg": "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 1 1'/>",
        "view/index.html": PAGE,
        "guide.md": `# ${name}`,
      }).map(([path, content]) => [path, strToU8(content)]),
    ),
  );
  const inspection = await space.host.inspectFolder(folder);
  assert.ok(inspection.status === "valid");
  await inspection.install();
}

/** An export of a Space holding Notes under its old Module ID, with data, and a Module of someone else. */
async function anExport() {
  const space = aSpace();
  await install(space, "notes", "@tessello/notes", "Notes");
  await install(space, "weather", "@test/weather", "Weather");
  await space.persistence.storage.write("@tessello/notes", "notes", JSON.stringify([{ text: "Buy milk" }]));
  await space.persistence.home.write(["@test/weather", "@tessello/notes"]);
  return (await space.host.exportSpace()).file;
}

describe("renaming the Modules of a Space export under @craftskillz", () => {
  test("the renamed export imports the Module under its new Module ID, with its data and its place on the Home", async () => {
    const result = renameSpaceExport(await anExport());

    assert.ok(result.status === "renamed");
    assert.deepEqual(result.changes, ["@tessello/notes → @craftskillz/notes"]);
    const other = aSpace();
    const inspection = await other.host.inspectSpace(result.file);
    assert.ok(inspection.status === "valid", JSON.stringify(inspection));
    await inspection.import();
    assert.deepEqual(
      (await other.persistence.registry.read()).map(({ id, folder }) => ({ id, folder })),
      [
        { id: "@craftskillz/notes", folder: "notes" },
        { id: "@test/weather", folder: "weather" },
      ],
    );
    assert.deepEqual(await other.persistence.home.read(), ["@test/weather", "@craftskillz/notes"]);
    assert.deepEqual([...(await other.persistence.storage.read("@craftskillz/notes"))], [["notes", JSON.stringify([{ text: "Buy milk" }])]]);
    assert.equal(strFromU8(unzipSync(result.file)["modules/notes/guide.md"]), "# Notes");
  });

  test("an export that already holds a new Module ID is refused, naming it", async () => {
    const space = aSpace();
    await install(space, "notes", "@tessello/notes", "Notes");
    await install(space, "notes-2", "@craftskillz/notes", "Notes");

    assert.deepEqual(renameSpaceExport((await space.host.exportSpace()).file), { status: "conflict", conflicts: ["@craftskillz/notes"] });
  });

  test("an export without any old Module ID is left as it is", async () => {
    const space = aSpace();
    await install(space, "weather", "@test/weather", "Weather");

    assert.deepEqual(renameSpaceExport((await space.host.exportSpace()).file), { status: "unchanged" });
  });
});
