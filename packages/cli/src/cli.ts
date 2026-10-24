#!/usr/bin/env node
import { realpathSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { execCommand, publishCommand, type Gh, type GhResult, type PublishDeps } from "./publish-command.ts";
import { formatReport, validatePath } from "./validate-command.ts";

const USAGE = `Usage: tessello <command>

Commands:
  validate <path> [--json]   Check a Module folder or .zip against the Tessello Convention.
                             Exits with 1 if the Module is not installable.
  publish <package.zip> --url <URL>
                             Prepare the Marketplace listing for a package you have published
                             at <URL> and open the pull request (run \`tessello publish\` for options).`;

interface Output {
  out: (text: string) => void;
  err: (text: string) => void;
}

/** Runs the CLI and returns the process exit code: 0 success, 1 invalid Module, 2 usage error. */
export async function run(args: string[], output: Output, deps: Partial<PublishDeps> = {}): Promise<number> {
  const [command, ...rest] = args;

  if (command === "publish") return publishCommand(rest, output, await publishDeps(deps));

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
