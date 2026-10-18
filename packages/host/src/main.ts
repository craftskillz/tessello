// The Host's interface: the Modules folder, the Launcher, the Home and its Widgets, the View area, and installing a
// Module from a dropped or chosen .zip file or from a folder placed in the Modules folder.

import type { Issue, Manifest, Permissions } from "@tessello/convention";
import {
  createHost,
  type HomeWidget,
  type Host,
  type Icon,
  type Inspection,
  type ModuleEntry,
  type MountedSurface,
  type Theme,
} from "@tessello/host-core";
import { copyModulesFolder, createFolderPersistence } from "./folder-persistence.ts";
import { canUseFolders, hasTesselloFolder, isGranted, pickFolder, reconnect, rememberedFolder, rememberFolder } from "./modules-folder.ts";
import { buildView, dataUrl, IFRAME_SANDBOX, typeOf, type ViewDocument } from "./srcdoc.ts";

const THEME: Theme = {
  mode: "light",
  colors: { background: "#ffffff", surface: "#f4f5f7", text: "#16181d", textMuted: "#5f6670", accent: "#2f6fec", border: "#d9dce1" },
};

const byId = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const gate = byId<HTMLElement>("gate");
const launcher = byId<HTMLElement>("launcher");
const stage = byId<HTMLElement>("stage");
const home = byId<HTMLElement>("home");
const homeEmpty = byId<HTMLElement>("home-empty");
const widgetList = byId<HTMLOListElement>("widgets");
const arrangeButton = byId<HTMLButtonElement>("arrange-button");
const launcherList = byId<HTMLUListElement>("launcher-modules");
const folderButton = byId<HTMLButtonElement>("folder-button");
const dialog = byId<HTMLDialogElement>("dialog");
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

function button(label: string, onClick: () => void, className = "") {
  const element = el("button", { type: "button", className }, label);
  element.addEventListener("click", onClick);
  return element;
}

const iconUrl = (icon: Icon) => dataUrl(typeOf(icon.path), icon.bytes);

// ---------------------------------------------------------------------------------------------------------------------
// The Modules folder: nothing else is usable until the Host may use it.

/** Shows a full page instead of the Host, with these children. */
function showGate(...children: Node[]) {
  launcher.hidden = stage.hidden = true;
  gate.replaceChildren(...children);
  gate.hidden = false;
}

const FOLDER_EXPLANATION = [
  el(
    "p",
    {},
    "Tessello keeps each Module in its own folder there, and the data of your Modules under ",
    el("code", {}, ".tessello/data/"),
    ". Nothing in it is sent anywhere.",
  ),
  el(
    "p",
    {},
    "You can version this folder with git. The data of a Module may contain secrets, such as API tokens: exclude ",
    el("code", {}, ".tessello/data/"),
    " from git if needed.",
  ),
  el("p", {}, "Choosing a folder that already holds a .tessello/ folder finds its Modules, Permissions and data as they were."),
  el(
    "p",
    {},
    "Your browser remembers this folder for this address of Tessello only. Opened from another address, such as a local copy, Tessello asks for the folder again: choose the same one to find the same Modules.",
  ),
];

function showUnsupported() {
  showGate(
    el("h1", {}, "Tessello needs Chrome or Edge on a computer"),
    el(
      "p",
      {},
      "Tessello keeps your Modules and their data in a folder of your computer, and only Chrome and Edge on a computer let a web page use a folder. Open this page in one of them.",
    ),
  );
}

function showChooseFolder() {
  showGate(
    el("h1", {}, "Choose your Modules folder"),
    ...FOLDER_EXPLANATION,
    el(
      "div",
      { className: "actions" },
      button(
        "Choose a folder…",
        async () => {
          const folder = await pickFolder();
          if (folder) await useFolder(folder);
        },
        "primary",
      ),
    ),
  );
}

