// Serves the built Host locally, with the same server as `tessello serve`: the headers come from `dist/_headers`, the
// file Cloudflare Pages reads.
// Run with `npm run start:host`, after `npm run build:host`.

import type { Server } from "node:http";
import { fileURLToPath } from "node:url";
import { serveSite } from "../../cli/src/serve-site.ts";
import { DIST } from "./build.ts";

/** Starts serving `dist/` on `port` (0 picks a free one); resolves with the server and its URL. */
export function serveHost(port = 0): Promise<{ server: Server; url: string }> {
  return serveSite(DIST, port);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { url } = await serveHost(Number(process.env.PORT ?? 8080));
  console.log(`Tessello Host: ${url}`);
}
