import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { before, describe, test } from "node:test";
import type { Page } from "playwright";
import { dropFile, readFolder, showLauncher, useHost, writeFolder, zipSample } from "./browser.ts";

const host = useHost();

let diagram: Uint8Array;
/** A small opaque picture. */
let noise: Buffer;
before(async () => {
  diagram = await zipSample("diagram");
  const page = await host.newPage();
  noise = await noisePng(page, 200, 150);
  await page.close();
});

const view = (page: Page) => page.frameLocator("iframe[title='Diagram']");
const canvas = (page: Page) => view(page).getByRole("application", { name: "Canvas" });
const sidebar = (page: Page) => view(page).getByRole("navigation", { name: "Diagrams" });
const widget = (page: Page) => page.frameLocator("iframe[title='Diagram widget']");
const goHome = async (page: Page) => (await showLauncher(page)).getByRole("button", { name: "Tessello" }).click();
const openFromLauncher = async (page: Page) => (await showLauncher(page)).getByRole("button", { name: "Diagram" }).click();

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

const DATA = "modules/.tessello/data/@tessello/diagram";

type StoredEnd = { shapeId?: string; port?: string | null; x?: number; y?: number };
type StoredDiagram = {
  shapes: Record<string, number & string>[];
  arrows: {
    id: string;
    from: StoredEnd;
    to: StoredEnd;
    route: string;
    waypoints: { x: number; y: number }[];
    heads: string;
    dashed: boolean;
    width: number;
    label: string;
    labelAt: number;
    labelOffset: number;
  }[];
};

