import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { describe, test } from "node:test";
import { dropFile, showLauncher, useHost, zip } from "./browser.ts";

const host = useHost();

/** A page whose buttons hand the User a text file made in the Module's own opaque origin, as a blob: or a data: URL. */
const downloader = (title: string) => `<!doctype html><title>${title}</title>
<button id="blob">Download</button>
<button id="data">Download as data</button>
<output></output>
<script>
  parent.postMessage({ tessello: 1, type: "ready", id: "1" }, "*");
  const save = (href, name) => {
    const link = document.createElement("a");
    link.href = href;
    link.download = name;
    link.click();
    document.querySelector("output").textContent = "Asked for " + name;
  };
  document.querySelector("#blob").addEventListener("click", () => save(URL.createObjectURL(new Blob(["Hello from ${title}"], { type: "text/plain" })), "hello.txt"));
  document.querySelector("#data").addEventListener("click", () => save("data:text/plain,Hello%20as%20data", "data.txt"));
</script>`;

const DOWNLOADER = zip({
  "manifest.json": {
    convention: 1,
    id: "@test/downloader",
    name: "Downloader",
    version: "1.0.0",
    icon: "icon.svg",
    guide: "guide.md",
    view: { entry: "index.html" },
    widget: { entry: "widget.html", size: "M" },
  },
  "icon.svg": "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 1 1'/>",
  "guide.md": "# Guide",
  "index.html": downloader("the View"),
  "widget.html": downloader("the Widget"),
});

describe("downloads", () => {
  test("a View hands the User a file it made, from a blob: or a data: URL of its opaque origin", async () => {
    const page = await host.newPage();
    await dropFile(page, "downloader.zip", DOWNLOADER);
    await page.getByRole("dialog", { name: "Install Downloader?" }).getByRole("button", { name: "Accept and install" }).click();

    const view = page.frameLocator("iframe[title='Downloader']");
    const download = async (button: string) => {
      const [file] = await Promise.all([page.waitForEvent("download"), view.getByRole("button", { name: button, exact: true }).click()]);
      return { name: file.suggestedFilename(), content: await readFile((await file.path())!, "utf8") };
    };
    assert.deepEqual(await download("Download"), { name: "hello.txt", content: "Hello from the View" });
    assert.deepEqual(await download("Download as data"), { name: "data.txt", content: "Hello as data" });
  });

  test("a Widget cannot download: a file comes from a gesture in the View", async () => {
    const page = await host.newPage();
    await dropFile(page, "downloader.zip", DOWNLOADER);
    await page.getByRole("dialog", { name: "Install Downloader?" }).getByRole("button", { name: "Accept and install" }).click();
    await (await showLauncher(page)).getByRole("button", { name: "Tessello" }).click();

    const downloads: string[] = [];
    page.on("download", (download) => downloads.push(download.suggestedFilename()));
    const widget = page.frameLocator("iframe[title='Downloader widget']");
    await widget.getByRole("button", { name: "Download", exact: true }).click();
    await widget.getByText("Asked for hello.txt").waitFor();
    // A blocked download leaves no event to wait for: the View's download, asked for afterwards, is the one that does.
    // Download events arrive in the order the downloads start, so if the Widget's had started, it would be listed first.
    await (await showLauncher(page)).getByRole("button", { name: "Downloader" }).click();
    const [viewDownload] = await Promise.all([
      page.waitForEvent("download"),
      page.frameLocator("iframe[title='Downloader']").getByRole("button", { name: "Download", exact: true }).click(),
    ]);
    assert.equal(await readFile((await viewDownload.path())!, "utf8"), "Hello from the View");
    assert.deepEqual(downloads, ["hello.txt"], "only the View's download arrived");
    assert.equal(await page.locator("iframe[title='Downloader widget']").getAttribute("sandbox"), "allow-scripts allow-forms allow-popups allow-popups-to-escape-sandbox");
  });
});
