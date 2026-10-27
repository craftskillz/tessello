import assert from "node:assert/strict";
import { describe, test } from "node:test";
import type { Page } from "playwright";
import { dropFile, exampleFiles, removeFolder, showLauncher, until, useHost, writeFolder, zip, zipExample } from "./browser.ts";

const host = useHost();

/** Installs a .zip from the Host's drop zone, then goes back to the Home. */
async function install(page: Page, name: string, bytes: Uint8Array) {
  await dropFile(page, `${name}.zip`, bytes);
  await page.getByRole("dialog", { name: `Install ${name}?` }).getByRole("button", { name: "Accept and install" }).click();
  await page.locator(`iframe[title='${name}']`).waitFor();
  await (await showLauncher(page)).getByRole("button", { name: "Tessello" }).click();
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
      icon: "icon.svg", guide: "guide.md",
      view: { entry: "view.html" },
      ...(size ? { widget: { entry: "widget.html", size } } : {}),
    },
    "icon.svg": "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 1 1'/>", "guide.md": "# Guide",
    "view.html": probe(`${name} view`),
    ...(size ? { "widget.html": probe(`${name} widget`, options.silentWidget) } : {}),
  });
}

/** The names of the Widgets, in the order the Home shows them. */
const order = (page: Page) => widgets(page).getByRole("listitem").evaluateAll((items) => items.map((item) => item.getAttribute("aria-label")));

/** Waits until the Launcher is in the page, or has slid out of it to the left. */
const launcherIs = (page: Page, shown: boolean) =>
  page.waitForFunction((shown) => (document.getElementById("launcher")!.getBoundingClientRect().right > 0) === shown, shown);

