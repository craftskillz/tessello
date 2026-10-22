import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { strToU8, zipSync } from "fflate";
import { createHost, createMemoryPersistence, type MemoryPersistence, type Theme } from "../src/index.ts";

const THEME: Theme = {
  mode: "light",
  colors: { background: "#ffffff", surface: "#f4f5f7", text: "#16181d", textMuted: "#5f6670", accent: "#2f6fec", border: "#d9dce1" },
};
const READY_VIEW = `<!doctype html><script>parent.postMessage({ tessello: 1, type: "ready", id: "1" }, "*")</script>`;
const ICON = "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 1 1'/>";

const newHost = (persistence = createMemoryPersistence()) =>
  createHost({ persistence, locale: "en-US", theme: THEME, openView: () => {} });

const notesFiles = (manifest: object = {}) =>
  new Map(
    Object.entries({
      "manifest.json": JSON.stringify({
        convention: 1,
        id: "@craftskillz/notes",
        name: "Notes",
        version: "1.0.0",
        icon: "icon.svg",
        view: { entry: "view/index.html" },
        guide: "guide.md",
        ...manifest,
      }),
      "icon.svg": ICON,
      "view/index.html": READY_VIEW,
      "guide.md": "# Notes",
    }).map(([path, content]) => [path, strToU8(content)]),
  );

/** Puts a folder in the Modules folder, as `git clone` or a copy would. */
function placeFolder(persistence: MemoryPersistence, name: string, files: Map<string, Uint8Array>) {
  persistence.disk.set(name, new Map(files));
}

/** A Modules folder where Notes is activated, in the folder "notes". */
async function withNotes() {
  const persistence = createMemoryPersistence();
  placeFolder(persistence, "notes", notesFiles());
  const host = newHost(persistence);
  const inspection = await host.inspectFolder("notes");
  assert.ok(inspection.status === "valid");
  await inspection.install();
  return { persistence, host };
}

const statuses = async (host: ReturnType<typeof newHost>) =>
  (await host.modules()).map(({ status, folder, id }) => ({ status, folder, id }));

