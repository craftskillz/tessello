// The Host's HTTP headers, the single source for the `_headers` file of Cloudflare Pages and the local server.

export type HeaderRule = { path: string; headers: Record<string, string> };

export const HEADERS: readonly HeaderRule[] = [
  {
    path: "/*",
    headers: {
      // Blocks a Module from navigating its iframe away, without restricting what the srcdoc documents load (ADR 0005).
      "Content-Security-Policy": "frame-src 'none'",
    },
  },
  {
    // The browser must always revalidate the service worker, so that updates reach the Users.
    path: "/sw.js",
    headers: { "Cache-Control": "no-cache" },
  },
];

/** The text of the Cloudflare Pages `_headers` file for `rules`. */
export function headersFile(rules: readonly HeaderRule[] = HEADERS): string {
  return rules
    .map(({ path, headers }) => [path, ...Object.entries(headers).map(([name, value]) => `  ${name}: ${value}`)].join("\n"))
    .join("\n\n")
    .concat("\n");
}

/** The headers of every rule matching `pathname`, merged in order (a later rule wins), as Cloudflare applies them. */
export function headersFor(pathname: string, rules: readonly HeaderRule[] = HEADERS): Record<string, string> {
  const matches = (path: string) =>
    path.endsWith("/*") ? pathname.startsWith(path.slice(0, -1)) : pathname === path;
  return Object.assign({}, ...rules.filter(({ path }) => matches(path)).map(({ headers }) => headers));
}
