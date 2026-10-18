// The Host side of the message protocol (CONVENTION.md §5, §6), one surface (View or Widget) at a time.

import { LIMITS } from "@tessello/convention";
import { paramsOf } from "./navigation.ts";
import { payloadObject } from "./payload.ts";
import type { Persistence } from "./persistence.ts";
import { ProtocolError } from "./protocol-error.ts";
import { createHome, type HomeWidget } from "./home.ts";
import { createModules, type Inspection, type ModuleEntry, type Opening } from "./modules.ts";
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
  /** Called if `ready` has not arrived within the handshake timeout after `loaded()` (CONVENTION.md §6.4). */
  onHandshakeTimeout?(): void;
}

export interface HostOptions {
  persistence: Persistence;
  /** BCP 47 tag of the interface language. */
  locale: string;
  theme: Theme;
  /**
   * Called when a Widget asks to open its Module's View (CONVENTION.md §6.3). The interface shows that View.
   * If a View of this Module is already mounted, it has already been given the params; otherwise mount one with them.
   */
  openView(request: { module: ModuleRef; params: Record<string, string> }): void;
}

/** What the Host's interface keeps to drive one mounted View or Widget. */
export interface MountedSurface {
  /** Starts the handshake timeout: call it when the iframe has loaded (its "load" event). */
  loaded(): void;
  /** Tells the Module it is shown or hidden; a Module starts visible after its handshake (CONVENTION.md §6.4). */
  setVisible(visible: boolean): void;
  /** Stops answering this iframe and sending it events: call it when the interface removes the iframe. */
  unmount(): void;
}

export interface Host {
  /** Every Module of the Modules folder, for the Launcher: reads only their Manifest and icon. */
  modules(): Promise<ModuleEntry[]>;
  /** The Widgets of the active Modules, in the order of the Home; a Module without a Widget is not there. */
  home(): Promise<HomeWidget[]>;
  /** Saves the order of the Home's Widgets, given as the Module IDs, in `.tessello/home.json`. */
  arrangeHome(order: string[]): Promise<void>;
  /** Checks a folder of the Modules folder with the Validator; it is activated only when `install()` is called. */
  inspectFolder(folder: string): Promise<Inspection>;
  /** Checks a `.zip` package with the Validator; it is unpacked into a new folder only when `install()` is called. */
  inspectZip(zip: Uint8Array): Promise<Inspection>;
  /** Reads a registered Module's files from disk to show its View, once checked again (ADR 0007). */
  open(id: string): Promise<Opening>;
  /** Starts answering the messages of an iframe the Host has just created. */
  mountSurface(options: SurfaceOptions): MountedSurface;
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
  visible: boolean;
  handshakeTimer?: ReturnType<typeof setTimeout>;
}

export function createHost(options: HostOptions): Host {
  const surfaces = new Map<unknown, Surface>();
  const storage = createStorage(options.persistence);
  const modules = createModules(options.persistence);
  const home = createHome(options.persistence, modules.scan);
  let theme = options.theme;

  const contextOf = (surface: Surface) => ({
    surface: surface.surface,
    module: { id: surface.module.id, version: surface.module.version },
    locale: options.locale,
    theme,
    ...(surface.surface === "view" ? { params: surface.params ?? {} } : {}),
  });

  const handlers: Record<string, (surface: Surface, payload: unknown) => Promise<unknown>> = {
    ...Object.fromEntries(
      Object.entries(storage.handlers).map(([type, handle]) => [
        type,
        (surface: Surface, payload: unknown) => handle(surface.module.id, payload),
      ]),
    ),
    "navigation.openView": async (surface, payload) => {
      if (surface.surface !== "widget") throw new ProtocolError("not_allowed", "Only a Widget can open its Module's View.");
      const params = paramsOf(payload);
      for (const view of surfaces.values()) {
        if (view.surface !== "view" || view.module.id !== surface.module.id) continue;
        if (view.ready) send(view, { type: "navigation.params", payload: { params } });
        else view.params = params;
      }
      options.openView({ module: { id: surface.module.id, version: surface.module.version }, params });
      return {};
    },
  };

  const send = (surface: Surface, message: object) => surface.frame.postMessage({ tessello: 1, ...message }, "*");
  const sendVisibility = (surface: Surface) => send(surface, { type: "visibility", payload: { visible: surface.visible } });
  const succeed = (surface: Surface, request: Request, result: unknown) =>
    send(surface, { type: "response", id: request.id, ok: true, result });
  const fail = (surface: Surface, request: Request, code: string, message: string) =>
    send(surface, { type: "response", id: request.id, ok: false, error: { code, message } });

  return {
    modules: modules.scan,
    home: home.widgets,
    arrangeHome: home.arrange,
    inspectFolder: modules.inspectFolder,
    inspectZip: modules.inspectZip,
    open: modules.open,
    mountSurface(surfaceOptions) {
      const surface: Surface = { ...surfaceOptions, ready: false, visible: true };
      surfaces.set(surface.frame, surface);
      return {
        loaded() {
          if (surface.ready || surface.handshakeTimer !== undefined) return;
          surface.handshakeTimer = setTimeout(() => surface.onHandshakeTimeout?.(), LIMITS.handshakeTimeoutMs);
        },
        setVisible(visible) {
          if (visible === surface.visible) return;
          surface.visible = visible;
          if (surface.ready) sendVisibility(surface);
        },
        unmount() {
          clearTimeout(surface.handshakeTimer);
          surfaces.delete(surface.frame);
        },
      };
    },
    receive({ source, data }) {
      const surface = surfaces.get(source);
      if (!surface || !isRequest(data)) return;
      const request = data;
      if (request.type === "ready") {
        try {
          payloadObject(request.payload);
        } catch (error) {
          if (!(error instanceof ProtocolError)) throw error;
          fail(surface, request, error.code, error.message);
          return;
        }
        succeed(surface, request, contextOf(surface));
        surface.ready = true;
        clearTimeout(surface.handshakeTimer);
        // The Module believes it is visible: correct it if it was hidden before its handshake.
        if (!surface.visible) sendVisibility(surface);
        return;
      }
      if (!surface.ready) {
        fail(surface, request, "not_ready", `Send "ready" before "${request.type}".`);
        return;
      }
      // Own keys only: a type such as "toString" must not find a property inherited from Object.prototype.
      const handle = Object.hasOwn(handlers, request.type) ? handlers[request.type] : undefined;
      if (!handle) {
        fail(surface, request, "unknown_type", `The Host does not know the request type "${request.type}".`);
        return;
      }
      handle(surface, request.payload).then(
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
