// The User guide of a Module (CONVENTION.md §3.2, ADR 0010): a Markdown file of the package, shown by the Host with
// the images of the package only. The Validator and the Host read its images the same way, with these functions, and
// the Host and the Marketplace render it the same way, with `renderGuide`.

import { Marked, marked, type Tokens } from "marked";

/** The image file types a User guide may show. */
export const GUIDE_IMAGE_EXTENSIONS: readonly string[] = [".svg", ".png", ".jpg", ".jpeg", ".gif", ".webp", ".avif"];

const ROOT = "https://package.tessello.invalid/";

/**
 * The package path an image of the guide points to, resolved against the guide's own folder, or null when the image
 * is not in the package: an absolute URL (`https://…`, `data:…`), a protocol-relative URL or an absolute path.
 */
export function guideImagePath(guide: string, src: string): string | null {
  if (/^[a-z][a-z0-9+.-]*:/i.test(src) || src.startsWith("/")) return null;
  try {
    return decodeURIComponent(new URL(src, ROOT + guide).pathname.slice(1));
  } catch {
    return null;
  }
}

/** The source of every image of a Markdown text, in order, including those inside tables and links. */
export function guideImageSources(markdown: string): string[] {
  const sources: string[] = [];
  marked.walkTokens(marked.lexer(markdown), (token) => {
    if (token.type === "image") sources.push(token.href);
  });
  return sources;
}

/** `text` with the characters that are special in HTML text and attribute values escaped. */
export const escapeHtml = (text: string) =>
  text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");

/** A heading's id, as GitHub writes it: lowercase, punctuation removed, spaces turned into "-". */
export const slug = (text: string) =>
  text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s_-]/gu, "")
    .trim()
    .replace(/\s/g, "-");

/**
 * The HTML of a User guide (CONVENTION.md §3.2, ADR 0010). Raw HTML is shown as text, links leave in a new tab or stay
 * inside the guide, and images come from the package only. `guide` is its package path, against which its images are
 * resolved. `imageSource(path)` gives the `src` of the package image at `path` (only called for paths with an extension
 * of GUIDE_IMAGE_EXTENSIONS), or null when the package has no such file: the image then shows as its alt text.
 */
export function renderGuide(markdown: string, guide: string, imageSource: (path: string) => string | null): string {
  const ids = new Map<string, number>();
  const uniqueId = (text: string) => {
    const id = slug(text);
    const count = ids.get(id) ?? 0;
    ids.set(id, count + 1);
    return count === 0 ? id : `${id}-${count}`;
  };
  const renderer = new Marked({
    gfm: true,
    renderer: {
      html: ({ text }: Tokens.HTML | Tokens.Tag) => escapeHtml(text),
      heading({ tokens, depth }: Tokens.Heading) {
        const id = uniqueId(this.parser.parseInline(tokens, this.parser.textRenderer));
        return `<h${depth} id="${escapeHtml(id)}">${this.parser.parseInline(tokens)}</h${depth}>\n`;
      },
      image({ href, title, text }: Tokens.Image) {
        const path = guideImagePath(guide, href);
        const isImage = path !== null && GUIDE_IMAGE_EXTENSIONS.some((ext) => path.toLowerCase().endsWith(ext));
        const src = isImage ? imageSource(path) : null;
        if (src === null) return `<span class="missing-image">${escapeHtml(text)}</span>`;
        const titleAttribute = title ? ` title="${escapeHtml(title)}"` : "";
        return `<img src="${escapeHtml(src)}" alt="${escapeHtml(text)}"${titleAttribute}>`;
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
  return renderer.parse(markdown, { async: false });
}
