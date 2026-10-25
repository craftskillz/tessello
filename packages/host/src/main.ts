// The Host's interface: the Modules folder, the Launcher, the Home and its Widgets, the View area, installing or
// updating a Module from a dropped or chosen .zip file, from a URL or an install link, from the Marketplace, or from a
// folder placed in the Modules folder, uninstalling, and the Settings: the theme and the language of the interface.

import type { Issue, Manifest, Permissions } from "@tessello/convention";
import {
  type MarketplaceReading,
  createHost,
  type HomeWidget,
  type Host,
  type Icon,
  type IndexModule,
  type IndexRelease,
  type Inspection,
  type MarketplaceNotice,
  type ModuleEntry,
  type MountedSurface,
  type Opening,
  type Persistence,
} from "@tessello/host-core";
import { PERMISSION_FILTERS, permissionFilter } from "@tessello/marketplace";
import { copyModulesFolder, createFolderPersistence } from "./folder-persistence.ts";
import { GUIDE_SANDBOX, guideDocument } from "./guide.ts";
import { assetUrl, createHttpIndexSource, MARKETPLACE_INDEX_URL } from "./marketplace-index.ts";
import { type Language, languageOf, LANGUAGES, type Messages, messagesOf } from "./i18n.ts";
import { checkPackageUrl, downloadPackage } from "./package-url.ts";
import { canUseFolders, hasTesselloFolder, isGranted, pickFolder, reconnect, rememberedFolder, rememberFolder } from "./modules-folder.ts";
import { buildView, dataUrl, typeOf, type ViewDocument, VIEW_SANDBOX, WIDGET_SANDBOX } from "./srcdoc.ts";
import { THEME_CHOICES, type ThemeChoice, themeChoiceOf, themeOf } from "./theme.ts";

// The User's theme and language, kept by this browser for this address of Tessello. Storage may be refused, as in a
// private window: the choice then lasts until the page is closed. `marketplace` is not a choice of the User: it is the
// address of the Marketplace's index.json, which the tests (and a Maintainer's trials) set to a local one; unset, the
// Host reads the Marketplace inscribed in it.
const PREFERENCES = { theme: "tessello.theme", language: "tessello.language", marketplace: "tessello.marketplace" };

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
const launcherTools = byId<HTMLElement>("launcher-tools");
const launcherToolsToggle = byId<HTMLButtonElement>("launcher-tools-toggle");
const launcherToolsPanel = byId<HTMLElement>("launcher-tools-panel");
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
/** The same for the User guide in the listing of a Module of the Marketplace, which is not in the dialog. */
let renderListingGuide: (() => void) | null = null;

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
  renderListingGuide?.();
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
/** The Host's persistence, read by the interface for the copy of the Marketplace index only. */
let persistence: Persistence;
let entries: ModuleEntry[] = [];
/** What the last copy of the Marketplace index says of the Modules installed from it, by Module ID (ADR 0018). */
let notices = new Map<string, MarketplaceNotice>();
/**
 * What the stage shows besides the Home: a View, or a message in its place. Behind the Home, a View stays loaded and
 * hidden until another one opens, so that its Widget can bring it back as it was.
 */
let current: { id: string; surface?: MountedSurface; element: HTMLElement } | null = null;
/** The latest View asked for: a View whose document is still being built when another one is asked for is dropped. */
let requested: object | null = null;
/** Where the Host reads the Marketplace index from; its asset paths resolve against it. */
const marketplaceIndexUrl = readPreference("marketplace") ?? MARKETPLACE_INDEX_URL;

