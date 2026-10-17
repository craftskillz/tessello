import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { LIMITS } from "@tessello/convention";
import { type ConnectedModule, connect, TesselloError } from "@tessello/sdk";
import { createHost, createMemoryPersistence, type HostOptions, type Persistence, type Theme } from "../src/index.ts";
import { mountFrame, settle, strangerFrame } from "./memory-channel.ts";

const THEME: Theme = {
  mode: "dark",
  colors: {
    background: "#14161a",
    surface: "#1d2026",
    text: "#e8e9eb",
    textMuted: "#9aa0a8",
    accent: "#4f8cff",
    border: "#2c3038",
  },
};
const WEATHER = { id: "@yassine/weather", version: "1.0.0" };
const NOTES = { id: "@yassine/notes", version: "2.1.0" };

const newHost = (persistence = createMemoryPersistence(), openView: HostOptions["openView"] = () => {}) =>
  createHost({ persistence, locale: "fr-FR", theme: THEME, openView });

// Answers after a delay, as IndexedDB does, so that concurrent requests can interleave.
function slowPersistence(): Persistence {
  const memory = createMemoryPersistence();
  const later = <T>(value: Promise<T>) => new Promise<T>((resolve) => setTimeout(() => resolve(value), 5));
  return {
    readStorage: (moduleId) => later(memory.readStorage(moduleId)),
    writeStorage: (moduleId, key, serialized) => later(memory.writeStorage(moduleId, key, serialized)),
    deleteStorageKey: (moduleId, key) => later(memory.deleteStorageKey(moduleId, key)),
  };
}

describe("handshake", () => {
  test("connect sends ready and returns the context of a View", async () => {
    const host = newHost();
    const frame = mountFrame(host, { module: WEATHER, surface: "view", params: { city: "Paris" } });
    const module = await connect({ transport: frame.transport });
    assert.deepEqual(module.context, {
      surface: "view",
      module: WEATHER,
      locale: "fr-FR",
      theme: THEME,
      params: { city: "Paris" },
    });
  });

  test("a Widget's context has no params", async () => {
    const host = newHost();
    const module = await connect({ transport: mountFrame(host, { module: WEATHER, surface: "widget" }).transport });
    assert.equal(module.context.surface, "widget");
    assert.equal("params" in module.context, false);
  });

  test("a request sent before ready fails with not_ready", async () => {
    const frame = mountFrame(newHost(), { module: WEATHER, surface: "view" });
    const response = await frame.request("storage.get", { key: "cities" });
    assert.equal(response.ok, false);
    assert.equal(response.error?.code, "not_ready");
  });

  test("no event is sent before the handshake", async () => {
    const host = newHost();
    const frame = mountFrame(host, { module: WEATHER, surface: "widget" });
    host.setTheme({ ...THEME, mode: "light" });
    await settle();
    assert.deepEqual(frame.received, []);

    await frame.request("ready");
    host.setTheme(THEME);
    await settle();
    assert.deepEqual(frame.received.map((message: any) => message.type), ["response", "theme.changed"]);
  });
});

describe("storage", () => {
  test("an absent key reads as null, a written value reads back", async () => {
    const module = await connect({ transport: mountFrame(newHost(), { module: WEATHER, surface: "view" }).transport });
    assert.equal(await module.storage.get("cities"), null);
    await module.storage.set("cities", ["Paris", "Rabat"]);
    assert.deepEqual(await module.storage.get("cities"), ["Paris", "Rabat"]);
  });

  test("keys lists the stored keys, delete removes one and succeeds on an absent key", async () => {
    const module = await connect({ transport: mountFrame(newHost(), { module: WEATHER, surface: "view" }).transport });
    await module.storage.set("cities", ["Paris"]);
    await module.storage.set("unit", "celsius");
    assert.deepEqual((await module.storage.keys()).sort(), ["cities", "unit"]);

    await module.storage.delete("cities");
    await module.storage.delete("never-written");
    assert.deepEqual(await module.storage.keys(), ["unit"]);
    assert.equal(await module.storage.get("cities"), null);
  });

  test("a Module's View and Widget share the same storage", async () => {
    const host = newHost();
    const view = await connect({ transport: mountFrame(host, { module: WEATHER, surface: "view" }).transport });
    const widget = await connect({ transport: mountFrame(host, { module: WEATHER, surface: "widget" }).transport });
    await view.storage.set("cities", ["Paris"]);
    assert.deepEqual(await widget.storage.get("cities"), ["Paris"]);
  });

  test("a Module cannot see the storage of another Module", async () => {
    const host = newHost();
    const weather = await connect({ transport: mountFrame(host, { module: WEATHER, surface: "view" }).transport });
    const notes = await connect({ transport: mountFrame(host, { module: NOTES, surface: "view" }).transport });
    await weather.storage.set("cities", ["Paris"]);
    assert.equal(await notes.storage.get("cities"), null);
    assert.deepEqual(await notes.storage.keys(), []);
    await notes.storage.delete("cities");
    assert.deepEqual(await weather.storage.get("cities"), ["Paris"]);
  });
});