/** The file of the open diagram as the Host wrote it, under the key `diagram:<id>`. */
async function diagramFile(page: Page): Promise<{ name: string; file: { key: string; value: StoredDiagram } }> {
  for (let tries = 0; ; tries++) {
    try {
      const [name, file] = Object.entries(await readFolder(page, DATA))
        .map(([name, file]) => [name, JSON.parse(file)] as const)
        .find(([, file]) => String(file.key).startsWith("diagram:"))!;
      return { name, file };
    } catch (error) {
      if (tries === 10) throw error;
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
  }
}

/** A diagram as the Host wrote it, under the key `diagram:<id>`. */
async function storedFile(page: Page, id: string): Promise<StoredDiagram> {
  const files = Object.values(await readFolder(page, DATA)).map((file) => JSON.parse(file) as { key: string; value: StoredDiagram });
  return files.find((file) => file.key === `diagram:${id}`)!.value;
}

/** Waits until the first shape of a diagram, as the Host wrote it, has a link. */
async function linkStored(page: Page, id: string, link: unknown) {
  for (let tries = 0; tries < 50; tries++) {
    try {
      if (JSON.stringify((await storedFile(page, id)).shapes[0].link) === JSON.stringify(link)) return;
    } catch {
      // A file read while the Host writes it: read again.
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  assert.fail("the Host did not write the link");
}

type StoredDefaults = { arrows: { dashed: boolean }; shapes: Record<string, { color: string }> };

/** Waits until the creation defaults the Host wrote, under the key `defaults`, pass `written`. */
async function storedDefaults(page: Page, written: (defaults: StoredDefaults | undefined) => boolean) {
  for (let tries = 0; tries < 50; tries++) {
    try {
      const file = (await readFolder(page, DATA))["defaults.json"];
      if (written(file ? JSON.parse(file).value : undefined)) return;
    } catch {
      // A file read while the Host writes it: read again.
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  assert.fail("the Host did not write the defaults");
}

/** The open diagram as the Host wrote it. */
const storedDiagram = async (page: Page) => (await diagramFile(page)).file.value;

/** Changes the stored diagram as a User would by hand, to set up a test quickly, then reloads the Host and opens the View again. */
async function editStored(page: Page, change: (diagram: StoredDiagram) => void) {
  const { name, file } = await diagramFile(page);
  change(file.value);
  await writeFolder(page, DATA, { [name]: file });
  await page.reload();
  await openFromLauncher(page);
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
  const [x1, y1] = (await arrow.locator(".dg-arrow-line").getAttribute("d"))!.slice(1).split(/[ ,LC]/).map(Number);
  const start = { x: x1, y: y1 };
  const [x, y] = (await arrow.locator(".dg-arrow-head").getAttribute("points"))!.split(" ")[0].split(",").map(Number);
  return { start, tip: { x, y } };
}

/** Within a pixel: a point of the page and a point of the drawing may differ by half a pixel. */
function near(actual: { x: number; y: number }, expected: { x: number; y: number }) {
  assert.ok(Math.abs(actual.x - expected.x) <= 1 && Math.abs(actual.y - expected.y) <= 1, `${JSON.stringify(actual)} is not near ${JSON.stringify(expected)}`);
}

/** A point of the drawn line of an arrow, at a part of its length, in the coordinates of the page. */
async function pointOn(page: Page, name: string, part: number) {
  const point = await view(page)
    .getByRole("img", { name, exact: true })
    .locator(".dg-arrow-line")
    .evaluate((path: SVGPathElement, part) => {
      const { x, y } = path.getPointAtLength(path.getTotalLength() * part);
      return { x, y };
    }, part);
  return at(page, point.x, point.y);
}

async function isSelected(page: Page, name: string) {
  return /\bselected\b/.test((await view(page).getByRole("img", { name, exact: true }).getAttribute("class"))!);
}

/** Clicks the drawing at a point given in its coordinates. */
async function clickAt(page: Page, x: number, y: number) {
  const point = await at(page, x, y);
  await page.mouse.click(point.x, point.y);
}

/** Hides or shows the page of the Host, as when the User switches to another tab and back. */
async function setPageVisible(page: Page, visible: boolean) {
  await page.evaluate((visible) => {
    Object.defineProperty(document, "visibilityState", { configurable: true, get: () => (visible ? "visible" : "hidden") });
    document.dispatchEvent(new Event("visibilitychange"));
  }, visible);
}

/** Waits until the View shows the diagram titled `title`. */
async function opened(page: Page, title: string) {
  const field = view(page).getByRole("textbox", { name: "Diagram title" });
  for (let tries = 0; tries < 50; tries++) {
    if ((await field.inputValue()) === title) return;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  assert.fail(`the View did not open “${title}”`);
}

/** The file the View hands the User when `start` runs: its name and its bytes. */
async function downloaded(page: Page, start: () => Promise<void>): Promise<{ name: string; bytes: Buffer }> {
  const [file] = await Promise.all([page.waitForEvent("download", { timeout: 10000 }), start()]);
  return { name: file.suggestedFilename(), bytes: await readFile((await file.path())!) };
}

/** The size of a PNG, from its header, and the opacity of its top-left pixel, as the browser decodes it. */
async function pngOf(page: Page, bytes: Buffer): Promise<{ w: number; h: number; cornerAlpha: number }> {
  assert.deepEqual([...bytes.subarray(0, 8)], [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], "the file is a PNG");
  const cornerAlpha = await page.evaluate(async (base64) => {
    const bitmap = await createImageBitmap(await (await fetch(`data:image/png;base64,${base64}`)).blob());
    const context = new OffscreenCanvas(1, 1).getContext("2d")!;
    context.drawImage(bitmap, 0, 0);
    return context.getImageData(0, 0, 1, 1).data[3];
  }, bytes.toString("base64"));
  return { w: bytes.readUInt32BE(16), h: bytes.readUInt32BE(20), cornerAlpha };
}

async function newDiagram(page: Page, title: string) {
  await saved(page, () => sidebar(page).getByRole("button", { name: "+ New" }).click());
  const field = view(page).getByRole("textbox", { name: "Diagram title" });
  await field.fill(title);
  await saved(page, () => field.press("Enter"));
  await sidebar(page).getByRole("button", { name: title, exact: true }).waitFor();
}

/** A PNG made by the browser: opaque noise, which compresses badly, so that its size grows with its pixels. */
async function noisePng(page: Page, w: number, h: number): Promise<Buffer> {
  const base64 = await page.evaluate(
    async ([w, h]) => {
      const canvas = new OffscreenCanvas(w, h);
      const context = canvas.getContext("2d")!;
      const pixels = context.createImageData(w, h);
      for (let index = 0; index < pixels.data.length; index++) pixels.data[index] = index % 4 === 3 ? 255 : Math.floor(Math.random() * 256);
      context.putImageData(pixels, 0, 0);
      const bytes = new Uint8Array(await (await canvas.convertToBlob({ type: "image/png" })).arrayBuffer());
      let binary = "";
      for (const byte of bytes) binary += String.fromCharCode(byte);
      return btoa(binary);
    },
    [w, h],
  );
  return Buffer.from(base64, "base64");
}

/** The images the Host stored, by key. */
async function storedImages(page: Page): Promise<Record<string, string>> {
  const files = Object.values(await readFolder(page, DATA)).map((file) => JSON.parse(file) as { key: string; value: string });
  return Object.fromEntries(files.filter((file) => file.key.startsWith("image:")).map((file) => [file.key, file.value]));
}

/** Waits until the images the Host stored pass `written`. */
async function imagesStored(page: Page, written: (keys: string[]) => boolean) {
  for (let tries = 0; tries < 50; tries++) {
    try {
      if (written(Object.keys(await storedImages(page)))) return;
    } catch {
      // A file read while the Host writes it: read again.
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  assert.fail("the Host did not store the images");
}

/** Chooses a picture with the Image tool, by a double-click on a point of the drawing. */
async function chooseImage(page: Page, x: number, y: number, name: string, buffer: Buffer) {
  await view(page).getByRole("button", { name: "Image (I)" }).click();
  const chooser = page.waitForEvent("filechooser");
  const point = await at(page, x, y);
  await page.mouse.dblclick(point.x, point.y);
  await (await chooser).setFiles({ name, mimeType: "image/png", buffer });
}

/** The `.diagrams.json` of the fixture of living-documentation (tests/fixtures/with-diagrams/testdocs). */
const SAMPLE_DIAGRAMS = [
  {
    id: "diag-1",
    title: "Sample Diagram",
    nodes: [
      { id: "n1", label: "Start", shapeType: "box", colorKey: "c-blue", x: 0, y: 0 },
      { id: "n2", label: "End", shapeType: "ellipse", colorKey: "c-green", x: 200, y: 0 },
    ],
    edges: [{ id: "e1", from: "n1", to: "n2" }],
    edgesStraight: false,
    gridEnabled: true,
    alignGuides: true,
  },
];
/** A second diagram: a custom shape of the library, and an image that is not provided. */
const SECOND_DIAGRAMS = [
  {
    id: "diag-2",
    title: "Servers",
    nodes: [
      { id: "s1", label: "Prod", shapeType: "custom-shape", customShapeId: "srv", x: 0, y: 0 },
      { id: "p1", label: "Photo", shapeType: "image", imageSrc: "/images/missing.png", x: 200, y: 0 },
    ],
    edges: [],
  },
];
const SAMPLE_LIBRARIES = { libraries: [{ id: "lib-1", name: "Infra", shapes: [{ id: "srv", name: "Server", imageSrc: "/images/icon.png", width: 80, height: 40 }] }] };
const json = (name: string, value: unknown) => ({ name, mimeType: "application/json", buffer: Buffer.from(JSON.stringify(value)) });

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

  test("three arrows A→B, A→B and B→A are all visible with their labels, and each is selected by a click on its own line", async () => {
    const page = await host.newPage();
    await install(page);
    await newDiagram(page, "Parallel");
    await addRectangle(page, -200, 0, "A");
    await addRectangle(page, 200, 0, "B");
    await tool(page, "Arrow (F)");
    for (const [from, to] of [[-200, 200], [-200, 200], [200, -200]]) await saved(page, async () => drag(page, await at(page, from, 0), await at(page, to, 0)));
    await editStored(page, (diagram) => diagram.arrows.forEach((arrow, index) => (arrow.label = ["one", "two", "back"][index])));

    const names = ["Arrow “one” from Rectangle A to Rectangle B", "Arrow “two” from Rectangle A to Rectangle B", "Arrow “back” from Rectangle B to Rectangle A"];
    await view(page).getByRole("img", { name: names[0], exact: true }).waitFor();
    // Each label shows, apart from the others.
    const labels = await Promise.all(["one", "two", "back"].map((label) => view(page).getByText(label, { exact: true }).boundingBox()));
    for (const [index, box] of labels.entries()) {
      for (const other of labels.slice(index + 1)) assert.ok(box!.y + box!.height <= other!.y || other!.y + other!.height <= box!.y, "two labels overlap");
    }
    for (const name of names) {
      const middle = await pointOn(page, name, 0.5);
      await page.mouse.click(middle.x, middle.y);
      for (const other of names) assert.equal(await isSelected(page, other), other === name, `after a click on ${name}`);
    }
  });

  test("a curved arrow between the north ports of two shapes is selected by a click anywhere on its visible line", async () => {
    const page = await host.newPage();
    await install(page);
    await newDiagram(page, "Curve");
    await addRectangle(page, -200, 0, "A");
    await addRectangle(page, 200, 200, "B");
    // The rectangles are 120 × 60: their north ports are the middles of their top sides.
    await tool(page, "Arrow (F)");
    await saved(page, async () => drag(page, await at(page, -200, -30), await at(page, 200, 170)));
    const [arrow] = (await storedDiagram(page)).arrows;
    assert.deepEqual([arrow.from, arrow.to], [{ shapeId: arrow.from.shapeId, port: "N" }, { shapeId: arrow.to.shapeId, port: "N" }]);
    // The new arrow is selected: its panel sets its route.
    await saved(page, () => view(page).getByRole("button", { name: "Curved" }).click());
    assert.equal((await storedDiagram(page)).arrows[0].route, "curved");

    const name = "Arrow from Rectangle A at N to Rectangle B at N";
    await tool(page, "Select (S)");
    for (const part of [0.1, 0.5, 0.9]) {
      await clickAt(page, 0, 300);
      assert.equal(await isSelected(page, name), false);
      const point = await pointOn(page, name, part);
      await page.mouse.click(point.x, point.y);
      assert.equal(await isSelected(page, name), true, `a click at ${part} of the line`);
    }
  });

  test("an elbow made by a drag is found after a reload, keeps its waypoints when its shape moves, and is selected by a click on its last segment", async () => {
    const page = await host.newPage();
    await install(page);
    await newDiagram(page, "Corners");
    await addRectangle(page, -200, 0, "A");
    await addRectangle(page, 200, 200, "B");
    await tool(page, "Arrow (F)");
    await saved(page, async () => drag(page, await at(page, -200, 0), await at(page, 200, 200)));
    const name = "Arrow from Rectangle A to Rectangle B";
    await tool(page, "Select (S)");
    const middle = await pointOn(page, name, 0.5);
    await page.mouse.click(middle.x, middle.y);
    await saved(page, () => view(page).getByRole("button", { name: "Elbow" }).click());
    // Out of the right side of A, down halfway, and into the left side of B: the middle segment is at x = 0.
    near((await arrowEnds(page, name)).start, { x: -140, y: 0 });
    near((await arrowEnds(page, name)).tip, { x: 140, y: 200 });

    // Dragging the middle segment 60 to the right makes its two corners the waypoints of the arrow.
    await saved(page, async () => drag(page, await at(page, 0, 100), await at(page, 60, 100)));
    const corners = (await storedDiagram(page)).arrows[0].waypoints;
    assert.equal(corners.length, 2);
    near(corners[0], { x: 60, y: 0 });
    near(corners[1], { x: 60, y: 200 });

    await page.reload();
    await openFromLauncher(page);
    await view(page).getByRole("img", { name, exact: true }).waitFor();
    assert.deepEqual((await storedDiagram(page)).arrows[0].waypoints, corners);
    near((await arrowEnds(page, name)).start, { x: -140, y: 0 });

    // B moves down: the waypoints stay, and the last segments follow it, down from the second corner into its top side.
    await saved(page, async () => drag(page, await at(page, 200, 200), await at(page, 200, 300)));
    assert.deepEqual((await storedDiagram(page)).arrows[0].waypoints, corners);
    near((await arrowEnds(page, name)).tip, { x: 200, y: 270 });

    await clickAt(page, 0, -200);
    assert.equal(await isSelected(page, name), false);
    await clickAt(page, 200, 225);
    assert.equal(await isSelected(page, name), true);
  });

  test("a dashed arrow with heads at both ends, 3 wide, with its label dragged along it and aside, is found after a reload", async () => {
    const page = await host.newPage();
    await install(page);
    await newDiagram(page, "Styles");
    await addRectangle(page, -200, 0, "A");
    await addRectangle(page, 200, 0, "B");
    await tool(page, "Arrow (F)");
    await saved(page, async () => drag(page, await at(page, -200, 0), await at(page, 200, 0)));
    await tool(page, "Select (S)");
    await clickAt(page, 0, 0);
    const panel = view(page).getByRole("complementary", { name: "Arrow" });
    await saved(page, () => panel.getByRole("button", { name: "Dashed" }).click());
    await saved(page, () => panel.getByRole("button", { name: "Arrowheads at both ends" }).click());
    await panel.getByRole("spinbutton", { name: "Line width" }).fill("3");
    await saved(page, () => panel.getByRole("spinbutton", { name: "Line width" }).press("Enter"));

    // A double-click on the line edits its label, which shows in the middle of the line.
    const point = await at(page, 0, 0);
    await page.mouse.dblclick(point.x, point.y);
    await view(page).getByRole("textbox", { name: "Label of the arrow" }).fill("calls");
    await saved(page, () => view(page).getByRole("textbox", { name: "Label of the arrow" }).press("Enter"));
    const name = "Arrow “calls” from Rectangle A to Rectangle B";
    const label = view(page).getByRole("img", { name, exact: true }).getByRole("button", { name: /^Label:/ });
    near(await middleOf(label), await at(page, 0, 0));

    // The line goes from (−140, 0) to (140, 0): 70 to the right is three quarters of the way, and 30 up is 30 aside. The
    // label is taken by its left part, beside the handle of the segment, which is in the middle of the line.
    const box = (await label.boundingBox())!;
    const from = { x: box.x + 4, y: box.y + box.height / 2 };
    await saved(page, () => drag(page, from, { x: from.x + 70, y: from.y - 30 }));
    const [arrow] = (await storedDiagram(page)).arrows;
    assert.deepEqual({ dashed: arrow.dashed, heads: arrow.heads, width: arrow.width, label: arrow.label }, { dashed: true, heads: "both", width: 3, label: "calls" });
    assert.ok(Math.abs(arrow.labelAt - 0.75) < 0.01 && Math.abs(arrow.labelOffset + 30) < 1, JSON.stringify(arrow));

    await page.reload();
    await openFromLauncher(page);
    const drawn = view(page).getByRole("img", { name, exact: true });
    await drawn.waitFor();
    assert.equal(await drawn.locator(".dg-arrow-head").count(), 2);
    assert.equal(await drawn.locator(".dg-arrow-line").getAttribute("stroke-width"), "3");
    assert.equal(await drawn.locator(".dg-arrow-line").getAttribute("stroke-dasharray"), "12 9");
    near(await middleOf(label), await at(page, 70, -30));

    // A double-click on the label, away from the line, edits it.
    const aside = await middleOf(label);
    await page.mouse.dblclick(aside.x, aside.y);
    assert.equal(await view(page).getByRole("textbox", { name: "Label of the arrow" }).inputValue(), "calls");
    await view(page).getByRole("textbox", { name: "Label of the arrow" }).press("Escape");

    // A click on the label selects the arrow, and "Reset label" brings the label back to the middle of the line.
    await page.mouse.click((await middleOf(label)).x, (await middleOf(label)).y);
    assert.equal(await isSelected(page, name), true);
    await saved(page, () => panel.getByRole("button", { name: "Reset label" }).click());
    near(await middleOf(label), await at(page, 0, 0));

    // The handle on the right edge of the label widens it on both sides, around its center.
    const automatic = (await label.boundingBox())!.width;
    await saved(page, () => dragHandle(page, "Drag to change the width of the label", 30, 0));
    assert.ok(Math.abs((await label.boundingBox())!.width - automatic - 60) < 2);
    near(await middleOf(label), await at(page, 0, 0));
  });

  test("a drag on the empty canvas draws a free arrow, which moves by its body and is taken by a selection rectangle", async () => {
    const page = await host.newPage();
    await install(page);
    await newDiagram(page, "Free");
    await tool(page, "Arrow (F)");
    await saved(page, async () => drag(page, await at(page, -150, -100), await at(page, 150, -100)));
    await view(page).getByRole("img", { name: "Arrow from (-150, -100) to (150, -100)" }).waitFor();
    // A click without a drag draws nothing.
    await clickAt(page, 0, 100);
    // With Shift, the arrow turns by steps of 45°: drawn a little below the level, it stays level.
    await page.keyboard.down("Shift");
    await saved(page, async () => drag(page, await at(page, -150, 100), await at(page, 100, 130)));
    await page.keyboard.up("Shift");
    const arrows = (await storedDiagram(page)).arrows;
    assert.equal(arrows.length, 2);
    assert.ok(Math.abs(arrows[1].to.y! - arrows[1].from.y!) < 1e-6, JSON.stringify(arrows[1]));

    await tool(page, "Select (S)");
    await saved(page, async () => drag(page, await at(page, 0, -100), await at(page, 0, -60)));
    await view(page).getByRole("img", { name: "Arrow from (-150, -60) to (150, -60)" }).waitFor();

    await clickAt(page, 0, 250);
    await drag(page, await at(page, -200, -90), await at(page, 200, -30));
    assert.equal(await isSelected(page, "Arrow from (-150, -60) to (150, -60)"), true);
    // The arrow drawn with Shift is outside the rectangle.
    assert.doesNotMatch((await view(page).getByRole("img", { name: /^Arrow from \(-150, 100\)/ }).getAttribute("class"))!, /\bselected\b/);
  });

  test("an end attached to the north-east port follows the shape turned by 90°, until its ends are detached", async () => {
    const page = await host.newPage();
    await install(page);
    await newDiagram(page, "Ports");
    await addRectangle(page, 200, 0, "B");
    // While the arrow is drawn, the shape shows its ports; the north-east one is the top-right corner, at (260, −30).
    await tool(page, "Arrow (F)");
    await saved(page, async () => drag(page, await at(page, -100, 0), await at(page, 260, -30)));
    const name = "Arrow from (-100, 0) to Rectangle B at NE";
    near((await arrowEnds(page, name)).tip, { x: 260, y: -30 });

    await tool(page, "Select (S)");
    await view(page).getByRole("img", { name: "Rectangle B", exact: true }).click();
    for (let turn = 0; turn < 9; turn++) await saved(page, () => view(page).getByRole("button", { name: "Rotate right by 10°" }).click());
    // Turned a quarter turn clockwise, the top-right corner of B is at its bottom-right, at (230, 60).
    near((await arrowEnds(page, name)).tip, { x: 230, y: 60 });

    const point = await pointOn(page, name, 0.5);
    await page.mouse.click(point.x, point.y);
    await saved(page, () => view(page).getByRole("button", { name: "Detach ends" }).click());
    assert.deepEqual((await storedDiagram(page)).arrows[0].to.port, null);
    await view(page).getByRole("img", { name: "Arrow from (-100, 0) to Rectangle B", exact: true }).waitFor();
  });

  test("deleting a shape frees the ends of its arrows, where they were; Ctrl+Delete deletes its arrows too", async () => {
    const page = await host.newPage();
    await install(page);
    await newDiagram(page, "Delete");
    await addRectangle(page, -200, 0, "A");
    await addRectangle(page, 200, 0, "B");
    await tool(page, "Arrow (F)");
    await saved(page, async () => drag(page, await at(page, -200, 0), await at(page, 200, 0)));

    await tool(page, "Select (S)");
    await view(page).getByRole("img", { name: "Rectangle B", exact: true }).click();
    await saved(page, () => page.keyboard.press("Delete"));
    // The end stays where it was drawn, on the left side of B; a point of the page may be half a pixel off the drawing.
    await view(page).getByRole("img", { name: /^Arrow from Rectangle A to \(140, -?[01]\)$/ }).waitFor();
    near((await storedDiagram(page)).arrows[0].to as { x: number; y: number }, { x: 140, y: 0 });

    await view(page).getByRole("img", { name: "Rectangle A", exact: true }).click();
    await saved(page, () => page.keyboard.press("Control+Delete"));
    assert.equal((await storedDiagram(page)).arrows.length, 0);
    assert.equal(await view(page).getByRole("img", { name: /^Arrow/ }).count(), 0);
  });

  test("a group is selected by a click on a member, moves as one block, and Alt+click selects a member alone", async () => {
    const page = await host.newPage();
    await install(page);
    await newDiagram(page, "Groups");
    await addRectangle(page, -100, 0, "A");
    await addRectangle(page, 100, 0, "B");
    await tool(page, "Select (S)");
    await view(page).getByRole("img", { name: "Rectangle A", exact: true }).click();
    await view(page).getByRole("img", { name: "Rectangle B", exact: true }).click({ modifiers: ["ControlOrMeta"] });
    await saved(page, () => view(page).getByRole("button", { name: "Group selection" }).click());

    await clickAt(page, 0, 200);
    await view(page).getByRole("img", { name: "Rectangle A", exact: true }).click();
    assert.ok(await isSelected(page, "Rectangle B"));
    assert.equal(await view(page).locator(".dg-group-outline").count(), 1);

    // The grid takes the center of A to (−100, 100).
    await saved(page, async () => drag(page, await at(page, -100, 0), await at(page, -97, 103)));
    const [a, b] = (await storedDiagram(page)).shapes;
    assert.deepEqual([a.x, a.y, b.x, b.y], [-100, 100, 100, 100]);
    assert.ok(a.groupId && a.groupId === b.groupId);

    await view(page).getByRole("img", { name: "Rectangle B", exact: true }).click({ modifiers: ["Alt"] });
    assert.ok(await isSelected(page, "Rectangle B"));
    assert.ok(!(await isSelected(page, "Rectangle A")));

    await saved(page, () => view(page).getByRole("button", { name: "Ungroup" }).click());
    assert.deepEqual((await storedDiagram(page)).shapes.map((shape) => shape.groupId), [null, null]);
  });

  test("a locked shape is selected with a padlock, but neither moved, deleted nor taken by Ctrl+A, until it is unlocked", async () => {
    const page = await host.newPage();
    await install(page);
    await newDiagram(page, "Locks");
    await addRectangle(page, 0, 0, "A");
    await tool(page, "Select (S)");
    await view(page).getByRole("img", { name: "Rectangle A", exact: true }).click();
    await saved(page, () => view(page).getByRole("button", { name: "Lock", exact: true }).click());
    const panel = view(page).getByRole("complementary", { name: "Locked" });
    await panel.getByRole("button", { name: "Unlock" }).waitFor();
    assert.equal(await panel.getByRole("button").count(), 1);
    await view(page).getByRole("img", { name: "Locked" }).waitFor();

    await page.keyboard.press("Delete");
    await drag(page, await at(page, 0, 0), await at(page, 200, 100));
    await clickAt(page, 0, 200);
    await page.keyboard.press("ControlOrMeta+a");
    assert.ok(!(await isSelected(page, "Rectangle A")));
    // A point of the page may be half a pixel off the drawing.
    const [shape] = (await storedDiagram(page)).shapes;
    near({ x: shape.x, y: shape.y }, { x: 0, y: 0 });
    assert.equal(shape.locked, true);

    await view(page).getByRole("img", { name: "Rectangle A", exact: true }).click();
    await saved(page, () => panel.getByRole("button", { name: "Unlock" }).click());
    await saved(page, () => page.keyboard.press("Delete"));
    assert.equal((await storedDiagram(page)).shapes.length, 0);
  });

  test("copies a group joined by an arrow and pastes it twice, 40 further each time, as new groups", async () => {
    const page = await host.newPage();
    await install(page);
    await newDiagram(page, "Copies");
    await addRectangle(page, -100, 0, "A");
    await addRectangle(page, 100, 0, "B");
    await tool(page, "Arrow (F)");
    await saved(page, async () => drag(page, await at(page, -100, 0), await at(page, 100, 0)));
    await tool(page, "Select (S)");
    await view(page).getByRole("img", { name: "Rectangle A", exact: true }).click();
    await view(page).getByRole("img", { name: "Rectangle B", exact: true }).click({ modifiers: ["ControlOrMeta"] });
    await saved(page, () => view(page).getByRole("button", { name: "Group selection" }).click());

    await page.keyboard.press("ControlOrMeta+c");
    await saved(page, () => page.keyboard.press("ControlOrMeta+v"));
    await saved(page, () => page.keyboard.press("ControlOrMeta+v"));
    const { shapes, arrows } = await storedDiagram(page);
    // A point of the page may be half a pixel off the drawing: each copy lands exactly 40 further than the last.
    assert.deepEqual(shapes.map((shape) => shape.text), ["A", "B", "A", "B", "A", "B"]);
    near({ x: shapes[0].x, y: shapes[0].y }, { x: -100, y: 0 });
    for (let index = 2; index < 6; index++) assert.deepEqual([shapes[index].x, shapes[index].y], [shapes[index - 2].x + 40, shapes[index - 2].y + 40]);
    const groups = shapes.map((shape) => shape.groupId);
    assert.equal(new Set(groups).size, 3);
    assert.deepEqual([groups[2] === groups[3], groups[4] === groups[5]], [true, true]);
    assert.equal(arrows.length, 3);
    assert.deepEqual([arrows[1].from.shapeId, arrows[1].to.shapeId], [shapes[2].id, shapes[3].id]);
    // The last paste is selected.
    assert.equal(await view(page).locator(".dg-shape.selected").count(), 2);
  });

  test("copies the style of a shape onto another, with its size when asked", async () => {
    const page = await host.newPage();
    await install(page);
    await newDiagram(page, "Styles");
    await addRectangle(page, -100, 0, "A");
    await saved(page, () => view(page).getByRole("button", { name: "Blue" }).click());
    await addShape(page, "Ellipse (E)", 100, 0, "B");
    await tool(page, "Select (S)");

    await view(page).getByRole("img", { name: "Rectangle A", exact: true }).click();
    await dragHandle(page, "Resize from the bottom-right corner", 40, 20);
    await view(page).getByRole("button", { name: "Copy style" }).click();
    await view(page).getByRole("img", { name: "Ellipse B", exact: true }).click();
    await saved(page, () => view(page).getByRole("button", { name: "Paste style" }).click());
    let b = (await storedDiagram(page)).shapes[1];
    assert.deepEqual([b.color, b.w, b.h], ["c-blue", 120, 60]);

    await view(page).getByRole("img", { name: "Rectangle A", exact: true }).click();
    await view(page).getByRole("checkbox", { name: "with size" }).check();
    // The shortcuts are those of the canvas, not of the checkbox.
    await view(page).getByRole("img", { name: "Rectangle A", exact: true }).click();
    await page.keyboard.press("ControlOrMeta+Alt+c");
    await view(page).getByRole("img", { name: "Ellipse B", exact: true }).click();
    await saved(page, () => page.keyboard.press("ControlOrMeta+Alt+v"));
    b = (await storedDiagram(page)).shapes[1];
    assert.deepEqual([b.color, b.w, b.h], ["c-blue", 160, 80]);
  });

  test("the grid and the guides are saved with the diagram, and the zoom fits the drawing", async () => {
    const page = await host.newPage();
    await install(page);
    await newDiagram(page, "View");
    await addRectangle(page, 0, 0, "A");
    await tool(page, "Select (S)");
    assert.equal(await view(page).getByRole("button", { name: "Grid (G)" }).getAttribute("aria-pressed"), "true");
    await clickAt(page, 0, 200);
    await saved(page, () => page.keyboard.press("g"));
    await saved(page, () => view(page).getByRole("button", { name: "Guides" }).click());
    const { grid, guides } = (await storedDiagram(page)) as unknown as { grid: boolean; guides: boolean };
    assert.deepEqual([grid, guides], [false, false]);

    const zoom = view(page).getByRole("group", { name: "Zoom" });
    await zoom.getByRole("button", { name: "Zoom in" }).click();
    await zoom.getByText("125%").waitFor();
    await zoom.getByRole("button", { name: "Zoom out" }).click();
    await zoom.getByRole("button", { name: "Zoom out" }).click();
    await zoom.getByText("80%").waitFor();
    // A single rectangle is shown at its real size, in the middle of the canvas.
    await zoom.getByRole("button", { name: "Fit" }).click();
    await zoom.getByText("100%").waitFor();
  });

  test("undoes a move, a waypoint and a rename one by one, redoes them all, and finds them after a reload", async () => {
    const page = await host.newPage();
    await install(page);
    await newDiagram(page, "Plan");
    await addRectangle(page, -200, 0, "A");
    await addRectangle(page, 200, 0, "B");
    await tool(page, "Arrow (F)");
    await saved(page, async () => drag(page, await at(page, -200, 0), await at(page, 200, 0)));
    // The history starts over when the diagram is opened: what was drawn before is not undone.
    await page.reload();
    await openFromLauncher(page);
    const name = "Arrow from Rectangle A to Rectangle B";
    await view(page).getByRole("img", { name, exact: true }).waitFor();

    const state = async () => {
      const diagram = await storedDiagram(page);
      const a = diagram.shapes.find((shape) => shape.text === "A")!;
      return { a: [a.x, a.y], waypoints: diagram.arrows[0].waypoints.length, title: (await storedIndex(page))[0].title };
    };
    const undone = await state();

    await tool(page, "Select (S)");
    await saved(page, async () => drag(page, await at(page, -200, 0), await at(page, -200, 100)));
    const middle = await pointOn(page, name, 0.5);
    await page.mouse.click(middle.x, middle.y);
    await saved(page, () => dragHandle(page, "Drag to add a waypoint", 0, -80));
    const field = view(page).getByRole("textbox", { name: "Diagram title" });
    await field.fill("Renamed");
    await saved(page, () => field.press("Enter"));
    await clickAt(page, 0, 300);

    const done = { a: [-200, 100], waypoints: 1, title: "Renamed" };
    assert.deepEqual(await state(), done);

    await saved(page, () => page.keyboard.press("ControlOrMeta+z"));
    assert.deepEqual(await state(), { ...done, title: undone.title });
    await saved(page, () => page.keyboard.press("ControlOrMeta+z"));
    assert.deepEqual(await state(), { ...done, waypoints: undone.waypoints, title: undone.title });
    await saved(page, () => page.keyboard.press("ControlOrMeta+z"));
    assert.deepEqual(await state(), undone);
    assert.equal(await field.inputValue(), "Plan");
    // There is nothing more to undo.
    await page.keyboard.press("ControlOrMeta+z");
    assert.deepEqual(await state(), undone);

    for (let step = 0; step < 3; step++) await saved(page, () => page.keyboard.press("ControlOrMeta+Shift+z"));
    assert.deepEqual(await state(), done);

    // Shown again after the page was hidden, the View reads the diagram again: unchanged, it keeps its history.
    await setPageVisible(page, false);
    await setPageVisible(page, true);
    await clickAt(page, 0, 300);
    await saved(page, () => page.keyboard.press("ControlOrMeta+z"));
    assert.deepEqual(await state(), { ...done, title: undone.title });
    await saved(page, () => page.keyboard.press("ControlOrMeta+Shift+z"));

    await page.reload();
    await openFromLauncher(page);
    await view(page).getByRole("img", { name, exact: true }).waitFor();
    assert.deepEqual(await state(), done);
    assert.equal(await field.inputValue(), "Renamed");
  });

  test("Ctrl+Z in the title field undoes the typing, not the diagram", async () => {
    const page = await host.newPage();
    await install(page);
    await newDiagram(page, "Plan");
    await addRectangle(page, 0, 0, "A");
    const field = view(page).getByRole("textbox", { name: "Diagram title" });
    await field.click();
    await field.pressSequentially("X");
    await field.press("ControlOrMeta+z");
    assert.equal(await field.inputValue(), "Plan");
    await view(page).getByRole("img", { name: "Rectangle A", exact: true }).waitFor();
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

  test("inserts a chosen image with its caption as a group, finds it after a reload, and removes it from the storage once deleted for good", async () => {
    const page = await host.newPage();
    await install(page);
    await newDiagram(page, "Pictures");
    const gauge = view(page).getByRole("navigation", { name: "Diagrams" }).getByText(/^Storage: \d+\.\d MB \/ 5 MB$/);
    await gauge.waitFor();
    const usageBefore = Number(await view(page).getByRole("meter").getAttribute("value"));

    await saved(page, () => chooseImage(page, 0, 0, "logo.final.png", noise));
    const image = view(page).getByRole("img", { name: "Image", exact: true });
    await image.waitFor();
    await view(page).getByRole("img", { name: "Free text logo.final", exact: true }).waitFor();
    const [key] = Object.keys(await storedImages(page));
    assert.match(key, /^image:[0-9a-f]{64}$/);
    // Opaque, it is stored in WebP; the image and its caption are one group.
    assert.match((await storedImages(page))[key], /^data:image\/webp;base64,/);
    const shapes = (await storedDiagram(page)).shapes;
    const picture = shapes.find((shape) => shape.type === "image")!;
    assert.equal(picture.imageKey, key);
    assert.ok(picture.groupId);
    assert.equal(shapes.find((shape) => shape.type === "text")!.groupId, picture.groupId);
    const usage = async () => Number(await view(page).getByRole("meter").getAttribute("value"));
    for (let tries = 0; tries < 50 && (await usage()) <= usageBefore; tries++) await new Promise((resolve) => setTimeout(resolve, 100));
    assert.ok((await usage()) > usageBefore, "the gauge counts the image");

    // The same picture again is not stored twice.
    await saved(page, () => chooseImage(page, 0, -220, "copy.png", noise));
    await view(page).getByRole("img", { name: "Free text copy", exact: true }).waitFor();
    assert.equal(Object.keys(await storedImages(page)).length, 1);

    await page.reload();
    await openFromLauncher(page);
    await view(page).getByRole("img", { name: "Free text copy", exact: true }).waitFor();
    assert.match((await image.first().locator("image").getAttribute("href"))!, /^data:image\/webp;base64,/);

    // Deleting one of the two leaves the picture. Deleting the other keeps it while an undo can bring it back.
    await tool(page, "Select (S)");
    await saved(page, async () => {
      await image.first().click();
      await page.keyboard.press("Delete");
    });
    assert.equal(await image.count(), 1);
    await saved(page, async () => {
      await image.click();
      await page.keyboard.press("Delete");
    });
    assert.equal(await view(page).getByRole("img", { name: /^Free text/ }).count(), 0);
    await saved(page, () => page.keyboard.press("ControlOrMeta+z"));
    assert.match((await image.locator("image").getAttribute("href"))!, /^data:image\/webp;base64,/);
    await saved(page, () => page.keyboard.press("ControlOrMeta+Shift+z"));
    assert.equal(Object.keys(await storedImages(page)).length, 1);
    // Once the history is gone, nothing uses it: it is removed from the storage.
    await page.reload();
    await openFromLauncher(page);
    await view(page).getByRole("textbox", { name: "Diagram title" }).waitFor();
    await imagesStored(page, (keys) => keys.length === 0);
  });

  test("stores a picture with transparency in PNG, and an SVG as it is", async () => {
    const page = await host.newPage();
    await install(page);
    await newDiagram(page, "Pictures");
    const transparent = Buffer.from(
      await page.evaluate(async () => {
        const canvas = new OffscreenCanvas(40, 40);
        canvas.getContext("2d")!.fillRect(0, 0, 20, 40);
        const bytes = new Uint8Array(await (await canvas.convertToBlob({ type: "image/png" })).arrayBuffer());
        return btoa(String.fromCharCode(...bytes));
      }),
      "base64",
    );
    await saved(page, () => chooseImage(page, 0, 0, "half.png", transparent));
    await view(page).getByRole("img", { name: "Free text half", exact: true }).waitFor();
    const svg = '<svg xmlns="http://www.w3.org/2000/svg" width="80" height="40"><rect width="80" height="40" fill="teal"/></svg>';
    await view(page).getByRole("button", { name: "Image (I)" }).click();
    const chooser = page.waitForEvent("filechooser");
    const point = await at(page, 0, -200);
    await page.mouse.dblclick(point.x, point.y);
    await saved(page, async () => (await chooser).setFiles({ name: "badge.svg", mimeType: "image/svg+xml", buffer: Buffer.from(svg) }));
    await view(page).getByRole("img", { name: "Free text badge", exact: true }).waitFor();
    const values = Object.values(await storedImages(page)).sort();
    assert.equal(values.length, 2);
    assert.match(values[0], /^data:image\/png;base64,/);
    assert.equal(values[1], `data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`);
    // The SVG keeps its proportions.
    const badge = (await storedDiagram(page)).shapes.find((shape) => shape.type === "image" && shape.y < -100)!;
    assert.deepEqual([badge.w, badge.h], [80, 40]);
  });

  test("deleting the diagram that shows an image removes the image from the storage", async () => {
    const page = await host.newPage();
    await install(page);
    await newDiagram(page, "Kept");
    await newDiagram(page, "Pictures");
    await saved(page, () => chooseImage(page, 0, 0, "logo.png", noise));
    await view(page).getByRole("img", { name: "Free text logo", exact: true }).waitFor();
    await imagesStored(page, (keys) => keys.length === 1);
    await sidebar(page).getByRole("button", { name: "Delete Pictures" }).click();
    await view(page).getByRole("dialog", { name: "Delete this diagram?" }).getByRole("button", { name: "Delete" }).click();
    await imagesStored(page, (keys) => keys.length === 0);
  });

  test("refuses an image too heavy, with a message, and places nothing", async () => {
    const page = await host.newPage();
    await install(page);
    await newDiagram(page, "Pictures");
    await chooseImage(page, 0, 0, "huge.png", await noisePng(page, 1600, 1600));
    await view(page).getByRole("alert").getByText(/This image is too large: \d+ KB once reduced, more than the 900 KB/).waitFor();
    assert.equal(await view(page).getByRole("img", { name: "Image", exact: true }).count(), 0);
    assert.equal((await storedDiagram(page)).shapes.length, 0);
    assert.deepEqual(await storedImages(page), {});
    await view(page).getByRole("button", { name: "Close" }).click();
    assert.equal(await view(page).getByRole("alert").count(), 0);
  });

  test("pastes an image of the system clipboard in the middle of the view, captioned image", async () => {
    const page = await host.newPage();
    await install(page);
    await newDiagram(page, "Pictures");
    const base64 = noise.toString("base64");
    const frame = (await (await page.locator("iframe[title='Diagram']").elementHandle())!.contentFrame())!;
    await saved(page, () =>
      frame.evaluate((base64) => {
        const bytes = Uint8Array.from(atob(base64), (char) => char.charCodeAt(0));
        const data = new DataTransfer();
        data.items.add(new File([bytes], "image.png", { type: "image/png" }));
        document.body.dispatchEvent(new ClipboardEvent("paste", { clipboardData: data, bubbles: true }));
      }, base64),
    );
    await view(page).getByRole("img", { name: "Free text image", exact: true }).waitFor();
    const picture = (await storedDiagram(page)).shapes.find((shape) => shape.type === "image")!;
    assert.deepEqual([picture.x, picture.y], [0, 0]);
  });

  test("makes a custom shape with two anchors, places it, attaches an arrow to its second anchor, and hides it from the palette without changing it", async () => {
    const page = await host.newPage();
    await install(page);
    await newDiagram(page, "Icons");

    // The shape editor: a library, and a shape made from a picture, with two anchors of its own.
    await view(page).getByRole("button", { name: "Shapes" }).click();
    await view(page).getByRole("button", { name: "New library" }).click();
    const libraryName = view(page).getByRole("textbox", { name: "Library name" });
    await libraryName.fill("Platform icons");
    await libraryName.press("Enter");
    await view(page).getByRole("button", { name: "New shape" }).click();
    await view(page).getByText("Choose an image: the shape is saved once it has one.").waitFor();
    await view(page).getByLabel("Image", { exact: true }).setInputFiles({ name: "gateway.png", mimeType: "image/png", buffer: noise });
    await view(page).getByRole("button", { name: "gateway" }).waitFor();
    const name = view(page).getByRole("textbox", { name: "Shape name" });
    await name.fill("Gateway");
    await name.press("Enter");
    for (const [side, size] of [["Width", "100"], ["Height", "60"]]) {
      await view(page).getByRole("spinbutton", { name: side }).fill(size);
      await view(page).getByRole("spinbutton", { name: side }).press("Enter");
    }
    await view(page).getByRole("button", { name: "Clear anchors" }).click();
    await view(page).getByText("No anchor: arrows attach to this shape automatically only.").waitFor();
    const preview = view(page).getByRole("button", { name: "Preview of the shape" });
    const box = (await preview.boundingBox())!;
    await preview.click({ position: { x: box.width / 2, y: 1 } });
    await preview.click({ position: { x: box.width - 1, y: box.height / 2 } });
    await view(page).getByRole("button", { name: "Anchor p2", exact: true }).waitFor();
    await view(page).getByText("2 anchors").waitFor();

    const storedLibraries = async () => {
      const files = Object.values(await readFolder(page, DATA)).map((file) => JSON.parse(file) as { key: string; value: unknown });
      return files.find((file) => file.key === "shapes")?.value as { id: string; name: string; shapes: Record<string, unknown>[] }[];
    };
    for (let tries = 0; tries < 50 && ((await storedLibraries())?.[0]?.shapes[0]?.anchors as unknown[] | undefined)?.length !== 2; tries++) await new Promise((resolve) => setTimeout(resolve, 100));
    const [library] = await storedLibraries();
    assert.equal(library.name, "Platform icons");
    const [definition] = library.shapes;
    assert.deepEqual([definition.name, definition.width, definition.height, definition.showInDiagram], ["Gateway", 100, 60, true]);
    assert.deepEqual((definition.anchors as { id: string }[]).map((anchor) => anchor.id), ["p1", "p2"]);
    assert.match(String(definition.imageKey), /^image:[0-9a-f]{64}$/);

    // Back to the diagram: the palette offers it, placed at its size with its name.
    await view(page).getByRole("button", { name: "← Back to diagram" }).click();
    await view(page).getByRole("group", { name: "Custom shapes" }).getByRole("button", { name: "Platform icons · Gateway" }).click();
    const origin = await at(page, 0, 0);
    await saved(page, () => page.mouse.dblclick(origin.x, origin.y));
    const icon = view(page).getByRole("img", { name: "Custom shape Gateway", exact: true });
    await icon.waitFor();
    const placed = (await storedDiagram(page)).shapes.find((shape) => shape.type === "custom")!;
    assert.deepEqual([placed.w, placed.h, placed.text], [100, 60, "Gateway"]);

    // An arrow from its second anchor, on the middle of its right side, to a rectangle.
    await addRectangle(page, 300, 0, "B");
    await tool(page, "Arrow (F)");
    await saved(page, async () => drag(page, await at(page, placed.x + 50, placed.y), await at(page, 300, 0)));
    const arrow = (await storedDiagram(page)).arrows[0];
    assert.deepEqual(arrow.from, { shapeId: placed.id, port: "p2" });
    const name0 = "Arrow from Custom shape Gateway at p2 to Rectangle B";
    near((await arrowEnds(page, name0)).start, { x: placed.x + 49.6, y: placed.y });

    // Hidden from the palette, it is no longer offered, but the shape placed stays as it was.
    await view(page).getByRole("button", { name: "Shapes" }).click();
    await view(page).getByRole("checkbox", { name: "Show in diagram palette" }).uncheck();
    for (let tries = 0; tries < 50 && (await storedLibraries())[0].shapes[0].showInDiagram !== false; tries++) await new Promise((resolve) => setTimeout(resolve, 100));
    await view(page).getByRole("button", { name: "← Back to diagram" }).click();
    await icon.waitFor();
    assert.equal(await view(page).getByRole("group", { name: "Custom shapes" }).count(), 0);
    assert.match((await icon.locator("image").getAttribute("href"))!, /^data:image\/webp;base64,/);
    near((await arrowEnds(page, name0)).start, { x: placed.x + 49.6, y: placed.y });

    // Deleted after a confirmation that says a diagram uses it, it shows as a dashed frame with its name, still attached.
    await view(page).getByRole("button", { name: "Shapes" }).click();
    await view(page).getByRole("button", { name: "Delete shape" }).click();
    const dialog = view(page).getByRole("dialog", { name: "Delete this shape?" });
    await dialog.getByText("1 diagram uses it", { exact: false }).waitFor();
    await dialog.getByRole("button", { name: "Delete" }).click();
    await view(page).getByText("No shape yet.").first().waitFor();
    await view(page).getByRole("button", { name: "← Back to diagram" }).click();
    await icon.getByText("Gateway", { exact: true }).waitFor();
    assert.equal(await icon.locator("image").count(), 0);
    assert.deepEqual((await storedDiagram(page)).arrows[0].from, { shapeId: placed.id, port: "p2" });
    // Without its anchor, the arrow leaves the frame toward the rectangle, from its right side.
    near((await arrowEnds(page, name0)).start, { x: placed.x + 50, y: placed.y });
  });

  test("links a shape to a new diagram, follows it with Shift+click and comes back; a link to a deleted diagram says so and can be removed", async () => {
    const page = await host.newPage();
    await install(page);
    await newDiagram(page, "Overview");
    await addRectangle(page, 0, 0, "Billing");

    // A new diagram needs a title.
    await view(page).getByRole("button", { name: "Link…" }).click();
    const dialog = view(page).getByRole("dialog", { name: "Link on this shape" });
    await dialog.getByRole("radio", { name: "New diagram" }).check();
    await dialog.getByRole("button", { name: "Save" }).click();
    await dialog.getByText("Enter a title for the new diagram.").waitFor();
    await dialog.getByRole("textbox", { name: "Title of the new diagram" }).fill("Billing details");
    await saved(page, () => dialog.getByRole("button", { name: "Save" }).click());
    await sidebar(page).getByRole("button", { name: "Billing details", exact: true }).waitFor();
    const billing = view(page).getByRole("img", { name: "Rectangle Billing" });
    await billing.locator(".dg-link[data-link='diagram']").waitFor();
    const target = (await storedIndex(page)).find((entry) => entry.title === "Billing details")!;
    const overview = (await storedIndex(page)).find((entry) => entry.title === "Overview")!;
    // The new diagram is written before the shape that leads to it.
    await linkStored(page, overview.id, { type: "diagram", value: target.id });

    // Shift+click follows the link, and "← Back" returns.
    const title = view(page).getByRole("textbox", { name: "Diagram title" });
    const shiftClick = async () => {
      const point = await middleOf(billing);
      await page.keyboard.down("Shift");
      await page.mouse.click(point.x, point.y);
      await page.keyboard.up("Shift");
    };
    await shiftClick();
    await view(page).getByRole("button", { name: "← Back to “Overview”" }).click();
    await billing.waitFor();
    assert.equal(await title.inputValue(), "Overview");
    assert.equal(await view(page).getByRole("button", { name: /^← Back to/ }).count(), 0);

    // Opening a diagram from the list forgets the way back.
    await shiftClick();
    await view(page).getByRole("button", { name: "← Back to “Overview”" }).waitFor();
    assert.equal(await title.inputValue(), "Billing details");
    await sidebar(page).getByRole("button", { name: "Overview", exact: true }).click();
    await billing.waitFor();
    assert.equal(await view(page).getByRole("button", { name: /^← Back to/ }).count(), 0);

    // The target deleted, the link says so, and is removed.
    await sidebar(page).getByRole("button", { name: "Delete Billing details" }).click();
    await view(page).getByRole("dialog", { name: "Delete this diagram?" }).getByRole("button", { name: "Delete" }).click();
    await stored(page, (index) => index.every((entry) => entry.title !== "Billing details"));
    await shiftClick();
    const notice = view(page).getByRole("alert").filter({ hasText: "Diagram not found" });
    await notice.waitFor();
    assert.equal(await title.inputValue(), "Overview");
    await saved(page, () => notice.getByRole("button", { name: "Remove link" }).click());
    assert.equal(await billing.locator(".dg-link").count(), 0);
    await linkStored(page, overview.id, null);
  });

  test("a link to an external URL gets https:// and opens in a new tab", async () => {
    const page = await host.newPage();
    await install(page);
    await newDiagram(page, "Docs");
    await addRectangle(page, 0, 0, "Wiki");
    await view(page).getByRole("button", { name: "Link…" }).click();
    const dialog = view(page).getByRole("dialog", { name: "Link on this shape" });
    await dialog.getByRole("textbox", { name: "URL" }).fill("example.com/wiki");
    await saved(page, () => dialog.getByRole("button", { name: "Save" }).click());
    const wiki = view(page).getByRole("img", { name: "Rectangle Wiki" });
    await wiki.locator(".dg-link[data-link='url']").waitFor();
    assert.deepEqual((await storedDiagram(page)).shapes[0].link, { type: "url", value: "https://example.com/wiki" });

    const point = await middleOf(wiki);
    const popup = page.context().waitForEvent("page");
    await page.keyboard.down("Shift");
    await page.mouse.click(point.x, point.y);
    await page.keyboard.up("Shift");
    assert.equal((await popup).url(), "https://example.com/wiki");
  });

  test("new rectangles take the default color set in Diagram defaults, after a reload too; a size out of bounds is refused, and existing shapes are unchanged", async () => {
    const page = await host.newPage();
    await install(page);
    await newDiagram(page, "Styles");
    await addRectangle(page, -200, 0, "Before");

    await view(page).getByRole("button", { name: "Defaults" }).click();
    const dialog = view(page).getByRole("dialog", { name: "Diagram defaults" });
    await dialog.getByRole("combobox", { name: "Rectangle · Color" }).selectOption({ label: "Blue" });
    const width = dialog.getByRole("spinbutton", { name: "Rectangle · Width" });
    await width.fill("5");
    await dialog.getByRole("button", { name: "Save" }).click();
    await dialog.getByRole("alert").getByText("Correct the values out of their bounds before saving.").waitFor();
    assert.equal(await width.getAttribute("aria-invalid"), "true");
    await width.fill("200");
    assert.equal(await width.getAttribute("aria-invalid"), "false");
    await dialog.getByRole("button", { name: "Save" }).click();
    await dialog.waitFor({ state: "detached" });
    await storedDefaults(page, (defaults) => defaults?.shapes.rect.color === "c-blue");
    await addRectangle(page, 200, 0, "After");

    await page.reload();
    await openFromLauncher(page);
    await view(page).getByRole("img", { name: "Rectangle After", exact: true }).waitFor();
    await addRectangle(page, 0, 200, "Again");
    const [before, after, again] = (await storedDiagram(page)).shapes;
    assert.deepEqual([before.color, before.w], ["c-gray", 120]);
    assert.deepEqual([after.color, after.w, after.h], ["c-blue", 200, 60]);
    assert.deepEqual([again.color, again.w], ["c-blue", 200]);
  });

  test("Save as default for this shape type, and for arrows, make the style of the selection that of the next ones", async () => {
    const page = await host.newPage();
    await install(page);
    await newDiagram(page, "From selection");
    await addShape(page, "Ellipse (E)", -200, 0, "Source");
    await saved(page, () => view(page).getByRole("button", { name: "Green", exact: true }).click());
    await view(page).getByRole("button", { name: "Save as default for this shape type" }).click();
    await view(page).getByRole("status").getByText("Saved: new Ellipse shapes take this style.").waitFor();
    await storedDefaults(page, (defaults) => defaults?.shapes.ellipse.color === "c-green");

    await addShape(page, "Ellipse (E)", 200, 0, "Next");
    await tool(page, "Arrow (F)");
    await saved(page, async () => drag(page, await at(page, -200, 0), await at(page, 200, 0)));
    await saved(page, () => view(page).getByRole("button", { name: "Dashed" }).click());
    await view(page).getByRole("button", { name: "Save as default for arrows" }).click();
    await storedDefaults(page, (defaults) => defaults?.arrows.dashed === true);
    await saved(page, async () => drag(page, await at(page, -200, 100), await at(page, 200, 100)));

    const diagram = await storedDiagram(page);
    assert.equal(diagram.shapes[1].color, "c-green");
    assert.deepEqual(diagram.arrows.map((arrow) => arrow.dashed), [true, true]);
  });

  test("an image missing from the storage shows a missing image frame", async () => {
    const page = await host.newPage();
    await install(page);
    await newDiagram(page, "Pictures");
    await saved(page, () => chooseImage(page, 0, 0, "logo.png", noise));
    await view(page).getByRole("img", { name: "Image", exact: true }).waitFor();
    await editStored(page, (diagram) => {
      (diagram.shapes.find((shape) => shape.type === "image") as Record<string, unknown>).imageKey = `image:${"0".repeat(64)}`;
    });
    await view(page).getByRole("img", { name: "Image", exact: true }).getByText("missing image").waitFor();
  });

  test("exports the whole diagram as a PNG drawn from its model, what is off the screen included, and the selection alone with Ctrl+Shift+E", async () => {
    const page = await host.newPage();
    await install(page);
    await newDiagram(page, "Checkout: v2");
    await addRectangle(page, -150, 0, "A");
    await addRectangle(page, 150, 0, "B");
    await tool(page, "Arrow (F)");
    await saved(page, async () => drag(page, await at(page, -150, 0), await at(page, 150, 0)));
    await tool(page, "Select (S)");
    await view(page).getByRole("img", { name: "Rectangle A", exact: true }).click();
    // The drawing moves far out of the canvas.
    const middle = await at(page, 0, 0);
    await page.mouse.move(middle.x, middle.y);
    await page.mouse.wheel(3000, 0);
    await view(page).getByRole("img", { name: "Rectangle A", exact: true }).waitFor();

    // Twice the size of the drawing, with 20 around it: a rectangle 120 × 60 is 320 × 200.
    const selection = await downloaded(page, () => page.keyboard.press("ControlOrMeta+Shift+e"));
    assert.equal(selection.name, "Checkout_v2.png");
    const one = await pngOf(page, selection.bytes);
    assert.ok(Math.abs(one.w - 320) <= 4 && Math.abs(one.h - 200) <= 4, `${one.w} × ${one.h}`);
    assert.equal(one.cornerAlpha, 255, "the background of the theme");

    // Nothing selected: the two rectangles and the arrow between them, 420 wide.
    await page.keyboard.press("Escape");
    const whole = await pngOf(page, (await downloaded(page, () => view(page).getByRole("button", { name: "PNG", exact: true }).click())).bytes);
    assert.ok(Math.abs(whole.w - 920) <= 4 && Math.abs(whole.h - 200) <= 4, `${whole.w} × ${whole.h}`);

    await view(page).getByRole("button", { name: "Transparent" }).click();
    const transparent = await pngOf(page, (await downloaded(page, () => view(page).getByRole("button", { name: "PNG", exact: true }).click())).bytes);
    assert.equal(transparent.cornerAlpha, 0);
  });

  test("exports the diagram as a .drawio file, with a cell for each shape, group and arrow", async () => {
    const page = await host.newPage();
    await install(page);
    await newDiagram(page, "Billing");
    await addRectangle(page, -100, 0, "A");
    await addShape(page, "Database (D)", 100, 0, "B");
    await addRectangle(page, 0, 150, "C");
    await tool(page, "Arrow (F)");
    await saved(page, async () => drag(page, await at(page, -100, 0), await at(page, 100, 0)));
    await tool(page, "Select (S)");
    await view(page).getByRole("img", { name: "Rectangle A", exact: true }).click();
    await view(page).getByRole("img", { name: "Database B", exact: true }).click({ modifiers: ["ControlOrMeta"] });
    await saved(page, () => view(page).getByRole("button", { name: "Group selection" }).click());

    const file = await downloaded(page, () => view(page).getByRole("button", { name: "Export as drawio (.drawio)" }).click());
    assert.equal(file.name, "Billing.drawio");
    const { shapes, arrows } = await storedDiagram(page);
    const parsed = await page.evaluate((xml) => {
      const document = new DOMParser().parseFromString(xml, "application/xml");
      const cells = [...document.querySelectorAll("mxCell")];
      return {
        error: document.querySelector("parsererror")?.textContent ?? null,
        name: document.querySelector("diagram")?.getAttribute("name"),
        cells: cells.length,
        groups: cells.filter((cell) => cell.getAttribute("style") === "group;").length,
        edges: cells.filter((cell) => cell.getAttribute("edge") === "1").map((cell) => [cell.getAttribute("source"), cell.getAttribute("target")]),
        values: cells.filter((cell) => cell.getAttribute("vertex") === "1").map((cell) => cell.getAttribute("value")),
      };
    }, file.bytes.toString("utf8"));
    assert.equal(parsed.error, null);
    assert.equal(parsed.name, "Billing");
    // The root and its layer, the group, three shapes and the arrow.
    assert.equal(parsed.cells, 7);
    assert.equal(parsed.groups, 1);
    assert.deepEqual(parsed.edges, [[arrows[0].from.shapeId, arrows[0].to.shapeId]]);
    assert.deepEqual(parsed.values.filter(Boolean).sort(), shapes.map((shape) => shape.text).sort());
  });

  test("the Widget lists the diagrams created in the View, the most recent first, and opens the View on the one clicked", async () => {
    const page = await host.newPage();
    await install(page);
    await newDiagram(page, "Checkout");
    await newDiagram(page, "Billing");
    await goHome(page);

    const recent = widget(page).getByRole("list", { name: "Recent diagrams" });
    await recent.getByRole("button", { name: /^Billing/ }).waitFor();
    assert.deepEqual(
      (await recent.getByRole("listitem").allInnerTexts()).map((text) => text.replace(/\s+/g, " ").trim()),
      ["Billing just now", "Checkout just now"],
    );

    // The View is loaded behind the Home: it gets the id as an event.
    await recent.getByRole("button", { name: /^Checkout/ }).click();
    await page.locator("iframe[title='Diagram']").waitFor({ state: "visible" });
    await opened(page, "Checkout");

    // The View is not loaded: it gets the id in its handshake.
    await page.reload();
    await widget(page).getByRole("button", { name: /^Checkout/ }).click();
    await opened(page, "Checkout");
  });

  test("an empty Widget says so, and its “+ New” opens the View on a new diagram, which the Widget then lists", async () => {
    const page = await host.newPage();
    await install(page);
    await goHome(page);
    await widget(page).getByText("No diagrams yet").waitFor();

    await saved(page, () => widget(page).getByRole("button", { name: "+ New" }).click());
    await page.locator("iframe[title='Diagram']").waitFor({ state: "visible" });
    const field = view(page).getByRole("textbox", { name: "Diagram title" });
    assert.equal(await field.inputValue(), "New diagram");
    await field.fill("Onboarding");
    await saved(page, () => field.press("Enter"));

    // The Widget, hidden behind the View, reads the diagrams again when the Home comes back.
    await goHome(page);
    await widget(page).getByRole("button", { name: /^Onboarding/ }).waitFor();
    assert.equal(await widget(page).getByText("No diagrams yet").count(), 0);
    assert.equal((await storedIndex(page)).length, 1, "a single diagram is created");

    // The View is not loaded: it gets `new` in its handshake.
    await page.reload();
    await saved(page, () => widget(page).getByRole("button", { name: "+ New" }).click());
    await opened(page, "New diagram");
    assert.equal((await storedIndex(page)).length, 2);
  });

  test("imports the files of living-documentation after a confirmation: diagrams, libraries and the images they refer to", async () => {
    const page = await host.newPage();
    await install(page);
    await newDiagram(page, "Existing");
    const chooser = page.waitForEvent("filechooser");
    await sidebar(page).getByRole("button", { name: "Import" }).click();
    await (
      await chooser
    ).setFiles([
      json(".diagrams.json", SAMPLE_DIAGRAMS),
      json("more.json", SECOND_DIAGRAMS),
      json(".shape-libraries.json", SAMPLE_LIBRARIES),
      { name: "icon.png", mimeType: "image/png", buffer: noise },
      { name: "unused.png", mimeType: "image/png", buffer: noise },
    ]);
    const dialog = view(page).getByRole("dialog", { name: "Import these files?" });
    await dialog.getByText("Diagrams: 2, libraries: 1, custom shapes: 1, images: 1").waitFor();
    await dialog.getByText("missing.png").waitFor();
    // Cancelled, nothing is written.
    await dialog.getByRole("button", { name: "Cancel" }).click();
    assert.equal(await sidebar(page).getByRole("button", { name: "Sample Diagram", exact: true }).count(), 0);
    assert.equal(Object.keys(await storedImages(page)).length, 0);

    const again = page.waitForEvent("filechooser");
    await sidebar(page).getByRole("button", { name: "Import" }).click();
    await (
      await again
    ).setFiles([json(".diagrams.json", SAMPLE_DIAGRAMS), json("more.json", SECOND_DIAGRAMS), json(".shape-libraries.json", SAMPLE_LIBRARIES), { name: "icon.png", mimeType: "image/png", buffer: noise }]);
    await dialog.getByRole("button", { name: "Import", exact: true }).click();

    await sidebar(page).getByRole("button", { name: "Sample Diagram", exact: true }).waitFor();
    await view(page).getByRole("img", { name: "Rectangle Start", exact: true }).waitFor();
    await view(page).getByRole("img", { name: "Ellipse End", exact: true }).waitFor();
    await view(page).getByRole("img", { name: "Arrow from Rectangle Start to Ellipse End", exact: true }).waitFor();
    await imagesStored(page, (keys) => keys.length === 1 && /^image:[0-9a-f]{64}$/.test(keys[0]));
    await stored(page, (index) => index.length === 3);

    await page.reload();
    await openFromLauncher(page);
    await sidebar(page).getByRole("button", { name: "Servers", exact: true }).waitFor();
    await sidebar(page).getByRole("button", { name: "Existing", exact: true }).waitFor();
    await sidebar(page).getByRole("button", { name: "Sample Diagram", exact: true }).click();
    await view(page).getByRole("img", { name: "Rectangle Start", exact: true }).waitFor();
    await view(page).getByRole("img", { name: "Arrow from Rectangle Start to Ellipse End", exact: true }).waitFor();
    await sidebar(page).getByRole("button", { name: "Servers", exact: true }).click();
    await view(page).getByRole("img", { name: /Photo/ }).getByText("missing image").waitFor();
    assert.equal(Object.keys(await storedImages(page)).length, 1);
  });

  test("refuses a file that is not JSON, naming it, and imports nothing", async () => {
    const page = await host.newPage();
    await install(page);
    const chooser = page.waitForEvent("filechooser");
    await sidebar(page).getByRole("button", { name: "Import" }).click();
    await (await chooser).setFiles([{ name: "notes.json", mimeType: "application/json", buffer: Buffer.from("{nope") }, json(".diagrams.json", SAMPLE_DIAGRAMS)]);
    await view(page).getByRole("alert").getByText(/notes\.json.*not JSON/).waitFor();
    assert.equal(await view(page).getByRole("dialog").count(), 0);
    assert.equal((await storedIndex(page)).length, 0);
    assert.equal(await sidebar(page).getByRole("button", { name: "Sample Diagram", exact: true }).count(), 0);
  });

  test("its User guide opens from the Launcher, with its screenshots", async () => {
    const page = await host.newPage();
    await install(page);
    const launcher = await showLauncher(page);
    await launcher.getByRole("listitem").filter({ hasText: "Diagram" }).getByRole("button", { name: "About" }).click();
    await page.getByRole("dialog", { name: "About Diagram" }).getByRole("button", { name: "User guide" }).click();
    const guide = page.frameLocator("iframe[title='Diagram: User guide']");
    await guide.getByRole("heading", { name: "Diagram", level: 1 }).waitFor();
    for (const image of await guide.getByRole("img").all()) {
      assert.ok(await image.evaluate((element: HTMLImageElement) => element.complete && element.naturalWidth > 0), `${await image.getAttribute("alt")} is shown`);
    }
    assert.equal(await guide.getByRole("img").count(), 5);
  });
});
