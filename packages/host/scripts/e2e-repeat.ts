// Runs browser test files several times, one after the other, then summarizes: the duration of each file (median,
// longest) and every test that failed at least once. Run by `just e2e-repeat N [names…]`.

import { glob } from "node:fs/promises";
import { cpus, release, totalmem, type as osType } from "node:os";
import { join, relative } from "node:path";
import { run as runTests } from "node:test";
import { spec } from "node:test/reporters";
import { pipeline } from "node:stream/promises";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

/** What one run of one test file reported. */
export interface FileRun {
  file: string;
  durationMs: number;
  events: TestEvent[];
}

/** An event of the `node:test` reporter stream, as `run()` emits it. */
export interface TestEvent {
  type: "test:start" | "test:pass" | "test:fail";
  data: { name: string; nesting: number; details?: { error?: { failureType?: string; message?: string; cause?: unknown } } };
}

export interface Summary {
  files: { file: string; runs: number; medianMs: number; maxMs: number }[];
  /** `failed` counts the runs of its file it failed in, out of `runs`. */
  failures: { file: string; test: string; failed: number; runs: number; firstMessage: string }[];
}

/**
 * Failures that only repeat another: a suite failing because a test in it did, and the tests a failed hook stopped (the
 * hook's own failure is reported on its suite).
 */
const ECHOES = new Set(["subtestsFailed", "cancelledByParent"]);

/**
 * What a failed test threw, on one line: an assertion's generated message is only useful with what follows its first
 * line ("Expected values to be strictly equal: 1 !== 0"). `node:test` wraps it as the `cause` of its own error.
 */
function messageOf(error: { message?: string; cause?: unknown } = {}): string {
  const { cause } = error;
  const message = cause instanceof Error ? cause.message : cause === undefined ? (error.message ?? "") : String(cause);
  return message.split("\n").map((line) => line.trim()).filter(Boolean).join(" ");
}

/** The full names of the tests that failed in a run, as "suite › test", each with its first message. */
function failuresOf({ events }: FileRun): Map<string, string> {
  const failures = new Map<string, string>();
  const path: string[] = [];
  for (const { type, data } of events) {
    path.length = data.nesting;
    if (type === "test:start") path.push(data.name);
    if (type !== "test:fail" || ECHOES.has(data.details?.error?.failureType ?? "")) continue;
    const test = [...path, data.name].join(" › ");
    if (!failures.has(test)) failures.set(test, messageOf(data.details?.error));
  }
  return failures;
}

const median = (values: number[]) => {
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
};

/** The summary of every run, of every file: the slowest files first. */
export function summarize(runs: FileRun[]): Summary {
  const durationsByFile = new Map<string, number[]>();
  for (const { file, durationMs } of runs) durationsByFile.set(file, [...(durationsByFile.get(file) ?? []), durationMs]);
  const files = [...durationsByFile].map(([file, durations]) => ({
    file,
    runs: durations.length,
    medianMs: median(durations),
    maxMs: Math.max(...durations),
  }));
  const failures = new Map<string, Summary["failures"][number]>();
  for (const fileRun of runs) {
    const { file } = fileRun;
    for (const [test, message] of failuresOf(fileRun)) {
      const key = `${file}\0${test}`;
      const failure = failures.get(key) ?? { file, test, failed: 0, runs: durationsByFile.get(file)!.length, firstMessage: message };
      failure.failed++;
      failures.set(key, failure);
    }
  }
  return {
    files: files.sort((a, b) => b.medianMs - a.medianMs),
    failures: [...failures.values()].sort((a, b) => b.failed - a.failed),
  };
}

const seconds = (ms: number) => `${(ms / 1000).toFixed(1)} s`;

/** The summary as Markdown, ready for `.scratch/e2e-reliability/mesures.md`. */
function formatSummary({ files, failures }: Summary, setting: string): string {
  const lines = [setting, "", "| File | Runs | Median | Longest |", "|---|---|---|---|"];
  for (const { file, runs, medianMs, maxMs } of files) lines.push(`| \`${file}\` | ${runs} | ${seconds(medianMs)} | ${seconds(maxMs)} |`);
  lines.push("");
  if (!failures.length) lines.push("No test failed.");
  else lines.push("| Test | Failed | First message |", "|---|---|---|");
  for (const { file, test, failed, runs, firstMessage } of failures) {
    lines.push(`| \`${file}\` ${test.replaceAll("|", "\\|")} | ${failed}/${runs} | ${firstMessage.replaceAll("|", "\\|")} |`);
  }
  return lines.join("\n");
}

/** Runs one test file with `node:test`, showing its progress, and records what its reporter emitted. */
async function runFile(file: string, root: string): Promise<FileRun> {
  const events: TestEvent[] = [];
  const start = performance.now();
  const stream = runTests({ files: [file], concurrency: 1 });
  for (const type of ["test:start", "test:pass", "test:fail"] as const) stream.on(type, (data) => events.push({ type, data }));
  await pipeline(stream.compose(spec), process.stdout, { end: false });
  return { file: relative(root, file), durationMs: performance.now() - start, events };
}

/** The machine, the versions and the CPU slowdown the runs were made with. */
async function setting(passes: number): Promise<string> {
  const browser = await chromium.launch();
  const chromiumVersion = browser.version();
  await browser.close();
  const slowdown = process.env.E2E_CPU_SLOWDOWN ?? "none";
  return [
    `${passes} passes, ${new Date().toISOString().slice(0, 10)}, E2E_CPU_SLOWDOWN: ${slowdown}.`,
    `${cpus()[0]?.model} (${cpus().length} cores, ${Math.round(totalmem() / 2 ** 30)} GB), ${osType()} ${release()}, Node ${process.version}, Chromium ${chromiumVersion}.`,
  ].join(" ");
}

/** The files matching a pattern under `root`, in order, as absolute paths. */
async function filesMatching(pattern: string, root: string): Promise<string[]> {
  const files: string[] = [];
  for await (const path of glob(pattern, { cwd: root })) files.push(join(root, path));
  return files.sort();
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const [count, ...names] = process.argv.slice(2);
  const passes = Number(count);
  if (!Number.isInteger(passes) || passes < 1) throw new Error(`Usage: e2e-repeat.ts N [names…], N a number of passes, not "${count}".`);
  const root = fileURLToPath(new URL("../../../", import.meta.url));
  const files = names.length
    ? names.map((name) => join(root, "packages/host/e2e", `${name}.test.ts`))
    : await filesMatching("packages/*/e2e/*.test.ts", root);
  const runs: FileRun[] = [];
  for (let pass = 1; pass <= passes; pass++) {
    for (const file of files) {
      console.log(`\n== Pass ${pass}/${passes}: ${relative(root, file)}`);
      runs.push(await runFile(file, root));
    }
  }
  console.log(`\n${formatSummary(summarize(runs), await setting(passes))}`);
}
