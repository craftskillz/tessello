import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { strToU8, zipSync } from "fflate";
import { createHost, createMemoryPersistence, type Theme } from "../src/index.ts";

const THEME: Theme = {
  mode: "light",
  colors: { background: "#ffffff", surface: "#f4f5f7", text: "#16181d", textMuted: "#5f6670", accent: "#2f6fec", border: "#d9dce1" },
};
const READY_VIEW = `<!doctype html><script>parent.postMessage({ tessello: 1, type: "ready", id: "1" }, "*")</script>`;
const ICON = "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 1 1'/>";

const newHost = (persistence = createMemoryPersistence()) =>
  createHost({ persistence, locale: "en-US", theme: THEME, openView: () => {} });

function zip(files: Record<string, string | object>): Uint8Array {
  return zipSync(
    Object.fromEntries(
      Object.entries(files).map(([path, content]) => [path, strToU8(typeof content === "string" ? content : JSON.stringify(content))]),
    ),
  );
}

const notesZip = (version = "1.0.0") =>
  zip({
    "manifest.json": {
      convention: 1,
      id: "@tessello/notes",
      name: "Notes",
      version,
      description: "Jot things down.",
      icon: "icon.svg",
      view: { entry: "view/index.html" },
    },
    "icon.svg": ICON,
    "view/index.html": READY_VIEW,
  });

describe("installation", () => {
  test("a valid package shows its Manifest and installs once confirmed", async () => {
    const host = newHost();
    const inspection = host.inspect(notesZip());
    assert.equal(inspection.ok, true);
    assert.ok(inspection.ok);
    assert.equal(inspection.manifest.name, "Notes");
    assert.equal(new TextDecoder().decode(inspection.files.get("icon.svg")), ICON);
    assert.deepEqual(await host.modules(), [], "nothing is installed before the User confirms");

    await inspection.install();
    const [installed, ...others] = await host.modules();
    assert.deepEqual(others, []);
    assert.equal(installed.manifest.id, "@tessello/notes");
    assert.equal(new TextDecoder().decode(installed.files.get("view/index.html")), READY_VIEW);
  });

  test("a non-compliant package is refused with the Validator's report and nothing is installed", async () => {
    const host = newHost();
    const inspection = host.inspect(zip({ "manifest.json": { convention: 1, id: "Not An Id" } }));
    assert.equal(inspection.ok, false);
    assert.ok(inspection.report.issues.some((issue) => issue.code === "manifest/invalid-id"));
    assert.equal("install" in inspection, false);
    assert.deepEqual(await host.modules(), []);
  });

  test("a file that is not a .zip is refused", () => {
    const inspection = newHost().inspect(strToU8("hello"));
    assert.equal(inspection.ok, false);
    assert.deepEqual(inspection.report.issues.map((issue) => issue.code), ["package/invalid-zip"]);
  });

  test("installed Modules are found again by a new Host on the same persistence", async () => {
    const persistence = createMemoryPersistence();
    const first = newHost(persistence).inspect(notesZip());
    assert.ok(first.ok);
    await first.install();

    const [installed] = await newHost(persistence).modules();
    assert.equal(installed.manifest.id, "@tessello/notes");
  });

  test("installing a known Module ID replaces it rather than adding a second one", async () => {
    const host = newHost();
    for (const version of ["1.0.0", "1.1.0"]) {
      const inspection = host.inspect(notesZip(version));
      assert.ok(inspection.ok);
      await inspection.install();
    }
    assert.deepEqual((await host.modules()).map((module) => module.manifest.version), ["1.1.0"]);
  });
});
