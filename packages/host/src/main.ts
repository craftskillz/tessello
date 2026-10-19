// The Host's interface: the Modules folder, the Launcher, the Home and its Widgets, the View area, installing or
// updating a Module from a dropped or chosen .zip file, from a URL or an install link, or from a folder placed in the
// Modules folder, uninstalling, and the Settings: the theme and the language of the interface.

import type { Issue, Manifest, Permissions } from "@tessello/convention";
import {
  createHost,
  type HomeWidget,
  type Host,
  type Icon,
  type Inspection,
  type ModuleEntry,
  type MountedSurface,
  type Opening,
} from "@tessello/host-core";
import { copyModulesFolder, createFolderPersistence } from "./folder-persistence.ts";
import { GUIDE_SANDBOX, guideDocument } from "./guide.ts";
import { type Language, languageOf, LANGUAGES, type Messages, messagesOf } from "./i18n.ts";
import { checkPackageUrl, downloadPackage } from "./package-url.ts";
import { canUseFolders, hasTesselloFolder, isGranted, pickFolder, reconnect, rememberedFolder, rememberFolder } from "./modules-folder.ts";
import { buildView, dataUrl, IFRAME_SANDBOX, typeOf, type ViewDocument } from "./srcdoc.ts";
import { THEME_CHOICES, type ThemeChoice, themeChoiceOf, themeOf } from "./theme.ts";

// The User's theme and language, kept by this browser for this address of Tessello. Storage may be refused, as in a
// private window: the choice then lasts until the page is closed.
const PREFERENCES = { theme: "tessello.theme", language: "tessello.language" };

function readPreference(name: keyof typeof PREFERENCES): string | null {
  try {
    return localStorage.getItem(PREFERENCES[name]);
  } catch {
    return null;
  }
}

function savePreference(name: keyof typeof PREFERENCES, value: string) {
  try {
    localStorage.setItem(PREFERENCES[name], value);
  } catch {
    // Kept for this page only.
  }
}

const language: Language = languageOf(readPreference("language"));
const t: Messages = messagesOf(language);

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

document.documentElement.lang = language;
for (const element of document.querySelectorAll<HTMLElement>("[data-i18n]")) {
  element.textContent = t[element.dataset.i18n as keyof Messages] as string;
}
for (const element of document.querySelectorAll<HTMLElement>("[data-i18n-label]")) {
  element.setAttribute("aria-label", t[element.dataset.i18nLabel as keyof Messages] as string);
}

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
  el("p", {}, ...t.folderKeeps(el("code", {}, ".tessello/data/"))),
  el("p", {}, ...t.folderGit(el("code", {}, ".tessello/data/"))),
  el("p", {}, t.folderExisting),
  el("p", {}, t.folderAddress),
];

/**
 * Shown when the browser has no `showDirectoryPicker`: without it the Host cannot use the Modules folder. Opened from
 * an install link, it names the Module's URL and lets the User copy the link, to open it in another browser.
 */
function showUnsupported(link: InstallLink | null) {
  const copyButton = (link: InstallLink) => {
    const copy = button(t.copyInstallLink, async () => {
      try {
        await navigator.clipboard.writeText(link.href);
        copy.textContent = t.installLinkCopied;
      } catch {
        copy.replaceWith(el("code", {}, link.href));
      }
    });
    return copy;
  };
  showGate(
    el("h1", {}, t.unsupportedTitle),
    el("p", {}, t.unsupportedText),
    ...(link
      ? [
          el("p", {}, ...t.unsupportedLink(el("code", {}, link.url))),
          el("div", { className: "actions" }, copyButton(link)),
        ]
      : []),
  );
}

/** An install link: the package URL it carries, and the whole link, to open it elsewhere. */
interface InstallLink {
  url: string;
  href: string;
}

/** An install link's package URL, kept while the User chooses or reconnects the Modules folder. */
let pendingInstall: string | null = null;

/** On the Modules folder pages, tells the User that the Module of an install link waits for the folder. */
const pendingNote = () =>
  pendingInstall === null
    ? []
    : [el("p", { className: "pending-install" }, ...t.pendingInstall(el("code", {}, pendingInstall)))];

