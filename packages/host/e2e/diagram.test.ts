// What the Host does for a View, proven with the Diagram Module: the rules of Diagram itself are tested in its own
// repository (craftskillz/tessello-diagram), and that its published package works here by modules-contract.test.ts.

import assert from "node:assert/strict";
import { before, describe, test } from "node:test";
import { until } from "@tessello/sdk/testing";
import type { Page } from "playwright";
import { dropFile, moduleFixture, readFolder, useHost, writeFolder } from "./browser.ts";

const host = useHost();

let diagram: Uint8Array;

const DATA = "modules/.tessello/data/@craftskillz/diagram";
const view = (page: Page) => page.frameLocator("iframe[title='Diagram']");
const sidebar = (page: Page) => view(page).getByRole("navigation", { name: "Diagrams" });

/** Installs the Diagram Module from its .zip, and creates a diagram titled `title` in its View. */
async function installWithDiagram(page: Page, title: string) {
  await dropFile(page, "diagram.zip", diagram);
  await page.getByRole("dialog", { name: "Install Diagram?" }).getByRole("button", { name: "Accept and install" }).click();
  await sidebar(page).getByRole("button", { name: "+ New" }).click();
  const field = view(page).getByRole("textbox", { name: "Diagram title" });
  await field.fill(title);
  await field.press("Enter");
  await until(async () => (await readFolder(page, DATA))["diagrams.json"]?.includes(`"${title}"`), "the diagram to be written");
}

/** Hides or shows the page of the Host, as when the User switches to another tab and back. */
async function setPageVisible(page: Page, visible: boolean) {
  await page.evaluate((visible) => {
    Object.defineProperty(document, "visibilityState", { configurable: true, get: () => (visible ? "visible" : "hidden") });
    document.dispatchEvent(new Event("visibilitychange"));
  }, visible);
}

describe("the Host and the View of a Module", () => {
  before(async () => {
    diagram = await moduleFixture("diagram");
  });

  test("tells the View it is hidden, then shown, when the page is: Diagram then reads its diagrams again", async () => {
    const page = await host.newPage();
    await installWithDiagram(page, "Plan");
    // Renamed in the Modules folder, as by another device: the View sees it only once it reads its storage again.
    const files = await readFolder(page, DATA);
    const index = JSON.parse(files["diagrams.json"]);
    index.value[0].title = "Renamed";
    await writeFolder(page, DATA, { "diagrams.json": index });

    await setPageVisible(page, false);
    await setPageVisible(page, true);
    await sidebar(page).getByRole("button", { name: "Renamed", exact: true }).waitFor();
  });

  test("a link opened by the View opens in a new tab, out of the sandbox of its frame", async () => {
    const page = await host.newPage();
    await installWithDiagram(page, "Docs");
    await view(page).getByRole("button", { name: "Rectangle (R)" }).click();
    await view(page).getByRole("application", { name: "Canvas" }).dblclick();
    await view(page).getByRole("textbox", { name: "Text of the shape" }).fill("Wiki");
    await view(page).getByRole("textbox", { name: "Text of the shape" }).press("Enter");
    await view(page).getByRole("button", { name: "Link…" }).click();
    const dialog = view(page).getByRole("dialog", { name: "Link on this shape" });
    await dialog.getByRole("textbox", { name: "URL" }).fill("https://example.com/wiki");
    await dialog.getByRole("button", { name: "Save" }).click();
    const wiki = view(page).getByRole("img", { name: "Rectangle Wiki" });
    await wiki.locator(".dg-link[data-link='url']").waitFor();

    // The new tab is answered here, not by the network.
    await page.context().route("https://example.com/**", (route) => route.fulfill({ contentType: "text/html", body: "<p>Wiki</p>" }));
    const box = (await wiki.boundingBox())!;
    const popup = page.context().waitForEvent("page");
    await page.keyboard.down("Shift");
    await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
    await page.keyboard.up("Shift");
    const tab = await popup;
    await tab.waitForLoadState();
    assert.equal(tab.url(), "https://example.com/wiki");
    // Still in the sandbox, its origin would be opaque: "null".
    assert.equal(await tab.evaluate(() => self.origin), "https://example.com");
  });
});
