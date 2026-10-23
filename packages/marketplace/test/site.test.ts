import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { describe, test } from "node:test";
import { strToU8, zipSync } from "fflate";
import { buildIndex, permissionFilter, renderSite, type Entry, type EntryVersion } from "../src/index.ts";

const READY_VIEW = `<!doctype html><script>parent.postMessage({ tessello: 1, type: "ready", id: "1" }, "*")</script>`;
const PNG = Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3]);
const HOST = "https://tessello.app/";

const sha256 = (bytes: Uint8Array) => createHash("sha256").update(bytes).digest("hex");

/** A real, valid Module package whose Manifest can be overridden. */
function zip(id: string, version: string, manifest: Record<string, unknown> = {}, guide = "# Guide\n\nHello.\n"): Uint8Array {
  return zipSync({
    "manifest.json": strToU8(
      JSON.stringify({ convention: 1, id, name: "Weather", version, icon: "icon.svg", view: { entry: "view/index.html" }, guide: "guide.md", ...manifest }),
    ),
    "icon.svg": strToU8("<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 1 1'/>"),
    "view/index.html": strToU8(READY_VIEW),
    "widget/index.html": strToU8(READY_VIEW),
    "guide.md": strToU8(guide),
    "docs/shot.png": PNG,
  });
}

const listed = (id: string, version: string, bytes: Uint8Array, extra: Partial<EntryVersion> = {}): EntryVersion => ({
  version,
  url: `https://example.org/${id.slice(1).replace("/", "-")}-${version}.zip`,
  sha256: sha256(bytes),
  ...extra,
});

interface Fixture {
  entry: Entry;
  /** The package of the entry's only version; absent means a version-less Module is not built from it. */
  bytes?: Uint8Array;
  files?: Map<string, Uint8Array>;
}

/** The pages of a site built from fixtures, through buildIndex like the real Generator. */
async function site(fixtures: Fixture[]): Promise<Map<string, string>> {
  const { index } = await buildIndex({
    listings: fixtures.map(({ entry, files }) => ({ entry, files: files ?? new Map() })),
    packages: new Map(fixtures.flatMap(({ entry, bytes }) => (bytes ? [[`${entry.id}@${entry.versions[0]?.version}`, bytes] as const] : []))),
    generatedAt: new Date("2026-05-01T08:30:00Z"),
  });
  return renderSite(index, { hostUrl: HOST });
}

const WEATHER = zip("@yassine/weather", "1.0.0", { name: "Weather", description: "Forecasts for your cities." });
const fixture = (id: string, bytes: Uint8Array, overrides: Partial<Entry> = {}): Fixture => ({
  bytes,
  entry: { id, source: `https://github.com/${id.slice(1).split("/")[0]}/repo`, license: "MIT", versions: [listed(id, "1.0.0", bytes)], ...overrides },
});
const page = (pages: Map<string, string>, path: string): string => {
  const html = pages.get(path);
  assert.ok(html !== undefined, `no page ${path}`);
  return html;
};

describe("the Permission filter", () => {
  test("maps each choice of the select to the Permissions the User accepts", () => {
    assert.equal(permissionFilter("any"), undefined);
    assert.deepEqual(permissionFilter("no-internet"), ["localNetwork"]);
    assert.deepEqual(permissionFilter("no-local-network"), ["network"]);
    assert.deepEqual(permissionFilter("none"), []);
    assert.equal(permissionFilter("unknown"), undefined);
  });
});

