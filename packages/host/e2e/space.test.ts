import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { describe, test } from "node:test";
import { dropFile, useHost, zipExample } from "./browser.ts";

const host = useHost();

describe("export and import of the space", () => {
  test("a space exported in one browser is found again in another, once its Permissions are accepted", async () => {
    const page = await host.newPage();
    await dropFile(page, "notes.zip", await zipExample("notes"));
    await page.getByRole("dialog", { name: "Install Notes?" }).getByRole("button", { name: "Accept and install" }).click();
    const notes = page.frameLocator("iframe[title='Notes']");
    await notes.getByRole("textbox", { name: "New note" }).fill("Buy oat milk");
    await notes.getByRole("button", { name: "Add note" }).click();
    await notes.getByText("Buy oat milk").waitFor();

    await page.getByRole("button", { name: /^Modules folder/ }).click();
    const [download] = await Promise.all([page.waitForEvent("download"), page.getByRole("button", { name: "Export your space" }).click()]);
    assert.match(download.suggestedFilename(), /^tessello-space-\d{4}-\d{2}-\d{2}\.zip$/);
    const exported = await readFile(await download.path());

    const other = await host.newPage();
    await other.getByRole("button", { name: /^Modules folder/ }).click();
    await other.getByLabel("Space file to import").setInputFiles({ name: "space.zip", mimeType: "application/zip", buffer: exported });
    const preview = other.getByRole("dialog", { name: "Import 1 Module?" });
    await preview.waitFor();
    assert.match(await preview.innerText(), /Notes[\s\S]*@tessello\/notes[\s\S]*What Notes can do/);
    const launcher = other.getByRole("navigation", { name: "Launcher" });
    assert.equal(await launcher.getByRole("button", { name: "Notes" }).count(), 0, "nothing is imported before accepting");

    await preview.getByRole("button", { name: "Accept and import" }).click();
    await launcher.getByRole("button", { name: "Notes" }).click();
    await other.frameLocator("iframe[title='Notes']").getByText("Buy oat milk").waitFor();
  });

  test("a file that is not an export is refused, and nothing is imported", async () => {
    const page = await host.newPage();
    await page.getByRole("button", { name: /^Modules folder/ }).click();
    await page.getByLabel("Space file to import").setInputFiles({ name: "notes.zip", mimeType: "application/zip", buffer: Buffer.from(await zipExample("notes")) });
    const refusal = page.getByRole("dialog", { name: "notes.zip can't be imported" });
    await refusal.waitFor();
    assert.match(await refusal.innerText(), /not an export of Tessello[\s\S]*Nothing was imported/);
    await refusal.getByRole("button", { name: "Close" }).click();
    assert.equal(await page.getByRole("navigation", { name: "Launcher" }).getByRole("listitem").count(), 0);
  });
});
