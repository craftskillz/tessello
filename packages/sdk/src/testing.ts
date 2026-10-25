// The Test Host: what a Module's own tests connect to instead of the Host (ADR 0019). It runs the Host's message
// protocol and storage from @tessello/host-core, in memory, so its answers, errors and limits are the Host's.
// Not for a Module's code: only its tests import `@tessello/sdk/testing`.

import { readFile } from "node:fs/promises";
import { createServer } from "node:http";
import { extname, resolve, sep } from "node:path";
import { createHost, createMemoryPersistence, ProtocolError, THEMES } from "@tessello/host-core";
import type { Json, Storage, Theme, Transport } from "./index.ts";

/** One of the Host's two themes, or any theme. */
export type TestTheme = Theme["mode"] | Theme;

export interface TestHostOptions {
  /** The Module the Host gives in the context; `@test/module` 0.0.0 by default. */
  module?: { id: string; version: string };
  /** BCP 47 tag of the Host's interface language; `en-US` by default. */
  locale?: string;
  /** One of the Host's two themes, or any theme; `light` by default. */
  theme?: TestTheme;
  /** What the Module's storage holds before the Module starts: key → value. */
  storage?: Record<string, Exclude<Json, null>>;
}

export interface MountOptions {
  surface: "view" | "widget";
  /** View only: the params it is opened with, as from its Widget's `openView`. */
  params?: Record<string, string>;
}

/** A View or a Widget the Test Host answers. */
export interface TestSurface {
  /** Tells the Module it is hidden (`false`) or shown again (`true`), as the Host does; a Module starts visible. */
  setVisible(visible: boolean): void;
}

/** A View or a Widget whose code runs in Node. */
export interface MountedSurface extends TestSurface {
  /** What the Module passes to `connect({ transport })`. */
  transport: Transport;
}

/** What the Test Host needs of a Playwright `Page`. */
export interface TestPage {
  exposeFunction(name: string, callback: (data: unknown) => unknown): Promise<unknown>;
  addInitScript(script: string): Promise<unknown>;
  evaluate(expression: string): Promise<unknown>;
}

export interface Refusal {
  /** Only the writes of this key; every key by default. */
  key?: string;
  /** One of the error codes of CONVENTION.md §5.1; `quota_exceeded`, a full storage, by default. */
  code?: string;
  message?: string;
}

export interface TestHost {
  /**
   * Answers the View or the Widget the page opens next, and after each reload, with this Test Host: call it before
   * `page.goto()`. The page is the Module's own, opened at the top of the tab, so the SDK's `connect()` reaches the Test
   * Host with no change to the Module's code. One surface per page.
   */
  attach(page: TestPage, options: MountOptions): Promise<TestSurface>;
  /** A View or a Widget connected through a transport, for a Module's code run in Node. */
  mount(options: MountOptions): MountedSurface;
  /**
   * The Module's storage, as the test sees it: it reads what the Module wrote, and changes it as another surface would.
   * Its writes skip the Host's limits, so a test can start from any state.
   */
  storage: Storage;
  /**
   * Makes the Host refuse the Module's writes (`storage.set` and `storage.delete`), to test what the Module tells the
   * User when a change cannot be saved. The Host's own checks come first (handshake, key, size), as when its disk
   * fails. Returns a function that stops refusing them.
   */
  refuseWrites(refusal?: Refusal): () => void;
  /** Changes the theme, and tells every surface past its handshake, as when the User changes the Host's. */
  setTheme(theme: TestTheme): void;
  /** The params of each `openView` of the Widget, in order. */
  readonly openedViews: Record<string, string>[];
  /**
   * Opens the View with `params`, as its Widget would: a View already loaded gets them in a `navigation.params` event,
   * one not loaded yet in `context.params`. It is not one of `openedViews`.
   */
  openView(params: Record<string, string>): void;
}

/** The window of a surface, as the Host sees it. */
interface Frame {
  postMessage(message: unknown, targetOrigin: string): void;
}

/** The function the page calls with each request of the Module. */
const BINDING = "__tesselloTestHost";

/**
 * Run in the page before the Module: the SDK posts its requests to `window.parent`, the page itself at the top of the
 * tab, so they arrive here too. Responses and events are the Test Host's own, posted back: they are not passed on.
 */
const PAGE_SCRIPT = `if (window === window.top) {
  window.addEventListener("message", (event) => {
    const data = event.data;
    if (event.source !== window || typeof data !== "object" || data === null || data.tessello !== 1) return;
    if (typeof data.id !== "string" || data.type === "response") return;
    window.${BINDING}(data);
  });
}`;

