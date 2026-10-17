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

  constructor(code: string, message: string) {
    super(message);
    this.name = "TesselloError";
    this.code = code;
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

export interface ConnectedModule {
  context: Context;
  storage: Storage;
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
      const error = (data.error ?? {}) as { code?: unknown; message?: unknown };
      request.reject(new TesselloError(String(error.code ?? "internal"), String(error.message ?? "")));
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
