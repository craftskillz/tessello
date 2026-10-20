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

type ToolName = "Select (S)" | "Rectangle (R)" | "Ellipse (E)" | "Database (D)" | "Circle (C)" | "Actor (A)" | "Post-it (P)" | "Free text (T)" | "Arrow (F)";

async function tool(page: Page, name: ToolName) {
  await view(page).getByRole("button", { name }).click();
}

/** Places a shape with a tool by a double-click, and writes its text: the shape stays selected. */
async function addShape(page: Page, name: ToolName, x: number, y: number, text: string) {
  await tool(page, name);
  const point = await at(page, x, y);
  await page.mouse.dblclick(point.x, point.y);
  await view(page).getByRole("textbox", { name: "Text of the shape" }).fill(text);
  await saved(page, () => view(page).getByRole("textbox", { name: "Text of the shape" }).press("Enter"));
  await view(page).getByRole("img", { name: new RegExp(` ${text}$`) }).waitFor();
}

const addRectangle = (page: Page, x: number, y: number, text: string) => addShape(page, "Rectangle (R)", x, y, text);

/** The middle of an element of the View, in the coordinates of the page. */
async function middleOf(locator: ReturnType<ReturnType<typeof view>["getByRole"]>) {
  const box = (await locator.boundingBox())!;
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
}

/** Drags a handle of the selected shape by (dx, dy) pixels. */
async function dragHandle(page: Page, name: string, dx: number, dy: number) {
  const from = await middleOf(view(page).getByRole("button", { name }));
  await drag(page, from, { x: from.x + dx, y: from.y + dy });
}