const themeOf = (theme: TestTheme = "light"): Theme => (typeof theme === "string" ? THEMES[theme] : theme);

export function createTestHost(options: TestHostOptions = {}): TestHost {
  const module = options.module ?? { id: "@test/module", version: "0.0.0" };
  const persistence = createMemoryPersistence();
  // The test writes past the refusals; the Host writes through them.
  const { write, delete: remove } = persistence.storage;
  const refusals = new Set<Required<Pick<Refusal, "code" | "message">> & Refusal>();
  const refuse = (key: string) => {
    const refusal = [...refusals].find((each) => each.key === undefined || each.key === key);
    if (refusal) throw new ProtocolError(refusal.code, refusal.message);
  };
  persistence.storage.write = async (moduleId, key, serialized) => {
    refuse(key);
    await write(moduleId, key, serialized);
  };
  persistence.storage.delete = async (moduleId, key) => {
    refuse(key);
    await remove(moduleId, key);
  };
  // Written before any request is handled: the Module starts with this storage.
  const seeded = Promise.all(
    Object.entries(options.storage ?? {}).map(([key, value]) => write(module.id, key, JSON.stringify(value))),
  );
  const openedViews: Record<string, string>[] = [];
  let openingFromTest = false;
  const host = createHost({
    persistence,
    locale: options.locale ?? "en-US",
    theme: themeOf(options.theme),
    openView({ params }) {
      if (!openingFromTest) openedViews.push(params);
    },
  });
  /** Handles a message from a surface, as the Host's window does, once the storage the test chose is written. */
  const receive = async (frame: Frame, data: unknown) => {
    await seeded;
    host.receive({ source: frame, data });
  };

  const entries = async () => {
    await seeded;
    return persistence.storage.read(module.id);
  };

  return {
    storage: {
      async get(key) {
        const serialized = (await entries()).get(key);
        return serialized === undefined ? null : JSON.parse(serialized);
      },
      async set(key, value) {
        await seeded;
        await write(module.id, key, JSON.stringify(value));
      },
      async delete(key) {
        await seeded;
        await remove(module.id, key);
      },
      keys: async () => [...(await entries()).keys()],
    },
    refuseWrites({ key, code = "quota_exceeded", message = "The storage of this Module is full." } = {}) {
      const refusal = { key, code, message };
      refusals.add(refusal);
      return () => void refusals.delete(refusal);
    },
    openedViews,
    openView(params) {
      // A Widget only the Host sees, so that the View gets the params exactly as from its own Widget. The Host handles
      // `ready` and `navigation.openView` at once: the flag only covers this call.
      const frame: Frame = { postMessage() {} };
      const widget = host.mountSurface({ frame, module, surface: "widget" });
      openingFromTest = true;
      try {
        host.receive({ source: frame, data: { tessello: 1, type: "ready", id: "ready", payload: {} } });
        host.receive({ source: frame, data: { tessello: 1, type: "navigation.openView", id: "open", payload: { params } } });
      } finally {
        openingFromTest = false;
        widget.unmount();
      }
    },
    setTheme: (theme) => host.setTheme(themeOf(theme)),
    async attach(page, { surface, params }) {
      const frame: Frame = {
        postMessage(message) {
          // A page closed or reloading drops it, as a window would. After a reload, the Module's `ready` gets the current
          // theme, and the Host tells a hidden surface it is hidden: nothing the test changed meanwhile is lost.
          page.evaluate(`window.postMessage(${JSON.stringify(message)}, "*")`).catch(() => {});
        },
      };
      const mounted = host.mountSurface({ frame, module, surface, ...(params ? { params } : {}) });
      await page.exposeFunction(BINDING, (data) => receive(frame, data));
      await page.addInitScript(PAGE_SCRIPT);
      return { setVisible: mounted.setVisible };
    },
    mount({ surface, params }) {
      const listeners = new Set<(data: unknown) => void>();
      // Asynchronous and structured-cloned, as `window.postMessage` is.
      const frame: Frame = {
        postMessage(message) {
          const data = structuredClone(message);
          setTimeout(() => {
            for (const listener of listeners) listener(data);
          }, 0);
        },
      };
      const mounted = host.mountSurface({ frame, module, surface, ...(params ? { params } : {}) });
      return {
        setVisible: mounted.setVisible,
        transport: {
          send(message) {
            const data = structuredClone(message);
            setTimeout(() => void receive(frame, data), 0);
          },
          subscribe(listener) {
            listeners.add(listener);
            return () => void listeners.delete(listener);
          },
        },
      };
    },
  };
}

