import assert from "node:assert/strict";
import { describe, test } from "node:test";
import type { Page } from "playwright";
import { chooseFolder, installLink, showLauncher, showLauncherTools, useHost, usePackageServer, zipExample } from "./browser.ts";

const host = useHost();
const packages = usePackageServer();


/** Pastes a URL in the field "Install from a URL" and starts the download. */
async function installFromUrl(page: Page, url: string) {
  await (await showLauncherTools(page)).getByRole("button", { name: "Install from a URL…" }).click();
  const form = page.getByRole("dialog", { name: "Install from a URL" });
  await form.getByRole("textbox", { name: "URL of the .zip file" }).fill(url);
  await form.getByRole("button", { name: "Download" }).click();
}

describe("installing a Module from a URL", () => {
  test("the package is downloaded, then the usual Accept screen shows its URL under the Module, and installs it", async () => {
    const page = await host.newPage();
    const { cors } = packages.serve("notes.zip", await zipExample("notes"));
    await installFromUrl(page, cors);

    const preview = page.getByRole("dialog", { name: "Install Notes?" });
    await preview.waitFor();
    assert.match(await preview.innerText(), new RegExp(`Notes[\\s\\S]*1\\.1\\.0[\\s\\S]*@craftskillz/notes[\\s\\S]*${cors.replaceAll(".", "\\.")}`));
    await preview.getByRole("button", { name: "Accept and install" }).click();

    await page.frameLocator("iframe[title='Notes']").getByText("No notes yet.").waitFor();
    assert.equal(await (await showLauncher(page)).getByRole("button", { name: "Notes" }).count(), 1);
  });

  test("a server that sends no CORS header gives one message, which offers to download the .zip and drop it", async () => {
    const page = await host.newPage();
    const { noCors } = packages.serve("notes.zip", await zipExample("notes"));
    await installFromUrl(page, noCors);

    const message = page.getByRole("dialog", { name: "notes.zip can't be downloaded" });
    await message.waitFor();
    assert.match(await message.innerText(), /unreachable, or it does not allow Tessello to download the file/);
    assert.equal(await message.getByRole("link", { name: "Download the .zip file" }).getAttribute("href"), noCors);
    assert.match(await message.innerText(), /drop it on Tessello/);
    assert.equal(await (await showLauncher(page)).getByRole("listitem").count(), 0);
  });

  test("a download beyond the package size limit is stopped, and refused with package/too-large", async () => {
    const page = await host.newPage();
    await installFromUrl(page, `${packages.url}/huge.zip`);

    const report = page.getByRole("dialog", { name: "huge.zip can't be installed" });
    await report.waitFor();
    assert.match(await report.innerText(), /\[package\/too-large\]/);
    assert.equal(await (await showLauncher(page)).getByRole("listitem").count(), 0);
  });

  test("a URL that is neither https: nor a Creator's localhost is refused with an explanation, before any request", async () => {
    const page = await host.newPage();
    const requested: string[] = [];
    page.on("request", (request) => requested.push(request.url()));
    await installFromUrl(page, "http://example.com/notes.zip");

    const form = page.getByRole("dialog", { name: "Install from a URL" });
    await form.getByRole("alert").waitFor();
    assert.match(await form.getByRole("alert").innerText(), /only over https:/);
    assert.deepEqual(requested.filter((url) => url.includes("example.com")), []);
  });
});

describe("an install link", () => {
  test("opened with the Modules folder ready, it shows the Module ready to install, and leaves the address", async () => {
    const page = await host.newPage();
    const { cors } = packages.serve("notes.zip", await zipExample("notes"));
    await page.goto("about:blank");
    await page.goto(host.url + installLink(cors));

    const preview = page.getByRole("dialog", { name: "Install Notes?" });
    await preview.waitFor();
    assert.match(await preview.innerText(), new RegExp(cors.replaceAll(".", "\\.")));
    assert.equal(page.url(), host.url, "the link is removed from the address");
    assert.equal(await (await showLauncher(page)).getByRole("button", { name: "Notes" }).count(), 0, "nothing is installed before accepting");

    await page.reload();
    await (await showLauncher(page)).waitFor();
    assert.equal(await page.getByRole("dialog").isVisible(), false, "a reload does not install again");
  });

  test("opened before the Modules folder is chosen, it is kept while the User chooses it, then downloaded", async () => {
    const { cors } = packages.serve("notes.zip", await zipExample("notes"));
    const page = await host.newPage({ choose: false, hash: installLink(cors) });
    await page.getByRole("heading", { name: "Choose your Modules folder" }).waitFor();
    assert.match(await page.locator("#gate").innerText(), new RegExp(`downloads the Module at ${cors.replaceAll(".", "\\.")}`));

    await chooseFolder(page);
    await page.getByRole("dialog", { name: "Install Notes?" }).getByRole("button", { name: "Accept and install" }).click();
    await page.frameLocator("iframe[title='Notes']").getByText("No notes yet.").waitFor();
  });

  test("opened in a tab where the Host already runs, it shows the Module ready to install", async () => {
    const page = await host.newPage();
    const { cors } = packages.serve("notes.zip", await zipExample("notes"));
    await page.evaluate((hash) => (location.hash = hash), installLink(cors));
    await page.getByRole("dialog", { name: "Install Notes?" }).waitFor();
  });

  test("with a URL that is not https:, it is refused with an explanation, before any request", async () => {
    const page = await host.newPage({ hash: installLink("file:///Users/me/notes.zip") });
    const message = page.getByRole("dialog", { name: "This install link can't be used" });
    await message.waitFor();
    assert.match(await message.innerText(), /only over https:/);
  });

  test("in a browser that cannot open the Modules folder, it says why, names the Module's URL and copies the link", async () => {
    const { cors } = packages.serve("notes.zip", await zipExample("notes"));
    const page = await host.newPage({ unsupported: true, hash: installLink(cors) });
    await page.context().grantPermissions(["clipboard-read", "clipboard-write"]);
    await page.getByRole("heading", { name: "This browser can't open your Modules folder" }).waitFor();
    const text = await page.locator("#gate").innerText();
    assert.match(text, /does not let a web page use a folder of your computer, whereas Chrome and Edge on a computer do/);
    assert.match(text, new RegExp(cors.replaceAll(".", "\\.")));

    await page.getByRole("button", { name: "Copy the install link" }).click();
    await page.getByRole("button", { name: "Install link copied" }).waitFor();
    assert.equal(await page.evaluate(() => navigator.clipboard.readText()), host.url + installLink(cors));
  });
});
