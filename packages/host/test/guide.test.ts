import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { strToU8 } from "fflate";
import { guideDocument, renderGuide, slug } from "../src/guide.ts";

const DOT_SVG = "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 1 1'/>";

/** A package whose User guide is `docs/guide.md`, with an image next to it. */
const render = (markdown: string) =>
  renderGuide(
    new Map([
      ["docs/guide.md", strToU8(markdown)],
      ["docs/images/dot.svg", strToU8(DOT_SVG)],
      ["notes.txt", strToU8("not an image")],
    ]),
    "docs/guide.md",
  );

describe("rendering a User guide", () => {
  test("renders Markdown with GitHub tables, strikethrough and task lists", () => {
    const html = render("# Weather\n\n| City | °C |\n|---|---|\n| Paris | 18 |\n\n~~old~~\n\n- [x] done");
    assert.match(html, /<h1 id="weather">Weather<\/h1>/);
    assert.match(html, /<th>City<\/th>/);
    assert.match(html, /<del>old<\/del>/);
    assert.match(html, /<input checked="" disabled="" type="checkbox">/);
  });

  test("shows raw HTML as text", () => {
    const html = render('<script>alert(1)</script>\n\nA <img src=x onerror="alert(2)"> inline tag');
    assert.doesNotMatch(html, /<script|<img/);
    assert.match(html, /&lt;script&gt;alert\(1\)&lt;\/script&gt;/);
    assert.match(html, /&lt;img src=x onerror=&quot;alert\(2\)&quot;&gt;/);
  });

  test("shows the images of the package, relative to the guide, as data: URLs", () => {
    const html = render('![The dot](images/dot.svg "A dot")');
    assert.match(html, /<img src="data:image\/svg\+xml;base64,[A-Za-z0-9+/=]+" alt="The dot" title="A dot">/);
  });

  test("replaces a remote, absolute, missing or non-image image with its alternative text", () => {
    for (const src of ["https://example.com/a.png", "/docs/images/dot.svg", "images/missing.png", "../notes.txt", "data:image/png;base64,AA=="]) {
      const html = render(`![Shown as text](${src})`);
      assert.doesNotMatch(html, /<img/, src);
      assert.match(html, /<span class="missing-image">Shown as text<\/span>/, src);
    }
  });

  test("opens web and mail links in a new tab, keeps #… links in the guide, and shows any other link as text", () => {
    assert.match(render("[Open-Meteo](https://open-meteo.com)"), /<a href="https:\/\/open-meteo.com" target="_blank" rel="noopener noreferrer">Open-Meteo<\/a>/);
    assert.match(render("[Mail](mailto:help@example.com)"), /<a href="mailto:help@example.com" target="_blank"/);
    assert.match(render("[Your data](#your-data)"), /<a href="#your-data">Your data<\/a>/);
    for (const href of ["javascript:alert(1)", "other.md", "file:///etc/passwd", "data:text/html,hi"]) {
      const html = render(`[Click **me**](${href})`);
      assert.doesNotMatch(html, /<a /, href);
      assert.match(html, /<span>Click <strong>me<\/strong><\/span>/, href);
    }
  });

  test("gives each heading a GitHub id, numbered when it repeats", () => {
    assert.equal(slug("Your data"), "your-data");
    assert.equal(slug("What's `copy` for?"), "whats-copy-for");
    assert.equal(slug("Tâches & notes"), "tâches--notes");
    const html = render("## Tips\n\n## Tips\n\n## *Your* data");
    assert.match(html, /<h2 id="tips">Tips<\/h2>/);
    assert.match(html, /<h2 id="tips-1">Tips<\/h2>/);
    assert.match(html, /<h2 id="your-data"><em>Your<\/em> data<\/h2>/);
  });
});

describe("the document of a User guide", () => {
  const document = guideDocument({
    files: new Map([["guide.md", strToU8("# Notes")]]),
    guide: "guide.md",
    title: "Notes <guide>",
    theme: {
      mode: "dark",
      colors: { background: "#14161a", surface: "#1d2026", text: "#e8e9eb", textMuted: "#9aa0a8", accent: "#4f8cff", border: "#2c3038" },
    },
  });

  test("allows only data: images and inline styles", () => {
    assert.match(document, /<meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src data:; style-src 'unsafe-inline'">/);
  });

  test("keeps #… links inside the guide", () => {
    assert.match(document, /<base href="about:srcdoc">/);
  });

  test("follows the Host's theme and escapes its title", () => {
    assert.match(document, /color-scheme: dark;/);
    assert.match(document, /--background: #14161a;/);
    assert.match(document, /<title>Notes &lt;guide&gt;<\/title>/);
    assert.match(document, /<h1 id="notes">Notes<\/h1>/);
  });
});
