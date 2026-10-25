import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { dropFile, showLauncher, useHost, zipExample } from "./browser.ts";

const host = useHost();

describe("the Host as a PWA", () => {
  test("is installable: its manifest parses without errors and its icon is served", async () => {
    const page = await host.newPage();
    const cdp = await page.context().newCDPSession(page);
    const { errors, url } = await cdp.send("Page.getAppManifest");
    assert.deepEqual(errors, []);
    const { installabilityErrors } = await cdp.send("Page.getInstallabilityErrors");
    assert.deepEqual(installabilityErrors, []);
    const manifest = await (await page.request.get(url!)).json();
    const icon = await page.request.get(new URL(manifest.icons[0].src, url).href);
    assert.equal(icon.status(), 200);
    assert.equal(icon.headers()["content-type"], "image/svg+xml");
  });

  test("opens offline with the Modules already installed", async () => {
    const page = await host.newPage();
    await dropFile(page, "Notes.zip", await zipExample("notes"));
    await page.getByRole("dialog", { name: "Install Notes?" }).getByRole("button", { name: "Accept and install" }).click();
    await page.locator("iframe[title='Notes']").waitFor();
    await page.waitForFunction(() => navigator.serviceWorker?.controller);

    await page.context().setOffline(true);
    const response = await page.reload();
    assert.equal(response?.fromServiceWorker(), true);
    // The cached page keeps the header that stops a Module from navigating its iframe away (ADR 0005).
    assert.equal(response?.headers()["content-security-policy"], "frame-src 'none'");
    const launcher = await showLauncher(page);
    await launcher.getByRole("button", { name: "Notes" }).click();
    await page.locator("iframe[title='Notes']").waitFor();
  });
});
