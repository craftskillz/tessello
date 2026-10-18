import assert from "node:assert/strict";
import { describe, test } from "node:test";
import type { Page } from "playwright";
import { dropFile, exampleFiles, removeFolder, useHost, writeFolder, zip, zipExample } from "./browser.ts";

const host = useHost();

/** Installs a .zip from the Host's drop zone, then goes back to the Home. */
async function install(page: Page, name: string, bytes: Uint8Array) {
  await dropFile(page, `${name}.zip`, bytes);
  await page.getByRole("dialog", { name: `Install ${name}?` }).getByRole("button", { name: "Accept and install" }).click();
  await page.locator(`iframe[title='${name}']`).waitFor();
  await page.getByRole("button", { name: "Tessello" }).click();
}

const widgets = (page: Page) => page.getByRole("list", { name: "Widgets" });

/**
 * A page that sends `ready` and shows, as text, each `visibility` it receives: "ready", then "visibility: false,true"…
 * `silent` never sends `ready`. From a Widget, its button opens the View.
 */
const probe = (label: string, silent = false) => `<!doctype html><p id="log">${label} starting</p><script>
  const seen = [];
  const log = document.getElementById("log");
  addEventListener("message", ({ data }) => {
    if (data?.type === "response" && data.id === "1") log.textContent = "${label} ready";
    if (data?.type === "visibility") log.textContent = "${label} visibility: " + seen.concat(data.payload.visible).join(",");
    if (data?.type === "visibility") seen.push(data.payload.visible);
  });
  ${silent ? "" : `parent.postMessage({ tessello: 1, type: "ready", id: "1" }, "*");`}
</script>
<button onclick='parent.postMessage({ tessello: 1, type: "navigation.openView", id: "2", payload: {} }, "*")'>Open the View</button>`;

/** A Module whose View and Widget are probes; `size` is its Widget's, or none. */
function probeModule(name: string, size?: "S" | "M" | "L", options: { silentWidget?: boolean } = {}) {
  const id = `@test/${name.toLowerCase()}`;
  return zip({
    "manifest.json": {
      convention: 1,
      id,
      name,
      version: "1.0.0",
      icon: "icon.svg",
      view: { entry: "view.html" },
      ...(size ? { widget: { entry: "widget.html", size } } : {}),
    },
    "icon.svg": "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 1 1'/>",
    "view.html": probe(`${name} view`),
    ...(size ? { "widget.html": probe(`${name} widget`, options.silentWidget) } : {}),
  });
}

/** The names of the Widgets, in the order the Home shows them. */
const order = (page: Page) => widgets(page).getByRole("listitem").evaluateAll((items) => items.map((item) => item.getAttribute("aria-label")));

