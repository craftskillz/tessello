// Test entry point D: the built Host in a real browser (Playwright). Run with `npm run test:browser`.
// BROWSER=firefox or BROWSER=webkit picks another engine than Chromium.

import { readdir, readFile } from "node:fs/promises";
import { join, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { after, before } from "node:test";
import { strToU8, zipSync } from "fflate";
import { type Browser, chromium, firefox, type Page, webkit } from "playwright";
import { serveHost } from "../scripts/serve.ts";

const engines = { chromium, firefox, webkit };

/** Starts the Host and a browser for the tests of the calling file; `newPage()` opens a fresh, empty Host. */
export function useHost() {
  let browser: Browser;
  let close: () => void;
  const state = { url: "" };
  before(async () => {
    const { server, url } = await serveHost();
    state.url = url;
    close = () => server.close();
    browser = await engines[(process.env.BROWSER ?? "chromium") as keyof typeof engines].launch();
  });
  after(async () => {
    await browser?.close();
    close?.();
  });
  return {
    get url() {
      return state.url;
    },
    /** A page in a new browser context, so no IndexedDB data is shared with other tests. */
    async newPage(): Promise<Page> {
      const page = await (await browser.newContext()).newPage();
      await page.goto(state.url);
      return page;
    },
  };
}

/** Zips an example Module folder, as a Creator would before sharing it. */
export async function zipExample(name: string): Promise<Uint8Array> {
  const root = fileURLToPath(new URL(`../../../examples/${name}`, import.meta.url));
  const files: Record<string, Uint8Array> = {};
  for (const entry of await readdir(root, { recursive: true, withFileTypes: true })) {
    if (!entry.isFile() || entry.name === ".DS_Store") continue;
    const absolute = join(entry.parentPath, entry.name);
    files[relative(root, absolute).split(sep).join("/")] = new Uint8Array(await readFile(absolute));
  }
  return zipSync(files);
}

/** Zips in-memory files: path → text, bytes, or an object written as JSON. */
export function zip(files: Record<string, string | Uint8Array | object>): Uint8Array {
  return zipSync(
    Object.fromEntries(
      Object.entries(files).map(([path, content]) => [
        path,
        content instanceof Uint8Array ? content : strToU8(typeof content === "string" ? content : JSON.stringify(content)),
      ]),
    ),
  );
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
