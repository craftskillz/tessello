// Test entry point D: the built Host in Chromium (Playwright), the only engine with a folder picker. Run with
// `npm run test:browser`.
// Playwright cannot drive the native folder picker: `showDirectoryPicker` returns a folder of the origin private file
// system (OPFS) instead, which has the same FileSystemDirectoryHandle interface. Changes a User makes with their own
// tools (git clone, an editor, git pull) are made by writing in that folder.
// HEADED=1 shows the browser, slowed down, to watch the tests run. E2E_CPU_SLOWDOWN=4 slows the processor of every page
// down 4 times, as on a CI machine: `E2E_CPU_SLOWDOWN=4 just e2e-only home`.

import { readdir, readFile } from "node:fs/promises";
import { createServer } from "node:http";
import { join, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { after, before } from "node:test";
import { strToU8, zipSync } from "fflate";
import { type Browser, chromium, type Locator, type Page } from "playwright";
import { setWaitTimeout, slowDownCpu, until } from "@tessello/sdk/testing";
import { serveHost } from "../scripts/serve.ts";

// Every wait of the tests goes through `until`, with one deadline set here: CI machines are slower, and E2E_CPU_SLOWDOWN
// multiplies it.
setWaitTimeout(process.env.CI ? 15_000 : 5_000);
export { until };

/** The folder `showDirectoryPicker` returns: `window.tesselloPick` under the OPFS root, "modules" by default. */
const FOLDER_PICKER = `window.showDirectoryPicker = async () => {
  const root = await navigator.storage.getDirectory();
  return root.getDirectoryHandle(window.tesselloPick ?? "modules", { create: true });
};`;

export interface PageOptions {
  /** A browser without `showDirectoryPicker`, as Firefox, Safari and every phone. */
  unsupported?: boolean;
  /** Chooses the Modules folder on the first launch; true by default. */
  choose?: boolean;
  /** Opens the Host at this fragment, such as an install link's "#install=…". */
  hash?: string;
  /** A script run in the page before the Host starts, such as one setting a preference in the local storage. */
  init?: string;
}

export interface HostOptions {
  /**
   * Chromium treats the Host as a public site, as it is once deployed, rather than as one of the User's computer: it
   * then applies Local Network Access, and asks the User before a Module reaches the local network. Headless, it
   * refuses unless the test grants "local-network-access".
   */
  public?: boolean;
}

/** Starts the Host and a browser for the tests of the calling file; `newPage()` opens a fresh, empty Host. */
export function useHost({ public: publicSite = false }: HostOptions = {}) {
  let browser: Browser;
  let close: () => void;
  const state = { url: "" };
  before(async () => {
    const { server, url } = await serveHost();
    state.url = url;
    close = () => server.close();
    const { host } = new URL(url);
    const headed = process.env.HEADED === "1";
    browser = await chromium.launch({
      headless: !headed,
      slowMo: headed ? 200 : 0,
      args: publicSite ? [`--ip-address-space-overrides=${host}=public`] : [],
    });
  });
  after(async () => {
    await browser?.close();
    close?.();
  });
  return {
    get url() {
      return state.url;
    },
    /** A page in a new browser context, so no folder or IndexedDB data is shared with other tests. */
    async newPage({ unsupported = false, choose = true, hash = "", init }: PageOptions = {}): Promise<Page> {
      const page = await (await browser.newContext()).newPage();
      await slowDownCpu(page);
      // Playwright turns on file chooser interception, without waiting, when a test starts listening for one, and off
      // when it stops: a click right after `waitForEvent("filechooser")` could beat it and open no chooser it sees.
      // A listener kept from the start keeps interception on for the whole test.
      page.on("filechooser", () => {});
      await page.addInitScript(unsupported ? "delete window.showDirectoryPicker;" : FOLDER_PICKER);
      if (init) await page.addInitScript(init);
      await page.goto(state.url + hash);
      if (!unsupported && choose) await chooseFolder(page);
      return page;
    },
  };
}

/** Chooses the Modules folder on the first launch, then waits for the Host. */
export async function chooseFolder(page: Page): Promise<void> {
  await page.getByRole("button", { name: "Choose a folder…" }).click();
  await page.getByRole("navigation", { name: "Launcher" }).waitFor();
}

/** The Launcher, once the pointer is near the left edge of the page: behind a View, it is a drawer hidden there. */
export async function showLauncher(page: Page, name = "Launcher"): Promise<Locator> {
  // Let a previous selection finish dismissing the drawer before entering its edge again.
  await page.mouse.move(page.viewportSize()!.width - 1, 300);
  await page.locator("#launcher").evaluate((launcher) => Promise.all(launcher.getAnimations().map((animation) => animation.finished)));
  await page.mouse.move(0, 300);
  await page.locator("#launcher").evaluate((launcher) => Promise.all(launcher.getAnimations().map((animation) => animation.finished)));
  return page.getByRole("navigation", { name });
}

/** Opens the inner drawer before choosing an installation, Settings or folder action. */
export async function showLauncherTools(page: Page): Promise<Locator> {
  const launcher = await showLauncher(page);
  const toggle = launcher.getByRole("button", { name: "Manage" });
  if (await toggle.getAttribute("aria-expanded") === "false") await toggle.click();
  return launcher;
}

type Files = Record<string, string | Uint8Array | object>;

const bytesOf = (content: string | Uint8Array | object) =>
  content instanceof Uint8Array ? content : strToU8(typeof content === "string" ? content : JSON.stringify(content, null, 2));

/** Writes files under a folder of the OPFS ("modules/notes"), as a User does with their own tools. */
export async function writeFolder(page: Page, folder: string, files: Files): Promise<void> {
  const entries = Object.entries(files).map(([path, content]) => [path, [...bytesOf(content)]] as const);
  await page.evaluate(
    async ({ folder, entries }) => {
      for (const [path, bytes] of entries) {
        let directory = await navigator.storage.getDirectory();
        const segments = `${folder}/${path}`.split("/");
        for (const name of segments.slice(0, -1)) directory = await directory.getDirectoryHandle(name, { create: true });
        const writable = await (await directory.getFileHandle(segments.at(-1)!, { create: true })).createWritable();
        await writable.write(new Uint8Array(bytes));
        await writable.close();
      }
    },
    { folder, entries },
  );
}

/** Removes a folder of the OPFS and everything in it. */
export async function removeFolder(page: Page, folder: string): Promise<void> {
  await page.evaluate(async (folder) => {
    let directory = await navigator.storage.getDirectory();
    const segments = folder.split("/");
    for (const name of segments.slice(0, -1)) directory = await directory.getDirectoryHandle(name);
    await directory.removeEntry(segments.at(-1)!, { recursive: true });
  }, folder);
}

/** Every file under a folder of the OPFS, as text: path → content. `{}` when the folder does not exist. */
export async function readFolder(page: Page, folder: string): Promise<Record<string, string>> {
  // A read that throws, as when the Host is replacing a file, is tried again.
  return until(
    () =>
      page.evaluate(async (folder) => {
        let directory = await navigator.storage.getDirectory();
        try {
          for (const name of folder.split("/")) directory = await directory.getDirectoryHandle(name);
        } catch {
          return {};
        }
        const files: Record<string, string> = {};
        const walk = async (handle: FileSystemDirectoryHandle, prefix: string) => {
          for await (const [name, entry] of handle.entries()) {
            if (entry.kind === "directory") await walk(entry as FileSystemDirectoryHandle, `${prefix}${name}/`);
            else files[prefix + name] = await (await (entry as FileSystemFileHandle).getFile()).text();
          }
        };
        await walk(directory, "");
        return files;
      }, folder),
    `the files of ${folder}`,
  );
}

/** A Module as `.tessello/modules.json` registers it. */
export interface Registered {
  id: string;
  folder: string;
  version: string;
  permissions: { network?: string[] };
  provenance?: { source: string; version: string; sha256: string };
}

/** The registry of the Modules folder, `.tessello/modules.json`, as it is now. */
export const registry = async (page: Page): Promise<{ modules: Registered[] }> =>
  JSON.parse((await readFolder(page, "modules/.tessello"))["modules.json"]);

/** The registry once `matches` gives a value: the Host writes it a moment after the interface shows the change. */
export const registryWhere = (page: Page, what: string, matches: (registry: { modules: Registered[] }) => unknown) =>
  until(async () => {
    const current = await registry(page);
    return matches(current) ? current : undefined;
  }, what);

/** The files of an example Module folder. */
export const exampleFiles = (name: string) => filesOf(fileURLToPath(new URL(`../../../examples/${name}`, import.meta.url)));

/** Every file under a folder of the disk: path → bytes. */
async function filesOf(root: string): Promise<Record<string, Uint8Array>> {
  const files: Record<string, Uint8Array> = {};
  for (const entry of await readdir(root, { recursive: true, withFileTypes: true })) {
    if (!entry.isFile() || entry.name === ".DS_Store") continue;
    const absolute = join(entry.parentPath, entry.name);
    files[relative(root, absolute).split(sep).join("/")] = new Uint8Array(await readFile(absolute));
  }
  return files;
}

/** Zips an example Module folder, as a Creator would before sharing it. */
export async function zipExample(name: string): Promise<Uint8Array> {
  return zipSync(await exampleFiles(name));
}

/** The published package of a @craftskillz Module, as zipped in `fixtures/` (its sources live in `craftskillz/tessello-<name>`). */
export async function moduleFixture(name: string): Promise<Uint8Array> {
  return new Uint8Array(await readFile(fileURLToPath(new URL(`./fixtures/${name}.zip`, import.meta.url))));
}

/** Zips in-memory files: path → text, bytes, or an object written as JSON. */
export function zip(files: Files): Uint8Array {
  return zipSync(Object.fromEntries(Object.entries(files).map(([path, content]) => [path, bytesOf(content)])));
}

/** Drops a file onto the Host, as the User does from their file manager. */
export async function dropFile(page: Page, name: string, bytes: Uint8Array): Promise<void> {
  const dataTransfer = await page.evaluateHandle(
    ({ name, bytes }) => {
      const transfer = new DataTransfer();
      transfer.items.add(new File([new Uint8Array(bytes)], name, { type: "application/zip" }));
      return transfer;
    },
    { name, bytes: [...bytes] },
  );
  await page.dispatchEvent("body", "dragover", { dataTransfer });
  await page.dispatchEvent("body", "drop", { dataTransfer });
}

/** An install link to the Host for a package URL. */
export const installLink = (packageUrl: string) => `#install=${encodeURIComponent(packageUrl)}`;

/**
 * Serves packages from a second origin, as a Creator's hosting does: under `/cors/` with the CORS header the Host
 * needs (ADR 0009), under `/no-cors/` without it. `/huge.zip` sends more than the package size limit, with no
 * Content-Length. `requests` lists the paths asked for.
 */
export function usePackageServer() {
  const packages = new Map<string, Uint8Array>();
  const state = { url: "", requests: [] as string[] };
  let close: () => void;
  before(async () => {
    const server = createServer((request, response) => {
      const path = new URL(request.url ?? "/", "http://packages").pathname;
      state.requests.push(path);
      if (path === "/huge.zip") {
        response.writeHead(200, { "Content-Type": "application/zip", "Access-Control-Allow-Origin": "*" });
        const chunk = new Uint8Array(1024 * 1024);
        let sent = 0;
        const send = () => {
          while (sent < 64 && !response.destroyed) {
            sent++;
            if (!response.write(chunk)) return void response.once("drain", send);
          }
          response.end();
        };
        return send();
      }
      const [, access, name] = /^\/(cors|no-cors)\/(.+)$/.exec(path) ?? [];
      const cors = access === "cors" ? { "Access-Control-Allow-Origin": "*" } : {};
      const bytes = packages.get(name);
      if (!bytes) return void response.writeHead(404, cors).end();
      response.writeHead(200, { "Content-Type": "application/zip", ...cors });
      response.end(bytes);
    });
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    const address = server.address();
    state.url = `http://127.0.0.1:${typeof address === "object" && address ? address.port : 0}`;
    close = () => server.close();
  });
  after(() => close?.());
  return {
    get url() {
      return state.url;
    },
    get requests() {
      return state.requests;
    },
    /** Serves a package under this name; returns its URLs with and without CORS. */
    serve(name: string, bytes: Uint8Array) {
      packages.set(name, bytes);
      return { cors: `${state.url}/cors/${name}`, noCors: `${state.url}/no-cors/${name}` };
    },
  };
}

/** The script setting the Marketplace's address for the Host, in place of the production one: a local storage entry. */
export const marketplaceAt = (indexUrl: string) => `localStorage.setItem("tessello.marketplace", ${JSON.stringify(indexUrl)});`;

/**
 * Serves a Marketplace from another origin, as its static site does: `/index.json` and the assets it points to, with the
 * CORS header the Host needs. While `offline` is true every request is answered 503, as when the Marketplace is down.
 */
export function useMarketplaceServer() {
  const files = new Map<string, { type: string; body: string | Uint8Array }>();
  const state = { url: "", offline: false };
  let close: () => void;
  before(async () => {
    const server = createServer((request, response) => {
      const path = new URL(request.url ?? "/", "http://marketplace").pathname.slice(1);
      const cors = { "Access-Control-Allow-Origin": "*" };
      const file = files.get(path);
      if (state.offline) return void response.writeHead(503, cors).end();
      if (!file) return void response.writeHead(404, cors).end();
      response.writeHead(200, { "Content-Type": file.type, ...cors });
      response.end(file.body);
    });
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    const address = server.address();
    state.url = `http://127.0.0.1:${typeof address === "object" && address ? address.port : 0}`;
    close = () => server.close();
  });
  after(() => close?.());
  const typeOfAsset = (path: string) => (path.endsWith(".svg") ? "image/svg+xml" : path.endsWith(".png") ? "image/png" : "application/octet-stream");
  return {
    get url() {
      return state.url;
    },
    /** The address of index.json, to give the Host. */
    get indexUrl() {
      return `${state.url}/index.json`;
    },
    set offline(value: boolean) {
      state.offline = value;
    },
    /** Publishes an index and its assets (path relative to index.json → bytes), replacing what was published. */
    publish(index: object, assets: ReadonlyMap<string, Uint8Array>) {
      files.clear();
      files.set("index.json", { type: "application/json", body: JSON.stringify(index) });
      for (const [path, body] of assets) files.set(path, { type: typeOfAsset(path), body });
    },
  };
}
