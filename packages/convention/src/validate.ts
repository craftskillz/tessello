import { unzipSync } from "fflate";
import { GUIDE_IMAGE_EXTENSIONS, guideImagePath, guideImageSources } from "./guide.ts";
import { LIMITS, SUPPORTED_CONVENTIONS, WIDGET_SIZES } from "./limits.ts";
import { invalidEntryReason, isCovered, PERMISSION_NAMES, type Permissions } from "./permissions.ts";
import { pngSize } from "./png.ts";

/** A Module package in memory: relative path → file content. */
export type PackageFiles = ReadonlyMap<string, Uint8Array>;

export type Severity = "error" | "warning";

export interface Issue {
  severity: Severity;
  /** Stable machine-readable code, e.g. "manifest/invalid-id". */
  code: string;
  message: string;
  /** Package path the issue relates to, when there is one. */
  file?: string;
}

export interface Manifest {
  convention: number;
  id: string;
  name: string;
  version: string;
  description?: string;
  icon: string;
  view: { entry: string };
  /** The package path of the User guide, a Markdown file (ADR 0010). */
  guide: string;
  widget?: { entry: string; size: "S" | "M" | "L" };
  permissions?: Permissions;
}

export interface ValidationReport {
  /** True when there is no error; warnings do not prevent installation. */
  valid: boolean;
  issues: Issue[];
  /** The parsed Manifest, only when the package is valid. */
  manifest: Manifest | null;
}

const MANIFEST = "manifest.json";
const ID_PATTERN = /^@[a-z0-9][a-z0-9-]{0,38}\/[a-z0-9][a-z0-9-]{0,63}$/;
const SEMVER_PATTERN =
  /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-((?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*)(?:\.(?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*))*))?$/;
const KNOWN_FIELDS = new Set(["convention", "id", "name", "version", "description", "icon", "view", "guide", "widget", "permissions"]);
const TEXT_EXTENSIONS = [".html", ".htm", ".js", ".mjs"];
const HTML_EXTENSIONS = [".html", ".htm"];