describe("folders of the Modules folder", () => {
  test("a folder that appeared in the Modules folder shows as new, to activate, with its name and icon", async () => {
    const persistence = createMemoryPersistence();
    placeFolder(persistence, "notes", notesFiles());
    const [entry, ...others] = await newHost(persistence).modules();
    assert.deepEqual(others, []);
    assert.equal(entry.status, "new");
    assert.equal(entry.folder, "notes");
    assert.equal(entry.name, "Notes");
    assert.equal(new TextDecoder().decode(entry.icon?.bytes), ICON);
  });

  test("activating a folder shows its Manifest, and registers it only once the User confirms", async () => {
    const persistence = createMemoryPersistence();
    placeFolder(persistence, "notes", notesFiles({ permissions: { network: ["https://api.example.com"] } }));
    const host = newHost(persistence);
    const inspection = await host.inspectFolder("notes");
    assert.equal(inspection.status, "valid");
    assert.ok(inspection.status === "valid");
    assert.equal(inspection.manifest.name, "Notes");
    assert.equal(new TextDecoder().decode(inspection.icon.bytes), ICON);
    assert.equal((await host.modules())[0].status, "new", "nothing is activated before the User confirms");

    await inspection.install();
    assert.deepEqual(
      (await host.modules()).map(({ status, folder, id }) => ({ status, folder, id })),
      [{ status: "active", folder: "notes", id: "@craftskillz/notes" }],
    );
    assert.deepEqual(await persistence.registry.read(), [
      { id: "@craftskillz/notes", folder: "notes", version: "1.0.0", permissions: { network: ["https://api.example.com"] } },
    ]);
  });

  test("activating a non-compliant folder shows the Validator's report and activates nothing", async () => {
    const persistence = createMemoryPersistence();
    placeFolder(persistence, "notes", notesFiles({ id: "Not An Id" }));
    const host = newHost(persistence);
    const inspection = await host.inspectFolder("notes");
    assert.equal(inspection.status, "invalid");
    assert.ok(inspection.status === "invalid");
    assert.ok(inspection.report.issues.some((issue) => issue.code === "manifest/invalid-id"));
    assert.equal((await host.modules())[0].status, "new");
  });

  test("the files of .git/ are not part of the Module", async () => {
    const persistence = createMemoryPersistence();
    const git = new Map([[".git/hooks/pre-commit.js", strToU8("localStorage.clear()")], [".DS_Store", new Uint8Array(1)]]);
    placeFolder(persistence, "notes", new Map([...notesFiles(), ...git]));
    const inspection = await newHost(persistence).inspectFolder("notes");
    assert.ok(inspection.status === "valid");
    assert.deepEqual(inspection.report.issues, []);
  });

  test("a second folder declaring a registered Module ID is in conflict, and cannot be activated", async () => {
    const { persistence, host } = await withNotes();
    placeFolder(persistence, "notes-copy", notesFiles({ name: "Other notes" }));
    assert.deepEqual(await statuses(host), [
      { status: "active", folder: "notes", id: "@craftskillz/notes" },
      { status: "conflict", folder: "notes-copy", id: "@craftskillz/notes" },
    ]);
    assert.equal((await host.inspectFolder("notes-copy")).status, "conflict");
    assert.equal((await persistence.registry.read()).length, 1);
  });

  test("a registered Module whose folder has disappeared is missing, and the others are still there", async () => {
    const { persistence, host } = await withNotes();
    placeFolder(persistence, "todo", notesFiles({ id: "@tessello/todo", name: "Todo" }));
    const todo = await host.inspectFolder("todo");
    assert.ok(todo.status === "valid");
    await todo.install();

    persistence.disk.delete("notes");
    assert.deepEqual(await statuses(host), [
      { status: "missing", folder: "notes", id: "@craftskillz/notes" },
      { status: "active", folder: "todo", id: "@tessello/todo" },
    ]);
  });

  test("a Module whose folder was renamed is found again by its Module ID, with its registration", async () => {
    const { persistence, host } = await withNotes();
    persistence.disk.set("my-notes", persistence.disk.get("notes")!);
    persistence.disk.delete("notes");
    assert.deepEqual(await statuses(host), [{ status: "active", folder: "my-notes", id: "@craftskillz/notes" }]);
    assert.equal((await persistence.registry.read())[0].folder, "my-notes");
  });

  test("hidden folders and .tessello/ are not Modules", async () => {
    const persistence = createMemoryPersistence();
    placeFolder(persistence, ".tessello", notesFiles());
    placeFolder(persistence, ".notes", notesFiles());
    assert.deepEqual(await newHost(persistence).modules(), []);
  });

  test("the Launcher gives the Permissions granted to each registered Module, not those its folder declares now", async () => {
    const persistence = createMemoryPersistence();
    placeFolder(persistence, "notes", notesFiles({ permissions: { network: ["https://api.example.com"] } }));
    placeFolder(persistence, "other", notesFiles({ id: "@tessello/other", permissions: { localNetwork: ["http://localhost:9090"] } }));
    const host = newHost(persistence);
    const inspection = await host.inspectFolder("notes");
    assert.ok(inspection.status === "valid");
    await inspection.install();
    editManifest(persistence, { permissions: { network: ["https://api.example.com", "https://evil.example.com"] } });

    const permissions = (await host.modules()).map(({ folder, permissions }) => ({ folder, permissions }));
    assert.deepEqual(permissions, [
      { folder: "notes", permissions: { network: ["https://api.example.com"] } },
      { folder: "other", permissions: null },
    ]);
  });
});

const zipOf = (files: Map<string, Uint8Array>) => zipSync(Object.fromEntries(files));

describe("installing a .zip", () => {
  test("a valid .zip is unpacked into a new folder named after its Module, then activated", async () => {
    const persistence = createMemoryPersistence();
    const host = newHost(persistence);
    const inspection = await host.inspectZip(zipOf(notesFiles()));
    assert.ok(inspection.status === "valid");
    assert.deepEqual([...persistence.disk.keys()], [], "nothing is written before the User confirms");

    await inspection.install();
    assert.deepEqual(await statuses(host), [{ status: "active", folder: "notes", id: "@craftskillz/notes" }]);
    assert.equal(new TextDecoder().decode(persistence.disk.get("notes")!.get("view/index.html")), READY_VIEW);
  });

  test("the folder name is suffixed when it is taken", async () => {
    const persistence = createMemoryPersistence();
    placeFolder(persistence, "notes", new Map([["readme.txt", strToU8("not a Module")]]));
    const host = newHost(persistence);
    const inspection = await host.inspectZip(zipOf(notesFiles()));
    assert.ok(inspection.status === "valid");
    await inspection.install();
    assert.deepEqual((await statuses(host))[0], { status: "active", folder: "notes-2", id: "@craftskillz/notes" });
  });

  test("a .zip the Validator refuses writes nothing", async () => {
    const persistence = createMemoryPersistence();
    const inspection = await newHost(persistence).inspectZip(zipOf(notesFiles({ id: "Not An Id" })));
    assert.equal(inspection.status, "invalid");
    assert.deepEqual([...persistence.disk.keys()], []);
    assert.deepEqual(await persistence.registry.read(), []);
  });

  test("a file that is not a .zip is refused", async () => {
    const inspection = await newHost().inspectZip(strToU8("hello"));
    assert.ok(inspection.status === "invalid");
    assert.deepEqual(inspection.report.issues.map((issue) => issue.code), ["package/invalid-zip"]);
  });
});

