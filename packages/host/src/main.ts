// The Host's interface: the Launcher, the View area and installing a Module from a dropped or chosen .zip file.

import type { Issue, Manifest, PackageFiles } from "@tessello/convention";
import { createHost, type InstalledModule, type MountedSurface, type Theme } from "@tessello/host-core";
import { openIndexedDbPersistence } from "./indexeddb-persistence.ts";
import { buildSrcdoc, dataUrl, IFRAME_SANDBOX, typeOf } from "./srcdoc.ts";

const THEME: Theme = {
  mode: "light",
  colors: { background: "#ffffff", surface: "#f4f5f7", text: "#16181d", textMuted: "#5f6670", accent: "#2f6fec", border: "#d9dce1" },
};

const byId = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const stage = byId<HTMLElement>("stage");
const home = byId<HTMLElement>("home");
const launcherList = byId<HTMLUListElement>("launcher-modules");
const installDialog = byId<HTMLDialogElement>("install-dialog");
const fileInput = byId<HTMLInputElement>("install-file");

/** Creates an element with properties (or attributes, for names containing "-") and children. */
function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  props: Record<string, unknown> = {},
  ...children: (Node | string)[]
): HTMLElementTagNameMap[K] {
  const element = document.createElement(tag);
  for (const [name, value] of Object.entries(props)) {
    if (name.includes("-")) element.setAttribute(name, String(value));
    else Object.assign(element, { [name]: value });
  }
  element.append(...children);
  return element;
}

const iconOf = (manifest: Manifest, files: PackageFiles) => dataUrl(typeOf(manifest.icon), files.get(manifest.icon)!);

const host = createHost({
  persistence: await openIndexedDbPersistence(),
  locale: "en",
  theme: THEME,
  openView: ({ module, params }) => {
    const installed = modules.find((candidate) => candidate.manifest.id === module.id);
    if (installed) void showView(installed, params);
  },
});
window.addEventListener("message", (event) => host.receive({ source: event.source, data: event.data }));

let modules: InstalledModule[] = [];
/** The View on screen, if any. */
let current: { id: string; surface: MountedSurface; element: HTMLElement } | null = null;

function clearStage() {
  current?.surface.unmount();
  current?.element.remove();
  current = null;
  home.hidden = true;
}

function showHome() {
  requested = null;
  clearStage();
  home.hidden = false;
  renderLauncher();
}

/** The latest View asked for: a View whose document is still being built when another one is asked for is dropped. */
let requested: object | null = null;

async function showView(module: InstalledModule, params: Record<string, string> = {}) {
  const request = (requested = {});
  const { manifest, files } = module;
  // Ticket 06 adds the consent screen: until then the CSP follows the Permissions declared in the Manifest.
  const srcdoc = await buildSrcdoc({ files, entry: manifest.view.entry, permissions: manifest.permissions });
  if (requested !== request) return;
  clearStage();
  const iframe = el("iframe", { className: "view-frame", title: manifest.name, sandbox: IFRAME_SANDBOX });
  iframe.srcdoc = srcdoc;
  stage.append(iframe);
  const surface = host.mountSurface({
    frame: iframe.contentWindow!,
    module: { id: manifest.id, version: manifest.version },
    surface: "view",
    params,
    // Replaces only this View: the rest of the Host keeps working (CONVENTION.md §6.4).
    onHandshakeTimeout: () => {
      if (current?.surface !== surface) return;
      surface.unmount();
      const error = el(
        "section",
        { className: "surface-error", role: "alert" },
        el("h2", {}, `${manifest.name} is not responding`),
        el("p", {}, "This Module did not finish starting. It may be broken: try again later, or ask its Creator for a fixed version."),
      );
      iframe.replaceWith(error);
      current = { id: manifest.id, surface, element: error };
    },
  });
  iframe.addEventListener("load", () => surface.loaded(), { once: true });
  current = { id: manifest.id, surface, element: iframe };
  renderLauncher();
}

