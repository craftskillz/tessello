// Tessello SDK: wraps the message protocol of the Convention (CONVENTION.md §5, §6) for a Module.
// No dependency, so a Creator can copy this file into a package and use it without any Permission.

/** How the Module exchanges messages with the Host. */
export interface Transport {
  send(message: unknown): void;
  /**
   * Calls `listener` with every message coming from the Host; returns a function that stops listening.
   * Must only pass on messages from the Host itself (`event.source === window.parent`, CONVENTION.md §5.3).
   */
  subscribe(listener: (data: unknown) => void): () => void;
}

/** A request the Host refused; `code` is one of the error codes of CONVENTION.md §5.1, such as "quota_exceeded". */
export class TesselloError extends Error {
  readonly code: string;
  /** The id of the granted folder the refusal is about, as with `overlapping`; absent otherwise. */
  readonly folder?: string;

  constructor(code: string, message: string, folder?: string) {
    super(message);
    this.name = "TesselloError";
    this.code = code;
    if (folder !== undefined) this.folder = folder;
  }
}

export interface Theme {
  mode: "light" | "dark";
  colors: { background: string; surface: string; text: string; textMuted: string; accent: string; border: string };
}

export interface Context {
  surface: "view" | "widget";
  module: { id: string; version: string };
  /** BCP 47 tag of the Host's interface language. */
  locale: string;
  theme: Theme;
  /** Present only on a View. */
  params?: Record<string, string>;
}

/** JSON values a Module can store (CONVENTION.md §6.1). */
export type Json = string | number | boolean | null | Json[] | { [key: string]: Json };

/** The Module's private key/value space, shared by its View and its Widget (CONVENTION.md §6.1). */
export interface Storage {
  /** Resolves with `null` when the key does not exist. */
  get(key: string): Promise<Json>;
  /** Use `delete` to remove a key: `null` cannot be stored. */
  set(key: string, value: Exclude<Json, null>): Promise<void>;
  /** Succeeds even when the key does not exist. */
  delete(key: string): Promise<void>;
  keys(): Promise<string[]>;
}

/** The Permissions a Module declares in its Manifest (CONVENTION.md §3.1). */
export interface Permissions {
  network?: string[];
  localNetwork?: string[];
  folders?: true;
}

/** A folder the User granted the Module (CONVENTION.md §6.5): an opaque id and the folder's name, never its path. */
export interface Folder {
  id: string;
  name: string;
}

/** The folders the User grants the Module, one at a time (CONVENTION.md §6.5). Needs the `folders` Permission. */
export interface Folders {
  /**
   * Opens the Host's folder picker; resolves with the folder the User chose, or `null` when they cancel. Call it from
   * the User's click, before any `await`: the browser opens the picker only while it handles the click.
   *
   * `mustContain` refuses a folder that does not hold the given granted folder (`not_containing`). `mustNotOverlap`
   * refuses a folder that is, lies inside, or holds any of the given granted folders (`overlapping`; the error's
   * `folder` is the id of the first one it clashes with). Nothing is granted on a refusal.
   */
  request(options?: { mustContain?: Folder; mustNotOverlap?: Folder[] }): Promise<Folder | null>;
  /** The folders granted to the Module, and whether the browser lets the Host use each of them now. */
  list(): Promise<(Folder & { state: FolderState })[]>;
  /**
   * Asks the User to allow a folder again, as after a browser restart; resolves with its state. Call it from the
   * User's click, before any `await`.
   */
  reconnect(folder: Folder): Promise<FolderState>;
  /** Gives a folder back: it is no longer granted. Its files stay on disk. */
  release(folder: Folder): Promise<void>;
}

/**
 * `granted`: the Module may use the folder. `prompt`: the browser waits for the User to allow it again (after a
 * restart); every `files.*` request on it is refused with `unavailable` until `reconnect`.
 */
export type FolderState = "granted" | "prompt";

/** A file read from a granted folder: its text, or its bytes when read `as: "bytes"`. */
export interface FolderFile<Content = string> {
  content: Content;
  /** Changes with each write, by the Module or anyone else (an editor, an agent, git). */
  version: string;
}

