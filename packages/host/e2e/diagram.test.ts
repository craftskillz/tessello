import assert from "node:assert/strict";
import { before, describe, test } from "node:test";
import type { Page } from "playwright";
import { dropFile, readFolder, useHost, zipSample } from "./browser.ts";

const host = useHost();

let diagram: Uint8Array;
before(async () => {
  diagram = await zipSample("diagram");
});

const view = (page: Page) => page.frameLocator("iframe[title='Diagram']");
const canvas = (page: Page) => view(page).getByRole("application", { name: "Canvas" });
const sidebar = (page: Page) => view(page).getByRole("navigation", { name: "Diagrams" });
const openFromLauncher = (page: Page) => page.getByRole("navigation", { name: "Launcher" }).getByRole("button", { name: "Diagram" }).click();

/** Installs the Diagram Module from its .zip; the Host then shows its View, with no diagram yet. */
async function install(page: Page) {
  await dropFile(page, "diagram.zip", diagram);
  await page.getByRole("dialog", { name: "Install Diagram?" }).getByRole("button", { name: "Accept and install" }).click();
  await view(page).getByText("Select or create a diagram").waitFor();
}

/** An entry of the list of diagrams. */
type Entry = { id: string; title: string; updatedAt: number };

/**
 * The list of diagrams as the Host wrote it, under the key `diagrams`. A file read while the Host writes it may fail
 * (NotReadableError): it is read again.
 */
