import assert from "node:assert/strict";
import { describe, test } from "node:test";
import type { Page } from "playwright";
import { dropFile, exampleFiles, readFolder, removeFolder, showLauncher, useHost, writeFolder, zip, zipExample } from "./browser.ts";

const host = useHost();

const notes = (page: Page) => page.frameLocator("iframe[title='Notes']");
const registry = async (page: Page) => JSON.parse((await readFolder(page, "modules/.tessello"))["modules.json"]);

/** Places Notes in the Modules folder as `git clone` would, then activates it from the Launcher. */
async function activateNotes(page: Page) {
  await writeFolder(page, "modules/notes", await exampleFiles("notes"));
  await page.reload();
  await (await showLauncher(page)).getByRole("button", { name: "Notes New, to activate" }).click();
  await page.getByRole("dialog", { name: "Activate Notes?" }).getByRole("button", { name: "Accept and activate" }).click();
  await notes(page).getByText("No notes yet.").waitFor();
}

const manifest = async (changes: object) => {
  const original = JSON.parse(new TextDecoder().decode((await exampleFiles("notes"))["manifest.json"]));
  return { ...original, ...changes };
};

describe("Modules in the Modules folder", () => {
  test("dropping a .zip unpacks it into a folder named after its Module, and registers it", async () => {
    const page = await host.newPage();
    await writeFolder(page, "modules/notes", { "readme.txt": "Something else" });
    await dropFile(page, "notes.zip", await zipExample("notes"));
    await page.getByRole("dialog", { name: "Install Notes?" }).getByRole("button", { name: "Accept and install" }).click();
    await notes(page).getByText("No notes yet.").waitFor();

    const unpacked = await readFolder(page, "modules/notes-2");
    assert.deepEqual(Object.keys(unpacked).sort(), Object.keys(await exampleFiles("notes")).sort());
    assert.deepEqual(await registry(page), { modules: [{ id: "@craftskillz/notes", folder: "notes-2", version: "1.1.0", permissions: {} }] });
  });

  test("a .zip the Validator refuses writes nothing in the folder", async () => {
    const page = await host.newPage();
    await dropFile(page, "broken.zip", zip({ "manifest.json": { convention: 1, id: "Notes" } }));
    await page.getByRole("dialog", { name: "broken.zip can't be installed" }).waitFor();
    assert.deepEqual(await readFolder(page, "modules"), {});
  });

  test("a folder added to the Modules folder shows as new, and runs once the User activates it", async () => {
    const page = await host.newPage();
    await writeFolder(page, "modules/notes", await exampleFiles("notes"));
    await page.reload();
    await (await showLauncher(page)).getByRole("button", { name: "Notes New, to activate" }).click();
    const preview = page.getByRole("dialog", { name: "Activate Notes?" });
    assert.match(await preview.innerText(), /Notes[\s\S]*1\.1\.0[\s\S]*@craftskillz\/notes/);
    assert.equal(await page.locator("iframe").count(), 0, "nothing runs before the User activates it");
    await preview.getByRole("button", { name: "Accept and activate" }).click();

    await notes(page).getByText("No notes yet.").waitFor();
    assert.equal((await registry(page)).modules[0].folder, "notes");
  });

  test("a non-compliant folder shows the Validator's report when activated", async () => {
    const page = await host.newPage();
    await writeFolder(page, "modules/broken", { "manifest.json": { convention: 1, id: "Broken", name: "Broken" } });
    await page.reload();
    await (await showLauncher(page)).getByRole("button", { name: "Broken New, to activate" }).click();
    const report = page.getByRole("dialog", { name: "the folder “broken” can't be activated" });
    assert.match(await report.innerText(), /\[manifest\/invalid-id\]/);
    assert.deepEqual(await readFolder(page, "modules/.tessello"), {});
  });

  test("a second folder declaring a registered Module ID is in conflict and does not run", async () => {
    const page = await host.newPage();
    await activateNotes(page);
    await writeFolder(page, "modules/notes-copy", await exampleFiles("notes"));
    await page.reload();

    await (await showLauncher(page)).getByRole("button", { name: "Notes Conflict" }).click();
    const explanation = page.getByRole("dialog", { name: "“notes-copy” is in conflict" });
    assert.match(await explanation.innerText(), /@craftskillz\/notes[\s\S]*“notes”/);
    await page.locator("iframe[title='Notes widget']").waitFor({ state: "attached" });
    assert.equal(await page.locator("iframe").count(), 1, "only the registered Notes runs, as its Widget");
  });

  test("a file changed on disk is used the next time the View opens", async () => {
    const page = await host.newPage();
    await activateNotes(page);
    const files = await exampleFiles("notes");
    const html = new TextDecoder().decode(files["view/index.html"]).replace("<h1>Notes</h1>", "<h1>My notes</h1>");
    assert.match(html, /My notes/);
    await writeFolder(page, "modules/notes", { "view/index.html": html });

    await (await showLauncher(page)).getByRole("button", { name: "Tessello" }).click();
    await (await showLauncher(page)).getByRole("button", { name: "Notes", exact: true }).click();
    await notes(page).getByRole("heading", { name: "My notes" }).waitFor();
  });

  test("a folder changed so that it no longer complies shows the Validator's report in place of the View", async () => {
    const page = await host.newPage();
    await activateNotes(page);
    await writeFolder(page, "modules/notes", { "manifest.json": await manifest({ view: { entry: "view/missing.html" } }) });

    await (await showLauncher(page)).getByRole("button", { name: "Tessello" }).click();
    await (await showLauncher(page)).getByRole("button", { name: "Notes", exact: true }).click();
    const report = page.getByRole("alert");
    await report.getByText("Notes no longer complies with the Convention").waitFor();
    assert.match(await report.innerText(), /\[manifest\/file-not-found\]/);
    assert.equal(await page.locator("iframe[title='Notes']").count(), 0);
  });

  test("Permissions added on disk stop the Module until the User accepts the added ones", async () => {
    const page = await host.newPage();
    await activateNotes(page);
    await notes(page).getByRole("textbox", { name: "New note" }).fill("Buy oat milk");
    await notes(page).getByRole("button", { name: "Add note" }).click();
    await notes(page).getByText("Buy oat milk").waitFor();
    await writeFolder(page, "modules/notes", { "manifest.json": await manifest({ permissions: { network: ["https://api.example.com"] } }) });

    const open = async () => {
      await (await showLauncher(page)).getByRole("button", { name: "Tessello" }).click();
      await (await showLauncher(page)).getByRole("button", { name: "Notes", exact: true }).click();
    };
    await open();
    const request = page.getByRole("alert");
    await request.getByText("Notes asks for new Permissions").waitFor();
    assert.match(
      await request.getByRole("region", { name: "What Notes can now also do" }).innerText(),
      /only these servers[\s\S]*api\.example\.com/,
    );
    assert.equal(await page.locator("iframe[title='Notes']").count(), 0);
    await request.getByRole("button", { name: "Decline" }).click();
    assert.deepEqual((await registry(page)).modules[0].permissions, {});

    await open();
    await page.getByRole("alert").getByRole("button", { name: "Accept" }).click();
    await notes(page).getByText("Buy oat milk").waitFor();
    assert.deepEqual((await registry(page)).modules[0].permissions, { network: ["https://api.example.com"] });
  });

  test("a Module whose folder has disappeared shows as not found, and is found again under another name", async () => {
    const page = await host.newPage();
    await activateNotes(page);
    await notes(page).getByRole("textbox", { name: "New note" }).fill("Buy oat milk");
    await notes(page).getByRole("button", { name: "Add note" }).click();
    await notes(page).getByText("Buy oat milk").waitFor();
    const files = await exampleFiles("notes");
    await removeFolder(page, "modules/notes");

    await page.reload();
    await (await showLauncher(page)).getByRole("button", { name: "@craftskillz/notes Not found" }).click();
    await page.getByRole("dialog", { name: "@craftskillz/notes can't be found" }).getByRole("button", { name: "Close" }).click();
    await page.getByRole("heading", { name: "Your space is ready" }).waitFor();

    await writeFolder(page, "modules/renamed-notes", files);
    await page.reload();
    await (await showLauncher(page)).getByRole("button", { name: "Notes", exact: true }).click();
    await notes(page).getByText("Buy oat milk").waitFor();
    assert.equal((await registry(page)).modules[0].folder, "renamed-notes");
  });
});