function showReconnect(folder: FileSystemDirectoryHandle) {
  showGate(
    el("h1", {}, "Reconnect your Modules folder"),
    el("p", {}, `Your browser asks again for permission to use your Modules folder, “${folder.name}”.`),
    el(
      "div",
      { className: "actions" },
      button("Choose another folder…", async () => {
        const other = await pickFolder();
        if (other) await useFolder(other);
      }),
      button(
        `Reconnect “${folder.name}”`,
        async () => {
          if (await reconnect(folder)) await start(folder);
        },
        "primary",
      ),
    ),
  );
}

async function useFolder(folder: FileSystemDirectoryHandle) {
  await rememberFolder(folder);
  await start(folder);
}

/** Moves to another Modules folder: Modules and `.tessello/` are copied there, unless it already holds a space. */
async function changeFolder(from: FileSystemDirectoryHandle) {
  const to = await pickFolder();
  if (!to || (await to.isSameEntry(from))) return;
  if (!(await hasTesselloFolder(to))) await copyModulesFolder(from, to);
  await rememberFolder(to);
  location.reload();
}

function showFolderSettings(folder: FileSystemDirectoryHandle) {
  dialog.replaceChildren(
    el("h2", { id: "dialog-title" }, "Modules folder"),
    el("p", {}, "Your Modules and their data are in the folder ", el("strong", {}, `“${folder.name}”`), "."),
    el(
      "p",
      {},
      "Choosing another folder copies your Modules and ",
      el("code", {}, ".tessello/"),
      " there, and leaves this one as it is. A folder that already holds a .tessello/ folder is used as it is.",
    ),
    el(
      "div",
      { className: "actions" },
      button("Close", () => dialog.close()),
      button("Choose another folder…", () => void changeFolder(folder), "primary"),
    ),
  );
  dialog.showModal();
}

// ---------------------------------------------------------------------------------------------------------------------
// The Host, once its Modules folder is usable.

let host: Host;
let entries: ModuleEntry[] = [];
/**
 * What the stage shows besides the Home: a View, or a message in its place. Behind the Home, a View stays loaded and
 * hidden until another one opens, so that its Widget can bring it back as it was.
 */
let current: { id: string; surface?: MountedSurface; element: HTMLElement } | null = null;
/** The latest View asked for: a View whose document is still being built when another one is asked for is dropped. */
let requested: object | null = null;

async function start(folder: FileSystemDirectoryHandle) {
  host = createHost({
    persistence: createFolderPersistence(folder),
    locale: "en",
    theme: THEME,
    openView: ({ module, params }) => {
      // A View of this Module behind the Home has already been given the params.
      if (current?.id === module.id && current.surface && current.element.hidden) bringBackView();
      else void showView(module.id, params);
    },
  });
  window.addEventListener("message", (event) => host.receive({ source: event.source, data: event.data }));
  document.addEventListener("visibilitychange", updateVisibility);
  // A folder may have appeared or changed while the User was in another application.
  window.addEventListener("focus", () => void refresh());
  folderButton.textContent = `Modules folder: ${folder.name}`;
  folderButton.addEventListener("click", () => showFolderSettings(folder));
  gate.hidden = true;
  launcher.hidden = stage.hidden = false;
  await refresh();
  showHome();
}

async function refresh() {
  entries = await host.modules();
  renderLauncher();
  await renderHome();
}

/** Tells each View and Widget whether it is shown: the Home hides its Widgets behind a View (CONVENTION.md §6.4). */
function updateVisibility() {
  const pageShown = document.visibilityState === "visible";
  for (const cell of cells.values()) cell.surface?.setVisible(pageShown && !home.hidden);
  current?.surface?.setVisible(pageShown && !current.element.hidden);
}

function clearStage() {
  current?.surface?.unmount();
  current?.element.remove();
  current = null;
  home.hidden = true;
  updateVisibility();
}

function showHome() {
  requested = null;
  if (current?.surface) current.element.hidden = true;
  else clearStage();
  home.hidden = false;
  renderLauncher();
  updateVisibility();
}

/** Shows again the View left behind the Home. */
function bringBackView() {
  requested = null;
  home.hidden = true;
  current!.element.hidden = false;
  renderLauncher();
  updateVisibility();
}

