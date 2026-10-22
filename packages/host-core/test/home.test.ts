import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { strToU8 } from "fflate";
import { createHost, createMemoryPersistence, type MemoryPersistence, type Theme } from "../src/index.ts";

const THEME: Theme = {
  mode: "light",
  colors: { background: "#ffffff", surface: "#f4f5f7", text: "#16181d", textMuted: "#5f6670", accent: "#2f6fec", border: "#d9dce1" },
};
const PAGE = `<!doctype html><script>parent.postMessage({ tessello: 1, type: "ready", id: "1" }, "*")</script>`;

const newHost = (persistence: MemoryPersistence) => createHost({ persistence, locale: "en-US", theme: THEME, openView: () => {} });

/** A Module's folder; `widget` is its Widget size, or none. */
function moduleFiles(id: string, name: string, widget?: "S" | "M" | "L") {
  return new Map(
    Object.entries({
      "manifest.json": JSON.stringify({
        convention: 1,
        id,
        name,
        version: "1.0.0",
        icon: "icon.svg",
        view: { entry: "view/index.html" },
        guide: "guide.md",
        ...(widget ? { widget: { entry: "widget/index.html", size: widget } } : {}),
      }),
      "icon.svg": "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 1 1'/>",
      "view/index.html": PAGE,
      "guide.md": `# ${name}`,
      ...(widget ? { "widget/index.html": PAGE } : {}),
    }).map(([path, content]) => [path, strToU8(content)]),
  );
}

/** Places and activates these Modules, in this order: `[folder, id, name, widget size]`. */
async function withModules(modules: [string, string, string, ("S" | "M" | "L")?][], persistence = createMemoryPersistence()) {
  const host = newHost(persistence);
  for (const [folder, id, name, widget] of modules) {
    persistence.disk.set(folder, moduleFiles(id, name, widget));
    const inspection = await host.inspectFolder(folder);
    assert.ok(inspection.status === "valid");
    await inspection.install();
  }
  return { host, persistence };
}

const ids = async (host: ReturnType<typeof newHost>) => (await host.home()).map((widget) => widget.id);

describe("the Home", () => {
  test("shows the Widget of each active Module, with its size, in the order the Modules were activated", async () => {
    const { host } = await withModules([
      ["weather", "@test/weather", "Weather", "M"],
      ["notes", "@craftskillz/notes", "Notes", "S"],
      ["photos", "@test/photos", "Photos", "L"],
    ]);
    assert.deepEqual(await host.home(), [
      { id: "@test/weather", name: "Weather", size: "M" },
      { id: "@craftskillz/notes", name: "Notes", size: "S" },
      { id: "@test/photos", name: "Photos", size: "L" },
    ]);
  });

  test("keeps the order the User arranges, for a new Host on the same Modules folder", async () => {
    const { host, persistence } = await withModules([
      ["weather", "@test/weather", "Weather", "M"],
      ["notes", "@craftskillz/notes", "Notes", "S"],
      ["photos", "@test/photos", "Photos", "L"],
    ]);
    await host.arrangeHome(["@test/photos", "@test/weather", "@craftskillz/notes"]);
    assert.deepEqual(await ids(newHost(persistence)), ["@test/photos", "@test/weather", "@craftskillz/notes"]);
  });

  test("a Module activated after the User arranged the Home comes last", async () => {
    const { host, persistence } = await withModules([
      ["weather", "@test/weather", "Weather", "M"],
      ["notes", "@craftskillz/notes", "Notes", "S"],
    ]);
    await host.arrangeHome(["@craftskillz/notes", "@test/weather"]);
    await withModules([["photos", "@test/photos", "Photos", "L"]], persistence);
    assert.deepEqual(await ids(host), ["@craftskillz/notes", "@test/weather", "@test/photos"]);
  });

  test("a Module without a Widget is not on the Home, but stays in the Launcher's list", async () => {
    const { host } = await withModules([
      ["clock", "@test/clock", "Clock"],
      ["notes", "@craftskillz/notes", "Notes", "S"],
    ]);
    assert.deepEqual(await ids(host), ["@craftskillz/notes"]);
    assert.deepEqual(
      (await host.modules()).map((entry) => entry.id),
      ["@test/clock", "@craftskillz/notes"],
    );
  });

  test("a Module whose folder has disappeared leaves the Home, and comes back at its place", async () => {
    const { host, persistence } = await withModules([
      ["weather", "@test/weather", "Weather", "M"],
      ["notes", "@craftskillz/notes", "Notes", "S"],
    ]);
    await host.arrangeHome(["@craftskillz/notes", "@test/weather"]);
    const notes = persistence.disk.get("notes")!;
    persistence.disk.delete("notes");
    assert.deepEqual(await ids(host), ["@test/weather"]);
    persistence.disk.set("notes-renamed", notes);
    assert.deepEqual(await ids(host), ["@craftskillz/notes", "@test/weather"]);
  });

  test("arranging the Home while a Module's folder is missing keeps that Module's place for when it comes back", async () => {
    const { host, persistence } = await withModules([
      ["weather", "@test/weather", "Weather", "M"],
      ["notes", "@craftskillz/notes", "Notes", "S"],
      ["photos", "@test/photos", "Photos", "L"],
    ]);
    await host.arrangeHome(["@craftskillz/notes", "@test/weather", "@test/photos"]);
    const notes = persistence.disk.get("notes")!;
    persistence.disk.delete("notes");
    await host.arrangeHome(["@test/photos", "@test/weather"]);
    persistence.disk.set("notes", notes);
    assert.deepEqual(await ids(host), ["@craftskillz/notes", "@test/photos", "@test/weather"]);
  });
});
