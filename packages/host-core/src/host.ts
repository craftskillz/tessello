// The Host side of the message protocol (CONVENTION.md §5, §6), one surface (View or Widget) at a time.

import type { Persistence } from "./persistence.ts";
import { ProtocolError } from "./protocol-error.ts";
import { createStorage } from "./storage.ts";

export interface Theme {
  mode: "light" | "dark";
  colors: { background: string; surface: string; text: string; textMuted: string; accent: string; border: string };
}

/** The window of an iframe the Host created, as the Host sees it (`iframe.contentWindow` in the browser). */
export interface Frame {
  postMessage(message: unknown, targetOrigin: string): void;
}

export interface ModuleRef {
  id: string;
  version: string;
}

export interface SurfaceOptions {
  frame: Frame;
  module: ModuleRef;
  surface: "view" | "widget";
  /** View only: the params it was opened with. */
  params?: Record<string, string>;
}

export interface HostOptions {
  persistence: Persistence;
  /** BCP 47 tag of the interface language. */
  locale: string;
  theme: Theme;
}

export interface Host {
  /** Starts answering the messages of an iframe the Host has just created. */
  mountSurface(options: SurfaceOptions): void;
  /** Handles a message received by the Host's window (wire it to the "message" event). */
  receive(event: { source: unknown; data: unknown }): void;
  /** Changes the theme given to every surface, and sends `theme.changed` to those past their handshake. */
  setTheme(theme: Theme): void;
}

interface Request {
  type: string;
  id: string;
  payload: unknown;
}

interface Surface extends SurfaceOptions {
  /** True once the Host has answered `ready`: until then, no event and `not_ready` for every other request. */
  ready: boolean;
}

export function createHost(options: HostOptions): Host {
  const surfaces = new Map<unknown, Surface>();
  const storage = createStorage(options.persistence);
  let theme = options.theme;

  const contextOf = (surface: Surface) => ({
    surface: surface.surface,
    module: { id: surface.module.id, version: surface.module.version },
    locale: options.locale,
    theme,
    ...(surface.surface === "view" ? { params: surface.params ?? {} } : {}),
  });

  const send = (surface: Surface, message: object) => surface.frame.postMessage({ tessello: 1, ...message }, "*");
  const succeed = (surface: Surface, request: Request, result: unknown) =>
    send(surface, { type: "response", id: request.id, ok: true, result });
  const fail = (surface: Surface, request: Request, code: string, message: string) =>
    send(surface, { type: "response", id: request.id, ok: false, error: { code, message } });

  return {
    mountSurface(surface) {
      surfaces.set(surface.frame, { ...surface, ready: false });
    },
    receive({ source, data }) {
      const surface = surfaces.get(source);
      if (!surface || !isRequest(data)) return;
      const request = data;
      if (request.type === "ready") {
        succeed(surface, request, contextOf(surface));
        surface.ready = true;
        return;
      }
      if (!surface.ready) {
        fail(surface, request, "not_ready", `Send "ready" before "${request.type}".`);
        return;
      }
      const handle = storage.handlers[request.type];
      if (!handle) {
        fail(surface, request, "unknown_type", `The Host does not know the request type "${request.type}".`);
        return;
      }
      handle(surface.module.id, request.payload).then(
        (result) => succeed(surface, request, result),
        (error: unknown) =>
          error instanceof ProtocolError
            ? fail(surface, request, error.code, error.message)
            : fail(surface, request, "internal", "The Host failed to handle this request."),
      );
    },
    setTheme(newTheme) {
      theme = newTheme;
      for (const surface of surfaces.values()) {
        if (surface.ready) send(surface, { type: "theme.changed", payload: theme });
      }
    },
  };
}

/** A message with the protocol envelope (CONVENTION.md §5) and an `id` to answer. */
function isRequest(data: unknown): data is Request {
  if (typeof data !== "object" || data === null) return false;
  const message = data as Record<string, unknown>;
  return message.tessello === 1 && typeof message.type === "string" && typeof message.id === "string";
}