describe("theme", () => {
  test("a Module follows every change of theme", async () => {
    const host = newHost();
    const module = await connect({ transport: mountFrame(host, { module: WEATHER, surface: "widget" }).transport });
    const themes: unknown[] = [];
    module.onThemeChange((theme) => themes.push(theme));
    const light: Theme = { ...THEME, mode: "light", colors: { ...THEME.colors, background: "#ffffff", text: "#111111" } };
    host.setTheme(light);
    host.setTheme(THEME);
    await settle();
    assert.deepEqual(themes, [light, THEME]);
  });

  test("a Module can stop following the theme", async () => {
    const host = newHost();
    const module = await connect({ transport: mountFrame(host, { module: WEATHER, surface: "view" }).transport });
    const themes: unknown[] = [];
    const stop = module.onThemeChange((theme) => themes.push(theme));
    stop();
    host.setTheme({ ...THEME, mode: "light" });
    await settle();
    assert.deepEqual(themes, []);
  });

  test("a surface mounted after a change starts with the new theme", async () => {
    const host = newHost();
    const light: Theme = { ...THEME, mode: "light" };
    host.setTheme(light);
    const module = await connect({ transport: mountFrame(host, { module: WEATHER, surface: "view" }).transport });
    assert.deepEqual(module.context.theme, light);
  });
});

describe("visibility", () => {
  test("a Module learns when it is hidden and shown again", async () => {
    const host = newHost();
    const frame = mountFrame(host, { module: WEATHER, surface: "widget" });
    const module = await connect({ transport: frame.transport });
    const changes: boolean[] = [];
    module.onVisibilityChange((visible) => changes.push(visible));
    frame.surface.setVisible(false);
    frame.surface.setVisible(true);
    await settle();
    assert.deepEqual(changes, [false, true]);
  });

  test("a Module starts visible: the Host only tells it about a change", async () => {
    const host = newHost();
    const frame = mountFrame(host, { module: WEATHER, surface: "view" });
    const module = await connect({ transport: frame.transport });
    const changes: boolean[] = [];
    module.onVisibilityChange((visible) => changes.push(visible));
    frame.surface.setVisible(true);
    frame.surface.setVisible(false);
    frame.surface.setVisible(false);
    await settle();
    assert.deepEqual(changes, [false]);
  });

  test("a surface hidden before its handshake is told so right after it", async () => {
    const host = newHost();
    const frame = mountFrame(host, { module: WEATHER, surface: "widget" });
    frame.surface.setVisible(false);
    await settle();
    assert.deepEqual(frame.received, []);

    const module = await connect({ transport: frame.transport });
    const changes: boolean[] = [];
    module.onVisibilityChange((visible) => changes.push(visible));
    await settle();
    assert.deepEqual(changes, [false]);
  });
});