describe("updating a Module from a .zip", () => {
  test("a .zip whose Module ID is installed is an update, with the installed and incoming name and version", async () => {
    const { persistence, host } = await withNotes();
    const inspection = await host.inspectZip(zipOf(notesFiles({ name: "Better notes", version: "1.1.0" })));
    assert.ok(inspection.status === "update");
    assert.deepEqual(inspection.installed, { name: "Notes", version: "1.0.0", folder: "notes" });
    assert.equal(inspection.manifest.name, "Better notes");
    assert.equal(inspection.manifest.version, "1.1.0");
    assert.deepEqual(inspection.added, {});
    assert.deepEqual([...persistence.disk.keys()], ["notes"]);
    assert.equal((await persistence.registry.read())[0].version, "1.0.0", "nothing changes before the User confirms");
  });

  test("an update replaces the Module's code in its folder and keeps its storage", async () => {
    const { persistence, host } = await withNotes();
    await persistence.storage.write("@craftskillz/notes", "notes", "[]");
    editFile(persistence, "notes", "view/old.js", "// gone in 1.1.0");
    editFile(persistence, "notes", ".git/HEAD", "ref: refs/heads/main");
    const files = notesFiles({ version: "1.1.0" });
    files.set("view/index.html", strToU8("<!doctype html><p>1.1.0</p>"));
    const inspection = await host.inspectZip(zipOf(files));
    assert.ok(inspection.status === "update");
    await inspection.update();

    assert.deepEqual(await statuses(host), [{ status: "active", folder: "notes", id: "@craftskillz/notes" }]);
    assert.equal((await persistence.registry.read())[0].version, "1.1.0");
    const opening = await host.open("@craftskillz/notes");
    assert.ok(opening.status === "ready");
    assert.equal(opening.manifest.version, "1.1.0");
    assert.deepEqual([...opening.files.keys()].sort(), ["guide.md", "icon.svg", "manifest.json", "view/index.html"]);
    assert.equal(new TextDecoder().decode(opening.files.get("view/index.html")), "<!doctype html><p>1.1.0</p>");
    assert.equal(persistence.disk.get("notes")!.has(".git/HEAD"), true, "the Creator's repository is not touched");
    assert.deepEqual([...(await persistence.storage.read("@craftskillz/notes"))], [["notes", "[]"]]);
  });

  test("an update adding Permissions presents only the added ones; accepting grants them and the Module runs", async () => {
    const persistence = createMemoryPersistence();
    placeFolder(persistence, "notes", notesFiles({ permissions: { network: ["https://api.example.com"] } }));
    const host = newHost(persistence);
    const install = await host.inspectFolder("notes");
    assert.ok(install.status === "valid");
    await install.install();

    const inspection = await host.inspectZip(
      zipOf(notesFiles({ version: "2.0.0", permissions: { network: ["https://api.example.com", "https://sync.example.com"] } })),
    );
    assert.ok(inspection.status === "update");
    assert.deepEqual(inspection.added, { network: ["https://sync.example.com"] });

    await inspection.update();
    const opening = await host.open("@craftskillz/notes");
    assert.ok(opening.status === "ready");
    assert.deepEqual(opening.permissions, { network: ["https://api.example.com", "https://sync.example.com"] });
  });

  test("declining an update leaves the installed version, its Permissions and its storage intact", async () => {
    const { persistence, host } = await withNotes();
    await persistence.storage.write("@craftskillz/notes", "notes", "[]");
    const before = structuredClone(persistence.disk.get("notes"));
    const inspection = await host.inspectZip(zipOf(notesFiles({ version: "2.0.0", permissions: { network: ["https://sync.example.com"] } })));
    assert.ok(inspection.status === "update");
    // Declining is not calling update().

    assert.deepEqual(persistence.disk.get("notes"), before);
    const opening = await host.open("@craftskillz/notes");
    assert.ok(opening.status === "ready");
    assert.equal(opening.manifest.version, "1.0.0");
    assert.deepEqual(opening.permissions, {});
    assert.deepEqual([...(await persistence.storage.read("@craftskillz/notes"))], [["notes", "[]"]]);
  });

  test("an update goes to the folder the Module was renamed to, and never to another folder now under its old name", async () => {
    const { persistence, host } = await withNotes();
    persistence.disk.set("my-notes", persistence.disk.get("notes")!);
    persistence.disk.set("notes", new Map([["readme.txt", strToU8("not a Module")]]));
    const inspection = await host.inspectZip(zipOf(notesFiles({ version: "1.1.0" })));
    assert.ok(inspection.status === "update");
    assert.equal(inspection.installed.folder, "my-notes");
    await inspection.update();

    assert.deepEqual([...persistence.disk.get("notes")!.keys()], ["readme.txt"]);
    assert.equal(new TextDecoder().decode(persistence.disk.get("my-notes")!.get("manifest.json")).includes("1.1.0"), true);
    assert.deepEqual(await statuses(host), [
      { status: "active", folder: "my-notes", id: "@craftskillz/notes" },
      { status: "new", folder: "notes", id: null },
    ]);
  });

  test("an update of a Module whose folder is missing puts its code back in a folder", async () => {
    const { persistence, host } = await withNotes();
    await persistence.storage.write("@craftskillz/notes", "notes", "[]");
    persistence.disk.delete("notes");
    const inspection = await host.inspectZip(zipOf(notesFiles({ version: "1.1.0" })));
    assert.ok(inspection.status === "update");
    await inspection.update();
    assert.deepEqual(await statuses(host), [{ status: "active", folder: "notes", id: "@craftskillz/notes" }]);
    assert.deepEqual([...(await persistence.storage.read("@craftskillz/notes"))], [["notes", "[]"]]);
  });

  test("a folder declaring an installed Module ID is still in conflict: only a package is an update", async () => {
    const { persistence, host } = await withNotes();
    placeFolder(persistence, "notes-copy", notesFiles({ version: "1.1.0" }));
    assert.equal((await host.inspectFolder("notes-copy")).status, "conflict");
  });
});