/**
 * A file or a folder of a granted folder, its path from that folder. A file's `modified` is when it was last modified,
 * in milliseconds since the Unix epoch (as `File.lastModified`); folders have none.
 */
export type FolderEntry = { kind: "file"; path: string; version: string; modified: number } | { kind: "folder"; path: string };

/**
 * The files of the folders the User granted (CONVENTION.md §6.5). Paths are relative to the granted folder, with `/`
 * between names; `..`, `.` and empty names are refused with `invalid_payload`.
 */
export interface Files {
  /** Refused with `not_found` when there is no such file. */
  read(folder: Folder, path: string, options?: { as?: "text" }): Promise<FolderFile<string>>;
  read(folder: Folder, path: string, options: { as: "bytes" }): Promise<FolderFile<Uint8Array>>;
  /**
   * Writes a file, creating it and its folders when needed, and resolves with its new version. With `ifVersion`, refused
   * with `conflict` unless the file still has this version; `ifVersion: null` only creates a file that does not exist.
   */
  write(folder: Folder, path: string, content: string | Uint8Array, options?: { ifVersion?: string | null }): Promise<{ version: string }>;
  /** Every file and folder under `path` (the whole folder by default), at any depth. `not_found` if it is no folder. */
  list(folder: Folder, path?: string): Promise<FolderEntry[]>;
  /**
   * Moves a file or a folder; missing folders of the destination are created. Refused with `conflict` when the
   * destination exists. A folder moves file by file: if the Host fails midway, both folders hold part of the files.
   */
  move(folder: Folder, from: string, to: string): Promise<void>;
  /** Deletes a file, or a folder with everything in it. `not_found` when there is nothing at `path`. */
  delete(folder: Folder, path: string): Promise<void>;
}

export interface ConnectedModule {
  context: Context;
  storage: Storage;
  folders: Folders;
  files: Files;
  /** Calls `listener` with the new theme each time the Host's theme changes; returns a function that stops it. */
  onThemeChange(listener: (theme: Theme) => void): () => void;
  /**
   * Calls `listener` each time the Module is hidden (`false`) or shown again (`true`); returns a function that stops it.
   * A Module starts visible. A hidden Module should stop its timers, animations and polling.
   */
  onVisibilityChange(listener: (visible: boolean) => void): () => void;
  /** Widget only: asks the Host to open this Module's View with `params` (CONVENTION.md §6.3). */
  openView(params?: Record<string, string>): Promise<void>;
  /**
   * View only: calls `listener` with the params each time the View, already loaded, is opened again from the Widget;
   * returns a function that stops it. A View opened while not loaded gets its params in `context.params` instead.
   */
  onNavigationParams(listener: (params: Record<string, string>) => void): () => void;
}

export interface ConnectOptions {
  /** Defaults to postMessage with `window.parent`. */
  transport?: Transport;
}

