// Builds the document of a View or Widget, loaded with `<iframe sandbox srcdoc>` (ADR 0005, ADR 0007).
// The srcdoc only holds the Content Security Policy derived from the Permissions and a small loader. The Host then
// posts the Module's files to the iframe once: the loader turns them into blob: URLs, which belong to the iframe's
// own opaque origin, and writes the View's document over itself. That document starts with the same CSP, then a small
// runtime that serves what can only be resolved while the Module runs (relative fetches, Workers, URLs set by
// script). The loader and the runtime are a compatibility layer, not a security boundary: only the CSP decides what
// goes out.

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

/**
 * The `allow` attribute of a Module iframe: Chrome and Edge ask the User before a public site reaches the local network,
 * and only for a frame the page delegates it to (ADR 0012). Delegated only to a Module that declares `localNetwork`.
 * `local-network-access` is the name of Chrome 142, split since into `local-network` and `loopback-network`.
 */
export function iframeAllow(permissions: Permissions = {}): string {
  return (permissions.localNetwork ?? []).length > 0 ? "local-network-access; local-network; loopback-network" : "";
}

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

/** What the Host needs to show a View or Widget. */
export interface ViewDocument {
  /** The `srcdoc` of the iframe: the CSP and the loader, whatever the size of the Module. */
  srcdoc: string;
  /** Post it to the iframe once, when it has loaded: `postMessage(message, "*", transfer)`. */
  message: LoaderMessage;
  transfer: ArrayBuffer[];
  /** The `allow` attribute of the iframe, set before it is in the page. */
  allow: string;
}

interface LoaderMessage {
  tessello: "files";
  /** The entry document, with the CSP and the runtime first, and its local references as package URLs. */
  html: string;
  /**
   * Every file of the package; stylesheets and scripts are already rewritten. `url` is the package URL that stands
   * for the file in the document and the scripts.
   */
  files: { path: string; url: string; type: string; bytes: ArrayBuffer }[];
}

// A package URL as `packageUrl` writes it; its group is the escaped path.
const PACKAGE_URL = new RegExp(PACKAGE_ROOT.replace(/[.\/]/g, "\\$&") + "([A-Za-z0-9\\-._~%/]*)", "g");

// Placeholders of the entry document, which the loader replaces once the blob: URLs exist.
const FILES_PLACEHOLDER = "__TESSELLO_FILES__";
const IMPORTS_PLACEHOLDER = "__TESSELLO_IMPORTS__";

/**
 * The package URL of a path, which the loader recognizes and replaces with the file's blob: URL. Every character but
 * [A-Za-z0-9-._~/] is escaped, so the URL never contains a quote, a parenthesis or a space.
 */
const packageUrl = (path: string) =>
  PACKAGE_ROOT +
  [...new TextEncoder().encode(path)]
    .map((byte) => (/[A-Za-z0-9\-._~/]/.test(String.fromCharCode(byte)) ? String.fromCharCode(byte) : `%${byte.toString(16).toUpperCase().padStart(2, "0")}`))
    .join("");