/** Starts a View or Widget in its iframe, which must be in the page: the files go to it once it has loaded. */
function startSurface(iframe: HTMLIFrameElement, document: ViewDocument, surface: MountedSurface) {
  iframe.addEventListener(
    "load",
    () => {
      // The loader in the srcdoc waits for the Module's files, which it accepts only once.
      iframe.contentWindow!.postMessage(document.message, "*", document.transfer);
      surface.loaded();
    },
    { once: true },
  );
}

/** Shows a message in place of a Module's View. */
function showInStage(id: string, ...children: Node[]) {
  clearStage();
  const element = el("section", { className: "surface-error", role: "alert" }, ...children);
  stage.append(element);
  current = { id, element };
  renderLauncher();
}

const nameOf = (id: string) => entries.find((entry) => entry.id === id)?.name ?? id;

function permissionList(permissions: Permissions) {
  return el(
    "ul",
    { className: "permissions" },
    ...Object.entries(permissions).flatMap(([name, origins]: [string, string[]]) =>
      origins.map((origin) => el("li", {}, `${name}: `, el("code", {}, origin))),
    ),
  );
}

async function showView(id: string, params: Record<string, string> = {}) {
  const request = (requested = {});
  const opening = await host.open(id);
  if (requested !== request) return;
  if (opening.status === "missing") {
    await refresh();
    showInStage(id, el("h2", {}, `${nameOf(id)} can't be found`), missingExplanation(id));
    return;
  }
  if (opening.status === "invalid") {
    showInStage(
      id,
      el("h2", {}, `${nameOf(id)} no longer complies with the Convention`),
      el("p", {}, "Its folder has changed, and it does not run until it is fixed. The Validator reports:"),
      errorList(opening.report.issues),
    );
    return;
  }
  if (opening.status === "permissions") {
    // Ticket 06 replaces this raw list with the consent screen.
    showInStage(
      id,
      el("h2", {}, `${opening.manifest.name} asks for new Permissions`),
      el("p", {}, "Its folder now declares Permissions you have not granted. It does not run until you accept them:"),
      permissionList(opening.added),
      el(
        "div",
        { className: "actions" },
        button("Decline", showHome),
        button(
          "Accept",
          async () => {
            await opening.accept();
            await showView(id, params);
          },
          "primary",
        ),
      ),
    );
    return;
  }

  const { manifest, files, permissions } = opening;
  const view = await buildView({ files, entry: manifest.view.entry, permissions });
  if (requested !== request) return;
  clearStage();
  const iframe = el("iframe", { className: "view-frame", title: manifest.name, sandbox: IFRAME_SANDBOX });
  iframe.srcdoc = view.srcdoc;
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
      error.hidden = iframe.hidden;
      current = { id: manifest.id, element: error };
    },
  });
  startSurface(iframe, view, surface);
  current = { id: manifest.id, surface, element: iframe };
  await refresh();
}

const missingExplanation = (id: string) => {
  const folder = entries.find((entry) => entry.id === id)?.folder;
  return el(
    "p",
    {},
    `Its folder${folder ? ` “${folder}”` : ""} is no longer in your Modules folder. Put it back, under any name, to find this Module and its data again.`,
  );
};

const STATUS_LABELS: Record<ModuleEntry["status"], string> = {
  active: "",
  new: "New, to activate",
  conflict: "Conflict",
  missing: "Not found",
};

function renderLauncher() {
  launcherList.replaceChildren(
    ...entries.map((entry) => {
      const label = STATUS_LABELS[entry.status];
      const entryButton = el(
        "button",
        { type: "button", className: entry.status },
        entry.icon ? el("img", { src: iconUrl(entry.icon), alt: "" }) : el("span", { className: "no-icon" }),
        el("span", { className: "name" }, entry.name),
        ...(label ? [el("span", { className: "status" }, label)] : []),
      );
      if (entry.id !== null && current?.id === entry.id && !current.element.hidden && entry.status === "active") {
        entryButton.setAttribute("aria-current", "page");
      }
      entryButton.addEventListener("click", () => onLauncherClick(entry));
      return el("li", {}, entryButton);
    }),
  );
}

