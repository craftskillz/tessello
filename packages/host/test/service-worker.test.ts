import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { shellKeyOf } from "../src/service-worker.ts";

const scope = "https://tessello.example/app/";
const shell = ["index.html", "main.js", "style.css", "manifest.webmanifest", "icon.svg"];
const shellKeyFor = (url: string, method = "GET", mode = "no-cors") => shellKeyOf({ url, method, mode }, scope, shell);

describe("the requests the service worker answers from the shell cache", () => {
  test("a navigation to the Host, whatever its query or hash, is answered with index.html", () => {
    for (const url of [scope, `${scope}?a=1`, `${scope}#install=https%3A%2F%2Fx.test%2Fm.zip`, `${scope}index.html`]) {
      assert.equal(shellKeyFor(url, "GET", "navigate"), `${scope}index.html`);
    }
  });

  test("a shell file is answered with itself", () => {
    assert.equal(shellKeyFor(`${scope}main.js`, "GET", "cors"), `${scope}main.js`);
    assert.equal(shellKeyFor(`${scope}icon.svg?v=2`), `${scope}icon.svg`);
    assert.equal(shellKeyFor(`${scope}manifest.webmanifest`), `${scope}manifest.webmanifest`);
  });
});

describe("the requests the service worker leaves alone", () => {
  test("cross-origin requests, including navigations", () => {
    assert.equal(shellKeyFor("https://tessello-marketplace.pages.dev/index.json", "GET", "cors"), null);
    assert.equal(shellKeyFor("https://other.example/app/main.js"), null);
    assert.equal(shellKeyFor("https://other.example/app/", "GET", "navigate"), null);
  });

  test("non-GET requests", () => {
    assert.equal(shellKeyFor(`${scope}main.js`, "POST"), null);
    assert.equal(shellKeyFor(scope, "POST", "navigate"), null);
  });

  test("same-origin paths outside the shell", () => {
    assert.equal(shellKeyFor(`${scope}main.js.map`, "GET", "cors"), null);
    assert.equal(shellKeyFor(`${scope}sw.js`), null);
    assert.equal(shellKeyFor(`${scope}_headers`), null);
  });

  test("a navigation to another page the Host's site serves, such as a text file", () => {
    assert.equal(shellKeyFor(`${scope}skill.md`, "GET", "navigate"), null);
    assert.equal(shellKeyFor(`${scope}other/page`, "GET", "navigate"), null);
  });

  test("anything outside the scope", () => {
    assert.equal(shellKeyFor("https://tessello.example/main.js"), null);
    assert.equal(shellKeyFor("https://tessello.example/", "GET", "navigate"), null);
  });
});
