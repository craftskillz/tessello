import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { renderGuide, slug } from "../src/index.ts";

/** Renders `markdown` as the guide `docs/guide.md`, recording the paths asked of `imageSource`. */
const render = (markdown: string, imageSource: (path: string) => string | null = () => null) => {
  const asked: string[] = [];
  const html = renderGuide(markdown, "docs/guide.md", (path) => {
    asked.push(path);
    return imageSource(path);
  });
  return { html, asked };
};

describe("rendering a User guide", () => {
  test("renders Markdown with GitHub tables, strikethrough and task lists", () => {
    const { html } = render("| a | b |\n|---|---|\n| 1 | 2 |\n\n~~old~~\n\n- [x] done");
    assert.match(html, /<table>/);
    assert.match(html, /<del>old<\/del>/);
    assert.match(html, /<input checked="" disabled="" type="checkbox">/);
  });

  test("shows raw HTML as text", () => {
    const { html } = render('<script>alert(1)</script>\n\nhello <img src=x onerror=alert(1)>');
    assert.doesNotMatch(html, /<script>/);
    assert.doesNotMatch(html, /<img/);
    assert.match(html, /&lt;script&gt;/);
  });

  test("gives headings GitHub-style unique ids", () => {
    const { html } = render("# Intro\n\n## Intro\n\n## Café & thé");
    assert.match(html, /<h1 id="intro">/);
    assert.match(html, /<h2 id="intro-1">/);
    assert.match(html, /<h2 id="café--thé">/);
    assert.equal(slug("Hello, World!"), "hello-world");
  });

  test("keeps # links, opens http(s) and mailto links in a new tab, and neutralizes the others", () => {
    const { html } = render("[a](#intro) [b](https://example.com) [c](mailto:x@y.z) [d](javascript:alert(1)) [e](other.md)");
    assert.match(html, /<a href="#intro">a<\/a>/);
    assert.match(html, /<a href="https:\/\/example.com" target="_blank" rel="noopener noreferrer">b<\/a>/);
    assert.match(html, /<a href="mailto:x@y.z" target="_blank" rel="noopener noreferrer">c<\/a>/);
    assert.match(html, /<span>d<\/span>/);
    assert.match(html, /<span>e<\/span>/);
    assert.doesNotMatch(html, /javascript:/);
  });

  describe("images", () => {
    test("asks imageSource for the package path, resolved against the guide's folder", () => {
      const { asked } = render("![x](images/dot.svg)", () => "data:image/svg+xml;base64,AAAA");
      assert.deepEqual(asked, ["docs/images/dot.svg"]);
    });

    test("uses what imageSource returns, escaped, as the src", () => {
      const { html } = render('![the dot](images/dot.svg "A dot")', () => 'a"b&c');
      assert.match(html, /<img src="a&quot;b&amp;c" alt="the dot" title="A dot">/);
    });

    test("shows the alt text when imageSource has no such file", () => {
      const { html } = render("![the <dot>](images/dot.svg)", () => null);
      assert.match(html, /<span class="missing-image">the &lt;dot&gt;<\/span>/);
      assert.doesNotMatch(html, /<img/);
    });

    test("never asks for an image outside the package", () => {
      const { html, asked } = render("![a](https://example.com/a.png) ![b](/etc/b.png) ![c](//cdn.example.com/c.png) ![d](data:image/png;base64,AA)", () => "x");
      assert.deepEqual(asked, []);
      assert.doesNotMatch(html, /<img/);
      assert.equal(html.match(/class="missing-image"/g)?.length, 4);
    });

    test("never asks for a file that is not an image", () => {
      const { html, asked } = render("![n](../notes.txt)", () => "x");
      assert.deepEqual(asked, []);
      assert.match(html, /<span class="missing-image">n<\/span>/);
    });
  });
});