async function start(folder: FileSystemDirectoryHandle) {
  persistence = createFolderPersistence(folder);
  host = createHost({
    persistence,
    locale: language,
    theme,
    marketplace: { source: createHttpIndexSource(marketplaceIndexUrl) },
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
  // At most once a day, and only with a Module from the Marketplace: the Host offers its updates and tells of its Bans.
  void host
    .checkMarketplace()
    .then(refreshNotices)
    .catch((error: unknown) => console.error("The Marketplace could not be checked:", error));
  if (pendingInstall !== null) {
    const url = pendingInstall;
    pendingInstall = null;
    installLinked(url);
  }
}

async function refresh() {
  entries = await host.modules();
  await readNotices();
  renderLauncher();
  await renderHome();
}

async function readNotices() {
  notices = new Map((await host.marketplaceNotices()).map((notice) => [notice.id, notice]));
}

/** Shows what a new copy of the Marketplace index says, in the Launcher and on the Widgets. */
async function refreshNotices() {
  await readNotices();
  renderLauncher();
  for (const cell of cells.values()) renderWidgetNotice(cell);
}

/** Tells each View and Widget whether it is shown: the Home hides its Widgets behind a View (CONVENTION.md §6.4). */
function updateVisibility() {
  const pageShown = document.visibilityState === "visible";
  for (const cell of cells.values()) cell.surface?.setVisible(pageShown && !home.hidden);
  current?.surface?.setVisible(pageShown && !current.element.hidden);
  // Behind a View, the Launcher becomes a drawer, shown again near the left edge of the page. The Marketplace screen is
  // the Host's own: the Launcher stays.
  document.body.classList.toggle("drawer", home.hidden && current?.id !== MARKETPLACE_SCREEN);
}

function clearStage() {
  renderListingGuide = null;
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
  const iframe = el("iframe", { className: "view-frame", title: manifest.name, sandbox: VIEW_SANDBOX, allow: view.allow });
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
      return el("li", {}, entryButton, ...noticeBadges(entry), aboutButton);
    }),
  );
}

/** A small button telling of the Marketplace's notice; its name does not repeat the Module's, as for "About". */
function noticeButton(className: string, text: string, label: string, onClick: () => void) {
  const element = button(text, onClick, className);
  element.setAttribute("aria-label", label);
  element.title = label;
  return element;
}

/**
 * The Launcher's badges for a Module from the Marketplace (ADR 0018): a Ban's warning, which says all, or a Withdrawal's
 * note and a newer version, which the User updates to with a click, through the usual update.
 */
function noticeBadges(entry: ModuleEntry): HTMLButtonElement[] {
  const notice = notices.get(entry.id!);
  if (!notice) return [];
  if (notice.ban) return [noticeButton("entry-notice banned", "⚠", t.banned, () => showBan(entry, notice))];
  const { update, withdrawal } = notice;
  return [
    ...(withdrawal ? [noticeButton("entry-notice withdrawn", t.withdrawn, t.withdrawn, () => showWithdrawal(entry, notice))] : []),
    ...(update ? [noticeButton("entry-notice update", t.updateBadge, t.updateTo(update.version), () => void installFromMarketplace(update))] : []),
  ];
}

/**
 * A Ban, with the Maintainer's reason. The Module keeps running: only the User uninstalls it, or updates to the newest
 * version when only the installed one is banned.
 */
function showBan(entry: ModuleEntry, notice: MarketplaceNotice) {
  const { scope, reason, recommended } = notice.ban!;
  dialog.classList.remove("guide");
  dialog.replaceChildren(
    el("h2", { id: "dialog-title" }, scope === "module" ? t.moduleBannedTitle(entry.name) : t.versionBannedTitle(entry.name, notice.version)),
    ...(reason ? [el("p", {}, t.banReason), el("blockquote", { className: "ban-reason" }, reason)] : []),
    el("p", {}, t.banKeepsWorking(entry.name)),
    ...(recommended ? [el("p", {}, t.banRecommends(recommended.version))] : []),
    el(
      "div",
      { className: "actions" },
      button(t.close, () => dialog.close()),
      button(t.uninstallEllipsis, () => confirmUninstall(entry), "danger"),
      ...(recommended ? [button(t.updateTo(recommended.version), () => void installFromMarketplace(recommended), "primary")] : []),
    ),
  );
  dialog.showModal();
}

