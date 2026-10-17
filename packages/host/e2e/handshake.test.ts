import assert from "node:assert/strict";
import { test } from "node:test";
import { dropFile, useHost, zip } from "./browser.ts";

const host = useHost();

test("a View that does not send ready within 10 seconds is replaced by an error, and the Host keeps working", async () => {
  const page = await host.newPage();
  await page.clock.install();
  await page.reload();
  const silent = zip({
    "manifest.json": { convention: 1, id: "@test/silent", name: "Silent", version: "1.0.0", icon: "icon.svg", view: { entry: "index.html" } },
    "icon.svg": "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 1 1'/>",
    "index.html": "<!doctype html><p>I never say hello.</p>",
  });
  await dropFile(page, "silent.zip", silent);
  await page.getByRole("dialog", { name: "Install Silent?" }).getByRole("button", { name: "Install" }).click();
  const frame = await (await page.locator("iframe[title='Silent']").elementHandle())!.contentFrame();
  await frame!.waitForLoadState("load");
  await frame!.getByText("I never say hello.").waitFor();

  await page.clock.runFor(9_900);
  assert.equal(await page.getByRole("alert").count(), 0);
  await page.clock.runFor(100);
  await page.getByRole("alert").getByText("Silent is not responding").waitFor();
  assert.equal(await page.locator("iframe[title='Silent']").count(), 0);

  await page.getByRole("button", { name: "Tessello" }).click();
  await page.getByRole("heading", { name: "Your space is ready" }).waitFor();
});