describe("the Home", () => {
  test("shows the Notes Widget, which follows the notes written in the View and opens it", async () => {
    const page = await host.newPage();
    await install(page, "Notes", await zipExample("notes"));
    const widget = page.frameLocator("iframe[title='Notes widget']");
    await widget.getByText("No notes yet").waitFor();

    await page.getByRole("navigation", { name: "Launcher" }).getByRole("button", { name: "Notes" }).click();
    const view = page.frameLocator("iframe[title='Notes']");
    await view.getByRole("textbox", { name: "New note" }).fill("Buy oat milk");
    await view.getByRole("button", { name: "Add note" }).click();
    await view.getByText("Buy oat milk").waitFor();
    await page.getByRole("button", { name: "Tessello" }).click();
    await widget.getByText("Buy oat milk").waitFor();

    await widget.getByRole("button", { name: "Open Notes" }).click();
    await page.locator("iframe[title='Notes']").waitFor({ state: "visible" });
    assert.equal(await widgets(page).isVisible(), false, "the View hides the Home");
  });

  test("lays out S, M and L Widgets on 1×1, 2×1 and 2×2 cells, and leaves out a Module without a Widget", async () => {
    const page = await host.newPage();
    await install(page, "Small", probeModule("Small", "S"));
    await install(page, "Medium", probeModule("Medium", "M"));
    await install(page, "Large", probeModule("Large", "L"));
    await install(page, "Plain", probeModule("Plain"));
    await page.frameLocator("iframe[title='Large widget']").getByText(/^Large widget (ready|visibility)/).waitFor();

    assert.deepEqual(await order(page), ["Small", "Medium", "Large"]);
    const box = async (name: string) => (await widgets(page).getByRole("listitem", { name }).boundingBox())!;
    const [small, medium, large] = [await box("Small"), await box("Medium"), await box("Large")];
    assert.equal(small.width, small.height, "a cell is square");
    const gap = 16;
    assert.deepEqual([medium.width, medium.height], [2 * small.width + gap, small.height]);
    assert.deepEqual([large.width, large.height], [2 * small.width + gap, 2 * small.height + gap]);
    await page.getByRole("navigation", { name: "Launcher" }).getByRole("button", { name: "Plain" }).waitFor();
  });

  test("the User reorders the Widgets with buttons or by dragging, and the order is kept after a reload", async () => {
    const page = await host.newPage();
    for (const name of ["First", "Second", "Third"]) await install(page, name, probeModule(name, "S"));
    const first = page.frameLocator("iframe[title='First widget']").getByText(/^First widget/);
    await first.waitFor();
    assert.equal(await page.getByRole("button", { name: "Move First later" }).isVisible(), false, "only while arranging");

    await page.getByRole("button", { name: "Arrange widgets" }).click();
    await page.getByRole("button", { name: "Move First later" }).click();
    await page.waitForFunction(() => document.querySelector("#widgets li")?.getAttribute("aria-label") === "Second");
    assert.deepEqual(await order(page), ["Second", "First", "Third"]);
    const before = await first.innerText();
    await widgets(page).getByRole("listitem", { name: "Third" }).dragTo(widgets(page).getByRole("listitem", { name: "Second" }));
    await page.waitForFunction(() => document.querySelector("#widgets li")?.getAttribute("aria-label") === "Third");
    assert.deepEqual(await order(page), ["Third", "Second", "First"]);
    assert.equal(await first.innerText(), before, "a moved Widget keeps running");
    await page.getByRole("button", { name: "Done" }).click();

    await page.reload();
    await page.frameLocator("iframe[title='First widget']").getByText(/^First widget/).waitFor();
    assert.deepEqual(await order(page), ["Third", "Second", "First"]);
  });

  test("the Notes Widget's + opens the View ready to write a new note, also when the View was left behind the Home", async () => {
    const page = await host.newPage();
    await install(page, "Notes", await zipExample("notes"));
    const widget = page.frameLocator("iframe[title='Notes widget']");
    const textbox = page.frameLocator("iframe[title='Notes']").getByRole("textbox", { name: "New note" });

    /** Waits until the View's new note has the focus. */
    const focused = async () => {
      const frame = await (await page.locator("iframe[title='Notes']").elementHandle())!.contentFrame();
      await frame!.waitForFunction(() => document.activeElement?.getAttribute("aria-label") === "New note");
    };

    await widget.getByRole("button", { name: "New note" }).click();
    await focused();

    await textbox.fill("Unsent draft");
    await textbox.blur();
    await page.getByRole("button", { name: "Tessello" }).click();
    await widget.getByRole("button", { name: "New note" }).click();
    await page.locator("iframe[title='Notes']").waitFor({ state: "visible" });
    assert.equal(await textbox.inputValue(), "Unsent draft", "the same View comes back");
    await focused();
  });

  test("a Widget hidden by a View, and a View left behind the Home, are told they are hidden, then visible again", async () => {
    const page = await host.newPage();
    await install(page, "Probe", probeModule("Probe", "S"));
    const widget = page.frameLocator("iframe[title='Probe widget']");
    const view = page.frameLocator("iframe[title='Probe']");
    const widgetLog = widget.locator("#log");
    const viewLog = view.locator("#log");
    await widgetLog.getByText(/^Probe widget (ready|visibility: .*true)$/).waitFor();

    await page.getByRole("navigation", { name: "Launcher" }).getByRole("button", { name: "Probe" }).click();
    await viewLog.getByText("Probe view ready").waitFor();
    await widgetLog.getByText(/false$/).waitFor({ state: "attached" });

    await page.getByRole("button", { name: "Tessello" }).click();
    await widgetLog.getByText(/false,true$/).waitFor();
    await viewLog.getByText("Probe view visibility: false").waitFor({ state: "attached" });

    await widget.getByRole("button", { name: "Open the View" }).click();
    await viewLog.getByText("Probe view visibility: false,true").waitFor();
    await widgetLog.getByText(/true,false$/).waitFor({ state: "attached" });
  });

  test("a Widget that does not finish its handshake is replaced by an error, and the other Widgets keep working", async () => {
    const page = await host.newPage();
    await page.clock.install();
    await page.reload();
    await install(page, "Silent", probeModule("Silent", "S", { silentWidget: true }));
    await install(page, "Probe", probeModule("Probe", "S"));
    await page.frameLocator("iframe[title='Silent widget']").getByText("Silent widget starting").waitFor();
    await page.frameLocator("iframe[title='Probe widget']").getByText(/^Probe widget/).waitFor();

    await page.clock.runFor(10_000);
    const silent = widgets(page).getByRole("listitem", { name: "Silent" });
    await silent.getByRole("alert").getByText("Silent is not responding").waitFor();
    assert.equal(await page.locator("iframe[title='Silent widget']").count(), 0);

    await page.frameLocator("iframe[title='Probe widget']").getByRole("button", { name: "Open the View" }).click();
    await page.frameLocator("iframe[title='Probe']").getByText("Probe view visibility: false,true").waitFor();
  });

  test("a Widget whose folder no longer complies shows an error, and comes back once the folder is fixed", async () => {
    const page = await host.newPage();
    await install(page, "Notes", await zipExample("notes"));
    await page.frameLocator("iframe[title='Notes widget']").getByText("No notes yet").waitFor();
    const widget = (await exampleFiles("notes"))["widget/index.html"];
    await removeFolder(page, "modules/notes/widget/index.html");

    await page.reload();
    const notes = widgets(page).getByRole("listitem", { name: "Notes" });
    await notes.getByRole("alert").getByText("Notes can't be shown").waitFor();

    await writeFolder(page, "modules/notes", { "widget/index.html": widget });
    // The User comes back from the editor where they fixed it.
    await page.evaluate(() => window.dispatchEvent(new Event("focus")));
    await page.frameLocator("iframe[title='Notes widget']").getByText("No notes yet").waitFor();
  });
});
