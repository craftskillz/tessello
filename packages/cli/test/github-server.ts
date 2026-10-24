import { createServer, type Server } from "node:http";
import { strToU8, zipSync } from "fflate";
import type { GitHubAccess } from "../src/listing.ts";

const VIEW = `<script>parent.postMessage({ tessello: 1, type: "ready", id: "1" }, "*")</script>`;

export function zipOf(overrides: object = {}): Uint8Array {
  const manifest = { convention: 1, id: "@jane/weather", name: "Weather", version: "1.0.0", icon: "icon.svg", view: { entry: "view/index.html" }, guide: "guide.md", ...overrides };
  return zipSync({ "manifest.json": strToU8(JSON.stringify(manifest)), "icon.svg": strToU8("<svg/>"), "view/index.html": strToU8(VIEW), "guide.md": strToU8("# Weather") });
}

export interface Reply {
  status?: number;
  json?: unknown;
  bytes?: Uint8Array;
  headers?: Record<string, string>;
}

export const URL_1 = "https://packages.test/weather-1.0.0.zip";
export const JANE = { login: "jane", id: 7 };
export const CORS = { "access-control-allow-origin": "*" };

/** One local server plays the GitHub API and the Creator's host. Routes are set per test, by "path?query". */
export interface GithubServer {
  start(): Promise<void>;
  stop(): void;
  /** Forgets the routes and the recorded requests. */
  reset(): void;
  routes: Record<string, Reply>;
  requests: string[];
  base: string;
  /** Fetch that sends https://packages.test/ to the local server. */
  rewriting: typeof fetch;
  access(): GitHubAccess;
  /** A Marketplace where jane is a user, her source repository is MIT, and nothing is listed yet. */
  marketplace(extra?: Record<string, Reply>): void;
  host(zip: Uint8Array, headers?: Record<string, string>, path?: string): void;
}

export function githubServer(): GithubServer {
  let server: Server;
  const self: GithubServer = {
    routes: {},
    requests: [],
    base: "",
    rewriting: (input, init) => fetch(String(input).replace("https://packages.test/", `${self.base}/host/`), init),
    async start() {
      server = createServer((req, res) => {
        self.requests.push(`${req.method} ${req.url}`);
        const reply = self.routes[req.url ?? ""];
        if (!reply) {
          res.writeHead(404).end("not found");
          return;
        }
        res.writeHead(reply.status ?? 200, reply.headers ?? {});
        res.end(reply.bytes ?? (reply.json === undefined ? "" : JSON.stringify(reply.json)));
      });
      await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
      const address = server.address();
      self.base = `http://127.0.0.1:${typeof address === "object" && address ? address.port : 0}`;
    },
    stop: () => server.close(),
    reset() {
      self.routes = {};
      self.requests.length = 0;
    },
    access: () => ({ apiUrl: self.base, fetch: self.rewriting }),
    marketplace(extra = {}) {
      self.routes = {
        "/users/jane": { json: { login: "jane", id: 7, type: "User" } },
        "/repos/jane/weather": { json: { private: false, license: { spdx_id: "MIT" } } },
        ...extra,
      };
    },
    host(zip, headers = CORS, path = "/host/weather-1.0.0.zip") {
      self.routes[path] = { bytes: zip, headers };
    },
  };
  return self;
}
