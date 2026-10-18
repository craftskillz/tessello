import assert from "node:assert/strict";
import { test } from "node:test";
import { dropFile, useHost, zip } from "./browser.ts";

const host = useHost();

test("the document of a View does not contain the Module's files, whatever their size", async () => {
  const page = await host.newPage();
  // About 9 MB of data the Module reads back, just under the 10 MB limit of a package.
  const big = new Uint8Array(9 * 1024 * 1024);
  for (let i = 0; i < big.length; i += 65_536) crypto.getRandomValues(big.subarray(i, i + 65_536));
  await dropFile(
    page,
    "big.zip",
    zip({
      "manifest.json": { convention: 1, id: "@test/big", name: "Big", version: "1.0.0", icon: "icon.svg", view: { entry: "index.html" } },
      "icon.svg": "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 1 1'/>",
      "big.bin": big,
      "index.html": `<!doctype html><p id="size"></p><script type="module">
        document.getElementById("size").textContent = (await (await fetch("big.bin")).arrayBuffer()).byteLength;
      </script>`,
    }),
  );
  await page.getByRole("dialog", { name: "Install Big?" }).getByRole("button", { name: "Install" }).click();

  await page.frameLocator("iframe[title='Big']").locator("#size").filter({ hasText: /\d/ }).waitFor();
  assert.equal(await page.frameLocator("iframe[title='Big']").locator("#size").innerText(), String(big.length));
  const srcdocLength = await page.locator("iframe[title='Big']").evaluate((iframe: HTMLIFrameElement) => iframe.srcdoc.length);
  assert.ok(srcdocLength < 16_000, `the srcdoc is ${srcdocLength} characters long`);
});
