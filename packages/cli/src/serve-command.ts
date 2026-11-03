import { access } from "node:fs/promises";
import type { Server } from "node:http";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { serveSite } from "./serve-site.ts";

/**
 * Never change it: the permission to use the Modules folder and the installed app belong to the Host's address, port
 * included. Another default would make every User choose their folder again.
 */
export const DEFAULT_PORT = 7355;

export interface ServeDeps {
  /** The built Host; by default the copy the npm package holds next to this file. */
  hostDir: string;
  /** Receives the running server, so that a test can stop it. */
  onServing: (server: Server) => void;
}

interface Output {
  out: (text: string) => void;
  err: (text: string) => void;
}

const USAGE = "Usage: tessello serve [--port <number>]";

/** Serves the Host until the process stops. Returns once it is running: 0, 1 when it cannot run, 2 on a usage error. */
export async function serveCommand(args: string[], output: Output, deps: Partial<ServeDeps> = {}): Promise<number> {
  const port = portOf(args);
  if (port === null) {
    output.err(USAGE);
    return 2;
  }
  const hostDir = deps.hostDir ?? fileURLToPath(new URL("./host", import.meta.url));
  try {
    await access(join(hostDir, "index.html"));
  } catch {
    output.err(`The Host's files are not in ${hostDir}. In the Tessello repository, use \`npm run start:host\`.`);
    return 1;
  }
  try {
    const { server, url } = await serveSite(hostDir, port);
    deps.onServing?.(server);
    output.out(`Tessello Host: ${url}`);
    output.out("Open it in Chrome or Edge and choose your Modules folder. Press Ctrl+C to stop.");
    return 0;
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code !== "EADDRINUSE") throw e;
    output.err(
      `Port ${port} is already in use. If Tessello is already running, open http://127.0.0.1:${port}/. ` +
        "Otherwise use --port <number>: on another port you choose your Modules folder again.",
    );
    return 1;
  }
}

/** The port asked for, the default without `--port`, or null when the arguments are wrong. */
function portOf(args: string[]): number | null {
  if (args.length === 0) return DEFAULT_PORT;
  if (args.length !== 2 || args[0] !== "--port" || !/^\d+$/.test(args[1]!)) return null;
  const port = Number(args[1]);
  return port >= 1 && port <= 65535 ? port : null;
}