describe("the Home", () => {
  test("keeps the management drawer inside the Launcher, with a handle while collapsed", async () => {
    const page = await host.newPage();
    await install(page, "Notes", await zipExample("notes"));
    const launcher = await showLauncher(page);
    const toggle = launcher.getByRole("button", { name: "Manage" });
    const settings = launcher.getByRole("button", { name: "Settings" });
    assert.equal(await toggle.getAttribute("aria-expanded"), "false");
    assert.equal(await settings.count(), 0, "collapsed actions are absent from the accessibility tree");
    const marketplace = launcher.getByRole("button", { name: "Marketplace" });
    assert.equal(await marketplace.isVisible(), true, "Marketplace stays available with management collapsed");
    const marketplaceBounds = (await marketplace.boundingBox())!;
    const toggleBounds = (await toggle.boundingBox())!;
    assert.ok(marketplaceBounds.y + marketplaceBounds.height <= toggleBounds.y, "Marketplace sits just above the management drawer");

    await launcher.getByRole("button", { name: "Notes", exact: true }).click();
    await launcherIs(page, false);
    await showLauncher(page);
    await toggle.click();
    await settings.waitFor();
    assert.equal(await toggle.getAttribute("aria-expanded"), "true");
    assert.equal(await page.locator("body.drawer-dismissed").count(), 0, "the handle does not dismiss the outer drawer");
    await launcherIs(page, true);

    await page.mouse.move(600, 300);
    await launcherIs(page, false);
    assert.ok((await toggle.boundingBox())!.x + (await toggle.boundingBox())!.width <= 0, "the handle hides with its parent");
    await showLauncher(page);
    await launcherIs(page, true);
    assert.equal(await toggle.getAttribute("aria-expanded"), "true", "revealing the Launcher preserves the inner drawer");
    await toggle.click();
    assert.equal(await toggle.getAttribute("aria-expanded"), "false");
    await launcherIs(page, true);
  });

  test("opens management actions with the keyboard and returns focus to the handle on Escape", async () => {
    const page = await host.newPage();
    const toggle = page.getByRole("button", { name: "Manage" });
    await toggle.focus();
    await page.keyboard.press("Enter");
    // The management drawer is ready once it is open and its actions are shown; Tab and Enter before that go nowhere.
    await until(async () => (await toggle.getAttribute("aria-expanded")) === "true", "the management drawer to open");
    const install = page.getByRole("button", { name: "Install a Module…" });
    await install.waitFor();
    await page.keyboard.press("Tab");
    await until(() => install.evaluate((button) => button === document.activeElement), "focus to move to Install a Module…");
    const chooser = page.waitForEvent("filechooser");
    await page.keyboard.press("Enter");
    assert.equal((await chooser).isMultiple(), false, "installing a Module is keyboard accessible");
    await page.keyboard.press("Escape");
    await until(async () => (await toggle.getAttribute("aria-expanded")) === "false", "the management drawer to collapse");
    await until(() => toggle.evaluate((button) => button === document.activeElement), "focus to return to the handle");
    await install.waitFor({ state: "detached" });
    assert.equal(await page.getByRole("button", { name: "Marketplace" }).isVisible(), true);
  });

  test("keeps the Launcher beside it, which becomes a drawer behind a View, shown again near the left edge", async () => {
    const page = await host.newPage();
    await install(page, "Notes", await zipExample("notes"));
    await page.mouse.move(600, 300);
    await launcherIs(page, true);

    await (await showLauncher(page)).getByRole("button", { name: "Notes" }).click();
    await page.locator("iframe[title='Notes']").waitFor();
    await launcherIs(page, false);

    await page.mouse.move(0, 300);
    await launcherIs(page, true);
    await page.mouse.move(600, 300);
    await launcherIs(page, false);

    await (await showLauncher(page)).getByRole("button", { name: "Tessello" }).click();
    await page.mouse.move(600, 300);
    await launcherIs(page, true);
  });

  test("keeps module names readable and About buttons compact in the open drawer", async () => {
    for (const width of [1280, 390]) {
      const page = await host.newPage();
      await page.setViewportSize({ width, height: 844 });
      await install(page, "Notes", await zipExample("notes"));
      await (await showLauncher(page)).getByRole("button", { name: "Notes", exact: true }).click();
      await page.locator("iframe[title='Notes']").waitFor();
      const launcher = await showLauncher(page);
      const row = launcher.locator("li").filter({ hasText: "Notes" });
      const open = row.getByRole("button", { name: "Notes", exact: true });
      const about = row.locator(".entry-about");
      const [rowBox, openBox, aboutBox] = await Promise.all([row.boundingBox(), open.boundingBox(), about.boundingBox()]);
      assert.ok(aboutBox!.width < rowBox!.width / 3, `About stays compact at ${width}px`);
      assert.ok(openBox!.width > rowBox!.width / 2, `the module button keeps the remaining row at ${width}px`);
      assert.ok(openBox!.x + openBox!.width <= aboutBox!.x + 1, "the buttons do not overlap");
      const lines = await row.locator(".name").evaluate((name) => name.getBoundingClientRect().height / parseFloat(getComputedStyle(name).lineHeight));
      assert.ok(lines <= 1.1, `Notes stays on one line at ${width}px`);
      await page.context().close();
    }
  });

  test("shows the Notes Widget, which follows the notes written in the View and opens it", async () => {
    const page = await host.newPage();
    await install(page, "Notes", await zipExample("notes"));
    const widget = page.frameLocator("iframe[title='Notes widget']");
    await widget.getByText("No notes yet").waitFor();

    await (await showLauncher(page)).getByRole("button", { name: "Notes" }).click();
    const view = page.frameLocator("iframe[title='Notes']");
    await view.getByRole("textbox", { name: "New note" }).fill("Buy oat milk");
    await view.getByRole("button", { name: "Add note" }).click();
    await view.getByText("Buy oat milk").waitFor();
    await (await showLauncher(page)).getByRole("button", { name: "Tessello" }).click();
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
    await (await showLauncher(page)).getByRole("button", { name: "Plain" }).waitFor();
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
    await (await showLauncher(page)).getByRole("button", { name: "Tessello" }).click();
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

    await (await showLauncher(page)).getByRole("button", { name: "Probe" }).click();
    await viewLog.getByText("Probe view ready").waitFor();
    await widgetLog.getByText(/false$/).waitFor({ state: "attached" });

    await (await showLauncher(page)).getByRole("button", { name: "Tessello" }).click();
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