function renderLauncher() {
  launcherList.replaceChildren(
    ...modules.map((module) => {
      const { manifest, files } = module;
      const button = el(
        "button",
        { type: "button" },
        el("img", { src: iconOf(manifest, files), alt: "" }),
        el("span", {}, manifest.name),
      );
      if (current?.id === manifest.id) button.setAttribute("aria-current", "page");
      button.addEventListener("click", () => void showView(module));
      return el("li", {}, button);
    }),
  );
}

function issueList(issues: Issue[]) {
  return el(
    "ul",
    { className: "issues" },
    ...issues.map((issue) =>
      el("li", { className: issue.severity }, `${issue.severity === "error" ? "Error" : "Warning"}: ${issue.message} `, el("code", {}, `[${issue.code}]`)),
    ),
  );
}

function closeButton(label: string, primary = false) {
  const button = el("button", { type: "button", className: primary ? "primary" : "" }, label);
  button.addEventListener("click", () => installDialog.close());
  return button;
}

/** Shows what is about to be installed, or why it cannot be (CONVENTION.md §8). */
async function inspectFile(file: File) {
  const inspection = host.inspect(new Uint8Array(await file.arrayBuffer()));
  if (!inspection.ok) {
    const errors = inspection.report.issues.filter((issue) => issue.severity === "error");
    installDialog.replaceChildren(
      el("h2", { id: "install-title" }, `${file.name} can't be installed`),
      el("p", {}, "This file is not a valid Tessello Module. Nothing was installed. The Validator reports:"),
      issueList(errors),
      el("div", { className: "actions" }, closeButton("Close", true)),
    );
    installDialog.showModal();
    return;
  }

  const { manifest, files, report } = inspection;
  const warnings = report.issues.filter((issue) => issue.severity === "warning");
  const install = el("button", { type: "button", className: "primary" }, "Install");
  install.addEventListener("click", async () => {
    install.disabled = true;
    const installed = await inspection.install();
    modules = await host.modules();
    installDialog.close();
    await showView(installed);
  });
  installDialog.replaceChildren(
    el("h2", { id: "install-title" }, `Install ${manifest.name}?`),
    el(
      "div",
      { className: "module-summary" },
      el("img", { src: iconOf(manifest, files), alt: `${manifest.name} icon` }),
      el(
        "dl",
        {},
        el("dt", {}, "Name"),
        el("dd", {}, manifest.name),
        el("dt", {}, "Version"),
        el("dd", {}, manifest.version),
        el("dt", {}, "Module ID"),
        el("dd", {}, el("code", {}, manifest.id)),
        ...(manifest.description ? [el("dt", {}, "Description"), el("dd", {}, manifest.description)] : []),
      ),
    ),
    ...(warnings.length > 0 ? [el("p", {}, "The Validator has warnings; the Module can still be installed:"), issueList(warnings)] : []),
    el("div", { className: "actions" }, closeButton("Cancel"), install),
  );
  installDialog.showModal();
}

// Dropping a file anywhere on the Host installs it.
document.body.addEventListener("dragover", (event) => {
  if (!event.dataTransfer?.types.includes("Files")) return;
  event.preventDefault();
  document.body.classList.add("dragging");
});
document.body.addEventListener("dragleave", (event) => {
  if (event.relatedTarget === null) document.body.classList.remove("dragging");
});
document.body.addEventListener("drop", (event) => {
  event.preventDefault();
  document.body.classList.remove("dragging");
  const file = event.dataTransfer?.files[0];
  if (file) void inspectFile(file);
});
fileInput.addEventListener("change", () => {
  const file = fileInput.files?.[0];
  fileInput.value = "";
  if (file) void inspectFile(file);
});
byId<HTMLButtonElement>("home-button").addEventListener("click", showHome);

modules = await host.modules();
showHome();