/** Sends `ready` and resolves once the Host has answered with the context (CONVENTION.md §6.4). */
export async function connect(options: ConnectOptions = {}): Promise<ConnectedModule> {
  const transport = options.transport ?? parentWindowTransport();
  const pending = new Map<string, { resolve: (result: any) => void; reject: (error: Error) => void }>();
  // Event type → its listeners. Events of any other type are ignored (CONVENTION.md §5.3).
  const listeners = new Map<string, Set<(payload: unknown) => void>>();
  let nextId = 0;

  transport.subscribe((data) => {
    if (!isProtocolMessage(data)) return;
    if (data.type !== "response") {
      for (const listener of listeners.get(data.type) ?? []) listener(data.payload);
      return;
    }
    if (typeof data.id !== "string") return;
    const request = pending.get(data.id);
    if (!request) return;
    pending.delete(data.id);
    if (data.ok) {
      request.resolve(data.result);
    } else {
      const error = (data.error ?? {}) as { code?: unknown; message?: unknown; folder?: unknown };
      request.reject(
        new TesselloError(
          String(error.code ?? "internal"),
          String(error.message ?? ""),
          typeof error.folder === "string" ? error.folder : undefined,
        ),
      );
    }
  });

  const request = (type: string, payload: object = {}) =>
    new Promise<any>((resolve, reject) => {
      const id = String(nextId++);
      pending.set(id, { resolve, reject });
      transport.send({ tessello: 1, type, id, payload });
    });

  // `read` turns the event's payload into what the listener gets, or `undefined` to ignore an event it cannot read.
  const on = <T>(type: string, read: (payload: unknown) => T | undefined, listener: (value: T) => void) => {
    const onEvent = (payload: unknown) => {
      const value = read(payload);
      if (value !== undefined) listener(value);
    };
    let ofType = listeners.get(type);
    if (!ofType) listeners.set(type, (ofType = new Set()));
    ofType.add(onEvent);
    return () => void ofType.delete(onEvent);
  };

  const context: Context = await request("ready");
  return {
    context,
    storage: {
      get: async (key) => (await request("storage.get", { key })).value,
      set: async (key, value) => void (await request("storage.set", { key, value })),
      delete: async (key) => void (await request("storage.delete", { key })),
      keys: async () => (await request("storage.keys")).keys,
    },
    folders: {
      request: async ({ mustContain, mustNotOverlap } = {}) =>
        (
          await request("folders.request", {
            ...(mustContain === undefined ? {} : { mustContain: mustContain.id }),
            ...(mustNotOverlap === undefined ? {} : { mustNotOverlap: mustNotOverlap.map((folder) => folder.id) }),
          })
        ).folder,
      list: async () => (await request("folders.list")).folders,
      reconnect: async (folder) => (await request("folders.reconnect", { folder: folder.id })).state,
      release: async (folder) => void (await request("folders.release", { folder: folder.id })),
    },
    files: {
      read: (folder: Folder, path: string, { as }: { as?: "text" | "bytes" } = {}) =>
        request("files.read", { folder: folder.id, path, ...(as === undefined ? {} : { as }) }),
      list: async (folder, path) => (await request("files.list", { folder: folder.id, ...(path === undefined ? {} : { path }) })).entries,
      move: async (folder, from, to) => void (await request("files.move", { folder: folder.id, from, to })),
      delete: async (folder, path) => void (await request("files.delete", { folder: folder.id, path })),
      write: (folder, path, content, { ifVersion } = {}) =>
        request("files.write", { folder: folder.id, path, content, ...(ifVersion === undefined ? {} : { ifVersion }) }),
    },
    onThemeChange: (listener) => on("theme.changed", readTheme, listener),
    onVisibilityChange: (listener) => on("visibility", readVisible, listener),
    openView: async (params = {}) => void (await request("navigation.openView", { params })),
    onNavigationParams: (listener) => on("navigation.params", readParams, listener),
  };
}

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const readTheme = (payload: unknown) =>
  isObject(payload) && (payload.mode === "light" || payload.mode === "dark") && isObject(payload.colors)
    ? (payload as unknown as Theme)
    : undefined;

const readVisible = (payload: unknown) =>
  isObject(payload) && typeof payload.visible === "boolean" ? payload.visible : undefined;

const readParams = (payload: unknown) =>
  isObject(payload) && isObject(payload.params) && Object.values(payload.params).every((value) => typeof value === "string")
    ? (payload.params as Record<string, string>)
    : undefined;

function isProtocolMessage(data: unknown): data is { tessello: 1; type: string; [field: string]: unknown } {
  return typeof data === "object" && data !== null && (data as { tessello?: unknown }).tessello === 1;
}

function parentWindowTransport(): Transport {
  return {
    send: (message) => window.parent.postMessage(message, "*"),
    subscribe(listener) {
      const onMessage = (event: MessageEvent) => {
        if (event.source === window.parent) listener(event.data);
      };
      window.addEventListener("message", onMessage);
      return () => window.removeEventListener("message", onMessage);
    },
  };
}
