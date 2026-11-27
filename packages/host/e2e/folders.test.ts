// Folders the User grants a Module (ADR 0022, CONVENTION.md §6.5), in the built Host: the picker returns a folder of the
// OPFS (`window.tesselloPick`), which has the interface of a folder of the User's disk.

import assert from "node:assert/strict";
import { describe, test } from "node:test";
import type { Page } from "playwright";
import { dropFile, readFolder, showLauncher, until, useHost, writeFolder, zip } from "./browser.ts";

const host = useHost();

/**
 * A View whose buttons send the request written in the `request` field (JSON: type and payload), the folder request from
 * the click itself, and show the response.
 */
const VIEW = `<!doctype html><title>Docs</title>
<textarea id="request" aria-label="request"></textarea>
<button id="send">Send</button>
<output></output>
<script>
  let next = 0;
  const pending = new Map();
  addEventListener("message", (event) => {
    if (event.source !== parent || event.data?.type !== "response") return;
    pending.get(event.data.id)?.(event.data);
  });
  const call = (type, payload = {}) => new Promise((done) => {
    const id = String(next++);
    pending.set(id, done);
    parent.postMessage({ tessello: 1, type, id, payload }, "*");
  });
  call("ready");
  document.querySelector("#send").addEventListener("click", async () => {
    const { type, payload } = JSON.parse(document.querySelector("#request").value);
    const response = await call(type, payload);
    document.querySelector("output").textContent = JSON.stringify(response.ok ? response.result : response.error);
  });
</script>`;

const DOCS = zip({
  "manifest.json": {
    convention: 1,
    id: "@test/docs",
    name: "Docs",
    version: "1.0.0",
    icon: "icon.svg",
    guide: "guide.md",
    view: { entry: "index.html" },
    permissions: { folders: true },
  },
  "icon.svg": "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 1 1'/>",
  "guide.md": "# Guide",
  "index.html": VIEW,
});

/** Sends a request from the View, by a click, and resolves with what it answered. */
async function send(page: Page, type: string, payload: object = {}): Promise<any> {
  const view = page.frameLocator("iframe[title='Docs']");
  await view.locator("output").evaluate((output) => (output.textContent = ""));
  await view.getByLabel("request").fill(JSON.stringify({ type, payload }));
  await view.getByRole("button", { name: "Send" }).click();
  const text = await until(() => view.locator("output").innerText(), `the answer to ${type}`);
  return JSON.parse(text);
}

/** The Host with Docs installed and opened. */
async function withDocs() {
  const page = await host.newPage();
  await dropFile(page, "docs.zip", DOCS);
  await page.getByRole("dialog", { name: "Install Docs?" }).getByRole("button", { name: "Accept and install" }).click();
  await page.frameLocator("iframe[title='Docs']").getByRole("button", { name: "Send" }).waitFor();
  return page;
}

const pick = (page: Page, folder: string) => page.evaluate((folder) => ((window as any).tesselloPick = folder), folder);