describe("navigation", () => {
  // A Host whose interface records each View it is asked to open.
  const recordingHost = () => {
    const opened: unknown[] = [];
    const host = newHost(createMemoryPersistence(), (request) => opened.push(request));
    return { host, opened };
  };

  test("a Widget asks the Host to open its Module's View with params", async () => {
    const { host, opened } = recordingHost();
    const widget = await connect({ transport: mountFrame(host, { module: WEATHER, surface: "widget" }).transport });
    await widget.openView({ city: "Paris" });
    await widget.openView();
    assert.deepEqual(opened, [
      { module: WEATHER, params: { city: "Paris" } },
      { module: WEATHER, params: {} },
    ]);
  });

  test("a View cannot ask to open a View", async () => {
    const { host, opened } = recordingHost();
    const view = await connect({ transport: mountFrame(host, { module: WEATHER, surface: "view" }).transport });
    await assert.rejects(view.openView({ city: "Paris" }), (error: unknown) => {
      assert.ok(error instanceof TesselloError);
      assert.equal(error.code, "not_allowed");
      return true;
    });
    assert.deepEqual(opened, []);
  });

  test("params larger than the Convention allows, once serialized, fail with invalid_payload", async () => {
    const { host, opened } = recordingHost();
    const widget = await connect({ transport: mountFrame(host, { module: WEATHER, surface: "widget" }).transport });
    // {"q":"…"} takes 8 bytes around the value.
    const serializedAs = (bytes: number) => ({ q: "x".repeat(bytes - 8) });
    await widget.openView(serializedAs(LIMITS.openViewParamsBytes));
    await assert.rejects(
      widget.openView(serializedAs(LIMITS.openViewParamsBytes + 1)),
      (error: unknown) => error instanceof TesselloError && error.code === "invalid_payload",
    );
    assert.equal(opened.length, 1);
  });

  const invalidOpenViewPayloads: unknown[] = [
    "Paris",
    { params: "city=Paris" },
    { params: ["Paris"] },
    { params: null },
    { params: { city: 42 } },
    { params: { city: { name: "Paris" } } },
  ];
  for (const payload of invalidOpenViewPayloads) {
    test(`navigation.openView with payload ${JSON.stringify(payload)} fails with invalid_payload`, async () => {
      const { host, opened } = recordingHost();
      const frame = mountFrame(host, { module: WEATHER, surface: "widget" });
      await frame.request("ready");
      const response = await frame.request("navigation.openView", payload);
      assert.equal(response.error?.code, "invalid_payload");
      assert.deepEqual(opened, []);
    });
  }

  test("a View that is not loaded receives the params in its context", async () => {
    // The interface mounts the View it is asked to open, as the real Host does.
    let host: ReturnType<typeof newHost>;
    let opening: Promise<ConnectedModule> | undefined;
    host = newHost(createMemoryPersistence(), ({ module, params }) => {
      opening = connect({ transport: mountFrame(host, { module, surface: "view", params }).transport });
    });
    const widget = await connect({ transport: mountFrame(host, { module: WEATHER, surface: "widget" }).transport });
    await widget.openView({ city: "Rabat" });
    assert.deepEqual((await opening)?.context.params, { city: "Rabat" });
  });

  test("a View already loaded receives the params as an event", async () => {
    const { host, opened } = recordingHost();
    const view = await connect({ transport: mountFrame(host, { module: WEATHER, surface: "view", params: { city: "Paris" } }).transport });
    const otherView = await connect({ transport: mountFrame(host, { module: NOTES, surface: "view" }).transport });
    const received: unknown[] = [];
    view.onNavigationParams((params) => received.push(["weather", params]));
    otherView.onNavigationParams((params) => received.push(["notes", params]));

    const widget = await connect({ transport: mountFrame(host, { module: WEATHER, surface: "widget" }).transport });
    await widget.openView({ city: "Rabat" });
    await widget.openView();
    await settle();
    assert.deepEqual(received, [["weather", { city: "Rabat" }], ["weather", {}]]);
    assert.equal(opened.length, 2);
  });

  test("a View mounted but not past its handshake receives the latest params in its context", async () => {
    const { host } = recordingHost();
    const viewFrame = mountFrame(host, { module: WEATHER, surface: "view", params: { city: "Paris" } });
    const widget = await connect({ transport: mountFrame(host, { module: WEATHER, surface: "widget" }).transport });
    await widget.openView({ city: "Rabat" });

    const view = await connect({ transport: viewFrame.transport });
    assert.deepEqual(view.context.params, { city: "Rabat" });
    await settle();
    assert.deepEqual(viewFrame.received.map((message: any) => message.type), ["response"]);
  });

  test("a View that was unmounted receives nothing", async () => {
    const { host } = recordingHost();
    const viewFrame = mountFrame(host, { module: WEATHER, surface: "view" });
    await connect({ transport: viewFrame.transport });
    viewFrame.surface.unmount();

    const widget = await connect({ transport: mountFrame(host, { module: WEATHER, surface: "widget" }).transport });
    await widget.openView({ city: "Rabat" });
    host.setTheme({ ...THEME, mode: "light" });
    await settle();
    assert.deepEqual(viewFrame.received.map((message: any) => message.type), ["response"]);
  });

  test("navigation.openView accepts a request without payload", async () => {
    const { host, opened } = recordingHost();
    const frame = mountFrame(host, { module: WEATHER, surface: "widget" });
    await frame.request("ready");
    assert.equal((await frame.request("navigation.openView")).ok, true);
    assert.deepEqual(opened, [{ module: WEATHER, params: {} }]);
  });
});

