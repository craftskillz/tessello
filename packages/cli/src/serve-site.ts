// Serves a built static site as Cloudflare Pages does: the HTTP headers come from the site's own `_headers` file, which
// is not served itself, and `/index.html` redirects to `/`. Only this computer can reach it.

import { readFile } from "node:fs/promises";
import { createServer, type Server } from "node:http";
import { extname, join, normalize, sep } from "node:path";

export type HeaderRule = { path: string; headers: Record<string, string> };

const TYPES: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".map": "application/json",
  ".webmanifest": "application/manifest+json",
  ".svg": "image/svg+xml",
  ".txt": "text/plain; charset=utf-8",
};

/** The rules of a `_headers` file: each path, followed by its indented headers. */
export function parseHeaders(text: string): HeaderRule[] {
  const rules: HeaderRule[] = [];
  for (const line of text.split("\n")) {
    if (!line.trim()) continue;
    if (!/^\s/.test(line)) {
      rules.push({ path: line.trim(), headers: {} });
      continue;
    }
    const colon = line.indexOf(":");
    rules.at(-1)!.headers[line.slice(0, colon).trim()] = line.slice(colon + 1).trim();
  }
  return rules;
}

/** The headers of every rule matching `pathname`, merged in order (a later rule wins), as Cloudflare applies them. */
export function headersFor(pathname: string, rules: readonly HeaderRule[]): Record<string, string> {
  const matches = (path: string) => (path.endsWith("/*") ? pathname.startsWith(path.slice(0, -1)) : pathname === path);
  return Object.assign({}, ...rules.filter(({ path }) => matches(path)).map(({ headers }) => headers));
}

/** Starts serving `root` on `port` of 127.0.0.1 (0 picks a free one); rejects when the port cannot be used. */
export async function serveSite(root: string, port = 0): Promise<{ server: Server; url: string }> {
  const rules = parseHeaders(await readFile(join(root, "_headers"), "utf8"));
  const server = createServer(async (request, response) => {
    const path = new URL(request.url ?? "/", "http://host").pathname;
    if (path === "/index.html") return void response.writeHead(308, { Location: "/" }).end();
    const file = normalize(join(root, path === "/" ? "index.html" : path));
    if (path === "/_headers" || !file.startsWith(normalize(root + sep))) return void response.writeHead(404).end();
    try {
      const body = await readFile(file);
      response.writeHead(200, { "Content-Type": TYPES[extname(file)] ?? "application/octet-stream", ...headersFor(path, rules) });
      response.end(body);
    } catch {
      response.writeHead(404).end();
    }
  });
  return new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(port, "127.0.0.1", () => {
      server.off("error", reject);
      const address = server.address();
      resolve({ server, url: `http://127.0.0.1:${typeof address === "object" && address ? address.port : port}/` });
    });
  });
}