export async function buildView(options: { files: PackageFiles; entry: string; permissions?: Permissions }): Promise<ViewDocument> {
  await init();
  const { files, entry } = options;
  const csp = cspFor(options.permissions);
  const text = (path: string) => new TextDecoder().decode(files.get(path));

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
  const urlFor = (ref: string, from: string) => {
    const path = pathOf(ref, from);
    return path === null ? null : packageUrl(path);
  };

  // CSS references become package URLs.
  const css = (body: string, from: string) =>
    body
      .replace(/@import\s+(["'])([^"']+)\1/g, (_match, _quote, ref) => `@import "${urlFor(ref, from) ?? ref}"`)
      .replace(/url\(\s*(["']?)([^"')]+)\1\s*\)/g, (match, _quote, ref) => {
        const url = urlFor(ref, from);
        return url ? `url("${url}")` : match;
      });

  // Relative module specifiers become package URLs, which the import map maps to blob: URLs: a module loaded from a
  // blob: URL cannot resolve a relative specifier on its own.
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
        const path = pathOf(found.specifier, from);
        const absolute = path === null ? new URL(found.specifier, self).href : packageUrl(path);
        replacement = found.type === "dynamic" ? JSON.stringify(absolute) : absolute;
      }
      if (replacement === null) continue;
      out += body.slice(last, found.start) + replacement;
      last = found.end;
    }
    return out + body.slice(last);
  };

  const doc = new DOMParser().parseFromString(text(entry), "text/html");
  // A local stylesheet becomes a <style>: it then applies before "load", which a <link> to another file does not
  // always do in Firefox (ADR 0005).
  for (const link of doc.querySelectorAll("link[rel~='stylesheet'][href]")) {
    const path = pathOf(link.getAttribute("href")!, entry);
    if (path) link.replaceWith(Object.assign(doc.createElement("style"), { textContent: css(text(path), path) }));
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
  for (const style of doc.querySelectorAll("style")) style.textContent = css(style.textContent ?? "", entry);
  for (const element of doc.querySelectorAll("[style]")) element.setAttribute("style", css(element.getAttribute("style")!, entry));

  const head = doc.head;
  const first = head.firstChild;
  const add = (tag: string, attributes: Record<string, string>, content?: string) => {
    const element = doc.createElement(tag);
    for (const [name, value] of Object.entries(attributes)) element.setAttribute(name, value);
    if (content) element.textContent = content;
    head.insertBefore(element, first);
  };
  add("meta", { "http-equiv": "Content-Security-Policy", content: csp });
  add("base", { href: new URL(".", PACKAGE_ROOT + entry).href });
  add("script", {}, RUNTIME);
  add("script", { type: "importmap" }, IMPORTS_PLACEHOLDER);

  const message: LoaderMessage = { tessello: "files", html: `<!doctype html>${doc.documentElement.outerHTML}`, files: [] };
  for (const [path, bytes] of files) {
    const type = typeOf(path);
    let content = bytes;
    if (type === "text/css") content = new TextEncoder().encode(css(text(path), path));
    if (type === "text/javascript") content = new TextEncoder().encode(js(text(path), path));
    message.files.push({ path, url: packageUrl(path), type, bytes: content.slice().buffer });
  }
  const srcdoc = `<!doctype html><html><head><meta http-equiv="Content-Security-Policy" content="${csp}"><script>${loader()}</script></head></html>`;
  return { srcdoc, message, transfer: message.files.map((file) => file.bytes), allow: iframeAllow(options.permissions) };
}

/**
 * The script of the srcdoc. It accepts a single message, from the Host, before any code of the Module runs: it makes
 * a blob: URL of every file, stylesheets once the files they reference have theirs, puts them in place of the package
 * URLs of the entry document and writes that document over its own.
 */
function loader(): string {
  return `(() => {
  const ROOT = ${scriptJson(PACKAGE_ROOT)};
  const PACKAGE_URL = ${PACKAGE_URL};
  const json = (value) => JSON.stringify(value).replace(/</g, "\\u003c");
  addEventListener("message", function receive(event) {
    if (event.source !== parent || event.data?.tessello !== "files") return;
    removeEventListener("message", receive);
    const { html, files } = event.data;
    const urls = new Map(), styles = new Map();
    const blob = (content, type) => URL.createObjectURL(new Blob([content], { type }));
    for (const { path, type, bytes } of files) {
      if (type === "text/css") styles.set(path, new TextDecoder().decode(bytes));
      else urls.set(path, blob(bytes, type));
    }
    // The blob: URL of a file; a stylesheet gets one once the files it references have theirs (seen stops @import cycles).
    const urlOf = (path, seen) => {
      if (urls.has(path)) return urls.get(path);
      if (!styles.has(path) || seen.has(path)) return null;
      seen.add(path);
      const url = blob(resolve(styles.get(path), seen), "text/css");
      urls.set(path, url);
      return url;
    };
    const resolve = (text, seen = new Set()) => text.replace(PACKAGE_URL, (match, encoded) => {
      try { return urlOf(decodeURIComponent(encoded), seen) ?? match; } catch { return match; }
    });
    for (const path of styles.keys()) urlOf(path, new Set());
    const imports = {};
    for (const { path, url, type } of files) if (type === "text/javascript") imports[url] = urls.get(path);
    const page = resolve(html)
      .replace(${scriptJson(FILES_PLACEHOLDER)}, () => json(Object.fromEntries(urls)))
      .replace(${scriptJson(IMPORTS_PLACEHOLDER)}, () => json({ imports }));
    document.open();
    document.write(page);
    document.close();
  });
})();`;
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
const RUNTIME = `(() => {
  const ROOT = ${scriptJson(PACKAGE_ROOT)}, FILES = ${FILES_PLACEHOLDER};
  // The blob: URL of a package file, "" for a missing one under the package root, null for any other URL.
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
      const data = value && !/^(data|blob):/.test(value) && local(value);
      if (data) element.setAttribute(name, data);
    }
    if (element.matches("link, image, use")) {
      const value = element.getAttribute("href");
      const data = value && !/^(data|blob):/.test(value) && local(value);
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
