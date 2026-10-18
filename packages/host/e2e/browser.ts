// Test entry point D: the built Host in Chromium (Playwright), the only engine with a folder picker. Run with
// `npm run test:browser`.
// Playwright cannot drive the native folder picker: `showDirectoryPicker` returns a folder of the origin private file
// system (OPFS) instead, which has the same FileSystemDirectoryHandle interface. Changes a User makes with their own
// tools (git clone, an editor, git pull) are made by writing in that folder.

import { readdir, readFile } from "node:fs/promises";
import { join, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { after, before } from "node:test";
import { strToU8, zipSync } from "fflate";
import { type Browser, chromium, type Page } from "playwright";
import { serveHost } from "../scripts/serve.ts";

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
}

/** Starts the Host and a browser for the tests of the calling file; `newPage()` opens a fresh, empty Host. */
export function useHost() {
  let browser: Browser;
  let close: () => void;
  const state = { url: "" };
  before(async () => {
    const { server, url } = await serveHost();
    state.url = url;
    close = () => server.close();
    browser = await chromium.launch();
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
    async newPage({ unsupported = false, choose = true }: PageOptions = {}): Promise<Page> {
      const page = await (await browser.newContext()).newPage();
      await page.addInitScript(unsupported ? "delete window.showDirectoryPicker;" : FOLDER_PICKER);
      await page.goto(state.url);
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
  return page.evaluate(async (folder) => {
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
  }, folder);
}

/** The files of an example Module folder. */
export async function exampleFiles(name: string): Promise<Record<string, Uint8Array>> {
  const root = fileURLToPath(new URL(`../../../examples/${name}`, import.meta.url));
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
