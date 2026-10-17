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
}

export interface ConnectOptions {
  /** Defaults to postMessage with `window.parent`. */
  transport?: Transport;
}

/** Sends `ready` and resolves once the Host has answered with the context (CONVENTION.md §6.4). */
export async function connect(options: ConnectOptions = {}): Promise<ConnectedModule> {
  const transport = options.transport ?? parentWindowTransport();
  const pending = new Map<string, { resolve: (result: any) => void; reject: (error: Error) => void }>();
  let nextId = 0;

  transport.subscribe((data) => {
    if (!isProtocolMessage(data) || data.type !== "response" || typeof data.id !== "string") return;
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

  const context: Context = await request("ready");
  return {
    context,
    storage: {
      get: async (key) => (await request("storage.get", { key })).value,
      set: async (key, value) => void (await request("storage.set", { key, value })),
      delete: async (key) => void (await request("storage.delete", { key })),
      keys: async () => (await request("storage.keys")).keys,
    },
  };
}

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