function onLauncherClick(entry: ModuleEntry) {
  if (entry.status === "active") void showView(entry.id!);
  else if (entry.status === "new") void showInspection(`the folder “${entry.folder}”`, host.inspectFolder(entry.folder), "folder");
  else if (entry.status === "conflict") {
    const registered = entries.find((other) => other.status !== "conflict" && other.id === entry.id);
    showDialog(
      `“${entry.folder}” is in conflict`,
      el(
        "p",
        {},
        `This folder declares the Module ID `,
        el("code", {}, entry.id!),
        `, which the Module in “${registered?.folder}” already uses. Only that one runs. Give this one its own Module ID in its Manifest, or remove one of the two folders.`,
      ),
    );
  } else showDialog(`${entry.name} can't be found`, missingExplanation(entry.id!));
}

// ---------------------------------------------------------------------------------------------------------------------
// The Home: the Widgets of the active Modules in a grid of cells, in the order the User arranges (CONVENTION.md §7.1).

interface WidgetCell {
  widget: HomeWidget;
  element: HTMLLIElement;
  /** Where the iframe, or a message in its place, goes. */
  body: HTMLElement;
  surface?: MountedSurface;
  /** Shows an error in place of the Widget: it is tried again the next time the Home is brought in line. */
  failed?: boolean;
}

/** The Widgets on the Home, by Module ID, in no particular order: the list's children hold the order. */
const cells = new Map<string, WidgetCell>();
let homeRendering = Promise.resolve();
let arranging = false;

/**
 * Brings the Home in line with the Modules folder. A Widget already shown is moved, not reloaded: `moveBefore` keeps an
 * iframe running where `insertBefore` would reload it (in Chrome and Edge since version 133).
 */
function renderHome(): Promise<void> {
  homeRendering = homeRendering
    .then(async () => {
      const widgets = await host.home();
      for (const [id, cell] of cells) {
        const widget = widgets.find((candidate) => candidate.id === id);
        if (!widget || widget.size !== cell.widget.size) removeCell(cell);
      }
      let previous: Element | null = null;
      for (const widget of widgets) {
        const cell = cells.get(widget.id) ?? createCell(widget);
        const next: Element | null = previous ? previous.nextElementSibling : widgetList.firstElementChild;
        if (cell.element !== next) {
          if (cell.element.isConnected) widgetList.moveBefore(cell.element, next);
          else widgetList.insertBefore(cell.element, next);
        }
        previous = cell.element;
        if (!cell.body.hasChildNodes() || cell.failed) void mountWidget(cell);
      }
      homeEmpty.hidden = widgets.length > 0;
      arrangeButton.hidden = widgets.length < 2;
      if (arrangeButton.hidden && arranging) toggleArranging();
      updateVisibility();
    })
    .catch((error: unknown) => console.error("The Home could not be shown:", error));
  return homeRendering;
}

function createCell(widget: HomeWidget): WidgetCell {
  const body = el("div", { className: "widget-body" });
  const element = el(
    "li",
    { className: `widget size-${widget.size}`, "aria-label": widget.name, draggable: arranging },
    body,
    el(
      "div",
      { className: "arrange" },
      el("span", { className: "arrange-name" }, widget.name),
      button("←", () => void move(widget.id, -1), "move"),
      button("→", () => void move(widget.id, 1), "move"),
    ),
  );
  const [earlier, later] = element.querySelectorAll<HTMLButtonElement>(".move");
  earlier.setAttribute("aria-label", `Move ${widget.name} earlier`);
  later.setAttribute("aria-label", `Move ${widget.name} later`);
  element.dataset.id = widget.id;
  element.addEventListener("dragstart", (event) => {
    event.dataTransfer!.setData(WIDGET_DRAG, widget.id);
    event.dataTransfer!.effectAllowed = "move";
  });
  element.addEventListener("dragover", (event) => {
    if (arranging && event.dataTransfer?.types.includes(WIDGET_DRAG)) event.preventDefault();
  });
  element.addEventListener("drop", (event) => {
    const dragged = event.dataTransfer?.getData(WIDGET_DRAG);
    if (!arranging || !dragged) return;
    event.preventDefault();
    event.stopPropagation();
    const order = homeOrder().filter((id) => id !== dragged);
    // Dropped on a Widget, the dragged one takes its place.
    const target = homeOrder().indexOf(widget.id);
    order.splice(target, 0, dragged);
    void arrange(order);
  });
  const cell = { widget, element, body };
  cells.set(widget.id, cell);
  return cell;
}

