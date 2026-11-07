import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { dropFile, showLauncher, useHost, zip } from "./browser.ts";

const host = useHost();

/** A page whose button copies a text with `navigator.clipboard.writeText`, then says how it went. */
const copier = (title: string) => `<!doctype html><title>${title}</title>
<button id="copy">Copy</button>
<output></output>
<script>
  parent.postMessage({ tessello: 1, type: "ready", id: "1" }, "*");
  document.querySelector("#copy").addEventListener("click", () =>
    navigator.clipboard.writeText("Copied from ${title}").then(
      () => (document.querySelector("output").textContent = "copied"),
      (error) => (document.querySelector("output").textContent = "refused: " + error.name),
    ),
  );
</script>`;

const COPIER = zip({
  "manifest.json": {
    convention: 1,
    id: "@test/copier",
    name: "Copier",
    version: "1.0.0",
    icon: "icon.svg",
    guide: "guide.md",
    view: { entry: "index.html" },
    widget: { entry: "widget.html", size: "M" },
  },
  "icon.svg": "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 1 1'/>",
  "guide.md": "# Guide",
  "index.html": copier("the View"),
  "widget.html": copier("the Widget"),
});

describe("clipboard", () => {
  test("a View and a Widget copy a text to the User's clipboard", async () => {
    const page = await host.newPage();
    // Lets the test read the clipboard back; the Module only writes.
    await page.context().grantPermissions(["clipboard-read", "clipboard-write"]);
    await dropFile(page, "copier.zip", COPIER);
    await page.getByRole("dialog", { name: "Install Copier?" }).getByRole("button", { name: "Accept and install" }).click();

    const copy = async (frame: string) => {
      const module = page.frameLocator(`iframe[title='${frame}']`);
      await module.getByRole("button", { name: "Copy", exact: true }).click();
      await module.locator("output").filter({ hasText: /copied|refused/ }).waitFor();
      return { output: await module.locator("output").innerText(), clipboard: await page.evaluate(() => navigator.clipboard.readText()) };
    };
    assert.deepEqual(await copy("Copier"), { output: "copied", clipboard: "Copied from the View" });

    await (await showLauncher(page)).getByRole("button", { name: "Tessello" }).click();
    assert.deepEqual(await copy("Copier widget"), { output: "copied", clipboard: "Copied from the Widget" });
  });
});