describe("events", () => {
  test("the SDK ignores events of unknown type and events whose payload it cannot read", async () => {
    const host = newHost();
    const frame = mountFrame(host, { module: WEATHER, surface: "view" });
    const module = await connect({ transport: frame.transport });
    const seen: unknown[] = [];
    module.onThemeChange((theme) => seen.push(theme));
    module.onVisibilityChange((visible) => seen.push(visible));
    module.onNavigationParams((params) => seen.push(params));
    for (const message of [
      { tessello: 1, type: "storage.changed", payload: { key: "cities" } },
      { tessello: 1, type: "visibility" },
      { tessello: 1, type: "visibility", payload: { visible: "no" } },
      { tessello: 1, type: "navigation.params", payload: null },
      { tessello: 1, type: "navigation.params", payload: { params: [] } },
      { tessello: 1, type: "theme.changed", payload: "dark" },
      { tessello: 1, type: "response", id: "unknown", ok: true, result: {} },
    ]) {
      frame.fromHost(message);
    }
    await settle();
    assert.deepEqual(seen, []);

    frame.surface.setVisible(false);
    await settle();
    assert.deepEqual(seen, [false]);
    assert.equal(await module.storage.get("cities"), null);
  });
});

describe("protocol errors", () => {
  const readyFrame = async () => {
    const frame = mountFrame(newHost(), { module: WEATHER, surface: "view" });
    await frame.request("ready");
    return frame;
  };

  const invalidStorageRequests: [string, unknown][] = [
    ["storage.get", undefined],
    ["storage.get", { key: 42 }],
    ["storage.get", { key: "" }],
    ["storage.set", { key: "cities" }],
    ["storage.set", { value: 1 }],
    ["storage.delete", null],
    ["storage.delete", ["cities"]],
    ["storage.keys", "all"],
  ];
  for (const [type, payload] of invalidStorageRequests) {
    test(`${type} with payload ${JSON.stringify(payload)} fails with invalid_payload`, async () => {
      const response = await (await readyFrame()).request(type, payload);
      assert.equal(response.ok, false);
      assert.equal(response.error?.code, "invalid_payload");
    });
  }

  test("ready with a payload that is not an object fails with invalid_payload", async () => {
    const frame = mountFrame(newHost(), { module: WEATHER, surface: "view" });
    assert.equal((await frame.request("ready", "now")).error?.code, "invalid_payload");
    assert.equal((await frame.request("storage.keys")).error?.code, "not_ready");
    assert.equal((await frame.request("ready")).ok, true);
  });

  test("storage.keys accepts a request without payload", async () => {
    const response = await (await readyFrame()).request("storage.keys");
    assert.deepEqual(response.result, { keys: [] });
  });

  for (const type of ["storage.clear", "toString", "constructor", "__proto__"]) {
    test(`the unknown request type "${type}" fails with unknown_type`, async () => {
      const response = await (await readyFrame()).request(type, {});
      assert.equal(response.error?.code, "unknown_type");
    });
  }

  test("reach the SDK as errors carrying their code", async () => {
    const module = await connect({ transport: mountFrame(newHost(), { module: WEATHER, surface: "view" }).transport });
    // @ts-expect-error: the SDK's types already refuse null, the Host refuses it too.
    await assert.rejects(module.storage.set("cities", null), (error: unknown) => {
      assert.ok(error instanceof TesselloError);
      assert.equal(error.code, "invalid_payload");
      assert.match(error.message, /storage\.delete/);
      return true;
    });
  });
});