const WIDGET_DRAG = "application/x-tessello-widget";

declare global {
  interface ParentNode {
    /** Moves a node without removing it first (not yet in TypeScript's DOM types). */
    moveBefore(node: Node, child: Node | null): void;
  }
}

function removeCell(cell: WidgetCell) {
  cell.surface?.unmount();
  cell.element.remove();
  cells.delete(cell.widget.id);
}

/** Shows a message in place of a Widget; the other Widgets are not affected (CONVENTION.md §6.4). */
function showWidgetError(cell: WidgetCell, title: string, message: string) {
  cell.failed = true;
  cell.body.replaceChildren(el("div", { className: "widget-error", role: "alert" }, el("strong", {}, title), el("p", {}, message)));
}

async function mountWidget(cell: WidgetCell) {
  cell.failed = false;
  cell.body.replaceChildren(el("div", { className: "widget-loading" }));
  try {
    await startWidget(cell);
  } catch (error) {
    console.error(`The Widget of ${cell.widget.id} could not be shown:`, error);
    if (cells.get(cell.widget.id) === cell) showWidgetError(cell, `${cell.widget.name} can't be shown`, "Something went wrong while starting it.");
  }
}

async function startWidget(cell: WidgetCell) {
  const { id, name } = cell.widget;
  const opening = await host.open(id);
  if (cells.get(id) !== cell) return;
  if (opening.status !== "ready" || !opening.manifest.widget) {
    const reasons: Record<Exclude<typeof opening.status, "ready">, string> = {
      missing: "Its folder is no longer in your Modules folder.",
      invalid: "It no longer complies with the Convention: open it from the Launcher to see why.",
      permissions: "It asks for new Permissions: open it from the Launcher.",
    };
    showWidgetError(cell, `${name} can't be shown`, opening.status === "ready" ? "It no longer has a Widget." : reasons[opening.status]);
    return;
  }
  const { manifest, files, permissions } = opening;
  const document = await buildView({ files, entry: manifest.widget!.entry, permissions });
  if (cells.get(id) !== cell) return;
  const iframe = el("iframe", { className: "widget-frame", title: `${manifest.name} widget`, sandbox: IFRAME_SANDBOX });
  iframe.srcdoc = document.srcdoc;
  cell.body.replaceChildren(iframe);
  const surface = host.mountSurface({
    frame: iframe.contentWindow!,
    module: { id: manifest.id, version: manifest.version },
    surface: "widget",
    onHandshakeTimeout: () => {
      if (cell.surface !== surface) return;
      surface.unmount();
      cell.surface = undefined;
      showWidgetError(cell, `${manifest.name} is not responding`, "This Widget did not finish starting.");
    },
  });
  cell.surface = surface;
  startSurface(iframe, document, surface);
  updateVisibility();
}

/** The Module IDs of the Widgets, as the Home shows them. */
const homeOrder = () => [...widgetList.children].map((element) => (element as HTMLElement).dataset.id!);

async function arrange(order: string[]) {
  try {
    await host.arrangeHome(order);
  } catch (error) {
    console.error("The order of the Widgets could not be saved:", error);
  }
  await renderHome();
}

function move(id: string, offset: number) {
  const order = homeOrder();
  const from = order.indexOf(id);
  const to = from + offset;
  if (to < 0 || to >= order.length) return;
  order.splice(to, 0, ...order.splice(from, 1));
  return arrange(order);
}