describe("folders granted to a Module", () => {
  test("the View asks for a folder from a click, then writes, reads and lists its files", async () => {
    const page = await withDocs();
    await writeFolder(page, "docs", { "intro.md": "# Intro\n" });
    await pick(page, "docs");

    const { folder } = await send(page, "folders.request");
    assert.equal(folder.name, "docs");

    const read = await send(page, "files.read", { folder: folder.id, path: "intro.md" });
    assert.equal(read.content, "# Intro\n");
    await send(page, "files.write", { folder: folder.id, path: "guide/new.md", content: "# New\n", ifVersion: null });
    assert.deepEqual(await readFolder(page, "docs"), { "intro.md": "# Intro\n", "guide/new.md": "# New\n" });

    const { entries } = await send(page, "files.list", { folder: folder.id });
    assert.deepEqual(entries.map((entry: { kind: string; path: string }) => `${entry.kind} ${entry.path}`).sort(), [
      "file guide/new.md",
      "file intro.md",
      "folder guide",
    ]);
    const intro = entries.find((entry: { path: string }) => entry.path === "intro.md");
    assert.equal(typeof intro.modified, "number");
    assert.ok(Math.abs(intro.modified - Date.now()) < 60_000);
    assert.ok(!("modified" in entries.find((entry: { kind: string }) => entry.kind === "folder")));
  });

  test("a file changed by another program since the View read it is not overwritten", async () => {
    const page = await withDocs();
    await writeFolder(page, "docs", { "intro.md": "one" });
    await pick(page, "docs");
    const { folder } = await send(page, "folders.request");
    const { version } = await send(page, "files.read", { folder: folder.id, path: "intro.md" });
    await writeFolder(page, "docs", { "intro.md": "an agent's edit" });

    const refused = await send(page, "files.write", { folder: folder.id, path: "intro.md", content: "two", ifVersion: version });

    assert.equal(refused.code, "conflict");
    assert.deepEqual(await readFolder(page, "docs"), { "intro.md": "an agent's edit" });
  });

  test("a folder moves with its files, and is removed from where it was", async () => {
    const page = await withDocs();
    await writeFolder(page, "docs", { "todo/a.md": "a", "todo/deep/b.md": "b" });
    await pick(page, "docs");
    const { folder } = await send(page, "folders.request");

    await send(page, "files.move", { folder: folder.id, from: "todo", to: "done" });

    assert.deepEqual(await readFolder(page, "docs"), { "done/a.md": "a", "done/deep/b.md": "b" });
    const { entries } = await send(page, "files.list", { folder: folder.id });
    assert.ok(!entries.some((entry: { path: string }) => entry.path.startsWith("todo")));
  });

  test("a repository must contain the documentation folder already granted", async () => {
    const page = await withDocs();
    await writeFolder(page, "project", { "docs/a.md": "a", "src/main.ts": "" });
    await writeFolder(page, "elsewhere", { "x.md": "x" });
    await pick(page, "project/docs");
    const { folder: docs } = await send(page, "folders.request");

    await pick(page, "elsewhere");
    assert.equal((await send(page, "folders.request", { mustContain: docs.id })).code, "not_containing");
    await pick(page, "project");
    const { folder: repository } = await send(page, "folders.request", { mustContain: docs.id });

    assert.equal((await send(page, "files.read", { folder: repository.id, path: "docs/a.md" })).content, "a");
  });

  test("a folder overlapping a listed one is refused with overlapping", async () => {
    const page = await withDocs();
    await writeFolder(page, "project", { "docs/a.md": "a", "src/main.ts": "" });
    await pick(page, "project/docs");
    const { folder: docs } = await send(page, "folders.request");

    await pick(page, "project");
    const refused = await send(page, "folders.request", { mustNotOverlap: [docs.id] });

    assert.equal(refused.code, "overlapping");
    await pick(page, "project/src");
    assert.equal((await send(page, "folders.request", { mustNotOverlap: [docs.id] })).folder.name, "src");
  });

  test("the granted folders are kept when the Host is opened again", async () => {
    const page = await withDocs();
    await writeFolder(page, "docs", { "intro.md": "x" });
    await pick(page, "docs");
    const { folder } = await send(page, "folders.request");

    await page.reload();
    await page.getByRole("button", { name: "Docs" }).first().click();

    assert.deepEqual(await send(page, "folders.list"), { folders: [{ ...folder, state: "granted" }] });
  });

  test("its About screen lists the folders granted; taking one back revokes it", async () => {
    const page = await withDocs();
    await writeFolder(page, "docs", { "intro.md": "x" });
    await pick(page, "docs");
    const { folder } = await send(page, "folders.request");

    const about = await openAbout(page);
    const granted = about.getByRole("region", { name: "Folders granted to Docs" });
    await granted.getByText("docs", { exact: true }).waitFor();
    await granted.getByRole("button", { name: "Take back docs" }).click();
    await granted.getByText("No folder granted.").waitFor();
    await page.keyboard.press("Escape");

    assert.deepEqual(await send(page, "folders.list"), { folders: [] });
    assert.equal((await send(page, "files.read", { folder: folder.id, path: "intro.md" })).code, "not_found");
    assert.deepEqual(await readFolder(page, "docs"), { "intro.md": "x" }, "the files stay on disk");
  });

  test("uninstalling the Module forgets its folders", async () => {
    const page = await withDocs();
    await writeFolder(page, "docs", { "intro.md": "x" });
    await pick(page, "docs");
    await send(page, "folders.request");

    const about = await openAbout(page);
    await about.getByRole("button", { name: "Uninstall…" }).click();
    await page.getByRole("dialog", { name: "Uninstall Docs?" }).getByRole("button", { name: "Uninstall" }).click();
    await page.getByRole("heading", { name: "Your space is ready" }).waitFor();
    await until(async () => Object.keys(await readFolder(page, "modules/docs")).length === 0, "the folder of Docs to be removed");
    await dropFile(page, "docs.zip", DOCS);
    await page.getByRole("dialog", { name: "Install Docs?" }).getByRole("button", { name: "Accept and install" }).click();

    assert.deepEqual(await send(page, "folders.list"), { folders: [] });
  });
});

/** The About screen of Docs, from the Launcher. */
async function openAbout(page: Page) {
  const launcher = await showLauncher(page);
  await launcher.getByRole("listitem").filter({ hasText: "Docs" }).getByRole("button", { name: "About" }).click();
  return page.getByRole("dialog", { name: "About Docs" });
}