/** The open diagram as the Host wrote it, under the key `diagram:<id>`. */
async function storedDiagram(page: Page): Promise<{ shapes: Record<string, number & string>[] }> {
  for (let tries = 0; ; tries++) {
    try {
      const files = await readFolder(page, "modules/.tessello/data/@tessello/diagram");
      const entry = Object.values(files)
        .map((file) => JSON.parse(file))
        .find((file) => String(file.key).startsWith("diagram:"));
      return entry.value;
    } catch (error) {
      if (tries === 10) throw error;
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
  }
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

    await tool(page, "Select (S)");
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

  test("draws each built-in shape, resizes it with Shift, turns it, styles it and writes its text, and finds it all after a reload", async () => {
    const page = await host.newPage();
    await install(page);
    await newDiagram(page, "Shapes");
    // Each shape is resized by its bottom-right corner, by (30, 5) with Shift: the larger change wins, and the
    // top-left corner stays.
    const shapes = [
      { tool: "Rectangle (R)", name: "Rectangle", text: "R1", x: -240, y: -130, size: [150, 75] },
      { tool: "Ellipse (E)", name: "Ellipse", text: "E1", x: -60, y: -130, size: [150, 75] },
      { tool: "Database (D)", name: "Database", text: "D1", x: 110, y: -130, size: [90, 120] },
      { tool: "Circle (C)", name: "Circle", text: "C1", x: 260, y: -130, size: [90, 90] },
      { tool: "Actor (A)", name: "Actor", text: "A1", x: -240, y: 90, size: [66, 114.4] },
      { tool: "Post-it (P)", name: "Post-it", text: "P1", x: -60, y: 90, size: [150, 125] },
      { tool: "Free text (T)", name: "Free text", text: "T1", x: 130, y: 90, size: [150, 37.5] },
    ] as const;
    for (const shape of shapes) {
      await addShape(page, shape.tool, shape.x, shape.y, shape.text);
      await page.keyboard.down("Shift");
      await saved(page, () => dragHandle(page, "Resize from the bottom-right corner", 30, 5));
      await page.keyboard.up("Shift");
      await saved(page, () => view(page).getByRole("button", { name: "Rotate right by 10°" }).click());
      await saved(page, () => view(page).getByRole("button", { name: "Blue" }).click());
    }

    // The rotation handle of the selected free text, dragged to its right, turns it a quarter turn.
    const text = (await storedDiagram(page)).shapes.find((shape) => shape.text === "T1")!;
    const right = await at(page, text.x + 100, text.y);
    const handle = await middleOf(view(page).getByRole("button", { name: "Rotate the shape", exact: true }));
    await saved(page, () => drag(page, handle, right));
    // Its text has its own handle: dragged below the shape, the text points down, a quarter turn more than the shape.
    const below = await at(page, text.x, text.y + 100);
    const textHandle = await middleOf(view(page).getByRole("button", { name: "Rotate the text", exact: true }));
    await saved(page, () => drag(page, textHandle, below));

    // Ctrl+A selects everything, and the panel changes every selected shape.
    await canvas(page).click({ position: { x: 5, y: 5 } });
    await page.keyboard.press("Control+a");
    const size = view(page).getByRole("spinbutton", { name: "Font size" });
    await size.fill("20");
    await saved(page, () => size.press("Enter"));
    // Ctrl+click adds a shape to the selection, and takes it out again.
    await view(page).getByRole("img", { name: "Rectangle R1", exact: true }).click();
    await view(page).getByRole("img", { name: "Database D1", exact: true }).click({ modifiers: ["Control"] });
    await view(page).getByRole("button", { name: "Edit text" }).waitFor({ state: "detached" });
    await view(page).getByRole("img", { name: "Database D1", exact: true }).click({ modifiers: ["Control"] });
    await view(page).getByRole("button", { name: "Edit text" }).waitFor();
    // A click selects one shape alone, and its text is edited with the button of the panel.
    await view(page).getByRole("img", { name: "Ellipse E1", exact: true }).click();
    await view(page).getByRole("button", { name: "Edit text" }).click();
    await view(page).getByRole("textbox", { name: "Text of the shape" }).fill("Edge cache");
    await saved(page, () => view(page).getByRole("textbox", { name: "Text of the shape" }).press("Enter"));

    await page.reload();
    await openFromLauncher(page);
    await view(page).getByRole("img", { name: "Ellipse Edge cache" }).waitFor();
    const stored = (await storedDiagram(page)).shapes;
    for (const shape of shapes) {
      const name = shape.text === "E1" ? "Edge cache" : shape.text;
      const drawn = view(page).getByRole("img", { name: `${shape.name} ${name}`, exact: true });
      assert.match((await drawn.getAttribute("class"))!, /\bc-blue\b/);
      const found = stored.find((item) => item.text === name)!;
      assert.ok(Math.abs(found.w - shape.size[0]) <= 0.5 && Math.abs(found.h - shape.size[1]) <= 0.5, `${shape.name}: ${found.w} × ${found.h}`);
      assert.equal(found.rotation, shape.text === "T1" ? 90 : 10);
      assert.equal(found.fontSize, 20);
      assert.equal(found.textRotation, shape.text === "T1" ? 90 : 0);
      assert.match((await drawn.getAttribute("transform"))!, new RegExp(`rotate\\(${found.rotation}\\)`));
    }
  });

  test("an attached arrow follows the real outline of a shape that is resized or turned", async () => {
    const page = await host.newPage();
    await install(page);
    await newDiagram(page, "Outline");
    await addShape(page, "Ellipse (E)", -200, 0, "Front");
    await addShape(page, "Circle (C)", 200, 0, "Store");
    await tool(page, "Arrow (F)");
    await saved(page, async () => drag(page, await at(page, -200, 0), await at(page, 200, 0)));
    const arrow = "Arrow from Ellipse Front to Circle Store";
    // The ellipse is 120 × 60 and the circle 60 across: the line stops on their curves.
    let ends = await arrowEnds(page, arrow);
    near(ends.start, { x: -140, y: 0 });
    near(ends.tip, { x: 170, y: 0 });

    // Resized from its center by its bottom-right corner, by (30, 30), the circle is 120 across.
    await tool(page, "Select (S)");
    await view(page).getByRole("img", { name: "Circle Store", exact: true }).click();
    await view(page).getByRole("button", { name: "Resize: fixed corner" }).click();
    await saved(page, () => dragHandle(page, "Resize from the bottom-right corner", 30, 30));
    ends = await arrowEnds(page, arrow);
    near(ends.tip, { x: 140, y: 0 });

    // Turned a quarter turn, the ellipse is 60 wide on screen.
    await view(page).getByRole("img", { name: "Ellipse Front", exact: true }).click();
    for (let turn = 0; turn < 9; turn++) await saved(page, () => view(page).getByRole("button", { name: "Rotate right by 10°" }).click());
    ends = await arrowEnds(page, arrow);
    near(ends.start, { x: -170, y: 0 });
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
