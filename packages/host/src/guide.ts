// Builds the document of a Module's User guide (CONVENTION.md §3.2, ADR 0010), loaded with `<iframe sandbox srcdoc>`.
// The Host renders the Markdown itself and runs nothing of the Module: raw HTML is shown as text, images come from the
// package only, and links leave in a new tab or stay inside the guide. The iframe has no `allow-scripts` and the
// document a CSP that allows only `data:` images and inline styles, so the result is inert even if the rendering let
// something through.

import { GUIDE_IMAGE_EXTENSIONS, guideImagePath, type PackageFiles } from "@tessello/convention";
import type { Theme } from "@tessello/host-core";
import { Marked, type Tokens } from "marked";
import { dataUrl, typeOf } from "./srcdoc.ts";

/** The `sandbox` attribute of the guide's iframe: links may open a tab, nothing may run. */
export const GUIDE_SANDBOX = "allow-popups allow-popups-to-escape-sandbox";

const CSP = "default-src 'none'; img-src data:; style-src 'unsafe-inline'";

const escapeHtml = (text: string) =>
  text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");

/** A heading's id, as GitHub writes it: lowercase, punctuation removed, spaces turned into "-". */
export const slug = (text: string) =>
  text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s_-]/gu, "")
    .trim()
    .replace(/\s/g, "-");

/** The HTML of a User guide: `guide` is its package path, against which its images are resolved. */
export function renderGuide(files: PackageFiles, guide: string): string {
  const ids = new Map<string, number>();
  const uniqueId = (text: string) => {
    const id = slug(text);
    const count = ids.get(id) ?? 0;
    ids.set(id, count + 1);
    return count === 0 ? id : `${id}-${count}`;
  };
  const marked = new Marked({
    gfm: true,
    renderer: {
      html: ({ text }: Tokens.HTML | Tokens.Tag) => escapeHtml(text),
      heading({ tokens, depth }: Tokens.Heading) {
        const id = uniqueId(this.parser.parseInline(tokens, this.parser.textRenderer));
        return `<h${depth} id="${escapeHtml(id)}">${this.parser.parseInline(tokens)}</h${depth}>\n`;
      },
      image({ href, title, text }: Tokens.Image) {
        const path = guideImagePath(guide, href);
        const bytes = path === null || !GUIDE_IMAGE_EXTENSIONS.some((ext) => path.toLowerCase().endsWith(ext)) ? undefined : files.get(path);
        if (!bytes) return `<span class="missing-image">${escapeHtml(text)}</span>`;
        const titleAttribute = title ? ` title="${escapeHtml(title)}"` : "";
        return `<img src="${dataUrl(typeOf(path!), bytes)}" alt="${escapeHtml(text)}"${titleAttribute}>`;
      },
      link({ href, title, tokens }: Tokens.Link) {
        const content = this.parser.parseInline(tokens);
        const titleAttribute = title ? ` title="${escapeHtml(title)}"` : "";
        if (href.startsWith("#")) return `<a href="${escapeHtml(href)}"${titleAttribute}>${content}</a>`;
        if (/^(?:https?:|mailto:)/i.test(href)) {
          return `<a href="${escapeHtml(href)}" target="_blank" rel="noopener noreferrer"${titleAttribute}>${content}</a>`;
        }
        return `<span>${content}</span>`;
      },
    },
  });
  return marked.parse(new TextDecoder().decode(files.get(guide)), { async: false });
}

/**
 * The `srcdoc` of the guide's iframe, in the Host's theme. `<base href="about:srcdoc">` keeps `#…` links inside the
 * guide: without it they would resolve against the Host's address and load the Host in the iframe.
 */
export function guideDocument(options: { files: PackageFiles; guide: string; title: string; theme: Theme }): string {
  const { colors, mode } = options.theme;
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta http-equiv="Content-Security-Policy" content="${CSP}">
<base href="about:srcdoc">
<title>${escapeHtml(options.title)}</title>
<style>
:root {
  color-scheme: ${mode};
  --background: ${colors.background};
  --surface: ${colors.surface};
  --text: ${colors.text};
  --text-muted: ${colors.textMuted};
  --accent: ${colors.accent};
  --border: ${colors.border};
}
${GUIDE_STYLE}
</style>
</head>
<body>
<main>
${renderGuide(options.files, options.guide)}
</main>
</body>
</html>`;
}

const GUIDE_STYLE = `
* { box-sizing: border-box; }
html { scroll-behavior: smooth; }
body {
  margin: 0;
  background: var(--background);
  color: var(--text);
  font: 15px/1.65 system-ui, -apple-system, "Segoe UI", sans-serif;
}
main { max-width: 46rem; margin: 0 auto; padding: 2rem 1.5rem 4rem; }
h1, h2, h3, h4 { line-height: 1.25; scroll-margin-top: 1rem; }
h1 { font-size: 2rem; margin: 0 0 0.75rem; letter-spacing: -0.01em; }
h2 { font-size: 1.35rem; margin: 2.5rem 0 0.75rem; padding-bottom: 0.35rem; border-bottom: 1px solid var(--border); }
h3 { font-size: 1.1rem; margin: 1.75rem 0 0.5rem; }
h4 { font-size: 1rem; margin: 1.25rem 0 0.5rem; color: var(--text-muted); }
p, ul, ol, table, blockquote, pre { margin: 0 0 1rem; }
ul, ol { padding-left: 1.5rem; }
li { margin: 0.25rem 0; }
li > ul, li > ol { margin: 0.25rem 0 0; }
a { color: var(--accent); text-underline-offset: 2px; }
strong { font-weight: 650; }
hr { border: none; border-top: 1px solid var(--border); margin: 2rem 0; }
code {
  font: 0.88em ui-monospace, "SF Mono", Consolas, monospace;
  padding: 0.1em 0.35em;
  border-radius: 5px;
  background: var(--surface);
  border: 1px solid var(--border);
}
pre { padding: 0.85rem 1rem; overflow-x: auto; border-radius: 10px; background: var(--surface); border: 1px solid var(--border); }
pre code { padding: 0; border: none; background: none; font-size: 0.85rem; }
blockquote {
  padding: 0.75rem 1rem;
  border-left: 4px solid var(--accent);
  border-radius: 0 10px 10px 0;
  background: color-mix(in srgb, var(--accent) 8%, transparent);
}
blockquote > :last-child { margin-bottom: 0; }
table { width: 100%; border-collapse: collapse; font-size: 0.92rem; display: block; overflow-x: auto; }
th, td { padding: 0.5rem 0.75rem; border: 1px solid var(--border); text-align: left; vertical-align: top; }
th { background: var(--surface); font-weight: 600; }
img {
  display: block;
  max-width: 100%;
  height: auto;
  margin: 0.5rem auto;
  border-radius: 10px;
  border: 1px solid var(--border);
  box-shadow: 0 8px 28px rgb(0 0 0 / 0.08);
}
td img, li img { display: inline-block; margin: 0; box-shadow: none; }
.missing-image { color: var(--text-muted); font-style: italic; }
input[type="checkbox"] { margin: 0 0.4rem 0 0; }
`;
