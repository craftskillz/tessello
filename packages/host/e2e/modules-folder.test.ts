import assert from "node:assert/strict";
import { describe, test } from "node:test";
import type { Page } from "playwright";
import { chooseFolder, dropFile, readFolder, showLauncher, showLauncherTools, useHost, zipExample } from "./browser.ts";

const host = useHost();

const notes = (page: Page) => page.frameLocator("iframe[title='Notes']");

/** Installs Notes from its .zip and adds a note. */
async function installNotesWithANote(page: Page, note: string) {
  await dropFile(page, "notes.zip", await zipExample("notes"));
  await page.getByRole("dialog", { name: "Install Notes?" }).getByRole("button", { name: "Accept and install" }).click();
  await notes(page).getByRole("textbox", { name: "New note" }).fill(note);
  await notes(page).getByRole("button", { name: "Add note" }).click();
  await notes(page).getByText(note).waitFor();
}

describe("the Modules folder", () => {
  test("a browser that cannot choose a folder only shows that it cannot open the Modules folder, and why", async () => {
    const page = await host.newPage({ unsupported: true });
    await page.getByRole("heading", { name: "This browser can't open your Modules folder" }).waitFor();
    assert.match(await page.locator("#gate").innerText(), /does not let a web page use a folder of your computer/);
    assert.equal(await (await showLauncher(page)).isVisible(), false);
    assert.equal(await page.getByRole("button").count(), 0);
  });

  test("on the first launch, the User chooses the folder before anything else, told where data goes and about git", async () => {
    const page = await host.newPage({ choose: false });
    await page.getByRole("heading", { name: "Choose your Modules folder" }).waitFor();
    assert.equal(await (await showLauncher(page)).isVisible(), false);
    const text = await page.locator("#gate").innerText();
    assert.match(text, /\.tessello\/data\//);
    assert.match(text, /secrets/);
    assert.match(text, /git/);

    await chooseFolder(page);
    await page.getByRole("heading", { name: "Your space is ready" }).waitFor();
  });

  test("when the browser asks for the permission again, the folder is reconnected in one click, and nothing else works until then", async () => {
    const page = await host.newPage();
    await installNotesWithANote(page, "Buy oat milk");
    await page.addInitScript(() => {
      let granted = false;
      FileSystemHandle.prototype.queryPermission = async () => (granted ? "granted" : "prompt");
      FileSystemHandle.prototype.requestPermission = async () => ((granted = true), "granted");
    });

    await page.reload();
    await page.getByRole("heading", { name: "Reconnect your Modules folder" }).waitFor();
    assert.equal(await (await showLauncher(page)).isVisible(), false);
    await page.getByRole("button", { name: "Reconnect “modules”" }).click();
    await (await showLauncher(page)).getByRole("button", { name: "Notes" }).click();
    await notes(page).getByText("Buy oat milk").waitFor();
  });

  test("choosing a folder that holds a .tessello/ finds the space as it was, after the reference to it is lost", async () => {
    const page = await host.newPage();
    await installNotesWithANote(page, "Buy oat milk");
    // As after a lost reference, or a git clone on another machine: the browser no longer knows the folder.
    await page.evaluate(() => new Promise((resolve) => (indexedDB.deleteDatabase("tessello-host").onsuccess = resolve)));

    await page.reload();
    await chooseFolder(page);
    await (await showLauncher(page)).getByRole("button", { name: "Notes" }).click();
    await notes(page).getByText("Buy oat milk").waitFor();
  });

  test("a setting shows the folder and moves to another one, copying Modules and .tessello/ without touching the first", async () => {
    const page = await host.newPage();
    await installNotesWithANote(page, "Buy oat milk");
    const before = await readFolder(page, "modules");

    await (await showLauncherTools(page)).getByRole("button", { name: "Modules folder: modules" }).click();
    const settings = page.getByRole("dialog", { name: "Modules folder" });
    assert.match(await settings.innerText(), /“modules”/);
    await page.evaluate(() => Object.assign(window, { tesselloPick: "elsewhere" }));
    await Promise.all([page.waitForEvent("load"), settings.getByRole("button", { name: "Choose another folder…" }).click()]);

    await (await showLauncherTools(page)).getByRole("button", { name: "Modules folder: elsewhere" }).waitFor();
    await (await showLauncher(page)).getByRole("button", { name: "Notes" }).click();
    await notes(page).getByText("Buy oat milk").waitFor();
    assert.deepEqual(await readFolder(page, "elsewhere"), before);
    assert.deepEqual(await readFolder(page, "modules"), before);
  });
});
