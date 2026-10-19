import assert from "node:assert/strict";
import { test } from "node:test";
import { dropFile, useHost, zip } from "./browser.ts";

const host = useHost();

// 1×1 PNG.
const DOT = Uint8Array.from(
  atob("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII="),
  (char) => char.charCodeAt(0),
);

// A View that loads its package files in every way a Module may, and writes what it got into #results.
const FIXTURE = {
  "manifest.json": { convention: 1, id: "@test/files", name: "Files", version: "1.0.0", icon: "icon.svg", guide: "guide.md", view: { entry: "view/index.html" } },
  "icon.svg": "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 1 1'/>", "guide.md": "# Guide",
  "img/dot.png": DOT,
  "view/index.html": `<!doctype html>
    <link rel="stylesheet" href="css/style.css">
    <div id="styled"></div>
    <img id="static" src="../img/dot.png" alt="">
    <img id="srcset" srcset="../img/dot.png 1x" alt="">
    <a id="hash" href="#section">Section</a>
    <pre id="results"></pre>
    <script type="module" src="app.js"></script>`,
  "view/css/style.css": `@import "theme.css";\n#styled { width: 42px; background-image: url("../../img/dot.png"); }`,
  "view/css/theme.css": ":root { --probe: imported; }",
  "view/lib/index.js": `export { double } from "./math.js";\nexport * from "./more.js";\n// import "./commented-out.js";`,
  "view/lib/math.js": "export const double = (n) => n * 2;",
  "view/lib/more.js": "export const triple = (n) => n * 3;",
  "view/lib/dynamic.js": "export const value = 'dynamic';",
  "view/data/info.json": `{ "answer": 42 }`,
  "view/worker.js": "onmessage = (event) => postMessage(event.data + ' pong');",
  "view/app.js": `
    import { double, triple } from "./lib/index.js";
    const results = {};
    const loaded = (img) => img.complete && img.naturalWidth ? img.naturalWidth : new Promise((resolve) => {
      img.onload = () => resolve(img.naturalWidth);
      img.onerror = () => resolve("error");
    });
    results.reexports = double(2) + triple(1);
    const styled = getComputedStyle(document.getElementById("styled"));
    results.stylesheet = styled.width;
    results.cssUrl = styled.backgroundImage.startsWith('url("blob:');
    results.cssImport = getComputedStyle(document.documentElement).getPropertyValue("--probe").trim();
    results.staticImage = await loaded(document.getElementById("static"));
    results.srcset = await loaded(document.getElementById("srcset"));
    results.fetch = (await (await fetch("data/info.json")).json()).answer;
    results.missingFile = (await fetch("data/missing.json")).status;
    results.dynamicImport = (await import("./lib/dynamic.js")).value;
    const metaImage = document.createElement("img");
    document.body.append(metaImage);
    metaImage.src = new URL("../img/dot.png", import.meta.url);
    results.importMetaUrl = await loaded(metaImage);
    const detached = new Image();
    detached.src = "../img/dot.png";
    results.detachedImage = await loaded(detached);
    const worker = new Worker("worker.js");
    results.worker = await new Promise((resolve) => { worker.onmessage = (event) => resolve(event.data); worker.postMessage("ping"); });
    document.getElementById("hash").click();
    results.hashLink = location.hash;
    document.getElementById("results").textContent = JSON.stringify(results);
    parent.postMessage({ tessello: 1, type: "ready", id: "ready" }, "*");
  `,
};

test("a View loads its package's stylesheets, images, modules, data files and Workers without touching the network", async () => {
  const page = await host.newPage();
  const requests: string[] = [];
  page.on("request", (request) => requests.push(request.url()));
  await dropFile(page, "files.zip", zip(FIXTURE));
  await page.getByRole("dialog", { name: "Install Files?" }).getByRole("button", { name: "Accept and install" }).click();

  const results = page.frameLocator("iframe[title='Files']").locator("#results");
  await results.filter({ hasText: "{" }).waitFor();
  assert.deepEqual(JSON.parse(await results.innerText()), {
    reexports: 7,
    stylesheet: "42px",
    cssUrl: true,
    cssImport: "imported",
    staticImage: 1,
    srcset: 1,
    fetch: 42,
    missingFile: 404,
    dynamicImport: "dynamic",
    importMetaUrl: 1,
    detachedImage: 1,
    worker: "ping pong",
    hashLink: "#section",
  });
  const network = requests.filter((url) => /^(https?|wss?):/.test(url));
  assert.deepEqual(network.filter((url) => !url.startsWith(host.url)), [], "no request leaves the Host");
  assert.deepEqual(
    network.map((url) => new URL(url).pathname).filter((path) => !["/", "/main.js", "/style.css"].includes(path)),
    [],
    "no package file is requested from the Host's server",
  );
});

test("the View's Content Security Policy still applies once the loader has written its document", async () => {
  const page = await host.newPage();
  const requests: string[] = [];
  page.on("request", (request) => requests.push(request.url()));
  const probe = `${host.url}csp-probe`;
  await dropFile(
    page,
    "probe.zip",
    zip({
      "manifest.json": { convention: 1, id: "@test/probe", name: "Probe", version: "1.0.0", icon: "icon.svg", guide: "guide.md", view: { entry: "index.html" } },
      "icon.svg": "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 1 1'/>", "guide.md": "# Guide",
      "index.html": `<!doctype html><pre id="result"></pre><script type="module">
        let result;
        try { await fetch(${JSON.stringify(probe)}); result = "reached"; } catch { result = "blocked"; }
        document.getElementById("result").textContent = result;
      </script>`,
    }),
  );
  await page.getByRole("dialog", { name: "Install Probe?" }).getByRole("button", { name: "Accept and install" }).click();

  const result = page.frameLocator("iframe[title='Probe']").locator("#result");
  await result.filter({ hasText: /\w/ }).waitFor();
  assert.equal(await result.innerText(), "blocked");
  assert.deepEqual(requests.filter((url) => url.startsWith(probe)), []);
});
