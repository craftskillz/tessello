import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { strToU8, zipSync } from "fflate";
import type { Page } from "playwright";
import { dropFile, exampleFiles, readFolder, useHost, zipExample } from "./browser.ts";

const host = useHost();

/** Notes 1.2.0: its View's heading says so, and it declares a network Permission Notes 1.1.0 does not have. */
async function notesWithSync(): Promise<Uint8Array> {
  const files = await exampleFiles("notes");
  const manifest = JSON.parse(new TextDecoder().decode(files["manifest.json"]));
  files["manifest.json"] = strToU8(JSON.stringify({ ...manifest, version: "1.2.0", permissions: { network: ["https://sync.example.com"] } }));
  files["view/index.html"] = strToU8(new TextDecoder().decode(files["view/index.html"]).replace("<h1>Notes</h1>", "<h1>Notes 1.2</h1>"));
  return zipSync(files);
}

/** Installs Notes and writes a note in it. */
async function installNotes(page: Page) {
  await dropFile(page, "notes.zip", await zipExample("notes"));
  await page.getByRole("dialog", { name: "Install Notes?" }).getByRole("button", { name: "Accept and install" }).click();
  const notes = page.frameLocator("iframe[title='Notes']");
  await notes.getByRole("textbox", { name: "New note" }).fill("Buy oat milk");
  await notes.getByRole("button", { name: "Add note" }).click();
  await notes.getByText("Buy oat milk").waitFor();
}

const launcher = (page: Page) => page.getByRole("navigation", { name: "Launcher" });

/** Opens the About dialog of Notes, with the Permissions granted to it, from the Launcher. */
async function openGranted(page: Page) {
  await launcher(page).getByRole("listitem").filter({ hasText: "Notes" }).getByRole("button", { name: "About" }).click();
  return page.getByRole("dialog", { name: "About Notes" });
}

async function grantedPermissions(page: Page) {
  const dialog = await openGranted(page);
  const text = await dialog.getByRole("region").innerText();
  await dialog.getByRole("button", { name: "Close" }).click();
  return text;
}

describe("updating a Module", () => {
  test("a new version asking for a new Permission shows the versions and only the added Permission; declined, nothing changes; accepted, it runs with its data", async () => {
    const page = await host.newPage();
    await installNotes(page);

    await dropFile(page, "notes-1.2.0.zip", await notesWithSync());
    const update = page.getByRole("dialog", { name: "Update Notes?" });
    await update.waitFor();
    assert.match(await update.innerText(), /Installed[\s\S]*Notes 1\.1\.0[\s\S]*Incoming[\s\S]*Notes 1\.2\.0/);
    const added = update.getByRole("region", { name: "What Notes can now also do" });
    assert.match(await added.innerText(), /only these servers[\s\S]*sync\.example\.com/);
    assert.deepEqual(await update.getByRole("button").allInnerTexts(), ["Cancel", "Accept and update"]);

    await update.getByRole("button", { name: "Cancel" }).click();
    await page.reload();
    await launcher(page).getByRole("button", { name: "Notes" }).click();
    const notes = page.frameLocator("iframe[title='Notes']");
    await notes.getByRole("heading", { name: "Notes", exact: true }).waitFor();
    assert.match(await grantedPermissions(page), /No network access/);

    await dropFile(page, "notes-1.2.0.zip", await notesWithSync());
    await page.getByRole("dialog", { name: "Update Notes?" }).getByRole("button", { name: "Accept and update" }).click();
    await notes.getByRole("heading", { name: "Notes 1.2" }).waitFor();
    await notes.getByText("Buy oat milk").waitFor();
    assert.match(await grantedPermissions(page), /only these servers[\s\S]*sync\.example\.com/);
    assert.equal(await launcher(page).getByRole("listitem").count(), 1);
  });
});

describe("uninstalling a Module", () => {
  test("after confirmation, removes the Module from the Launcher and the Home, with its folder and its data", async () => {
    const page = await host.newPage();
    await installNotes(page);
    await page.getByRole("button", { name: "Tessello" }).click();
    await page.getByRole("listitem", { name: "Notes" }).waitFor();

    await (await openGranted(page)).getByRole("button", { name: "Uninstall…" }).click();
    const confirm = page.getByRole("dialog", { name: "Uninstall Notes?" });
    assert.match(await confirm.innerText(), /folder “notes”[\s\S]*data/);
    await confirm.getByRole("button", { name: "Cancel" }).click();
    assert.equal(await launcher(page).getByRole("button", { name: "Notes" }).count(), 1, "cancelling keeps the Module");

    await (await openGranted(page)).getByRole("button", { name: "Uninstall…" }).click();
    await page.getByRole("dialog", { name: "Uninstall Notes?" }).getByRole("button", { name: "Uninstall" }).click();
    await page.getByRole("heading", { name: "Your space is ready" }).waitFor();
    assert.equal(await launcher(page).getByRole("listitem").count(), 0);
    assert.equal(await page.getByRole("listitem", { name: "Notes" }).count(), 0);
    assert.deepEqual(await readFolder(page, "modules/notes"), {});
    assert.deepEqual(await readFolder(page, "modules/.tessello/data/@tessello/notes"), {});
  });
});
