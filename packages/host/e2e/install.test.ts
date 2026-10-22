import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { dropFile, showLauncher, useHost, zip, zipExample } from "./browser.ts";

const host = useHost();

describe("installing a Module", () => {
  test("dropping Notes shows its Manifest, then installs it in the Launcher and opens its View in a sandboxed iframe", async () => {
    const page = await host.newPage();
    await dropFile(page, "notes.zip", await zipExample("notes"));

    const preview = page.getByRole("dialog", { name: "Install Notes?" });
    await preview.waitFor();
    assert.match(await preview.innerText(), /Notes[\s\S]*1\.1\.0[\s\S]*@craftskillz\/notes[\s\S]*Jot down short notes/);
    assert.equal(await preview.getByRole("img", { name: "Notes icon" }).evaluate((img: HTMLImageElement) => img.naturalWidth > 0), true);
    const launcher = await showLauncher(page);
    assert.equal(await launcher.getByRole("button", { name: "Notes" }).count(), 0, "nothing is installed before confirming");

    await preview.getByRole("button", { name: "Accept and install" }).click();
    await (await showLauncher(page)).getByRole("button", { name: "Notes" }).click();

    const iframe = page.locator("iframe[title='Notes']");
    assert.equal(await iframe.getAttribute("sandbox"), "allow-scripts allow-forms allow-popups allow-popups-to-escape-sandbox allow-downloads");
    await page.frameLocator("iframe[title='Notes']").getByRole("heading", { name: "Notes" }).waitFor();
    await page.frameLocator("iframe[title='Notes']").getByText("No notes yet.").waitFor();
  });

  test("a non-compliant Module is refused with the Validator's report, and nothing is installed", async () => {
    const page = await host.newPage();
    const broken = zip({
      "manifest.json": { convention: 1, id: "Notes", name: "Notes", version: "1.0", icon: "icon.svg", view: { entry: "view/index.html" } },
      "icon.svg": "<svg xmlns='http://www.w3.org/2000/svg'/>",
    });
    await dropFile(page, "broken.zip", broken);

    const report = page.getByRole("dialog", { name: "broken.zip can't be installed" });
    await report.waitFor();
    const text = await report.innerText();
    for (const code of ["manifest/invalid-id", "manifest/invalid-version", "manifest/file-not-found"]) {
      assert.match(text, new RegExp(`\\[${code}\\]`));
    }
    assert.equal(await report.getByRole("button", { name: "Install" }).count(), 0);
    await report.getByRole("button", { name: "Close" }).click();

    await page.reload();
    assert.equal(await (await showLauncher(page)).getByRole("listitem").count(), 0);
  });
});

describe("persistence", () => {
  test("installed Modules and their data are still there after a reload", async () => {
    const page = await host.newPage();
    await dropFile(page, "notes.zip", await zipExample("notes"));
    await page.getByRole("dialog", { name: "Install Notes?" }).getByRole("button", { name: "Accept and install" }).click();
    const notes = page.frameLocator("iframe[title='Notes']");
    await notes.getByRole("textbox", { name: "New note" }).fill("Buy oat milk");
    await notes.getByRole("button", { name: "Add note" }).click();
    await notes.getByText("Buy oat milk").waitFor();
    await notes.getByRole("textbox", { name: "New note" }).fill("Call the plumber");
    await notes.getByRole("button", { name: "Add note" }).click();
    await notes.getByText("Call the plumber").waitFor();

    await page.reload();
    await (await showLauncher(page)).getByRole("button", { name: "Notes" }).click();
    await notes.getByText("Call the plumber").waitFor();
    assert.deepEqual(await notes.getByRole("listitem").allInnerTexts().then((items) => items.map((item) => item.split("\n")[0])), [
      "Call the plumber",
      "Buy oat milk",
    ]);
  });
});
