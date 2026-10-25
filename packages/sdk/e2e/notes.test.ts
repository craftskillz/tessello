// How a Module's own browser tests use the Test Host, shown on the Notes example Module: its folder is served as it is,
// as a Module's `dist/` would be, and its View and Widget open in Chromium without a Host, a Modules folder or an iframe.
// A Module's repository copies this file, with `@tessello/sdk/testing` in place of the relative import.
// Run with `npm run test:browser`; E2E_CPU_SLOWDOWN=4 slows the browser down as on a CI machine.

import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { after, before, test } from "node:test";
import { type Browser, chromium, type Page } from "playwright";
import { createTestHost, serveFolder, slowDownCpu, until, WIDGET_SIZES } from "../src/testing.ts";

const folder = fileURLToPath(new URL("../../../examples/notes/", import.meta.url));
const manifest = JSON.parse(await readFile(`${folder}manifest.json`, "utf8"));
const module = { id: manifest.id, version: manifest.version };

let browser: Browser;
let server: { url: string; close(): Promise<void> };
before(async () => {
  server = await serveFolder(folder);
  browser = await chromium.launch();
});
after(async () => {
  await browser?.close();
  await server?.close();
});

/** A page in a new browser context, slowed down by E2E_CPU_SLOWDOWN. */
async function newPage(): Promise<Page> {
  const page = await (await browser.newContext()).newPage();
  await slowDownCpu(page);
  return page;
}

test("the View shows the stored notes, keeps a new one after a reload, and follows the theme and its Widget's +", async () => {
  const host = createTestHost({ module, storage: { notes: [{ id: "1", text: "Buy milk" }] } });
  const page = await newPage();
  await host.attach(page, { surface: "view" });
  await page.goto(`${server.url}/${manifest.view.entry}`);

  await page.getByText("Buy milk").waitFor();
  await page.getByLabel("New note").fill("Call the plumber");
  await page.getByRole("button", { name: "Add note" }).click();
  const notes = await until(async () => {
    const stored = (await host.storage.get("notes")) as { text: string }[] | null;
    return stored?.length === 2 && stored;
  }, "the new note is written");
  assert.equal(notes[0].text, "Call the plumber");

  await page.reload();
  await page.getByText("Call the plumber").waitFor();

  host.setTheme("dark");
  await until(() => page.evaluate(() => document.documentElement.style.colorScheme === "dark"), "the dark theme");

  host.openView({ note: "new" });
  await until(() => page.evaluate(() => document.activeElement?.id === "text"), "the new note's field has the focus");
});

test("the Widget, at its size, shows the latest note again when shown, and its + opens the View on a new note", async () => {
  const host = createTestHost({ module, storage: { notes: [{ id: "1", text: "Buy milk" }] } });
  const page = await newPage();
  await page.setViewportSize(WIDGET_SIZES[manifest.widget.size as keyof typeof WIDGET_SIZES]);
  const widget = await host.attach(page, { surface: "widget" });
  await page.goto(`${server.url}/${manifest.widget.entry}`);

  await page.getByText("Buy milk").waitFor();
  await host.storage.set("notes", [{ id: "2", text: "Water the plants" }, { id: "1", text: "Buy milk" }]);
  widget.setVisible(false);
  widget.setVisible(true);
  await page.getByText("Water the plants").waitFor();
  await page.getByText("2 notes").waitFor();

  await page.getByRole("button", { name: "New note" }).click();
  await until(() => host.openedViews.length === 1, "the Widget opens the View");
  assert.deepEqual(host.openedViews, [{ note: "new" }]);
});