/** A Withdrawal by the Creator: a neutral note, and the newer version when only the installed one was withdrawn. */
function showWithdrawal(entry: ModuleEntry, notice: MarketplaceNotice) {
  const { update } = notice;
  const module = notice.withdrawal!.scope === "module";
  dialog.classList.remove("guide");
  dialog.replaceChildren(
    el("h2", { id: "dialog-title" }, module ? t.moduleWithdrawnTitle(entry.name) : t.versionWithdrawnTitle(entry.name, notice.version)),
    el("p", {}, module ? t.moduleWithdrawnText(entry.name) : t.versionWithdrawnText(entry.name)),
    el(
      "div",
      { className: "actions" },
      button(t.close, () => dialog.close(), update ? "" : "primary"),
      ...(update ? [button(t.updateTo(update.version), () => void installFromMarketplace(update), "primary")] : []),
    ),
  );
  dialog.showModal();
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
        renderWidgetNotice(cell);
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

/** A Ban's warning or a Withdrawal's note over a Widget (ADR 0018); a newer version is offered in the Launcher only. */
function renderWidgetNotice(cell: WidgetCell) {
  cell.element.querySelector(".widget-notice")?.remove();
  const notice = notices.get(cell.widget.id);
  const entry = entries.find((candidate) => candidate.id === cell.widget.id);
  const badge =
    !notice || !entry
      ? null
      : notice.ban
        ? noticeButton("widget-notice banned", `⚠ ${t.banned}`, t.banned, () => showBan(entry, notice))
        : notice.withdrawal
          ? noticeButton("widget-notice withdrawn", t.withdrawn, t.withdrawn, () => showWithdrawal(entry, notice))
          : null;
  cell.element.classList.toggle("has-notice", badge !== null);
  // After the body, so that moving the Widget does not reload its iframe.
  if (badge) cell.body.after(badge);
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
  const iframe = el("iframe", { className: "widget-frame", title: t.widgetTitle(manifest.name), sandbox: WIDGET_SANDBOX, allow: document.allow });
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
    await showUpdate(inspection, downloadedFrom);
    return;
  }

  const { manifest, icon, report } = inspection;
  const warnings = report.issues.filter((issue) => issue.severity === "warning");
  const risk = inspection.provenance ? await marketplaceRisk(manifest.id) : [];
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
    ...risk,
    ...(warnings.length > 0 ? [el("p", {}, t.warningsInstall), issueList(warnings)] : []),
    el("div", { className: "actions" }, button(t.cancel, () => dialog.close()), confirm),
  );
  dialog.showModal();
}

/**
 * A package of an installed Module: the Host cannot tell an update from another Module reusing its Module ID, so the
 * User sees both names and versions (ADR 0003), and only the Permissions that are added (ADR 0004).
 */
async function showUpdate(inspection: Extract<Inspection, { status: "update" }>, downloadedFrom?: string) {
  const { manifest, installed, added, report } = inspection;
  const risk = inspection.provenance ? await marketplaceRisk(manifest.id) : [];
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
    ...risk,
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

/**
 * Downloads a package from an accepted URL, in a dialog that the User can cancel. Its bytes, or null when the download
 * was cancelled or the dialog now explains why there are none. `name` names the package in the messages.
 */
async function downloadWithDialog(url: string, name = fileNameOf(url)): Promise<Uint8Array | null> {
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
    if (signal.aborted) return null;
    throw error;
  }
  if (signal.aborted) return null;
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
    return download.bytes;
  }
  return null;
}

/**
 * Downloads a package from an accepted URL, then goes on as for a .zip file, the URL shown under the Module. For an
 * install link (`link`), the Host also looks the URL up in the Marketplace's index, to note where the Module comes from.
 */
async function installFromUrl(url: string, { link = false } = {}) {
  const bytes = await downloadWithDialog(url);
  if (bytes) await showInspection(fileNameOf(url), link ? host.inspectZip(bytes, { url }) : host.inspectZip(bytes), "zip", url);
}

