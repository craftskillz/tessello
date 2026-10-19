// The User guide of a Module (CONVENTION.md §3.2, ADR 0010): a Markdown file of the package, shown by the Host with
// the images of the package only. The Validator and the Host read its images the same way, with these functions.

import { marked } from "marked";

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