function showChooseFolder() {
  showGate(
    el("h1", {}, t.chooseFolderTitle),
    ...pendingNote(),
    ...FOLDER_EXPLANATION,
    el(
      "div",
      { className: "actions" },
      button(
        t.chooseFolder,
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
    el("h1", {}, t.reconnectTitle),
    el("p", {}, t.reconnectText(folder.name)),
    ...pendingNote(),
    el(
      "div",
      { className: "actions" },
      button(t.chooseAnotherFolder, async () => {
        const other = await pickFolder();
        if (other) await useFolder(other);
      }),
      button(
        t.reconnect(folder.name),
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
    el("h2", { id: "dialog-title" }, t.modulesFolder),
    el("p", {}, ...t.folderIs(el("strong", {}, t.quote(folder.name)))),
    el("p", {}, ...t.folderChange(el("code", {}, ".tessello/"))),
    el("div", { className: "actions" }, button(t.chooseAnotherFolder, () => void changeFolder(folder))),
    el("h3", {}, t.exportImportTitle),
    el("p", {}, t.exportExplanation),
    el("p", {}, t.importExplanation),
    el(
      "div",
      { className: "actions" },
      button(t.importSpace, () => spaceInput.click()),
      button(t.exportSpace, () => void exportSpace(), "primary"),
    ),
    el("div", { className: "actions" }, button(t.close, () => dialog.close())),
  );
  dialog.showModal();
}


// ---------------------------------------------------------------------------------------------------------------------
// The Settings: the theme, given to every View and Widget (CONVENTION.md §6.2), and the language of the interface,
// given to the Modules in their context (§6.4), which is why changing it restarts the Host.

const systemDark = matchMedia("(prefers-color-scheme: dark)");
let themeChoice: ThemeChoice = themeChoiceOf(readPreference("theme"));
let theme = themeOf(themeChoice, systemDark.matches);
/** Renders again the User guide shown, if any, in the current theme. */
let renderGuideFrame: (() => void) | null = null;

/** Applies the theme to the interface, the Views and Widgets mounted, and the User guide shown. */
function applyTheme() {
  theme = themeOf(themeChoice, systemDark.matches);
  const root = document.documentElement;
  const variables = { background: "--background", surface: "--surface", text: "--text", textMuted: "--text-muted", accent: "--accent", border: "--border" };
  for (const [color, variable] of Object.entries(variables)) root.style.setProperty(variable, theme.colors[color as keyof typeof variables]);
  root.style.colorScheme = theme.mode;
  root.dataset.mode = theme.mode;
  host?.setTheme(theme);
  renderGuideFrame?.();
}

systemDark.addEventListener("change", applyTheme);

const THEME_LABELS: Record<ThemeChoice, string> = { system: t.themeSystem, light: t.themeLight, dark: t.themeDark };

function showSettings() {
  const themes = el(
    "fieldset",
    {},
    el("legend", {}, t.theme),
    ...THEME_CHOICES.map((choice) => {
      const input = el("input", { type: "radio", name: "theme", value: choice, checked: choice === themeChoice });
      input.addEventListener("change", () => {
        themeChoice = choice;
        savePreference("theme", choice);
        applyTheme();
      });
      return el("label", {}, input, THEME_LABELS[choice]);
    }),
  );
  const select = el(
    "select",
    { name: "language" },
    ...LANGUAGES.map((option) => el("option", { value: option.language, selected: option.language === language, lang: option.language }, option.name)),
  );
  select.addEventListener("change", () => {
    savePreference("language", select.value);
    location.reload();
  });
  dialog.replaceChildren(
    el("h2", { id: "dialog-title" }, t.settings),
    el("div", { className: "settings" }, themes, el("label", { className: "language" }, t.language, select), el("p", { className: "note" }, t.languageNote)),
    el("div", { className: "actions" }, button(t.close, () => dialog.close(), "primary")),
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
    locale: language,
    theme,
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
  folderButton.textContent = t.modulesFolderButton(folder.name);
  folderButton.addEventListener("click", () => showFolderSettings(folder));
  gate.hidden = true;
  launcher.hidden = stage.hidden = false;
  await refresh();
  showHome();
  if (pendingInstall !== null) {
    const url = pendingInstall;
    pendingInstall = null;
    installLinked(url);
  }
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

/** A Permission entry in plain language: its host and port, without the scheme. */
function describeOrigin(origin: string) {
  const [, scheme, server] = /^([a-z]+):\/\/(.*)$/.exec(origin)!;
  const where = server.startsWith("*.") ? t.anySubdomain(server.slice(2)) : server;
  return scheme.startsWith("ws") ? t.liveConnection(where) : where;
}

const originList = (origins: string[]) => el("ul", { className: "origins" }, ...origins.map((origin) => el("li", {}, describeOrigin(origin))));

let summaryCount = 0;

/**
 * What a Module can do with these Permissions, in plain language, and what they do not guarantee (ADR 0008): the
 * servers it contacts are limited, its files, the Host and the other Modules are isolated, and what the User enters
 * in it can still leave.
 */
function permissionSummary(name: string, permissions: Permissions, title = t.whatCanDo(name)) {
  const id = `permission-summary-${++summaryCount}`;
  const network = permissions.network ?? [];
  const local = permissions.localNetwork ?? [];
  return el(
    "section",
    { className: "permission-summary", "aria-labelledby": id },
    el("h3", { id }, title),
    ...(network.length + local.length === 0 ? [el("p", {}, t.noNetwork(name))] : []),
    ...(network.length > 0 ? [el("p", {}, el("strong", {}, t.limited), t.limitedText(name)), originList(network)] : []),
    ...(local.length > 0
      ? [
          el(
            "div",
            { className: "sensitive" },
            el("p", {}, el("strong", {}, t.localNetwork), t.localNetworkText),
            originList(local),
          ),
        ]
      : []),
    el("p", { className: "limits" }, el("strong", {}, t.isolated), t.isolatedText(name)),
    el("p", { className: "limits" }, el("strong", {}, t.notGuaranteed), t.notGuaranteedText(name)),
  );
}

async function showView(id: string, params: Record<string, string> = {}) {
  const request = (requested = {});
  const opening = await host.open(id);
  if (requested !== request) return;
  if (opening.status === "missing") {
    await refresh();
    showInStage(id, el("h2", {}, t.cantBeFound(nameOf(id))), missingExplanation(id));
    return;
  }
  if (opening.status === "invalid") {
    showInStage(
      id,
      el("h2", {}, t.noLongerComplies(nameOf(id))),
      el("p", {}, t.folderChangedReports),
      errorList(opening.report.issues),
    );
    return;
  }
  if (opening.status === "permissions") {
    const { name } = opening.manifest;
    showInStage(
      id,
      el("h2", {}, t.asksNewPermissions(name)),
      el("p", {}, t.newPermissionsText),
      permissionSummary(name, opening.added, t.whatCanNowAlsoDo(name)),
      el(
        "div",
        { className: "actions" },
        button(t.decline, showHome),
        button(
          t.accept,
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
        el("h2", {}, t.notResponding(manifest.name)),
        el("p", {}, t.viewNotResponding),
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
  return el("p", {}, t.missingFolder(folder));
};

const STATUS_LABELS: Record<ModuleEntry["status"], string> = {
  active: "",
  new: t.statusNew,
  conflict: t.statusConflict,
  missing: t.statusMissing,
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
      if (entry.status !== "active") return el("li", {}, entryButton);
      // Named "About" only: "About Notes" would also answer to the name of the Module's own button.
      const aboutButton = el("button", { type: "button", className: "entry-about", title: t.aboutTitle(entry.name), "aria-label": t.about }, "ⓘ");
      aboutButton.addEventListener("click", () => void showAbout(entry));
      return el("li", {}, entryButton, aboutButton);
    }),
  );
}

/**
 * An active Module: what it is, its User guide, and the Permissions the User granted, to which the Host limits it
 * whatever its folder declares now. Its folder is read again, as when its View opens.
 */
async function showAbout(entry: ModuleEntry) {
  const opening = await host.open(entry.id!);
  dialog.classList.remove("guide");
  showDialog(
    t.aboutTitle(entry.name),
    ...(opening.status === "ready"
      ? [
          moduleSummary(opening.manifest, { path: opening.manifest.icon, bytes: opening.files.get(opening.manifest.icon)! }),
          el("div", { className: "actions start" }, button(t.userGuide, () => showGuide(entry, opening), "primary")),
        ]
      : [el("p", {}, t.aboutFolderChanged(entry.name))]),
    el("p", {}, t.aboutPermissions),
    permissionSummary(entry.name, entry.permissions ?? {}),
    el("div", { className: "actions" }, button(t.uninstallEllipsis, () => confirmUninstall(entry), "danger")),
  );
}

/** A Module's User guide, in a wide dialog (CONVENTION.md §3.2): the Host renders it, and nothing of the Module runs. */
function showGuide(entry: ModuleEntry, { manifest, files }: Extract<Opening, { status: "ready" }>) {
  const title = t.guideTitle(entry.name);
  const frame = el("iframe", { className: "guide-frame", title, sandbox: GUIDE_SANDBOX });
  renderGuideFrame = () => (frame.srcdoc = guideDocument({ files, guide: manifest.guide, title, theme }));
  renderGuideFrame();
  dialog.classList.add("guide");
  dialog.replaceChildren(
    el("h2", { id: "dialog-title" }, title),
    frame,
    el("div", { className: "actions" }, button(t.back, () => void showAbout(entry)), button(t.close, () => dialog.close(), "primary")),
  );
}

dialog.addEventListener("close", () => {
  dialog.classList.remove("guide");
  renderGuideFrame = null;
});

/** Uninstalls a Module once the User confirms: its folder and its data are removed (CONVENTION.md §8). */
function confirmUninstall(entry: ModuleEntry) {
  const id = entry.id!;
  const confirm = el("button", { type: "button", className: "danger" }, t.uninstall);
  confirm.addEventListener("click", async () => {
    confirm.disabled = true;
    // Stopped first, so that no View or Widget writes to the storage being removed.
    dropSurfaces(id);
    showHome();
    try {
      await host.uninstall(id);
      dialog.close();
    } catch (error) {
      console.error(`${entry.name} could not be uninstalled:`, error);
      showDialog(t.couldNotUninstall(entry.name), el("p", {}, t.folderFailed));
    }
    await refresh();
  });
  dialog.replaceChildren(
    el("h2", { id: "dialog-title" }, t.uninstallTitle(entry.name)),
    el("p", {}, entry.status === "missing" ? t.uninstallMissing(entry.folder) : t.uninstallDeletes(entry.folder)),
    el("div", { className: "actions" }, button(t.cancel, () => dialog.close()), confirm),
  );
  dialog.showModal();
}

/**
 * Stops the View and the Widget of a Module whose code was replaced or removed. The Home mounts its Widget again on its
 * next refresh; a View shown is opened again, one behind the Home is dropped.
 */
function dropSurfaces(id: string): boolean {
  const cell = cells.get(id);
  if (cell) removeCell(cell);
  if (current?.id !== id) return false;
  const shown = !current.element.hidden;
  current.surface?.unmount();
  current.element.remove();
  current = null;
  return shown;
}

function onLauncherClick(entry: ModuleEntry) {
  if (entry.status === "active") void showView(entry.id!);
  else if (entry.status === "new") void showInspection(t.theFolder(entry.folder), host.inspectFolder(entry.folder), "folder");
  else if (entry.status === "conflict") {
    const registered = entries.find((other) => other.status !== "conflict" && other.id === entry.id);
    showDialog(t.conflictTitle(entry.folder), el("p", {}, ...t.conflictText(el("code", {}, entry.id!), registered?.folder ?? "")));
  } else {
    showDialog(
      t.cantBeFound(entry.name),
      missingExplanation(entry.id!),
      el("div", { className: "actions" }, button(t.uninstallEllipsis, () => confirmUninstall(entry), "danger")),
    );
  }
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
  earlier.setAttribute("aria-label", t.moveEarlier(widget.name));
  later.setAttribute("aria-label", t.moveLater(widget.name));
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
    if (cells.get(cell.widget.id) === cell) showWidgetError(cell, t.cantBeShown(cell.widget.name), t.widgetStartFailed);
  }
}

async function startWidget(cell: WidgetCell) {
  const { id, name } = cell.widget;
  const opening = await host.open(id);
  if (cells.get(id) !== cell) return;
  if (opening.status !== "ready" || !opening.manifest.widget) {
    const reasons: Record<Exclude<typeof opening.status, "ready">, string> = {
      missing: t.widgetMissing,
      invalid: t.widgetInvalid,
      permissions: t.widgetPermissions,
    };
    showWidgetError(cell, t.cantBeShown(name), opening.status === "ready" ? t.widgetGone : reasons[opening.status]);
    return;
  }
  const { manifest, files, permissions } = opening;
  const document = await buildView({ files, entry: manifest.widget!.entry, permissions });
  if (cells.get(id) !== cell) return;
  const iframe = el("iframe", { className: "widget-frame", title: t.widgetTitle(manifest.name), sandbox: IFRAME_SANDBOX });
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
      showWidgetError(cell, t.notResponding(manifest.name), t.widgetNotResponding);
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
  arrangeButton.textContent = arranging ? t.done : t.arrangeWidgets;
  for (const cell of cells.values()) cell.element.draggable = arranging;
}

arrangeButton.addEventListener("click", toggleArranging);

// ---------------------------------------------------------------------------------------------------------------------
// Export and import of the space in a single file (ADR 0002).

const spaceInput = el("input", { type: "file", accept: ".zip,application/zip", hidden: true, "aria-label": t.spaceFile });
document.body.append(spaceInput);
spaceInput.addEventListener("change", () => {
  const file = spaceInput.files?.[0];
  spaceInput.value = "";
  if (file) void importSpace(file);
});

/** Saves the export as a file named after today's date, and names the Modules it had to leave out. */
async function exportSpace() {
  const { file, missing } = await host.exportSpace();
  const url = URL.createObjectURL(new Blob([file as BlobPart], { type: "application/zip" }));
  el("a", { href: url, download: `tessello-space-${new Date().toISOString().slice(0, 10)}.zip` }).click();
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
  if (missing.length > 0) {
    showDialog(
      t.exportedWithoutTitle,
      el("p", {}, t.exportedWithoutText),
      el("ul", {}, ...missing.map((id) => el("li", {}, nameOf(id), " ", el("code", {}, id)))),
    );
  }
}

/**
 * Shows the Modules of an export and the Permissions the User had granted them; they are activated only once the User
 * accepts them all. A Module already installed is listed, and left as it is.
 */
async function importSpace(file: File) {
  const inspection = await host.inspectSpace(new Uint8Array(await file.arrayBuffer()));
  if (inspection.status === "invalid") {
    showDialog(
      t.cantBeImported(file.name),
      el("p", {}, t.nothingImported(inspection.problem)),
      ...(inspection.report ? [el("p", {}, t.validatorReports), errorList(inspection.report.issues)] : []),
    );
    return;
  }
  const incoming = inspection.modules.filter((module) => !module.installed);
  const installed = inspection.modules.filter((module) => module.installed);
  const installedList = installed.length > 0
    ? [
        el("p", {}, t.alreadyInstalledHere),
        el("ul", {}, ...installed.map(({ manifest }) => el("li", {}, `${manifest.name} `, el("code", {}, manifest.id)))),
      ]
    : [];
  if (incoming.length === 0) {
    showDialog(t.nothingToImport(file.name), el("p", {}, t.everyModuleInstalled), ...installedList);
    return;
  }
  // Every Permission or none (ADR 0004): accepting them all, or cancelling, are the only choices.
  const confirm = el("button", { type: "button", className: "primary" }, t.acceptAndImport);
  confirm.addEventListener("click", async () => {
    confirm.disabled = true;
    try {
      await inspection.import();
      dialog.close();
    } catch (error) {
      console.error(`${file.name} could not be imported:`, error);
      showDialog(t.couldNotImport(file.name), el("p", {}, t.importFailed));
    }
    await refresh();
    showHome();
  });
  dialog.replaceChildren(
    el("h2", { id: "dialog-title" }, t.importTitle(incoming.length)),
    el("p", {}, t.importFrom(file.name)),
    ...incoming.flatMap(({ manifest, icon, permissions, report }) => {
      const warnings = report.issues.filter((issue) => issue.severity === "warning");
      return [
        moduleSummary(manifest, icon),
        permissionSummary(manifest.name, permissions),
        ...(warnings.length > 0 ? [el("p", {}, t.warningsImport), issueList(warnings)] : []),
      ];
    }),
    ...installedList,
    el("div", { className: "actions" }, button(t.cancel, () => dialog.close()), confirm),
  );
  dialog.showModal();
}

// ---------------------------------------------------------------------------------------------------------------------
// Installing a Module (CONVENTION.md §8).

function showDialog(title: string, ...children: (Node | string)[]) {
  dialog.replaceChildren(
    el("h2", { id: "dialog-title" }, title),
    ...children,
    el("div", { className: "actions" }, button(t.close, () => dialog.close(), "primary")),
  );
  dialog.showModal();
}

function issueList(issues: Issue[]) {
  return el(
    "ul",
    { className: "issues" },
    ...issues.map((issue) =>
      el("li", { className: issue.severity }, `${t.issueLine(issue.severity === "error" ? t.error : t.warning, issue.message)} `, el("code", {}, `[${issue.code}]`)),
    ),
  );
}

const errorList = (issues: Issue[]) => issueList(issues.filter((issue) => issue.severity === "error"));

/** The row naming the URL a package was downloaded from, if any. */
const downloadedFromRow = (downloadedFrom?: string) =>
  downloadedFrom ? [el("dt", {}, t.downloadedFrom), el("dd", {}, el("code", {}, downloadedFrom))] : [];

/** The Module's name, version, Module ID and description, then the URL it was downloaded from, if any. */
function moduleSummary(manifest: Manifest, icon: Icon, downloadedFrom?: string) {
  return el(
    "div",
    { className: "module-summary" },
    el("img", { src: iconUrl(icon), alt: t.iconOf(manifest.name) }),
    el(
      "dl",
      {},
      el("dt", {}, t.name),
      el("dd", {}, manifest.name),
      el("dt", {}, t.version),
      el("dd", {}, manifest.version),
      el("dt", {}, t.moduleId),
      el("dd", {}, el("code", {}, manifest.id)),
      ...(manifest.description ? [el("dt", {}, t.description), el("dd", {}, manifest.description)] : []),
      ...downloadedFromRow(downloadedFrom),
    ),
  );
}

/**
 * Shows what is about to be activated, or why it cannot be. `source` names it: a .zip file or a folder.
 * `downloadedFrom` is the URL a .zip was downloaded from.
 */
async function showInspection(source: string, pending: Promise<Inspection>, kind: "zip" | "folder", downloadedFrom?: string) {
  const inspection = await pending;
  if (inspection.status === "invalid") {
    showDialog(
      kind === "zip" ? t.cantBeInstalled(source) : t.cantBeActivated(source),
      el("p", {}, kind === "zip" ? t.notValidInstalled : t.notValidActivated),
      errorList(inspection.report.issues),
    );
    return;
  }
  if (inspection.status === "conflict") {
    showDialog(
      t.alreadyInstalledTitle(inspection.manifest.name),
      el("p", {}, ...t.alreadyUsed(el("code", {}, inspection.manifest.id), inspection.folder)),
    );
    return;
  }
  if (inspection.status === "update") {
    showUpdate(inspection, downloadedFrom);
    return;
  }

  const { manifest, icon, report } = inspection;
  const warnings = report.issues.filter((issue) => issue.severity === "warning");
  // Every Permission or none (ADR 0004): accepting them all, or cancelling, are the only choices.
  const confirm = el("button", { type: "button", className: "primary" }, kind === "zip" ? t.acceptAndInstall : t.acceptAndActivate);
  confirm.addEventListener("click", async () => {
    confirm.disabled = true;
    await inspection.install();
    dialog.close();
    await refresh();
    await showView(manifest.id);
  });
  dialog.replaceChildren(
    el("h2", { id: "dialog-title" }, kind === "zip" ? t.installTitle(manifest.name) : t.activateTitle(manifest.name)),
    ...(kind === "folder" ? [el("p", {}, t.foundIn(source))] : []),
    moduleSummary(manifest, icon, downloadedFrom),
    permissionSummary(manifest.name, manifest.permissions ?? {}),
    ...(warnings.length > 0 ? [el("p", {}, t.warningsInstall), issueList(warnings)] : []),
    el("div", { className: "actions" }, button(t.cancel, () => dialog.close()), confirm),
  );
  dialog.showModal();
}

/**
 * A package of an installed Module: the Host cannot tell an update from another Module reusing its Module ID, so the
 * User sees both names and versions (ADR 0003), and only the Permissions that are added (ADR 0004).
 */
function showUpdate(inspection: Extract<Inspection, { status: "update" }>, downloadedFrom?: string) {
  const { manifest, installed, added, report } = inspection;
  const warnings = report.issues.filter((issue) => issue.severity === "warning");
  const hasAdded = Object.keys(added).length > 0;
  const confirm = el("button", { type: "button", className: "primary" }, hasAdded ? t.acceptAndUpdate : t.update);
  confirm.addEventListener("click", async () => {
    confirm.disabled = true;
    try {
      await inspection.update();
      dialog.close();
    } catch (error) {
      console.error(`${installed.name} could not be updated:`, error);
      showDialog(t.couldNotUpdate(installed.name), el("p", {}, t.updateFailed));
    }
    const wasShown = dropSurfaces(manifest.id);
    await refresh();
    if (wasShown) await showView(manifest.id);
  });
  dialog.replaceChildren(
    el("h2", { id: "dialog-title" }, t.updateTitle(installed.name)),
    el("p", {}, ...t.updateText(el("code", {}, manifest.id), installed.folder)),
    el(
      "dl",
      { className: "versions" },
      el("dt", {}, t.installed),
      el("dd", {}, `${installed.name} ${installed.version}`),
      el("dt", {}, t.incoming),
      el("dd", {}, `${manifest.name} ${manifest.version}`),
      ...downloadedFromRow(downloadedFrom),
    ),
    ...(installed.name !== manifest.name ? [el("p", { className: "warning" }, t.namesDiffer)] : []),
    ...(hasAdded
      ? [el("p", {}, t.updateNewPermissions), permissionSummary(manifest.name, added, t.whatCanNowAlsoDo(manifest.name))]
      : [el("p", {}, t.noNewPermission)]),
    ...(warnings.length > 0 ? [el("p", {}, t.warningsUpdate), issueList(warnings)] : []),
    el("div", { className: "actions" }, button(t.cancel, () => dialog.close()), confirm),
  );
  dialog.showModal();
}

const installZip = async (file: File) => showInspection(file.name, host.inspectZip(new Uint8Array(await file.arrayBuffer())), "zip");

/** The name of the file a URL points to, to name the package in messages. */
function fileNameOf(url: string) {
  const name = new URL(url).pathname.split("/").at(-1) ?? "";
  try {
    return decodeURIComponent(name) || url;
  } catch {
    return name;
  }
}

/** The field "Install from a URL": a refused URL is explained there, before any request. */
function showUrlForm() {
  const input = el("input", { type: "url", name: "url", required: true, placeholder: "https://…", autocomplete: "off" });
  const problem = el("p", { className: "form-error", role: "alert" });
  problem.hidden = true;
  const form = el(
    "form",
    { className: "url-form", noValidate: true },
    el("label", {}, t.urlLabel, input),
    problem,
    el("div", { className: "actions" }, button(t.cancel, () => dialog.close()), el("button", { type: "submit", className: "primary" }, t.download)),
  );
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    const check = checkPackageUrl(input.value);
    if (check.status === "refused") {
      problem.textContent = t.urlRefused(check);
      problem.hidden = false;
      return;
    }
    void installFromUrl(check.url);
  });
  dialog.replaceChildren(
    el("h2", { id: "dialog-title" }, t.installFromUrlTitle),
    el("p", {}, t.installFromUrlText),
    form,
  );
  dialog.showModal();
}

/** The download in progress: a new one, or closing its dialog, stops it. */
let downloading = new AbortController();

/** Downloads a package from an accepted URL, then goes on as for a .zip file, the URL shown under the Module. */
async function installFromUrl(url: string) {
  const name = fileNameOf(url);
  downloading.abort();
  const stop = (downloading = new AbortController());
  const { signal } = stop;
  dialog.addEventListener("close", () => stop.abort(), { signal });
  dialog.replaceChildren(
    el("h2", { id: "dialog-title" }, t.downloading(name)),
    el("p", {}, ...t.fromUrl(el("code", {}, url))),
    el("div", { className: "actions" }, button(t.cancel, () => dialog.close())),
  );
  dialog.showModal();
  let download;
  try {
    download = await downloadPackage(url, { signal });
  } catch (error) {
    if (signal.aborted) return;
    throw error;
  }
  if (signal.aborted) return;
  stop.abort();
  if (download.status === "unreachable") {
    showDialog(
      t.cantBeDownloaded(name),
      el("p", {}, t.unreachable),
      el("p", {}, ...t.downloadYourself(el("a", { href: url, download: "" }, t.downloadZip))),
    );
  } else if (download.status === "failed") {
    showDialog(t.cantBeDownloaded(name), el("p", {}, t.httpFailed(download.httpStatus)));
  } else if (download.status === "too-large") {
    showDialog(t.cantBeInstalled(name), el("p", {}, t.tooLarge), errorList([download.issue]));
  } else {
    await showInspection(name, host.inspectZip(download.bytes), "zip", url);
  }
}

/** The Module of an install link: downloaded, then installed only once the User accepts, as from the field. */
function installLinked(url: string) {
  const check = checkPackageUrl(url);
  if (check.status === "refused") showDialog(t.installLinkUnusable, el("p", {}, t.urlRefused(check)));
  else void installFromUrl(check.url);
}

/**
 * The package URL of an install link, `#install=<encoded URL>`, removed from the address once read, so that a reload
 * does not install again.
 */
function takeInstallLink(): string | null {
  const encoded = /^#install=(.+)$/.exec(location.hash)?.[1];
  if (encoded === undefined) return null;
  history.replaceState(null, "", location.pathname + location.search);
  try {
    return decodeURIComponent(encoded);
  } catch {
    return encoded;
  }
}

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
byId<HTMLButtonElement>("install-url-button").addEventListener("click", showUrlForm);
byId<HTMLButtonElement>("home-button").addEventListener("click", showHome);
byId<HTMLButtonElement>("settings-button").addEventListener("click", showSettings);
byId<HTMLElement>("home-empty-text").replaceChildren(...t.homeEmptyText(el("code", {}, ".zip")));
// An install link opened in a tab where the Host already runs only changes the fragment.
window.addEventListener("hashchange", () => {
  const url = takeInstallLink();
  if (url === null) return;
  if (host) installLinked(url);
  else pendingInstall = url;
});

applyTheme();

// Kept whole before the link is removed from the address, to be copied on the page of an unsupported browser.
const installLinkHref = location.href;
pendingInstall = takeInstallLink();
if (!canUseFolders()) showUnsupported(pendingInstall === null ? null : { url: pendingInstall, href: installLinkHref });
else {
  const folder = await rememberedFolder();
  if (!folder) showChooseFolder();
  else if (await isGranted(folder)) await start(folder);
  else showReconnect(folder);
}
