import { readdir, readFile, stat } from "node:fs/promises";
import { join, relative, sep } from "node:path";
import { validatePackage, validateZip, type Issue, type ValidationReport } from "@tessello/convention";

// Files a Creator's folder may contain that are never part of a package.
const IGNORED_NAMES = new Set([".DS_Store", ".git"]);

/** Validates a Module folder or .zip archive on disk. */
export async function validatePath(path: string): Promise<ValidationReport> {
  const info = await stat(path);
  if (info.isDirectory()) return validatePackage(await readFolder(path));
  return validateZip(new Uint8Array(await readFile(path)));
}

async function readFolder(root: string): Promise<Map<string, Uint8Array>> {
  const files = new Map<string, Uint8Array>();
  const entries = await readdir(root, { recursive: true, withFileTypes: true });
  for (const entry of entries) {
    if (!entry.isFile()) continue;
    const absolute = join(entry.parentPath, entry.name);
    const path = relative(root, absolute).split(sep).join("/");
    if (path.split("/").some((part) => IGNORED_NAMES.has(part))) continue;
    files.set(path, new Uint8Array(await readFile(absolute)));
  }
  return files;
}

/** Human-readable report, meant to be read by Creators and by LLMs fixing their Module. */
export function formatReport(target: string, report: ValidationReport): string {
  const lines: string[] = [];
  const identity = report.manifest ? ` (${report.manifest.id} ${report.manifest.version})` : "";
  lines.push(`Validating ${target}${identity}`);

  const errors = report.issues.filter((issue) => issue.severity === "error");
  const warnings = report.issues.filter((issue) => issue.severity === "warning");
  for (const issue of [...errors, ...warnings]) lines.push(formatIssue(issue));

  const count = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;
  lines.push(
    report.valid
      ? `✓ ${count(warnings.length, "warning")}: this Module is installable.`
      : `${count(errors.length, "error")}, ${count(warnings.length, "warning")}: this Module is not installable.`,
  );
  return lines.join("\n");
}

function formatIssue(issue: Issue): string {
  const mark = issue.severity === "error" ? "✗" : "⚠";
  return `${mark} ${issue.message} [${issue.code}]`;
}