describe("the list page", () => {
  test("shows a card for each listed Module, and none for a banned, withdrawn or version-less one", async () => {
    const pages = await site([
      fixture("@yassine/weather", WEATHER),
      fixture("@yassine/banned", zip("@yassine/banned", "1.0.0"), { banned: "malware" }),
      fixture("@yassine/gone", zip("@yassine/gone", "1.0.0"), { withdrawn: true }),
      { entry: { id: "@yassine/empty", source: "https://github.com/yassine/repo", license: "MIT", versions: [] } },
    ]);
    const html = page(pages, "index.html");
    assert.deepEqual([...html.matchAll(/data-id="([^"]+)"/g)].map((m) => m[1]), ["@yassine/weather"]);
    assert.match(html, /Forecasts for your cities\./);
  });
});

describe("the list page cards and controls", () => {
  test("each card links to its page and its icon with relative URLs, and shows creator and tags", async () => {
    const pages = await site([fixture("@yassine/weather", WEATHER, { tags: ["forecast", "city"] })]);
    const html = page(pages, "index.html");
    assert.match(html, /<a [^>]*href="modules\/yassine\/weather\/index\.html"/);
    assert.match(html, /<img [^>]*src="modules\/yassine\/weather\/1\.0\.0\/icon\.svg"/);
    assert.match(html, /@yassine/);
    assert.match(html, /forecast/);
    assert.doesNotMatch(html, /(?:href|src)="(?:\/|https?:)/);
  });

  test("offers a search field, the Permission filter, an empty-results message, the generation date and the script", async () => {
    const html = page(await site([fixture("@yassine/weather", WEATHER)]), "index.html");
    assert.match(html, /<input [^>]*type="search"/);
    for (const [value, label] of [["any", "Any Permissions"], ["no-internet", "No internet access"], ["no-local-network", "No local network access"], ["none", "No Permissions"]]) {
      assert.match(html, new RegExp(`<option value="${value}"[^>]*>${label}</option>`));
    }
    assert.match(html, /id="empty" hidden/);
    assert.match(html, /2026-05-01/);
    assert.match(html, /<script type="module" src="search\.js"><\/script>/);
    assert.match(html, /<link rel="stylesheet" href="style\.css">/);
  });
});

describe("the Content Security Policy", () => {
  test("every page forbids inline styles and scripts and any third party, and has none of them", async () => {
    const pages = await site([fixture("@yassine/weather", WEATHER), fixture("@yassine/banned", zip("@yassine/banned", "1.0.0"), { banned: "x" })]);
    const html = [...pages].filter(([path]) => path.endsWith(".html"));
    assert.equal(html.length, 3);
    for (const [path, content] of html) {
      assert.ok(
        content.includes(`<meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src 'self'; style-src 'self'; script-src 'self'; connect-src 'self'">`),
        path,
      );
      assert.doesNotMatch(content, /<style|\sstyle=|\sonsubmit=|\sonclick=|<script(?![^>]*\ssrc=)/, path);
    }
  });
});

const GUIDE = "# Weather\n\nSee the forecast.\n\n![Forecast](docs/shot.png)\n";
const FULL = zip(
  "@yassine/weather",
  "1.2.0",
  {
    name: "Weather",
    description: "Forecasts for your cities.",
    permissions: { network: ["https://api.weather.example"] },
    widget: { entry: "widget/index.html", size: "M" },
  },
  GUIDE,
);
const fullFixture = (overrides: Partial<Entry> = {}): Fixture => ({
  bytes: FULL,
  entry: {
    id: "@yassine/weather",
    source: "https://github.com/yassine/weather",
    license: "MIT",
    tags: ["forecast"],
    screenshots: ["canvas.png"],
    versions: [listed("@yassine/weather", "1.2.0", FULL)],
    ...overrides,
  },
  files: new Map([["canvas.png", PNG]]),
});
const WEATHER_PAGE = "modules/yassine/weather/index.html";

describe("the page of a listed Module", () => {
  test("shows the fiche: name, creator, version, description, licence, source, Permissions, Widget, tags and screenshots", async () => {
    const html = page(await site([fullFixture()]), WEATHER_PAGE);
    assert.match(html, /<h1>Weather<\/h1>/);
    assert.match(html, /@yassine/);
    assert.match(html, /1\.2\.0/);
    assert.match(html, /Forecasts for your cities\./);
    assert.match(html, /MIT/);
    assert.match(html, /<a href="https:\/\/github\.com\/yassine\/weather"/);
    assert.match(html, /network[\s\S]*https:\/\/api\.weather\.example/);
    assert.match(html, /Widget[\s\S]*\bM\b/);
    assert.match(html, /forecast/);
    assert.match(html, /<img [^>]*src="\.\.\/\.\.\/\.\.\/modules\/yassine\/weather\/canvas\.png"/);
    assert.match(html, /<img [^>]*src="\.\.\/\.\.\/\.\.\/modules\/yassine\/weather\/1\.2\.0\/icon\.svg"/);
    assert.match(html, /<link rel="stylesheet" href="\.\.\/\.\.\/\.\.\/style\.css">/);
  });

  test("says so when the Module has no Permission and no Widget", async () => {
    const bytes = zip("@yassine/weather", "1.0.0");
    const html = page(await site([fixture("@yassine/weather", bytes)]), WEATHER_PAGE);
    assert.match(html, /No Permissions/);
    assert.match(html, /No Widget/);
  });

  test("renders the User guide, its images pointing at the package assets", async () => {
    const html = page(await site([fullFixture()]), WEATHER_PAGE);
    assert.match(html, /<h1 id="weather">Weather<\/h1>/);
    assert.match(html, /<img src="\.\.\/\.\.\/\.\.\/modules\/yassine\/weather\/1\.2\.0\/docs\/shot\.png" alt="Forecast">/);
  });

  test("carries the ADR 0015 warning with a link to the source and an install link to the Host", async () => {
    const html = page(await site([fullFixture()]), WEATHER_PAGE);
    assert.match(html, /Admitted to the Marketplace at its first publication\. Updates are not reviewed\. The Creator answers for this code, and you install it at your own risk\./);
    const url = "https://example.org/yassine-weather-1.2.0.zip";
    assert.ok(html.includes(`href="https://tessello.app/#install=${encodeURIComponent(url)}"`));
    assert.match(html, /Install in Tessello/);
  });
});

describe("the page of a Module that is no longer available", () => {
  test("a banned Module shows the reason and no install link or guide", async () => {
    const html = page(await site([fullFixture({ banned: "Steals your data" })]), WEATHER_PAGE);
    assert.match(html, /no longer available/);
    assert.match(html, /banned/i);
    assert.match(html, /Steals your data/);
    assert.doesNotMatch(html, /#install=|Install in Tessello|See the forecast/);
  });

  test("a withdrawn Module says so neutrally, without a reason or an install link", async () => {
    const html = page(await site([fullFixture({ withdrawn: true })]), WEATHER_PAGE);
    assert.match(html, /no longer available/);
    assert.match(html, /withdrawn by its Creator/);
    assert.doesNotMatch(html, /banned|#install=|Install in Tessello/i);
  });

  test("a listed Module with no usable version says it is not available", async () => {
    const html = page(await site([{ entry: { id: "@yassine/empty", source: "https://github.com/yassine/repo", license: "MIT", versions: [] } }]), "modules/yassine/empty/index.html");
    assert.match(html, /no longer available/);
    assert.doesNotMatch(html, /#install=/);
  });
});

describe("escaping", () => {
  test("text coming from a listing or a Manifest is escaped on both pages", async () => {
    const evil = zip("@yassine/weather", "1.0.0", { name: "<script>alert(1)</script>", description: "<img src=x onerror=alert(2)>" }, "<script>alert(3)</script>\n");
    const pages = await site([fixture("@yassine/weather", evil, { tags: ["<b>"], license: "<i>MIT" })]);
    for (const path of ["index.html", WEATHER_PAGE]) {
      const html = page(pages, path);
      assert.doesNotMatch(html, /<script>alert|<img src=x|<b>|<i>MIT/, path);
      assert.match(html, /&lt;script&gt;alert\(1\)/, path);
    }
  });

  test("the reason of a Ban is escaped", async () => {
    const html = page(await site([fullFixture({ banned: "<script>x</script>" })]), WEATHER_PAGE);
    assert.doesNotMatch(html, /<script>x/);
  });
});

describe("the stylesheet", () => {
  test("is one file with a light and a dark theme, and loads nothing from elsewhere", async () => {
    const css = page(await site([fullFixture()]), "style.css");
    assert.match(css, /prefers-color-scheme:\s*dark/);
    assert.match(css, /max-width/);
    assert.doesNotMatch(css, /@import|url\(/);
  });
});