describe("storage limits", () => {
  const quotaExceeded = (error: unknown) => error instanceof TesselloError && error.code === "quota_exceeded";
  // A string whose serialized form ("…" with its quotes) takes exactly `bytes` bytes.
  const serializedAs = (bytes: number) => "x".repeat(bytes - 2);
  const view = (host = newHost()) => connect({ transport: mountFrame(host, { module: WEATHER, surface: "view" }).transport });

  test("a key longer than the Convention allows", async () => {
    const module = await view();
    const longest = "k".repeat(LIMITS.storageKeyLength);
    await module.storage.set(longest, 1);
    await assert.rejects(module.storage.set(`${longest}k`, 1), quotaExceeded);
    assert.deepEqual(await module.storage.keys(), [longest]);
  });

  test("a value larger than the Convention allows, once serialized", async () => {
    const module = await view();
    await module.storage.set("note", serializedAs(LIMITS.storageValueBytes));
    await assert.rejects(module.storage.set("note", serializedAs(LIMITS.storageValueBytes + 1)), quotaExceeded);
    assert.equal(((await module.storage.get("note")) as string).length, LIMITS.storageValueBytes - 2);
  });

  test("the size of a value counts its UTF-8 bytes", async () => {
    const module = await view();
    const eAcute = "é"; // 2 bytes in UTF-8
    await assert.rejects(module.storage.set("note", eAcute.repeat(LIMITS.storageValueBytes / 2)), quotaExceeded);
  });

  test("a write that would exceed the total storage of the Module", async () => {
    const module = await view();
    const fullValue = serializedAs(LIMITS.storageValueBytes);
    const fullValues = Math.floor(LIMITS.storageTotalBytes / LIMITS.storageValueBytes) - 1;
    for (let i = 0; i < fullValues; i++) await module.storage.set(`page-${i}`, fullValue);

    await assert.rejects(module.storage.set("one-too-many", fullValue), quotaExceeded);
    assert.equal(await module.storage.get("one-too-many"), null);

    // Replacing a value only counts the difference, and deleting frees room.
    await module.storage.set("page-0", fullValue);
    await module.storage.delete("page-0");
    await module.storage.set("one-too-many", fullValue);
  });

  test("concurrent writes from the View and the Widget cannot exceed the total together", async () => {
    const host = newHost(slowPersistence());
    const viewSide = await view(host);
    const widgetSide = await connect({ transport: mountFrame(host, { module: WEATHER, surface: "widget" }).transport });
    const fullValue = serializedAs(LIMITS.storageValueBytes);
    const fullValues = Math.floor(LIMITS.storageTotalBytes / LIMITS.storageValueBytes) - 1;
    for (let i = 0; i < fullValues; i++) await viewSide.storage.set(`page-${i}`, fullValue);

    const half = serializedAs(LIMITS.storageValueBytes * 0.6);
    const results = await Promise.allSettled([viewSide.storage.set("a", half), widgetSide.storage.set("b", half)]);
    assert.deepEqual(results.map((result) => result.status).sort(), ["fulfilled", "rejected"]);
  });
});

describe("message sources", () => {
  test("the Host ignores messages from an iframe it did not create", async () => {
    const host = newHost();
    const frame = mountFrame(host, { module: WEATHER, surface: "view" });
    const stranger = strangerFrame(host);
    stranger.post({ tessello: 1, type: "ready", id: "1", payload: {} });
    stranger.post({ tessello: 1, type: "storage.set", id: "2", payload: { key: "cities", value: ["Nowhere"] } });
    await settle();
    assert.deepEqual(frame.received, []);

    const module = await connect({ transport: frame.transport });
    assert.equal(await module.storage.get("cities"), null);
  });

  test("the Host ignores messages without the protocol envelope", async () => {
    const frame = mountFrame(newHost(), { module: WEATHER, surface: "view" });
    for (const message of [
      "ready",
      null,
      { type: "ready", id: "1" },
      { tessello: 2, type: "ready", id: "2" },
      { tessello: "1", type: "ready", id: "3" },
      { tessello: 1, id: "4" },
      { tessello: 1, type: "ready" },
      { tessello: 1, type: "ready", id: 5 },
    ]) {
      frame.post(message);
    }
    await settle();
    assert.deepEqual(frame.received, []);
  });
});