/** Changes one file of a folder, as an editor or `git pull` would. */
function editFile(persistence: MemoryPersistence, folder: string, path: string, content: string) {
  persistence.disk.get(folder)!.set(path, strToU8(content));
}
const editManifest = (persistence: MemoryPersistence, manifest: object) =>
  editFile(persistence, "notes", "manifest.json", new TextDecoder().decode(notesFiles(manifest).get("manifest.json")));

describe("opening a View", () => {
  test("reads the Module's files as they are on disk when the View opens", async () => {
    const { persistence, host } = await withNotes();
    editFile(persistence, "notes", "view/index.html", "<!doctype html><p>Edited</p>");
    const opening = await host.open("@craftskillz/notes");
    assert.ok(opening.status === "ready");
    assert.equal(new TextDecoder().decode(opening.files.get("view/index.html")), "<!doctype html><p>Edited</p>");
    assert.equal(opening.manifest.view.entry, "view/index.html");
  });

  test("a folder changed so that it no longer complies shows the Validator's report instead", async () => {
    const { persistence, host } = await withNotes();
    editManifest(persistence, { view: { entry: "view/missing.html" } });
    const opening = await host.open("@craftskillz/notes");
    assert.ok(opening.status === "invalid");
    assert.ok(opening.report.issues.some((issue) => issue.code === "manifest/file-not-found"));
  });

  test("a new version on disk updates the registry and keeps the Module's storage", async () => {
    const { persistence, host } = await withNotes();
    await persistence.storage.write("@craftskillz/notes", "notes", "[]");
    editManifest(persistence, { version: "1.1.0" });
    assert.equal((await host.open("@craftskillz/notes")).status, "ready");
    assert.equal((await persistence.registry.read())[0].version, "1.1.0");
    assert.deepEqual([...(await persistence.storage.read("@craftskillz/notes"))], [["notes", "[]"]]);
  });

  test("a View runs with the Permissions granted in the registry, never those of the Manifest read again", async () => {
    const { persistence, host } = await withNotes();
    const [registered] = await persistence.registry.read();
    await persistence.registry.write([{ ...registered, permissions: { network: ["https://api.example.com"] } }]);
    const opening = await host.open("@craftskillz/notes");
    assert.ok(opening.status === "ready");
    assert.deepEqual(opening.permissions, { network: ["https://api.example.com"] });
  });

  test("Permissions added on disk stop the Module, list only the added ones, and run it once accepted", async () => {
    const { persistence, host } = await withNotes();
    const [registered] = await persistence.registry.read();
    await persistence.registry.write([{ ...registered, permissions: { network: ["https://api.example.com"] } }]);
    await persistence.storage.write("@craftskillz/notes", "notes", "[]");
    editManifest(persistence, {
      permissions: { network: ["https://api.example.com", "https://evil.example.com"], localNetwork: ["http://192.168.1.10"] },
    });

    const opening = await host.open("@craftskillz/notes");
    assert.ok(opening.status === "permissions");
    assert.deepEqual(opening.added, { network: ["https://evil.example.com"], localNetwork: ["http://192.168.1.10"] });
    // Declining is not calling accept(): the Module stays inactive, its data intact.
    assert.equal((await host.open("@craftskillz/notes")).status, "permissions");
    assert.deepEqual([...(await persistence.storage.read("@craftskillz/notes"))], [["notes", "[]"]]);

    await opening.accept();
    const accepted = await host.open("@craftskillz/notes");
    assert.ok(accepted.status === "ready");
    assert.deepEqual(accepted.permissions, {
      network: ["https://api.example.com", "https://evil.example.com"],
      localNetwork: ["http://192.168.1.10"],
    });
  });

  test("a Module whose folder has disappeared is missing; renamed, it opens from its new folder", async () => {
    const { persistence, host } = await withNotes();
    const files = persistence.disk.get("notes")!;
    persistence.disk.delete("notes");
    assert.equal((await host.open("@craftskillz/notes")).status, "missing");

    persistence.disk.set("elsewhere", files);
    assert.equal((await host.open("@craftskillz/notes")).status, "ready");
    assert.equal((await persistence.registry.read())[0].folder, "elsewhere");
  });

  test("a Module that is not registered is missing", async () => {
    assert.equal((await newHost().open("@tessello/unknown")).status, "missing");
  });
});

