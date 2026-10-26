// What the Host does for a View, proven with the Survival Kit Module: the rules of Survival Kit itself are tested in its
// own repository (craftskillz/tessello-survival-kit), and that its published package works here by modules-contract.test.ts.

import assert from "node:assert/strict";
import { before, describe, test } from "node:test";
import type { Page } from "playwright";
import { dropFile, moduleFixture, useHost } from "./browser.ts";

const host = useHost();

let survivalKit: Uint8Array;

const view = (page: Page) => page.frameLocator("iframe[title='Survival Kit']");
const notes = (page: Page) => view(page).getByRole("region", { name: "myNotes", exact: true });

/** Installs the Survival Kit from its .zip, and writes a note with a Code block holding `code` in its View. */
async function installWithCode(page: Page, code: string) {
  await dropFile(page, "survival-kit.zip", survivalKit);
  await page.getByRole("dialog", { name: "Install Survival Kit?" }).getByRole("button", { name: "Accept and install" }).click();
  await notes(page).getByRole("button", { name: "+ new note" }).click();
  await view(page).getByRole("dialog", { name: "New note" }).getByRole("textbox", { name: "Title" }).fill("Git");
  await view(page).getByRole("button", { name: "Create" }).click();
  await notes(page).getByRole("button", { name: "edit mode" }).click();
  await notes(page).getByRole("button", { name: "+ add a block" }).click();
  const dialog = view(page).getByRole("dialog", { name: "New block" });
  await dialog.getByRole("combobox", { name: "Type" }).selectOption({ label: "Code" });
  await dialog.getByRole("textbox", { name: "Content" }).fill(code);
  await dialog.getByRole("button", { name: "Save" }).click();
}

describe("the Host and the View of a Module", () => {
  before(async () => {
    survivalKit = await moduleFixture("survival-kit");
  });

  test("the View writes to the clipboard from its sandboxed iframe", async () => {
    const page = await host.newPage();
    await page.context().grantPermissions(["clipboard-read"], { origin: host.url });
    await installWithCode(page, "git stash pop");
    await notes(page).getByRole("button", { name: "copy" }).click();
    await notes(page).getByRole("button", { name: "copied ✓" }).waitFor();
    assert.equal(await page.evaluate(() => navigator.clipboard.readText()), "git stash pop");
  });
});
