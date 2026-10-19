// A Module's User guide, read from the Launcher (CONVENTION.md §3.2, ADR 0010).

import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { dropFile, useHost, zip } from "./browser.ts";

const host = useHost();

const READY = `<script>parent.postMessage({ tessello: 1, type: "ready", id: "1" }, "*")</script>`;

const GUIDE = `# Lamp

- [Your data](#your-data)

![The lamp](images/lamp.svg)

<script>parent.document.title = "ran"</script>

[Open-Meteo](https://open-meteo.com)

${"Some text to scroll past.\n\n".repeat(60)}

## Your data

Kept in your Modules folder.

${"More text, so that the section can reach the top.\n\n".repeat(60)}
`;

const LAMP = zip({
  "manifest.json": {
    convention: 1,
    id: "@test/lamp",
    name: "Lamp",
    version: "2.1.0",
    description: "A lamp that lights up.",
    icon: "icon.svg",
    view: { entry: "index.html" },
    guide: "docs/guide.md",
  },
  "icon.svg": "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 1 1'/>",
  "index.html": READY,
  "docs/guide.md": GUIDE,
  "docs/images/lamp.svg": "<svg xmlns='http://www.w3.org/2000/svg' width='120' height='60'><rect width='120' height='60' fill='gold'/></svg>",
});

describe("the User guide of a Module", () => {
  test("opens from the About dialog of the Launcher, with its images, without running anything, and goes back", async () => {
    const page = await host.newPage();
    await dropFile(page, "lamp.zip", LAMP);
    await page.getByRole("dialog", { name: "Install Lamp?" }).getByRole("button", { name: "Accept and install" }).click();
    const launcher = page.getByRole("navigation", { name: "Launcher" });
    await launcher.getByRole("listitem").filter({ hasText: "Lamp" }).getByRole("button", { name: "About" }).click();

    const about = page.getByRole("dialog", { name: "About Lamp" });
    assert.match(await about.innerText(), /2\.1\.0[\s\S]*@test\/lamp[\s\S]*A lamp that lights up\.[\s\S]*No network access/);
    await about.getByRole("button", { name: "User guide" }).click();

    const dialog = page.getByRole("dialog", { name: "Lamp: User guide" });
    const guide = page.frameLocator("iframe[title='Lamp: User guide']");
    await guide.getByRole("heading", { name: "Lamp", level: 1 }).waitFor();
    assert.equal(await guide.getByRole("img", { name: "The lamp" }).evaluate((image: HTMLImageElement) => image.naturalWidth), 120);
    await guide.getByText('<script>parent.document.title = "ran"</script>').waitFor();
    assert.notEqual(await page.title(), "ran");
    assert.equal(await guide.getByRole("link", { name: "Open-Meteo" }).getAttribute("target"), "_blank");

    // A #… link scrolls the guide to its heading, and does not load anything in its place.
    const top = () => guide.locator("#your-data").evaluate((heading) => heading.getBoundingClientRect().top);
    assert.ok((await top()) > 600, "the section starts below the fold");
    await guide.getByRole("link", { name: "Your data" }).click();
    for (let tries = 0; (await top()) > 100; tries++) {
      assert.ok(tries < 50, "the guide scrolls to the section");
      await page.waitForTimeout(100);
    }
    assert.equal(await guide.locator("body").evaluate(() => location.href), "about:srcdoc#your-data");

    await dialog.getByRole("button", { name: "Back" }).click();
    await about.getByRole("button", { name: "User guide" }).waitFor();
    await about.getByRole("button", { name: "Close" }).click();
    await about.waitFor({ state: "hidden" });
  });
});