async function storedIndex(page: Page): Promise<Entry[]> {
  for (let tries = 0; ; tries++) {
    try {
      const file = (await readFolder(page, "modules/.tessello/data/@tessello/diagram"))["diagrams.json"];
      return file ? JSON.parse(file).value : [];
    } catch (error) {
      if (tries === 10) throw error;
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
  }
}

/** Waits until the list of diagrams the Host wrote passes `written`, so that a reload cannot cut a write short. */
async function stored(page: Page, written: (index: Entry[]) => boolean) {
  for (let tries = 0; tries < 50; tries++) {
    if (written(await storedIndex(page))) return;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  assert.fail("the Host did not write the change");
}

/** Runs a change, then waits until the Host has written it: a diagram is written before the list, so a newer `updatedAt` in the list means the diagram is written too. */
async function saved(page: Page, change: () => Promise<void>) {
  const before = Math.max(0, ...(await storedIndex(page)).map((entry) => entry.updatedAt));
  await change();
  await stored(page, (index) => index.some((entry) => entry.updatedAt > before));
}

/** A point of the drawing, in the coordinates of the page: a diagram opens with its origin in the middle of the canvas. */
async function at(page: Page, x: number, y: number) {
  const box = (await canvas(page).boundingBox())!;
  return { x: box.x + box.width / 2 + x, y: box.y + box.height / 2 + y };
}

async function tool(page: Page, name: "Select (V)" | "Rectangle (R)" | "Arrow (F)") {
  await view(page).getByRole("button", { name }).click();
}

async function addRectangle(page: Page, x: number, y: number, text: string) {
  await tool(page, "Rectangle (R)");
  const point = await at(page, x, y);
  await page.mouse.dblclick(point.x, point.y);
  await view(page).getByRole("textbox", { name: "Text of the shape" }).fill(text);
  await saved(page, () => view(page).getByRole("textbox", { name: "Text of the shape" }).press("Enter"));
  await view(page).getByRole("img", { name: `Rectangle ${text}`, exact: true }).waitFor();
}

async function drag(page: Page, from: { x: number; y: number }, to: { x: number; y: number }) {
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  await page.mouse.move(to.x, to.y, { steps: 8 });
  await page.mouse.up();
}

/** Where the arrow starts and where its tip is, in the coordinates of the drawing. */
async function arrowEnds(page: Page, name: string) {
  const arrow = view(page).getByRole("img", { name });
  const line = arrow.locator(".dg-arrow-line");
  const start = { x: Number(await line.getAttribute("x1")), y: Number(await line.getAttribute("y1")) };
  const [x, y] = (await arrow.locator(".dg-arrow-head").getAttribute("points"))!.split(" ")[0].split(",").map(Number);
  return { start, tip: { x, y } };
}

/** Within a pixel: a point of the page and a point of the drawing may differ by half a pixel. */
function near(actual: { x: number; y: number }, expected: { x: number; y: number }) {
  assert.ok(Math.abs(actual.x - expected.x) <= 1 && Math.abs(actual.y - expected.y) <= 1, `${JSON.stringify(actual)} is not near ${JSON.stringify(expected)}`);
}

async function newDiagram(page: Page, title: string) {
  await saved(page, () => sidebar(page).getByRole("button", { name: "+ New" }).click());
  const field = view(page).getByRole("textbox", { name: "Diagram title" });
  await field.fill(title);
  await saved(page, () => field.press("Enter"));
  await sidebar(page).getByRole("button", { name: title, exact: true }).waitFor();
}

describe("the Diagram sample Module", () => {
  test("keeps two rectangles connected by an arrow after a reload, and the arrow follows a moved rectangle", async () => {
    const page = await host.newPage();
    await install(page);
    await newDiagram(page, "Checkout");
    await addRectangle(page, -200, 0, "API");
    await addRectangle(page, 200, 0, "DB");
    await tool(page, "Arrow (F)");
    await saved(page, async () => drag(page, await at(page, -200, 0), await at(page, 200, 0)));

    await page.reload();
    await openFromLauncher(page);
    await view(page).getByRole("img", { name: "Rectangle API", exact: true }).waitFor();
    await view(page).getByRole("img", { name: "Rectangle DB", exact: true }).waitFor();
    assert.equal(await view(page).getByRole("textbox", { name: "Diagram title" }).inputValue(), "Checkout");
    const arrow = "Arrow from Rectangle API to Rectangle DB";
    // The rectangles are 120 × 60: the line stops at their outline, and never enters them.
    let ends = await arrowEnds(page, arrow);
    near(ends.start, { x: -140, y: 0 });
    near(ends.tip, { x: 140, y: 0 });

    await tool(page, "Select (V)");
    await saved(page, async () => drag(page, await at(page, 200, 0), await at(page, 200, 300)));
    // From DB at (200, 300) toward API at (−200, 0), the line meets the top side of DB at (160, 270).
    ends = await arrowEnds(page, arrow);
    near(ends.tip, { x: 160, y: 270 });
    near(ends.start, { x: -160, y: 30 });

    await page.reload();
    await openFromLauncher(page);
    await view(page).getByRole("img", { name: arrow }).waitFor();
    near((await arrowEnds(page, arrow)).tip, { x: 160, y: 270 });
  });

  test("deletes a diagram after a confirmation, then opens the first remaining one, or shows the empty state", async () => {
    const page = await host.newPage();
    await install(page);
    await newDiagram(page, "Kept");
    await newDiagram(page, "Removed");

    await sidebar(page).getByRole("button", { name: "Delete Removed" }).click();
    const dialog = view(page).getByRole("dialog", { name: "Delete this diagram?" });
    await dialog.getByRole("button", { name: "Cancel" }).click();
    await sidebar(page).getByRole("button", { name: "Removed", exact: true }).waitFor();

    await sidebar(page).getByRole("button", { name: "Delete Removed" }).click();
    await dialog.getByRole("button", { name: "Delete" }).click();
    await stored(page, (index) => index.every((entry) => entry.title !== "Removed"));
    assert.equal(await sidebar(page).getByRole("button", { name: "Removed", exact: true }).count(), 0);
    assert.equal(await view(page).getByRole("textbox", { name: "Diagram title" }).inputValue(), "Kept");

    await sidebar(page).getByRole("button", { name: "Delete Kept" }).click();
    await dialog.getByRole("button", { name: "Delete" }).click();
    await view(page).getByText("Select or create a diagram").waitFor();
    await sidebar(page).getByText("No diagrams").waitFor();
  });

  test("an empty title becomes Untitled", async () => {
    const page = await host.newPage();
    await install(page);
    await newDiagram(page, "Draft");
    const field = view(page).getByRole("textbox", { name: "Diagram title" });
    await field.fill("  ");
    await field.press("Enter");
    await sidebar(page).getByRole("button", { name: "Untitled", exact: true }).waitFor();
    assert.equal(await field.inputValue(), "Untitled");
  });

  test("tells the User when a change cannot be saved, and keeps it on screen", async () => {
    const page = await host.newPage();
    await install(page);
    await newDiagram(page, "Too big");
    await tool(page, "Rectangle (R)");
    const point = await at(page, 0, 0);
    await page.mouse.dblclick(point.x, point.y);
    // A value of storage is limited to 1 MB (CONVENTION.md §6.1).
    await view(page).getByRole("textbox", { name: "Text of the shape" }).fill("x".repeat(1_100_000));
    await view(page).getByRole("textbox", { name: "Text of the shape" }).press("Enter");
    await view(page).getByRole("alert").getByText(/Your last change could not be saved: the storage of the Diagram Module is full/).waitFor();
    await view(page).getByRole("status").getByText("Save failed").waitFor();
    await view(page).getByRole("img", { name: /^Rectangle x+$/ }).waitFor();
  });
});
