// The Host's service worker: keeps the Host's own static shell (index.html, main.js, style.css, the manifest and the
// icon) available offline, and nothing else. Module files never come through here (ADR 0005): they live in the User's
// Modules folder, and every other request, such as an install by URL or the Marketplace index, goes to the network.
// The build injects `__SHELL__` (the shell's paths) and `__VERSION__` (a hash of their content), so that a deployment
// with changed files gets a new worker, which caches the new shell and deletes the old caches.

declare const __SHELL__: readonly string[];
declare const __VERSION__: string;

interface WorkerScope {
  registration: { scope: string };
  skipWaiting(): Promise<void>;
  clients: { claim(): Promise<void> };
  addEventListener(type: "install" | "activate" | "fetch", listener: (event: any) => void): void;
}
declare const self: WorkerScope;

/**
 * The URL a shell file is fetched and cached at: index.html at the root of `scope`, since Cloudflare Pages redirects
 * `/index.html` to `/`, and a navigation answered with a redirected response fails.
 */
export function shellUrlOf(path: string, scope: string): string {
  return path === "index.html" ? scope : scope + path;
}

/**
 * The cache key answering `request` (a URL under `scope`), or null to let it through to the network: a navigation to
 * the Host (its root or index.html, whatever the query or hash) gets the page, a shell file itself; cross-origin,
 * non-GET and non-shell requests, and navigations to any other page of the site, get null.
 */
export function shellKeyOf(
  request: { url: string; method: string; mode: string },
  scope: string,
  shell: readonly string[],
): string | null {
  if (request.method !== "GET") return null;
  const url = new URL(request.url);
  const root = new URL(scope);
  if (url.origin !== root.origin || !url.pathname.startsWith(root.pathname)) return null;
  const path = url.pathname.slice(root.pathname.length);
  if (request.mode === "navigate") return path === "" || path === "index.html" ? scope : null;
  return shell.includes(path) ? shellUrlOf(path, scope) : null;
}

if (typeof __VERSION__ !== "undefined") {
  const cacheName = `tessello-${__VERSION__}`;
  const scope = self.registration.scope;

  self.addEventListener("install", (event) => {
    event.waitUntil(
      caches
        .open(cacheName)
        .then((cache) => cache.addAll(__SHELL__.map((path) => new Request(shellUrlOf(path, scope), { cache: "reload" }))))
        .then(() => self.skipWaiting()),
    );
  });

  self.addEventListener("activate", (event) => {
    event.waitUntil(
      caches
        .keys()
        .then((names) => Promise.all(names.filter((name) => name.startsWith("tessello-") && name !== cacheName).map((name) => caches.delete(name))))
        .then(() => self.clients.claim()),
    );
  });

  self.addEventListener("fetch", (event) => {
    const key = shellKeyOf(event.request, scope, __SHELL__);
    if (key === null) return;
    // A shell file missing from the cache falls back to the network.
    event.respondWith(caches.open(cacheName).then((cache) => cache.match(key)).then((hit) => hit ?? fetch(event.request)));
  });
}
