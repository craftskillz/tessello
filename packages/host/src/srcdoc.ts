// Builds the self-contained document of a View or Widget, loaded with `<iframe sandbox srcdoc>` (ADR 0005).
// The Content Security Policy derived from the Permissions comes first, the Module's local files become data: URLs,
// and a small runtime serves what can only be resolved while the Module runs (relative fetches, Workers, URLs set by
// script). The runtime is a compatibility layer, not a security boundary: only the CSP decides what goes out.

import type { PackageFiles, Permissions } from "@tessello/convention";
import { init, parse } from "es-module-lexer";

/**
 * The URL standing for the package root inside the document. It never resolves (`.invalid`) and the CSP does not
 * allow it, so a local resource the runtime did not rewrite is blocked instead of going out to the network.
 */
export const PACKAGE_ROOT = "https://package.tessello.invalid/";

const TYPES: Record<string, string> = {
  html: "text/html",
  htm: "text/html",
  js: "text/javascript",
  mjs: "text/javascript",
  css: "text/css",
  json: "application/json",
  txt: "text/plain",
  svg: "image/svg+xml",
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  gif: "image/gif",
  webp: "image/webp",
  avif: "image/avif",
  ico: "image/x-icon",
  woff: "font/woff",
  woff2: "font/woff2",
  ttf: "font/ttf",
  otf: "font/otf",
  mp3: "audio/mpeg",
  ogg: "audio/ogg",
  wav: "audio/wav",
  mp4: "video/mp4",
  webm: "video/webm",
  wasm: "application/wasm",
};

/** The `sandbox` attribute of every Module iframe (CONVENTION.md §4): never `allow-same-origin`. */
export const IFRAME_SANDBOX = "allow-scripts allow-forms allow-popups allow-popups-to-escape-sandbox";

/** The CSP of a View or Widget: only its declared origins, and no URL of the Host. */
export function cspFor(permissions: Permissions = {}): string {
  const origins = [...(permissions.network ?? []), ...(permissions.localNetwork ?? [])].join(" ");
  return [
    `default-src ${origins} data: blob: 'unsafe-inline' 'unsafe-eval'`.replace(/ {2,}/g, " "),
    `form-action ${origins || "'none'"}`,
    `base-uri ${PACKAGE_ROOT}`,
  ].join("; ");
}

export const typeOf = (path: string) => TYPES[path.slice(path.lastIndexOf(".") + 1).toLowerCase()] ?? "application/octet-stream";

function base64(bytes: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(binary);
}

/** JSON safe to place inside a <script> element: "<" is escaped, so "</script>" cannot close it. */
const scriptJson = (value: unknown) => JSON.stringify(value).replace(/</g, "\\u003c");

export const dataUrl = (type: string, bytes: Uint8Array) => `data:${type};base64,${base64(bytes)}`;

