// The Host's HTTP headers, the single source for the `_headers` file that Cloudflare Pages and the local server read.

import type { HeaderRule } from "../../cli/src/serve-site.ts";

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