/** The Module of an install link: downloaded, then installed only once the User accepts, as from the field. */
function installLinked(url: string) {
  const check = checkPackageUrl(url);
  if (check.status === "refused") showDialog(t.installLinkUnusable, el("p", {}, t.urlRefused(check)));
  else void installFromUrl(check.url, { link: true });
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

// ---------------------------------------------------------------------------------------------------------------------
// The Marketplace (ADR 0015, 0017, 0018): a screen in the stage, like a View, with the Home hidden. It lists the Modules
// of the index, opens the listing of one, and installs it through the usual Accept screen.

/** A link to the Creator's source repository, opened in a new tab; the index's address is only trusted when it is https:. */
function sourceLink(source: string): Node {
  if (!/^https:\/\//.test(source)) return el("code", {}, source);
  return el("a", { href: source, target: "_blank", rel: "noopener noreferrer" }, source.replace(/^https:\/\//, ""));
}

/**
 * The ADR 0015 text, and the link to the source repository, for the Accept screen of a package from the Marketplace.
 * The source comes from the copy of the index the Host has just kept: the Accept screen downloads nothing more.
 */
async function marketplaceRisk(id: string): Promise<Node[]> {
  const module = (await persistence.marketplace.read())?.index.modules.find((candidate) => candidate.id === id);
  return [
    el(
      "div",
      { className: "marketplace-risk" },
      el("p", {}, t.marketplaceRisk),
      ...(module ? [el("p", {}, ...t.sourceRepositoryIs(sourceLink(module.source)))] : []),
    ),
  ];
}

/** The `current` of the Marketplace screen, which no Module ID can be: a Module ID starts with "@". */
const MARKETPLACE_SCREEN = "marketplace";

/** Opens the Marketplace screen: the index is downloaded now, or the last copy shown. */
async function showMarketplace() {
  const screen = el("section", { className: "marketplace", "aria-label": t.marketplace }, el("h1", {}, t.marketplace), el("p", {}, t.marketplaceLoading));
  clearStage();
  stage.append(screen);
  const self = (current = { id: MARKETPLACE_SCREEN, element: screen });
  renderLauncher();
  updateVisibility();
  const reading = await host.readMarketplace();
  void refreshNotices();
  if (current !== self) return;
  showModuleList(screen, reading);
}

/** The list of the Modules, with the search and the Permission filter, which filter it as the User types. */
function showModuleList(screen: HTMLElement, reading: MarketplaceReading) {
  renderListingGuide = null;
  screen.setAttribute("aria-label", t.marketplace);
  if (reading.status === "unavailable") {
    screen.replaceChildren(el("h1", {}, t.marketplace), el("p", { className: "note", role: "status" }, t.marketplaceUnavailable));
    return;
  }
  const query = el("input", { type: "search", name: "query", autocomplete: "off" });
  const filter = el(
    "select",
    { name: "permissions" },
    ...PERMISSION_FILTERS.map(({ value }) => el("option", { value }, t.permissionFilters[value] ?? value)),
  );
  const results = el("ul", { className: "market-results" });
  const update = () => {
    const accepts = permissionFilter(filter.value);
    const found = reading.search({ query: query.value, ...(accepts ? { accepts } : {}) });
    results.replaceChildren(
      ...(found.length === 0
        ? [el("li", { className: "note" }, t.marketplaceNoMatch)]
        : found.map((module) => {
            const release = module.latest!;
            const card = el(
              "button",
              { type: "button", className: "market-card" },
              el("img", { src: assetUrl(marketplaceIndexUrl, release.icon), alt: t.iconOf(release.name) }),
              el("span", { className: "name" }, release.name),
              el("span", { className: "creator" }, module.creator),
              ...(release.description ? [el("span", { className: "description" }, release.description)] : []),
            );
            card.addEventListener("click", () => showListing(screen, reading, module, release));
            return el("li", {}, card);
          })),
    );
  };
  query.addEventListener("input", update);
  filter.addEventListener("change", update);
  screen.replaceChildren(
    el("h1", {}, t.marketplace),
    ...(reading.status === "offline"
      ? [el("p", { className: "note", role: "status" }, t.marketplaceOffline(new Intl.DateTimeFormat(language, { dateStyle: "long", timeStyle: "short" }).format(new Date(reading.receivedAt))))]
      : []),
    el("div", { className: "market-filters" }, el("label", {}, t.marketplaceSearch, query), el("label", {}, t.marketplacePermissions, filter)),
    results,
  );
  update();
}

/** The User guide of a release, rendered by the Host from the index: its images are downloaded; one that fails is left out. */
async function listingGuideFiles(release: IndexRelease): Promise<Map<string, Uint8Array>> {
  const files = new Map<string, Uint8Array>([[release.guide.path, new TextEncoder().encode(release.guide.markdown)]]);
  await Promise.all(
    Object.entries(release.guide.images).map(async ([path, asset]) => {
      try {
        const response = await fetch(assetUrl(marketplaceIndexUrl, asset));
        if (response.ok) files.set(path, new Uint8Array(await response.arrayBuffer()));
      } catch {
        // Left out: the guide shows the image as missing.
      }
    }),
  );
  return files;
}

/** The listing of a Module: what the Creator and the index say of it, its User guide, and the button to install it. */
function showListing(screen: HTMLElement, reading: MarketplaceReading, module: IndexModule, release: IndexRelease) {
  const title = t.guideTitle(release.name);
  const frame = el("iframe", { className: "listing-guide-frame", title, sandbox: GUIDE_SANDBOX });
  void listingGuideFiles(release).then((files) => {
    if (!frame.isConnected) return;
    renderListingGuide = () => (frame.srcdoc = guideDocument({ files, guide: release.guide.path, title, theme }));
    renderListingGuide();
  });
  screen.setAttribute("aria-label", release.name);
  screen.replaceChildren(
    el("div", { className: "actions start" }, button(t.backToMarketplace, () => showModuleList(screen, reading))),
    el(
      "div",
      { className: "module-summary" },
      el("img", { src: assetUrl(marketplaceIndexUrl, release.icon), alt: t.iconOf(release.name) }),
      el(
        "dl",
        {},
        el("dt", {}, t.name),
        el("dd", {}, el("h1", {}, release.name)),
        el("dt", {}, t.version),
        el("dd", {}, release.version),
        el("dt", {}, t.creator),
        el("dd", {}, module.creator),
        el("dt", {}, t.license),
        el("dd", {}, module.license),
        el("dt", {}, t.sourceRepository),
        el("dd", {}, sourceLink(module.source)),
        el("dt", {}, t.widget),
        el("dd", {}, release.widget ? t.widgetSize(release.widget.size) : t.noWidget),
        ...(release.description ? [el("dt", {}, t.description), el("dd", {}, release.description)] : []),
      ),
    ),
    permissionSummary(release.name, release.permissions),
    el("h2", {}, t.userGuide),
    frame,
    ...(module.screenshots.length > 0
      ? [
          el("h2", {}, t.screenshots),
          el(
            "div",
            { className: "screenshots" },
            ...module.screenshots.map((path, index) => el("img", { src: assetUrl(marketplaceIndexUrl, path), alt: t.screenshotOf(release.name, index + 1) })),
          ),
        ]
      : []),
    el("p", { className: "marketplace-risk" }, t.marketplaceRisk),
    el("div", { className: "actions" }, button(t.install, () => void installFromMarketplace(release), "primary")),
  );
}

/** Downloads the package of a release, which must be the one the index lists, then goes on to the Accept screen. */
async function installFromMarketplace(release: IndexRelease) {
  const check = checkPackageUrl(release.url);
  if (check.status === "refused") {
    showDialog(t.cantBeDownloaded(release.name), el("p", {}, t.urlRefused(check)));
    return;
  }
  const bytes = await downloadWithDialog(check.url, release.name);
  if (!bytes) return;
  const inspection = await host.inspectRelease(release, bytes);
  if (inspection.status === "mismatch") {
    showDialog(t.cantBeInstalled(release.name), el("p", {}, t.noLongerMatches));
    return;
  }
  await showInspection(release.name, Promise.resolve(inspection), "zip", check.url);
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
byId<HTMLButtonElement>("install-file-button").addEventListener("click", () => fileInput.click());
byId<HTMLButtonElement>("marketplace-button").addEventListener("click", () => void showMarketplace());
byId<HTMLButtonElement>("home-button").addEventListener("click", showHome);
function setLauncherToolsOpen(open: boolean) {
  launcherTools.classList.toggle("open", open);
  launcherToolsToggle.setAttribute("aria-expanded", String(open));
  launcherToolsPanel.inert = !open;
  launcherToolsPanel.setAttribute("aria-hidden", String(!open));
}
launcherToolsToggle.addEventListener("click", (event) => {
  // Expanding the inner drawer must not dismiss the Launcher around it.
  event.stopPropagation();
  setLauncherToolsOpen(launcherToolsToggle.getAttribute("aria-expanded") !== "true");
});
launcherTools.addEventListener("keydown", (event) => {
  if (event.key !== "Escape" || launcherToolsToggle.getAttribute("aria-expanded") !== "true") return;
  event.preventDefault();
  event.stopPropagation();
  launcherToolsToggle.focus();
  setLauncherToolsOpen(false);
});
// A choice made with the pointer in the drawer sends it away, until the pointer comes back near the left edge.
launcher.addEventListener("click", (event) => {
  if (event.detail > 0) document.body.classList.add("drawer-dismissed");
});
launcher.addEventListener("pointerleave", () => document.body.classList.remove("drawer-dismissed"));
document.querySelector(".launcher-edge")!.addEventListener("pointerenter", () => document.body.classList.remove("drawer-dismissed"));
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

// Makes the shell available offline; the Host works without it (an http page, an old browser), so errors are ignored.
navigator.serviceWorker?.register("sw.js").catch(() => {});

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
