// What both kinds of rounds of `tessello sync` share: running git, its identity, its quiet wait.

import { execFile } from "node:child_process";

/** The identity of the commits in a repository whose git has none configured. */
export const COMMIT_IDENTITY = ["-c", "user.name=tessello sync", "-c", "user.email=sync@tessello.invalid"];
/** A changed file younger than this is probably still being written: its commit waits for the next round. */
export const QUIET_MS = 10_000;

const MAX_PUSH_MESSAGE = 500;

/** git's stderr without its advice, shortened. */
export function shortened(output: string): string {
  const lines = output.split("\n").map((l) => l.trim()).filter((l) => l && !l.startsWith("hint:"));
  const text = lines.join("\n");
  return text.length > MAX_PUSH_MESSAGE ? `${text.slice(0, MAX_PUSH_MESSAGE - 1)}…` : text;
}

export interface GitResult {
  code: number;
  stdout: string;
  stderr: string;
  /** The binary could not be started. */
  missing: boolean;
  /** Killed because it ran past its timeout. */
  timedOut: boolean;
}

export function runGit(git: string, args: string[], cwd: string, options: { env?: NodeJS.ProcessEnv; timeout?: number } = {}): Promise<GitResult> {
  return new Promise((done) => {
    execFile(git, args, { cwd, encoding: "utf8", maxBuffer: 256 * 1024 * 1024, ...options }, (error, stdout, stderr) => {
      const code = error ? (typeof error.code === "number" ? error.code : 1) : 0;
      done({ code, stdout, stderr, missing: (error as NodeJS.ErrnoException | null)?.code === "ENOENT", timedOut: Boolean(error?.killed) });
    });
  });
}
