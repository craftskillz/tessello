import assert from "node:assert/strict";
import { test } from "node:test";
import { dropFile, readFolder, useHost, zip } from "./browser.ts";

const host = useHost();

// 256 characters (UTF-16 code units, as the Convention counts them) mixing capitals, separators and emoji.
const LONG_KEY = `Ab/.~%é :${"🙂".repeat(120)}${"Z".repeat(7)}`;
assert.equal(LONG_KEY.length, 256);
const VALUES: Record<string, unknown> = { A: "capital", a: "small", con: "a name Windows reserves", notes: [{ id: 1, text: "Buy oat milk" }], [LONG_KEY]: { long: true } };

// Writes VALUES when its storage is empty, then shows every key and its value, read back from the Host.
const FIXTURE = {
  "manifest.json": { convention: 1, id: "@test/keys", name: "Keys", version: "1.0.0", icon: "icon.svg", view: { entry: "index.html" } },
  "icon.svg": "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 1 1'/>",
  "index.html": `<!doctype html><pre id="results"></pre><script type="module">
    const call = (type, payload) => new Promise((resolve) => {
      const id = Math.random().toString(36).slice(2);
      addEventListener("message", function listener(event) {
        if (event.data?.id !== id) return;
        removeEventListener("message", listener);
        resolve(event.data.result);
      });
      parent.postMessage({ tessello: 1, type, id, payload }, "*");
    });
    await call("ready", {});
    if ((await call("storage.keys", {})).keys.length === 0) {
      for (const [key, value] of Object.entries(${JSON.stringify(VALUES)})) await call("storage.set", { key, value });
    }
    const results = {};
    for (const key of (await call("storage.keys", {})).keys.sort()) results[key] = (await call("storage.get", { key })).value;
    document.getElementById("results").textContent = JSON.stringify(results);
  </script>`,
};

test("a Module's storage is one indented JSON file per key under .tessello/data/, whatever the case or length of the key, or a name Windows reserves", async () => {
  const page = await host.newPage();
  await dropFile(page, "keys.zip", zip(FIXTURE));
  await page.getByRole("dialog", { name: "Install Keys?" }).getByRole("button", { name: "Install" }).click();
  const results = page.frameLocator("iframe[title='Keys']").locator("#results");
  await results.filter({ hasText: "{" }).waitFor();

  const files = await readFolder(page, "modules/.tessello/data/@test/keys");
  const names = Object.keys(files);
  assert.equal(names.length, 5, "one file per key");
  assert.equal(new Set(names.map((name) => name.toLowerCase())).size, 5, "no two names differ only in case");
  assert.ok(!names.includes("con.json"), "no name Windows reserves");
  for (const name of names) assert.ok(new TextEncoder().encode(name).length <= 255, `${name} fits in a file name`);
  assert.deepEqual(
    Object.fromEntries(Object.values(files).map((content) => [JSON.parse(content).key, JSON.parse(content).value])),
    VALUES,
  );
  assert.equal(files["notes.json"], `{\n  "key": "notes",\n  "value": [\n    {\n      "id": 1,\n      "text": "Buy oat milk"\n    }\n  ]\n}\n`);

  await page.reload();
  await page.getByRole("navigation", { name: "Launcher" }).getByRole("button", { name: "Keys" }).click();
  await results.filter({ hasText: "{" }).waitFor();
  const sorted = Object.fromEntries(Object.keys(VALUES).sort().map((key) => [key, VALUES[key]]));
  assert.deepEqual(JSON.parse(await results.innerText()), sorted);
});
