// Serves the built Host locally, with the same headers as in production (headers.ts), and Cloudflare Pages' redirect
// of `/index.html` to `/`.
// Run with `npm run start:host`, after `npm run build:host`.

import { readFile } from "node:fs/promises";
import { createServer, type Server } from "node:http";
import { extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";
import { DIST } from "./build.ts";
import { headersFor } from "./headers.ts";

const TYPES: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".map": "application/json",
  ".webmanifest": "application/manifest+json",
  ".svg": "image/svg+xml",
};

/** Starts serving `dist/` on `port` (0 picks a free one); resolves with the server and its URL. */
export function serveHost(port = 0): Promise<{ server: Server; url: string }> {
  const server = createServer(async (request, response) => {
    const path = new URL(request.url ?? "/", "http://host").pathname;
    if (path === "/index.html") return void response.writeHead(308, { Location: "/" }).end();
    const file = normalize(join(DIST, path === "/" ? "index.html" : path));
    if (!file.startsWith(DIST)) return void response.writeHead(404).end();
    try {
      const body = await readFile(file);
      response.writeHead(200, {
        "Content-Type": TYPES[extname(file)] ?? "application/octet-stream",
        ...headersFor(path),
      });
      response.end(body);
    } catch {
      response.writeHead(404).end();
    }
  });
  return new Promise((resolve) =>
    server.listen(port, "127.0.0.1", () => {
      const address = server.address();
      resolve({ server, url: `http://127.0.0.1:${typeof address === "object" && address ? address.port : port}/` });
    }),
  );
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { url } = await serveHost(Number(process.env.PORT ?? 8080));
  console.log(`Tessello Host: ${url}`);
}