export async function buildSrcdoc(options: { files: PackageFiles; entry: string; permissions?: Permissions }): Promise<string> {
  await init();
  const { files, entry } = options;
  const text = (path: string) => new TextDecoder().decode(files.get(path));
  const urls = new Map<string, string>();

  /** The package path `ref` points to from the file `from`, or null when it is not a file of the package. */
  const pathOf = (ref: string, from: string) => {
    let url: URL;
    try {
      url = new URL(ref, PACKAGE_ROOT + from);
    } catch {
      return null;
    }
    if (!url.href.startsWith(PACKAGE_ROOT)) return null;
    const path = decodeURIComponent(url.pathname.slice(1));
    return files.has(path) ? path : null;
  };

  // CSS references become data: URLs; `seen` guards against @import cycles.
  const css = (body: string, from: string, seen: Set<string>) =>
    body
      .replace(/@import\s+(["'])([^"']+)\1/g, (_match, _quote, ref) => `@import "${urlFor(ref, from, seen) ?? ref}"`)
      .replace(/url\(\s*(["']?)([^"')]+)\1\s*\)/g, (match, _quote, ref) => {
        const url = urlFor(ref, from, seen);
        return url ? `url("${url}")` : match;
      });

  // Relative module specifiers become absolute URLs under PACKAGE_ROOT, which the import map maps to data: URLs:
  // a module loaded from a data: URL cannot resolve a relative specifier on its own.
  const js = (body: string, from: string) => {
    let imports;
    try {
      [imports] = parse(body);
    } catch {
      return body; // Not an ES module the lexer can read: left as is.
    }
    const self = PACKAGE_ROOT + from;
    let out = "";
    let last = 0;
    for (const found of imports) {
      let replacement: string | null = null;
      if (found.type === "import-meta") {
        replacement = `({ url: ${JSON.stringify(self)}, resolve: (specifier) => new URL(specifier, ${JSON.stringify(self)}).href })`;
      } else if (found.specifier && /^(\.{1,2}\/|\/(?!\/))/.test(found.specifier)) {
        const absolute = new URL(found.specifier, self).href;
        replacement = found.type === "dynamic" ? JSON.stringify(absolute) : absolute;
      }
      if (replacement === null) continue;
      out += body.slice(last, found.start) + replacement;
      last = found.end;
    }
    return out + body.slice(last);
  };

  function urlFor(ref: string, from: string, seen = new Set<string>()): string | null {
    const path = pathOf(ref, from);
    if (!path) return null;
    const cached = urls.get(path);
    if (cached) return cached;
    if (seen.has(path)) return null;
    seen.add(path);
    const type = typeOf(path);
    let bytes = files.get(path)!;
    if (type === "text/css") bytes = new TextEncoder().encode(css(text(path), path, seen));
    if (type === "text/javascript") bytes = new TextEncoder().encode(js(text(path), path));
    const url = dataUrl(type, bytes);
    urls.set(path, url);
    return url;
  }

  const doc = new DOMParser().parseFromString(text(entry), "text/html");
  // A local stylesheet becomes a <style>: it then applies before "load", which a data: <link> does not always do in
  // Firefox (ADR 0005).
  for (const link of doc.querySelectorAll("link[rel~='stylesheet'][href]")) {
    const path = pathOf(link.getAttribute("href")!, entry);
    if (path) link.replaceWith(Object.assign(doc.createElement("style"), { textContent: css(text(path), path, new Set()) }));
  }
  const rewrite = (selector: string, attribute: string) => {
    for (const element of doc.querySelectorAll(selector)) {
      const url = urlFor(element.getAttribute(attribute)!, entry);
      if (url) element.setAttribute(attribute, url);
    }
  };
  rewrite("[src]", "src");
  rewrite("[poster]", "poster");
  rewrite("link[href]", "href");
  rewrite("image[href], use[href]", "href");
  for (const element of doc.querySelectorAll("[srcset]")) {
    element.setAttribute("srcset", srcset(element.getAttribute("srcset")!, (ref) => urlFor(ref, entry)));
  }
  for (const style of doc.querySelectorAll("style")) style.textContent = css(style.textContent ?? "", entry, new Set());
  for (const element of doc.querySelectorAll("[style]")) element.setAttribute("style", css(element.getAttribute("style")!, entry, new Set()));

  const imports: Record<string, string> = {};
  const table: Record<string, string> = {};
  for (const path of files.keys()) {
    const url = urlFor(path, "")!;
    table[path] = url;
    if (typeOf(path) === "text/javascript") imports[PACKAGE_ROOT + path] = url;
  }

  const head = doc.head;
  const first = head.firstChild;
  const add = (tag: string, attributes: Record<string, string>, content?: string) => {
    const element = doc.createElement(tag);
    for (const [name, value] of Object.entries(attributes)) element.setAttribute(name, value);
    if (content) element.textContent = content;
    head.insertBefore(element, first);
  };
  add("meta", { "http-equiv": "Content-Security-Policy", content: cspFor(options.permissions) });
  add("base", { href: new URL(".", PACKAGE_ROOT + entry).href });
  add("script", {}, runtime(table));
  add("script", { type: "importmap" }, scriptJson({ imports }));
  return `<!doctype html>${doc.documentElement.outerHTML}`;
}

// Candidates of a srcset: a comma separates them when whitespace or a descriptor ("2x", "100w") is next to it, since a
// URL (a data: URL in particular) may contain commas.
const SRCSET_SEPARATOR = /,\s+|(?<=\s\d+(?:\.\d+)?[xwh]),/;

function srcset(value: string, urlFor: (ref: string) => string | null): string {
  return value
    .split(SRCSET_SEPARATOR)
    .map((candidate) => {
      const [ref, ...descriptors] = candidate.trim().split(/\s+/);
      return [urlFor(ref) ?? ref, ...descriptors].join(" ");
    })
    .join(", ");
}

/** The script run in the document before the Module's own: resolves package URLs set while the Module runs. */
function runtime(table: Record<string, string>): string {
  return `(() => {
  const ROOT = ${scriptJson(PACKAGE_ROOT)}, FILES = ${scriptJson(table)};
  // The data: URL of a package file, "" for a missing one under the package root, null for any other URL.
  const local = (ref) => {
    try {
      const url = new URL(ref, document.baseURI);
      if (!url.href.startsWith(ROOT)) return null;
      return FILES[decodeURIComponent(url.pathname.slice(1))] ?? "";
    } catch { return null; }
  };
  const nativeFetch = window.fetch;
  window.fetch = function (input, init) {
    const data = local(input instanceof Request ? input.url : String(input));
    if (data === null) return nativeFetch.call(this, input, init);
    return data ? nativeFetch.call(this, data) : Promise.resolve(new Response("", { status: 404, statusText: "Not Found" }));
  };
  const open = XMLHttpRequest.prototype.open;
  XMLHttpRequest.prototype.open = function (method, url, ...rest) { return open.call(this, method, local(String(url)) || url, ...rest); };
  const NativeWorker = window.Worker;
  window.Worker = class Worker extends NativeWorker { constructor(url, options) { super(local(String(url)) || url, options); } };
  // Setting a URL property starts loading at once, even on an element not yet in the page (new Image()).
  for (const [type, name] of [[HTMLImageElement, "src"], [HTMLScriptElement, "src"], [HTMLSourceElement, "src"], [HTMLMediaElement, "src"], [HTMLVideoElement, "poster"], [HTMLLinkElement, "href"]]) {
    const property = Object.getOwnPropertyDescriptor(type.prototype, name);
    Object.defineProperty(type.prototype, name, { ...property, set(value) { property.set.call(this, local(String(value)) || value); } });
  }
  const fixSrcset = (value) => value.split(${SRCSET_SEPARATOR}).map((candidate) => {
    const [ref, ...rest] = candidate.trim().split(/\\s+/);
    return [local(ref) || ref, ...rest].join(" ");
  }).join(", ");
  const fix = (element) => {
    for (const name of ["src", "poster"]) {
      const value = element.getAttribute(name);
      const data = value && !value.startsWith("data:") && local(value);
      if (data) element.setAttribute(name, data);
    }
    if (element.matches("link, image, use")) {
      const value = element.getAttribute("href");
      const data = value && !value.startsWith("data:") && local(value);
      if (data) element.setAttribute("href", data);
    }
    const set = element.getAttribute("srcset");
    if (set && set !== fixSrcset(set)) element.setAttribute("srcset", fixSrcset(set));
  };
  new MutationObserver((records) => {
    for (const record of records) {
      if (record.type === "attributes") fix(record.target);
      else for (const node of record.addedNodes) if (node.nodeType === 1) { fix(node); node.querySelectorAll("*").forEach(fix); }
    }
  }).observe(document, { subtree: true, childList: true, attributes: true, attributeFilter: ["src", "poster", "href", "srcset"] });
  // With the <base> above, href="#x" would leave the page: in-page links only change the hash (CONVENTION.md §4).
  document.addEventListener("click", (event) => {
    const link = event.target instanceof Element && event.target.closest("a[href^='#']");
    if (!link || event.defaultPrevented) return;
    event.preventDefault();
    location.hash = link.getAttribute("href");
  });
})();`;
}
