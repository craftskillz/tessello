#!/usr/bin/env node
import { realpathSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { formatReport, validatePath } from "./validate-command.ts";

const USAGE = `Usage: tessello <command>

Commands:
  validate <path> [--json]   Check a Module folder or .zip against the Tessello Convention.
                             Exits with 1 if the Module is not installable.`;

interface Output {
  out: (text: string) => void;
  err: (text: string) => void;
}

/** Runs the CLI and returns the process exit code: 0 success, 1 invalid Module, 2 usage error. */
export async function run(args: string[], output: Output): Promise<number> {
  const [command, ...rest] = args;

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

// npm runs the CLI through a symbolic link (node_modules/.bin/tessello), hence the real path.
if (process.argv[1] && realpathSync(process.argv[1]) === fileURLToPath(import.meta.url)) {
  process.exitCode = await run(process.argv.slice(2), {
    out: (text) => console.log(text),
    err: (text) => console.error(text),
  });
}