/** In arrangement, the Widgets do not take clicks: each one can be dragged or moved with its buttons. */
function toggleArranging() {
  arranging = !arranging;
  home.classList.toggle("arranging", arranging);
  arrangeButton.textContent = arranging ? "Done" : "Arrange widgets";
  for (const cell of cells.values()) cell.element.draggable = arranging;
}

arrangeButton.addEventListener("click", toggleArranging);

// ---------------------------------------------------------------------------------------------------------------------
// Installing a Module (CONVENTION.md §8).

function showDialog(title: string, ...children: (Node | string)[]) {
  dialog.replaceChildren(
    el("h2", { id: "dialog-title" }, title),
    ...children,
    el("div", { className: "actions" }, button("Close", () => dialog.close(), "primary")),
  );
  dialog.showModal();
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

const errorList = (issues: Issue[]) => issueList(issues.filter((issue) => issue.severity === "error"));

function moduleSummary(manifest: Manifest, icon: Icon) {
  return el(
    "div",
    { className: "module-summary" },
    el("img", { src: iconUrl(icon), alt: `${manifest.name} icon` }),
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
      ...(Object.keys(manifest.permissions ?? {}).length > 0 ? [el("dt", {}, "Permissions"), el("dd", {}, permissionList(manifest.permissions!))] : []),
    ),
  );
}

/** Shows what is about to be activated, or why it cannot be. `source` names it: a .zip file or a folder. */
async function showInspection(source: string, pending: Promise<Inspection>, kind: "zip" | "folder") {
  const inspection = await pending;
  if (inspection.status === "invalid") {
    showDialog(
      kind === "zip" ? `${source} can't be installed` : `${source} can't be activated`,
      el("p", {}, `This is not a valid Tessello Module. Nothing was ${kind === "zip" ? "installed" : "activated"}. The Validator reports:`),
      errorList(inspection.report.issues),
    );
    return;
  }
  if (inspection.status === "conflict") {
    showDialog(
      `${inspection.manifest.name} is already installed`,
      el(
        "p",
        {},
        "Its Module ID ",
        el("code", {}, inspection.manifest.id),
        ` is already used by the Module in the folder “${inspection.folder}”. Nothing was installed: updating a Module from a .zip is not available yet.`,
      ),
    );
    return;
  }

  const { manifest, icon, report } = inspection;
  const warnings = report.issues.filter((issue) => issue.severity === "warning");
  const confirm = el("button", { type: "button", className: "primary" }, kind === "zip" ? "Install" : "Activate");
  confirm.addEventListener("click", async () => {
    confirm.disabled = true;
    await inspection.install();
    dialog.close();
    await refresh();
    await showView(manifest.id);
  });
  dialog.replaceChildren(
    el("h2", { id: "dialog-title" }, kind === "zip" ? `Install ${manifest.name}?` : `Activate ${manifest.name}?`),
    ...(kind === "folder" ? [el("p", {}, `Found in ${source} of your Modules folder.`)] : []),
    moduleSummary(manifest, icon),
    ...(warnings.length > 0 ? [el("p", {}, "The Validator has warnings; the Module can still be installed:"), issueList(warnings)] : []),
    el("div", { className: "actions" }, button("Cancel", () => dialog.close()), confirm),
  );
  dialog.showModal();
}

const installZip = async (file: File) => showInspection(file.name, host.inspectZip(new Uint8Array(await file.arrayBuffer())), "zip");

// Dropping a file anywhere on the Host installs it.
document.body.addEventListener("dragover", (event) => {
  if (!host || !event.dataTransfer?.types.includes("Files")) return;
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
  if (host && file) void installZip(file);
});
fileInput.addEventListener("change", () => {
  const file = fileInput.files?.[0];
  fileInput.value = "";
  if (file) void installZip(file);
});
byId<HTMLButtonElement>("home-button").addEventListener("click", showHome);

if (!canUseFolders()) showUnsupported();
else {
  const folder = await rememberedFolder();
  if (!folder) showChooseFolder();
  else if (await isGranted(folder)) await start(folder);
  else showReconnect(folder);
}
