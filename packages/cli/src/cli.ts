#!/usr/bin/env node
import { realpathSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { execCommand, publishCommand, type Gh, type GhResult, type PublishDeps } from "./publish-command.ts";
import { askTerminal, listPublished, releaseCommand, runQuiet, type ReleaseDeps } from "./release-command.ts";
import { serveCommand, type ServeDeps } from "./serve-command.ts";
import { syncCommand, type SyncCommandDeps } from "./sync-command.ts";
import { formatReport, validatePath } from "./validate-command.ts";

const USAGE = `Usage: tessello <command>

Commands:
  validate <path> [--json]   Check a Module folder or .zip against the Tessello Convention.
                             Exits with 1 if the Module is not installable.
  release <major|minor|patch|fix> [--no-list]
                             In a Module's repository: check, raise the version, tag and push it,
                             wait for its Release workflow, then offer to list it on the Marketplace.
  publish [--dry-run]        In a Module's repository: list the version of manifest.json, as
                             published on the GitHub Pages of its remote origin, on the Marketplace.
  publish <package.zip> --url <URL>
                             Prepare the Marketplace listing for a package you have published
                             at <URL> and open the pull request (run \`tessello publish --help\` for options).
  serve [--port <number>]    Run the Host on this computer, to reach your installed Modules
                             when its site cannot be reached (http://127.0.0.1:7355/ by default).
  sync [--once] [--living-documentation <repository>]… [folder]
                             Commit the changes of your Modules folder to its git repository
                             (the current folder by default), round after round until Ctrl+C,
                             or once with --once. One instance per folder (a lock file).
                             --living-documentation also commits the Living Documentation
                             Project folders of a repository (repeatable), never pushes them.
                             Exits with 1 on a problem.`;

interface Output {
  out: (text: string) => void;
  err: (text: string) => void;
}

/** Runs the CLI and returns the process exit code: 0 success, 1 invalid Module or failed command, 2 usage error. */
export async function run(args: string[], output: Output, deps: Partial<PublishDeps & ServeDeps & SyncCommandDeps & { release: Partial<ReleaseDeps> }> = {}): Promise<number> {
  const [command, ...rest] = args;

  if (command === "release") return releaseCommand(rest, output, releaseDeps(output, deps));

  // Without a package nor its URL: the version this repository already published.
  if (command === "publish" && !rest.includes("--help") && !rest.includes("--url") && !rest.some((arg) => arg.endsWith(".zip"))) {
    return listPublished(rest, output, releaseDeps(output, deps));
  }
  if (command === "publish") return publishCommand(rest.filter((arg) => arg !== "--help"), output, await publishDeps(deps));

  if (command === "serve") return serveCommand(rest, output, deps);

  if (command === "sync") return syncCommand(rest, output, deps);

  if (command === "validate") {
    const json = rest.includes("--json");
    const paths = rest.filter((arg) => arg !== "--json");
    if (paths.length !== 1) {
      output.err(USAGE);
      return 2;
    }
    const target = paths[0]!;
    let report;
    try {
      report = await validatePath(target);
    } catch (e) {
      output.err(`Cannot read "${target}": ${(e as Error).message}`);
      return 2;
    }
    output.out(json ? JSON.stringify(report, null, 2) : formatReport(target, report));
    return report.valid ? 0 : 1;
  }

  if (command === undefined || command === "help" || command === "--help" || command === "-h") {
    output.out(USAGE);
    return command === undefined ? 2 : 0;
  }

  output.err(`Unknown command "${command}".\n\n${USAGE}`);
  return 2;
}

/** The real programs, terminal and network, in the current folder; `overrides` win. */
function releaseDeps(output: Output, overrides: Partial<PublishDeps & { release: Partial<ReleaseDeps> }>): ReleaseDeps {
  const cwd = overrides.cwd ?? process.cwd();
  return {
    cwd,
    run: (file, args) => runQuiet(file, args, cwd),
    ask: askTerminal,
    fetch: async (url) => {
      const response = await fetch(url);
      return { ok: response.ok, bytes: async () => new Uint8Array(await response.arrayBuffer()) };
    },
    publish: async (args) => publishCommand(args, output, await publishDeps(overrides)),
    validate: async (folder) => {
      const report = await validatePath(folder);
      return { valid: report.valid, text: formatReport(folder, report) };
    },
    wait: (ms) => new Promise((done) => setTimeout(done, ms)),
    now: () => Date.now(),
    ...overrides.release,
  };
}

/** The real gh (when installed and logged in), the GitHub token it holds, and the process's folder; `overrides` win. */
async function publishDeps(overrides: Partial<PublishDeps>): Promise<PublishDeps> {
  const realGh: Gh = (args) => execCommand("gh", args);
  const gh = "gh" in overrides ? overrides.gh! : (await realGh(["auth", "status"])).code === 0 ? realGh : null;
  let token = process.env.GITHUB_TOKEN;
  if (gh && !("gh" in overrides) && !overrides.github) {
    const result = await gh(["auth", "token"]);
    if (result.code === 0 && result.stdout.trim()) token = result.stdout.trim();
  }
  return {
    gh,
    github: overrides.github ?? { apiUrl: "https://api.github.com", ...(token && { token }) },
    cwd: overrides.cwd ?? process.cwd(),
    ...(overrides.git && { git: overrides.git }),
    ...(overrides.wait && { wait: overrides.wait }),
  };
}

// npm runs the CLI through a symbolic link (node_modules/.bin/tessello), hence the real path.
if (process.argv[1] && realpathSync(process.argv[1]) === fileURLToPath(import.meta.url)) {
  process.exitCode = await run(process.argv.slice(2), {
    out: (text) => console.log(text),
    err: (text) => console.error(text),
  });
}
