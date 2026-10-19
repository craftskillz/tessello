import assert from "node:assert/strict";
import { before, describe, test } from "node:test";
import type { Page } from "playwright";
import { dropFile, readFolder, useHost, zipSample } from "./browser.ts";

const host = useHost();

let survivalKit: Uint8Array;
before(async () => {
  survivalKit = await zipSample("survival-kit");
});

/** Installs the Survival Kit from its .zip; the Host then shows its View. */
async function install(page: Page) {
  await dropFile(page, "survival-kit.zip", survivalKit);
  await page.getByRole("dialog", { name: "Install Survival Kit?" }).getByRole("button", { name: "Accept and install" }).click();
  await view(page).getByRole("heading", { name: "myTasks." }).waitFor();
}

/** Waits until the Host has written a key of the kit, so that a reload cannot cut the write short. */
async function stored(page: Page, key: "tasks" | "notes" | "links", written: (value: any) => boolean) {
  for (let tries = 0; tries < 50; tries++) {
    const file = (await readFolder(page, "modules/.tessello/data/@tessello/survival-kit"))[`${key}.json`];
    if (file && written(JSON.parse(file).value)) return;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  assert.fail(`the Host did not write "${key}"`);
}

const view = (page: Page) => page.frameLocator("iframe[title='Survival Kit']");
const widget = (page: Page) => page.frameLocator("iframe[title='Survival Kit widget']");
const goHome = (page: Page) => page.getByRole("button", { name: "Tessello" }).click();
const openFromLauncher = (page: Page) => page.getByRole("navigation", { name: "Launcher" }).getByRole("button", { name: "Survival Kit" }).click();

async function addTask(page: Page, text: string, priority: "Normal" | "Urgent" | "Later") {
  await view(page).getByRole("textbox", { name: "New task" }).fill(text);
  await view(page).getByRole("combobox", { name: "Priority" }).selectOption({ label: priority });
  await view(page).getByRole("button", { name: "Add task" }).click();
  await view(page).getByRole("checkbox", { name: text }).waitFor();
}

/** The section of a panel: "myTasks", "myNotes" or "myLinks". */
const panel = (page: Page, name: string) => view(page).getByRole("region", { name, exact: true });

async function addCodeNote(page: Page, title: string, code: string) {
  const notes = panel(page, "myNotes");
  await notes.getByRole("button", { name: "+ new note" }).click();
  await view(page).getByRole("dialog", { name: "New note" }).getByRole("textbox", { name: "Title" }).fill(title);
  await view(page).getByRole("button", { name: "Create" }).click();
  await notes.getByRole("button", { name: "edit mode" }).click();
  await notes.getByRole("button", { name: "+ add a block" }).click();
  const dialog = view(page).getByRole("dialog", { name: "New block" });
  await dialog.getByRole("combobox", { name: "Type" }).selectOption({ label: "Code" });
  await dialog.getByRole("textbox", { name: "Content" }).fill(code);
  await dialog.getByRole("button", { name: "Save" }).click();
}

describe("the Survival Kit sample Module", () => {
  test("keeps a task, a note with a Code block and a link after a reload", async () => {
    const page = await host.newPage();
    await install(page);
    await addTask(page, "Rotate the API key", "Urgent");
    await addCodeNote(page, "Git shortcuts", "git log --oneline --graph");
    await panel(page, "myNotes").locator("pre").getByText("git log --oneline --graph").waitFor();

    const links = panel(page, "myLinks");
    await links.getByRole("button", { name: "+ new category" }).click();
    await view(page).getByRole("dialog", { name: "New category" }).getByRole("textbox", { name: "Name" }).fill("Monitoring");
    await view(page).getByRole("button", { name: "Add", exact: true }).click();
    await links.getByRole("button", { name: "edit mode" }).click();
    await links.getByRole("button", { name: "Add a link" }).click();
    const dialog = view(page).getByRole("dialog", { name: "New link" });
    await dialog.getByRole("textbox", { name: "Name" }).fill("Grafana");
    await dialog.getByRole("textbox", { name: "Description" }).fill("production dashboards");
    await dialog.getByRole("textbox", { name: "URL" }).fill("grafana.example.com");
    await dialog.getByRole("button", { name: "Add" }).click();
    await stored(page, "links", (categories) => categories[0]?.links.length === 1);

    await page.reload();
    await openFromLauncher(page);
    await view(page).getByRole("checkbox", { name: "Rotate the API key" }).waitFor();
    await panel(page, "myNotes").getByRole("button", { name: "expand all" }).click();
    await panel(page, "myNotes").locator("pre").getByText("git log --oneline --graph").waitFor();
    await panel(page, "myLinks").getByRole("button", { name: "expand all" }).click();
    const link = panel(page, "myLinks").getByRole("link", { name: /Grafana — production dashboards/ });
    assert.equal(await link.getAttribute("href"), "https://grafana.example.com", "a URL without a scheme gets https://");
    assert.equal(await link.getAttribute("target"), "_blank");
  });

  test("a task checked in the Widget shows as done when the View comes back", async () => {
    const page = await host.newPage();
    await install(page);
    await addTask(page, "Renew the certificate", "Urgent");
    await addTask(page, "Water the plants", "Normal");
    await goHome(page);

    const urgent = widget(page).getByRole("checkbox", { name: "Renew the certificate" });
    await urgent.waitFor();
    assert.equal(await widget(page).getByRole("checkbox", { name: "Water the plants" }).count(), 0, "only urgent tasks");
    await widget(page).getByText("1 urgent").waitFor();
    await widget(page).getByText("2 to do").waitFor();
    await urgent.click();
    await widget(page).getByText("No urgent task.").waitFor();
    await widget(page).getByText("1 to do").waitFor();

    // The View, left behind the Home, reads the kit again when it is shown.
    await openFromLauncher(page);
    await view(page).getByRole("checkbox", { name: "Renew the certificate", checked: true }).waitFor();
    assert.equal(await view(page).getByRole("checkbox", { name: "Water the plants" }).getAttribute("aria-checked"), "false");
  });

  test("the Widget's urgent count opens the View filtered on Urgent, whether the View is loaded or not", async () => {
    const page = await host.newPage();
    await install(page);
    await addTask(page, "Renew the certificate", "Urgent");
    await addTask(page, "Water the plants", "Normal");
    const urgentFilter = view(page).getByRole("button", { name: "Urgent", exact: true });
    assert.equal(await urgentFilter.getAttribute("aria-pressed"), "false");

    // The View is loaded behind the Home: it gets the params as an event.
    await goHome(page);
    await widget(page).getByRole("button", { name: "1 urgent" }).click();
    await page.locator("iframe[title='Survival Kit']").waitFor({ state: "visible" });
    await view(page).locator("button[aria-pressed='true']", { hasText: "Urgent" }).waitFor();
    assert.equal(await view(page).getByRole("checkbox", { name: "Water the plants" }).count(), 0);
    await view(page).getByRole("checkbox", { name: "Renew the certificate" }).waitFor();

    // The View is not loaded: it gets the params in its handshake.
    await page.reload();
    await widget(page).getByRole("button", { name: "1 urgent" }).click();
    await view(page).locator("button[aria-pressed='true']", { hasText: "Urgent" }).waitFor();
    await view(page).getByRole("checkbox", { name: "Renew the certificate" }).waitFor();
    assert.equal(await view(page).getByRole("checkbox", { name: "Water the plants" }).count(), 0);
  });

  test("imports a .survival-kit.json of the original Survival Kit, after a confirmation, and refuses a file that is not a kit", async () => {
    const page = await host.newPage();
    await install(page);
    await addTask(page, "Replaced by the import", "Later");
    const file = view(page).locator("input[type=file]");

    await file.setInputFiles({ name: "notes.txt", mimeType: "text/plain", buffer: Buffer.from("not a kit") });
    await view(page).getByRole("alert").getByText("notes.txt can't be imported: it is not a Survival Kit.").waitFor();

    const kit = {
      tasks: [
        { id: 1, text: "Imported task", priority: "urgent", done: false },
        { id: 2, text: "Imported done task", priority: "normal", done: true },
      ],
      notes: [{ id: 3, theme: "t-violet", titre: "Imported note", blocs: [{ type: "ul", items: ["one", "two"] }] }],
      links: [{ theme: "t-sky", titre: "Imported links", liens: [{ nom: "MDN", desc: "", url: "https://developer.mozilla.org" }] }],
    };
    await file.setInputFiles({ name: ".survival-kit.json", mimeType: "application/json", buffer: Buffer.from(JSON.stringify(kit)) });
    const dialog = view(page).getByRole("dialog", { name: "Replace your kit?" });
    await dialog.getByText("This file holds 2 tasks, 1 notes and 1 categories of links.").waitFor();
    await dialog.getByRole("button", { name: "Replace" }).click();

    await view(page).getByRole("checkbox", { name: "Imported task" }).waitFor();
    assert.equal(await view(page).getByRole("checkbox", { name: "Replaced by the import" }).count(), 0);
    await stored(page, "links", (categories) => categories[0]?.title === "Imported links");
    await page.reload();
    await openFromLauncher(page);
    await view(page).getByRole("checkbox", { name: "Imported done task" }).waitFor();
    await panel(page, "myNotes").getByRole("region", { name: "Imported note" }).waitFor();
    await panel(page, "myLinks").getByRole("region", { name: "Imported links" }).waitFor();
  });

  test("tells the User when a change cannot be saved", async () => {
    const page = await host.newPage();
    await install(page);
    // A value of storage is limited to 1 MB (CONVENTION.md §6.1).
    await addCodeNote(page, "Too big", "x".repeat(1_100_000));
    await view(page).getByRole("alert").getByText(/Your last change could not be saved: the storage of the Survival Kit is full/).waitFor();
  });

  test("copies a Code block to the clipboard from the sandboxed iframe", async () => {
    const page = await host.newPage();
    await page.context().grantPermissions(["clipboard-read"], { origin: host.url });
    await install(page);
    await addCodeNote(page, "Git", "git stash pop");
    await panel(page, "myNotes").getByRole("button", { name: "copy" }).click();
    await panel(page, "myNotes").getByRole("button", { name: "copied ✓" }).waitFor();
    assert.equal(await page.evaluate(() => navigator.clipboard.readText()), "git stash pop");
  });
});