// Waiting (.scratch/e2e-reliability/spec.md, common rules): a test waits for something it can observe,
// never for a fixed time, and its deadline is set in one place.

let waitTimeout = 5_000;

/** What is left of `T` once its values that count as false are taken out. */
export type Truthy<T> = Exclude<T, false | null | undefined | 0 | "">;

/** Sets how long `until()` waits before it gives up, on a machine that is not slowed down; 5 seconds by default. */
export function setWaitTimeout(ms: number): void {
  waitTimeout = ms;
}

/**
 * How many times slower `E2E_CPU_SLOWDOWN` asks the browser's processor to run, to reproduce a CI machine on one's own:
 * 1, unchanged, without it.
 */
export function cpuSlowdown(): number {
  const value = process.env.E2E_CPU_SLOWDOWN;
  if (!value) return 1;
  const rate = Number(value);
  if (!(rate >= 1)) throw new Error(`E2E_CPU_SLOWDOWN is how many times slower the processor runs, 1 or more, not "${value}".`);
  return rate;
}

/**
 * Reads `read` again until it gives a value that is not `false`, `null`, `undefined`, `0` or `""`, and resolves with it.
 * A read that throws counts as no value yet. Gives up once the deadline (`setWaitTimeout`, times `E2E_CPU_SLOWDOWN`)
 * has passed, with `what` it waited for and the last error.
 */
export async function until<T>(read: () => T | Promise<T>, what = "the condition"): Promise<Truthy<T>> {
  const timeout = waitTimeout * cpuSlowdown();
  const deadline = Date.now() + timeout;
  let lastError: unknown;
  for (;;) {
    try {
      const value = await read();
      if (value) return value as Truthy<T>;
    } catch (error) {
      lastError = error;
    }
    if (Date.now() >= deadline) {
      const reason = lastError === undefined ? "" : `: ${lastError instanceof Error ? lastError.message : String(lastError)}`;
      throw new Error(`Waited ${timeout} ms for ${what}${reason}`);
    }
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
}

// The browser: a Module's page served over HTTP, a slower processor, and the size of a Widget.

/** The indicative size of a Widget on the Home, by its `widget.size` (CONVENTION.md §7.1), for `page.setViewportSize`. */
export const WIDGET_SIZES: Readonly<Record<"S" | "M" | "L", { width: number; height: number }>> = {
  S: { width: 160, height: 160 },
  M: { width: 336, height: 160 },
  L: { width: 336, height: 336 },
};

/** What `slowDownCpu` needs of a Playwright `Page`. */
export interface CdpPage {
  context(): { newCDPSession(page: never): Promise<{ send(method: string, params?: object): Promise<unknown> }> };
}

/** Slows the page's processor down by `E2E_CPU_SLOWDOWN` (CDP `Emulation.setCPUThrottlingRate`); Chromium only. */
export async function slowDownCpu(page: CdpPage): Promise<void> {
  const rate = cpuSlowdown();
  if (rate === 1) return;
  const cdp = await page.context().newCDPSession(page as never);
  await cdp.send("Emulation.setCPUThrottlingRate", { rate });
}

const CONTENT_TYPES: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".md": "text/markdown; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".ico": "image/x-icon",
  ".woff2": "font/woff2",
  ".wasm": "application/wasm",
};

export interface FolderServer {
  /** Where the folder is served, without a trailing slash, such as `http://127.0.0.1:53124`. */
  url: string;
  close(): Promise<void>;
}

/** Serves a folder, such as a Module's `dist/`, on a free port of 127.0.0.1: a file per path, nothing outside it. */
export async function serveFolder(folder: string): Promise<FolderServer> {
  const root = resolve(folder);
  const server = createServer(async (request, response) => {
    const path = decodeURIComponent(new URL(request.url ?? "/", "http://localhost").pathname);
    const file = resolve(root, `.${path.endsWith("/") ? `${path}index.html` : path}`);
    try {
      if (!file.startsWith(root + sep)) throw new Error("outside the folder");
      const body = await readFile(file);
      response.writeHead(200, { "Content-Type": CONTENT_TYPES[extname(file).toLowerCase()] ?? "application/octet-stream" });
      response.end(body);
    } catch {
      response.writeHead(404).end();
    }
  });
  await new Promise<void>((listening) => server.listen(0, "127.0.0.1", listening));
  const { port } = server.address() as { port: number };
  return {
    url: `http://127.0.0.1:${port}`,
    close: () => new Promise<void>((closed) => server.close(() => closed())),
  };
}