describe("uninstalling a Module", () => {
  test("removes its folder, its storage and its registration; the Launcher and the Home no longer show it", async () => {
    const { persistence, host } = await withNotes();
    placeFolder(persistence, "todo", notesFiles({ id: "@tessello/todo", name: "Todo", widget: { entry: "view/index.html", size: "S" } }));
    const todo = await host.inspectFolder("todo");
    assert.ok(todo.status === "valid");
    await todo.install();
    await host.arrangeHome(["@tessello/todo"]);
    await persistence.storage.write("@tessello/todo", "tasks", "[]");
    await persistence.storage.write("@craftskillz/notes", "notes", "[]");

    await host.uninstall("@tessello/todo");
    assert.deepEqual(await statuses(host), [{ status: "active", folder: "notes", id: "@craftskillz/notes" }]);
    assert.deepEqual(await host.home(), []);
    assert.deepEqual(await persistence.home.read(), []);
    assert.deepEqual([...persistence.disk.keys()], ["notes"]);
    assert.deepEqual([...(await persistence.storage.read("@tessello/todo"))], []);
    assert.deepEqual([...(await persistence.storage.read("@craftskillz/notes"))], [["notes", "[]"]], "the other Modules keep their data");
  });

  test("a Module whose folder is missing is uninstalled with its storage", async () => {
    const { persistence, host } = await withNotes();
    await persistence.storage.write("@craftskillz/notes", "notes", "[]");
    persistence.disk.delete("notes");
    await host.uninstall("@craftskillz/notes");
    assert.deepEqual(await host.modules(), []);
    assert.deepEqual([...(await persistence.storage.read("@craftskillz/notes"))], []);
  });

  test("a folder in conflict with the uninstalled Module is not removed, and can then be activated", async () => {
    const { persistence, host } = await withNotes();
    placeFolder(persistence, "notes-copy", notesFiles({ name: "Other notes" }));
    await host.uninstall("@craftskillz/notes");
    assert.deepEqual(await statuses(host), [{ status: "new", folder: "notes-copy", id: "@craftskillz/notes" }]);
  });
});
