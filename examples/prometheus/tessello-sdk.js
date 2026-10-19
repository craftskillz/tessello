// Tessello SDK (built from @tessello/sdk). Copy this file into your Module and import it with a relative path.
class TesselloError extends Error {
  code;
  constructor(code, message) {
    super(message);
    this.name = "TesselloError";
    this.code = code;
  }
}
async function connect(options = {}) {
  const transport = options.transport ?? parentWindowTransport();
  const pending = /* @__PURE__ */ new Map();
  const listeners = /* @__PURE__ */ new Map();
  let nextId = 0;
  transport.subscribe((data) => {
    if (!isProtocolMessage(data)) return;
    if (data.type !== "response") {
      for (const listener of listeners.get(data.type) ?? []) listener(data.payload);
      return;
    }
    if (typeof data.id !== "string") return;
    const request2 = pending.get(data.id);
    if (!request2) return;
    pending.delete(data.id);
    if (data.ok) {
      request2.resolve(data.result);
    } else {
      const error = data.error ?? {};
      request2.reject(new TesselloError(String(error.code ?? "internal"), String(error.message ?? "")));
    }
  });
  const request = (type, payload = {}) => new Promise((resolve, reject) => {
    const id = String(nextId++);
    pending.set(id, { resolve, reject });
    transport.send({ tessello: 1, type, id, payload });
  });
  const on = (type, read, listener) => {
    const onEvent = (payload) => {
      const value = read(payload);
      if (value !== void 0) listener(value);
    };
    let ofType = listeners.get(type);
    if (!ofType) listeners.set(type, ofType = /* @__PURE__ */ new Set());
    ofType.add(onEvent);
    return () => void ofType.delete(onEvent);
  };
  const context = await request("ready");
  return {
    context,
    storage: {
      get: async (key) => (await request("storage.get", { key })).value,
      set: async (key, value) => void await request("storage.set", { key, value }),
      delete: async (key) => void await request("storage.delete", { key }),
      keys: async () => (await request("storage.keys")).keys
    },
    onThemeChange: (listener) => on("theme.changed", readTheme, listener),
    onVisibilityChange: (listener) => on("visibility", readVisible, listener),
    openView: async (params = {}) => void await request("navigation.openView", { params }),
    onNavigationParams: (listener) => on("navigation.params", readParams, listener)
  };
}
const isObject = (value) => typeof value === "object" && value !== null && !Array.isArray(value);
const readTheme = (payload) => isObject(payload) && (payload.mode === "light" || payload.mode === "dark") && isObject(payload.colors) ? payload : void 0;
const readVisible = (payload) => isObject(payload) && typeof payload.visible === "boolean" ? payload.visible : void 0;
const readParams = (payload) => isObject(payload) && isObject(payload.params) && Object.values(payload.params).every((value) => typeof value === "string") ? payload.params : void 0;
function isProtocolMessage(data) {
  return typeof data === "object" && data !== null && data.tessello === 1;
}
function parentWindowTransport() {
  return {
    send: (message) => window.parent.postMessage(message, "*"),
    subscribe(listener) {
      const onMessage = (event) => {
        if (event.source === window.parent) listener(event.data);
      };
      window.addEventListener("message", onMessage);
      return () => window.removeEventListener("message", onMessage);
    }
  };
}
export {
  TesselloError,
  connect
};