// Absolute URLs a source loads or calls (best effort): src attributes, <link href>, fetch/WebSocket/EventSource/import, static imports.
const REMOTE_URL_PATTERNS = [
  /\bsrc\s*=\s*["']((?:https?|wss?):\/\/[^"']+)/gi,
  /<link\b[^>]*\bhref\s*=\s*["']((?:https?):\/\/[^"']+)/gi,
  /\b(?:fetch|WebSocket|EventSource|import)\s*\(\s*["'`]((?:https?|wss?):\/\/[^"'`]+)/g,
  /\bfrom\s*["']((?:https?):\/\/[^"']+)/g,
];

// APIs a sandboxed Module cannot use (CONVENTION.md §4).
const SANDBOX_APIS: { name: string; pattern: RegExp; hint: string }[] = [
  { name: "localStorage", pattern: /\blocalStorage\b/, hint: "use the Host storage (storage.get / storage.set)" },
  { name: "sessionStorage", pattern: /\bsessionStorage\b/, hint: "use the Host storage (storage.get / storage.set)" },
  { name: "indexedDB", pattern: /\bindexedDB\b/, hint: "use the Host storage (storage.get / storage.set)" },
  { name: "document.cookie", pattern: /\bdocument\.cookie\b/, hint: "use the Host storage (storage.get / storage.set)" },
  { name: "window.top", pattern: /\bwindow\.top\b/, hint: "talk to the Host with postMessage only" },
  { name: "an embedded frame", pattern: /<(?:iframe|frame|object|embed)\b/i, hint: "the Host blocks frames, even from a declared origin" },
  {
    name: "alert / confirm / prompt",
    pattern: /(?<![\w$.])(?:alert|confirm|prompt)\s*\(|\bwindow\.(?:alert|confirm|prompt)\s*\(/,
    hint: "render dialogs inside the page instead",
  },
];

/** Whether `id` is a valid Module Identifier, `@namespace/name` (CONVENTION.md §3). */
export function isModuleId(id: string): boolean {
  return ID_PATTERN.test(id);
}

/** Whether `version` is a valid semver version (CONVENTION.md §3). */
export function isSemver(version: string): boolean {
  return SEMVER_PATTERN.test(version);
}

/** Validates a .zip package (CONVENTION.md §9). Never throws. */
export function validateZip(bytes: Uint8Array): ValidationReport {
  return readZip(bytes).report;
}

/** Validates a .zip package and, when it is readable, also returns its files, which the Host installs. Never throws. */
export function readZip(bytes: Uint8Array): { report: ValidationReport; files: PackageFiles | null } {
  let files: Map<string, Uint8Array>;
  let declaredBytes = 0;
  try {
    const entries = unzipSync(bytes, {
      // Sums declared sizes before inflating, so an oversized archive is never decompressed.
      filter: (file) => {
        if (isArchiveNoise(file.name) || file.name.endsWith("/")) return false;
        declaredBytes += file.originalSize;
        return declaredBytes <= LIMITS.packageBytes;
      },
    });
    files = new Map(Object.entries(entries));
  } catch {
    return { report: report([error("package/invalid-zip", "The file is not a readable .zip archive.")], null), files: null };
  }
  if (declaredBytes > LIMITS.packageBytes) {
    return { report: report([tooLarge(declaredBytes)], null), files: null };
  }
  return { report: validatePackage(files), files };
}

/** Validates a package given as in-memory files (CONVENTION.md §9). Never throws. */
export function validatePackage(files: PackageFiles): ValidationReport {
  const issues: Issue[] = [];

  for (const path of files.keys()) {
    if (isUnsafePath(path)) {
      issues.push(error("package/unsafe-path", `"${path}" is absolute or contains "..": package paths must be relative.`, path));
    }
  }
  const totalBytes = [...files.values()].reduce((sum, bytes) => sum + bytes.byteLength, 0);
  if (totalBytes > LIMITS.packageBytes) issues.push(tooLarge(totalBytes));

  const manifestBytes = files.get(MANIFEST);
  if (!manifestBytes) {
    issues.push(error("manifest/missing", missingManifestMessage(files)));
    return report(issues, null);
  }

  let raw: unknown;
  try {
    raw = JSON.parse(new TextDecoder().decode(manifestBytes).replace(/^﻿/, ""));
  } catch (e) {
    issues.push(error("manifest/invalid-json", `manifest.json is not valid JSON: ${(e as Error).message}`, MANIFEST));
    return report(issues, null);
  }
  if (!isObject(raw)) {
    issues.push(error("manifest/invalid-json", "manifest.json must contain a JSON object.", MANIFEST));
    return report(issues, null);
  }

  checkManifest(raw, files, issues);
  checkSources(raw, files, issues);

  const valid = !issues.some((issue) => issue.severity === "error");
  return report(issues, valid ? (raw as unknown as Manifest) : null);
}

function checkManifest(m: Record<string, unknown>, files: PackageFiles, issues: Issue[]): void {
  const field = (name: string) => `manifest.json: "${name}"`;

  if (m.convention === undefined) {
    issues.push(required("convention"));
  } else if (!Number.isInteger(m.convention)) {
    issues.push(error("manifest/invalid-convention", `${field("convention")} must be an integer, got ${show(m.convention)}.`, MANIFEST));
  } else if (!SUPPORTED_CONVENTIONS.includes(m.convention as number)) {
    issues.push(
      error(
        "manifest/unsupported-convention",
        `${field("convention")} is ${m.convention}; supported versions: ${SUPPORTED_CONVENTIONS.join(", ")}.`,
        MANIFEST,
      ),
    );
  }

  checkString(m, "id", issues, isModuleId, "manifest/invalid-id",
    `must look like "@namespace/name" (lowercase letters, digits and "-"; namespace ≤ 39 chars, name ≤ 64 chars)`);
  checkString(m, "name", issues, (v) => v.trim().length >= 1 && v.length <= LIMITS.nameMaxLength, "manifest/invalid-name",
    `must be 1 to ${LIMITS.nameMaxLength} characters`);
  checkString(m, "version", issues, isSemver, "manifest/invalid-version",
    `must be a semantic version such as "1.0.0" or "1.0.0-beta.1"`);
  if (m.description !== undefined) {
    checkString(m, "description", issues, (v) => v.length <= LIMITS.descriptionMaxLength, "manifest/invalid-description",
      `must be at most ${LIMITS.descriptionMaxLength} characters`);
  }

  if (checkString(m, "icon", issues)) checkIcon(m.icon as string, files, issues);

  if (m.view === undefined) {
    issues.push(required("view"));
  } else if (!isObject(m.view)) {
    issues.push(error("manifest/invalid-type", `${field("view")} must be an object with an "entry" field.`, MANIFEST));
  } else {
    checkEntry(m.view, "view", files, issues);
  }

  if (checkString(m, "guide", issues)) checkGuide(m.guide as string, files, issues);

  if (m.widget !== undefined) {
    if (!isObject(m.widget)) {
      issues.push(error("manifest/invalid-type", `${field("widget")} must be an object with "entry" and "size" fields.`, MANIFEST));
    } else {
      checkEntry(m.widget, "widget", files, issues);
      if (m.widget.size === undefined) {
        issues.push(required("widget.size"));
      } else if (typeof m.widget.size !== "string" || !WIDGET_SIZES.includes(m.widget.size)) {
        issues.push(
          error("manifest/invalid-widget-size", `${field("widget.size")} is ${show(m.widget.size)}; expected "S", "M" or "L".`, MANIFEST),
        );
      }
    }
  }

  if (m.permissions !== undefined) checkPermissions(m.permissions, issues);

  for (const key of Object.keys(m)) {
    if (!KNOWN_FIELDS.has(key)) {
      issues.push(warning("manifest/unknown-field", `${field(key)} is not defined by the Convention and will be ignored.`, MANIFEST));
    }
  }
}

function checkPermissions(permissions: unknown, issues: Issue[]): void {
  if (!isObject(permissions)) {
    issues.push(error("permissions/invalid", `manifest.json: "permissions" must be an object, got ${show(permissions)}.`, MANIFEST));
    return;
  }
  for (const [name, entries] of Object.entries(permissions)) {
    if (!PERMISSION_NAMES.includes(name)) {
      issues.push(
        error("permissions/unknown", `manifest.json: unknown Permission "${name}"; known Permissions: ${PERMISSION_NAMES.join(", ")}.`, MANIFEST),
      );
      continue;
    }
    if (!Array.isArray(entries) || !entries.every((entry) => typeof entry === "string")) {
      issues.push(error("permissions/invalid", `manifest.json: "permissions.${name}" must be an array of strings.`, MANIFEST));
      continue;
    }
    for (const entry of entries as string[]) {
      const reason = invalidEntryReason(name, entry);
      if (reason) issues.push(error("permissions/invalid", `manifest.json: "permissions.${name}" entry "${entry}" ${reason}.`, MANIFEST));
    }
  }
}

/** Checks a required string field; returns true when it is a string that passes `isValid`. */
function checkString(
  m: Record<string, unknown>,
  name: string,
  issues: Issue[],
  isValid?: (value: string) => boolean,
  code?: string,
  rule?: string,
): boolean {
  const value = m[name];
  if (value === undefined) {
    issues.push(required(name));
    return false;
  }
  if (typeof value !== "string") {
    issues.push(error("manifest/invalid-type", `manifest.json: "${name}" must be a string, got ${show(value)}.`, MANIFEST));
    return false;
  }
  if (isValid && !isValid(value)) {
    issues.push(error(code!, `manifest.json: "${name}" is ${show(value)}; it ${rule}.`, MANIFEST));
    return false;
  }
  return true;
}

function checkEntry(section: Record<string, unknown>, sectionName: string, files: PackageFiles, issues: Issue[]): void {
  const name = `${sectionName}.entry`;
  const entry = section.entry;
  if (entry === undefined) {
    issues.push(required(name));
  } else if (typeof entry !== "string") {
    issues.push(error("manifest/invalid-type", `manifest.json: "${name}" must be a string, got ${show(entry)}.`, MANIFEST));
  } else if (checkReferencedFile(name, entry, files, issues) && !hasExtension(entry, HTML_EXTENSIONS)) {
    issues.push(error("manifest/entry-not-html", `manifest.json: "${name}" must point to an .html page, got "${entry}".`, MANIFEST));
  }
}

function checkIcon(icon: string, files: PackageFiles, issues: Issue[]): void {
  if (!checkReferencedFile("icon", icon, files, issues)) return;
  if (hasExtension(icon, [".svg"])) return;
  if (!hasExtension(icon, [".png"])) {
    issues.push(error("icon/invalid-format", `The icon "${icon}" must be an .svg or .png file.`, icon));
    return;
  }
  const size = pngSize(files.get(icon)!);
  const min = LIMITS.iconMinPngPixels;
  if (!size) {
    issues.push(error("icon/invalid-png", `The icon "${icon}" is not a valid PNG image.`, icon));
  } else if (size.width !== size.height) {
    issues.push(error("icon/not-square", `The icon "${icon}" is ${size.width}×${size.height} px; it must be square.`, icon));
  } else if (size.width < min) {
    issues.push(error("icon/too-small", `The icon "${icon}" is ${size.width}×${size.height} px; it must be at least ${min}×${min} px.`, icon));
  }
}

/** Checks the User guide: a Markdown file with some text, whose images are in the package (ADR 0010). */
function checkGuide(guide: string, files: PackageFiles, issues: Issue[]): void {
  if (!checkReferencedFile("guide", guide, files, issues)) return;
  if (!hasExtension(guide, [".md"])) {
    issues.push(error("manifest/guide-not-markdown", `manifest.json: "guide" must point to a Markdown file (.md), got "${guide}".`, MANIFEST));
    return;
  }
  const markdown = new TextDecoder().decode(files.get(guide));
  if (!markdown.trim()) {
    issues.push(error("guide/empty", `The User guide "${guide}" is empty.`, guide));
    return;
  }
  for (const src of guideImageSources(markdown)) {
    const path = guideImagePath(guide, src);
    if (path === null) {
      issues.push(
        warning("guide/remote-image", `${guide} shows the image "${src}", which is not in the package; the Host shows only images of the package.`, guide),
      );
    } else if (!files.has(path) || !hasExtension(path, GUIDE_IMAGE_EXTENSIONS)) {
      issues.push(warning("guide/missing-image", `${guide} shows the image "${src}", but "${path}" is not an image of the package.`, guide));
    }
  }
}

/** Checks that a Manifest path is safe and exists; returns true when it does. */
function checkReferencedFile(fieldName: string, path: string, files: PackageFiles, issues: Issue[]): boolean {
  if (isUnsafePath(path)) {
    issues.push(error("manifest/unsafe-path", `manifest.json: "${fieldName}" is "${path}"; paths must be relative and must not contain "..".`, MANIFEST));
    return false;
  }
  if (!files.has(path)) {
    issues.push(error("manifest/file-not-found", `manifest.json: "${fieldName}" points to "${path}", which is not in the package.`, MANIFEST));
    return false;
  }
  return true;
}

/** Best-effort static checks of HTML and JavaScript sources (warnings only). */
function checkSources(m: Record<string, unknown>, files: PackageFiles, issues: Issue[]): void {
  const decoder = new TextDecoder();
  let sendsReady = false;
  const declared = declaredOrigins(m.permissions);

  for (const [path, bytes] of files) {
    if (!hasExtension(path, TEXT_EXTENSIONS)) continue;
    const source = decoder.decode(bytes);

    if (hasExtension(path, HTML_EXTENSIONS) && /\b(?:src|href)\s*=\s*["']\/(?!\/)/i.test(source)) {
      issues.push(
        warning("source/absolute-path", `${path} references a resource with an absolute path ("/…"); use a relative path instead.`, path),
      );
    }
    for (const api of SANDBOX_APIS) {
      if (api.pattern.test(source)) {
        issues.push(warning("sandbox/unavailable-api", `${path} uses ${api.name}, which is unavailable in the sandbox; ${api.hint}.`, path));
      }
    }
    for (const origin of undeclaredOrigins(source, declared)) {
      issues.push(
        warning(
          "permissions/undeclared-origin",
          `${path} reaches ${origin}, which is not declared in "permissions"; the Host will block it. Add it to "permissions.network" (or "permissions.localNetwork" for a local address).`,
          path,
        ),
      );
    }
    if (/["'`]ready["'`]|@tessello\/sdk/.test(source)) sendsReady = true;
  }

  if (!sendsReady && isObject(m.view)) {
    issues.push(
      warning(
        "lifecycle/no-ready",
        `No source sends the "ready" request; the Host will show an error if the View or Widget never completes the handshake.`,
      ),
    );
  }
}

/** Every well-formed entry of the known Permissions; invalid ones are reported elsewhere. */
function declaredOrigins(permissions: unknown): string[] {
  if (!isObject(permissions)) return [];
  return PERMISSION_NAMES.flatMap((name) => {
    const entries = permissions[name];
    return Array.isArray(entries) ? entries.filter((entry): entry is string => typeof entry === "string") : [];
  });
}

/** Origins of the absolute URLs a source loads or calls that no declared entry covers, each reported once. */
function undeclaredOrigins(source: string, declared: string[]): string[] {
  const origins = new Set<string>();
  for (const pattern of REMOTE_URL_PATTERNS) {
    for (const match of source.matchAll(pattern)) {
      const url = match[1]!;
      if (url.includes("${")) continue; // template literal: host unknown statically
      if (isCovered(url, declared)) continue;
      try {
        origins.add(new URL(url).origin);
      } catch {
        // Not a parsable URL: nothing reliable to report.
      }
    }
  }
  return [...origins];
}

function missingManifestMessage(files: PackageFiles): string {
  const nested = [...files.keys()].find((path) => path.split("/").length === 2 && path.endsWith(`/${MANIFEST}`));
  return nested
    ? `manifest.json must be at the package root, but it was found in "${nested.split("/")[0]}/". Zip the contents of that folder, not the folder itself.`
    : "manifest.json is missing at the package root.";
}

function isUnsafePath(path: string): boolean {
  return path.startsWith("/") || path.includes("\\") || /^[a-zA-Z]:/.test(path) || path.split("/").includes("..");
}

function isArchiveNoise(name: string): boolean {
  return name.startsWith("__MACOSX/") || name === ".DS_Store" || name.endsWith("/.DS_Store");
}

function hasExtension(path: string, extensions: readonly string[]): boolean {
  const lower = path.toLowerCase();
  return extensions.some((ext) => lower.endsWith(ext));
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function show(value: unknown): string {
  return JSON.stringify(value) ?? String(value);
}

function tooLarge(bytes: number): Issue {
  const mb = (n: number) => (n / (1024 * 1024)).toFixed(1);
  return error("package/too-large", `The package is ${mb(bytes)} MB uncompressed; the limit is ${mb(LIMITS.packageBytes)} MB.`);
}

function required(name: string): Issue {
  return error("manifest/field-required", `manifest.json: required field "${name}" is missing.`, MANIFEST);
}

function error(code: string, message: string, file?: string): Issue {
  return file ? { severity: "error", code, message, file } : { severity: "error", code, message };
}

function warning(code: string, message: string, file?: string): Issue {
  return file ? { severity: "warning", code, message, file } : { severity: "warning", code, message };
}

function report(issues: Issue[], manifest: Manifest | null): ValidationReport {
  return { valid: !issues.some((issue) => issue.severity === "error"), issues, manifest };
}
