import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { LIMITS } from "@tessello/convention";
import { connect, TesselloError } from "@tessello/sdk";
import { createHost, createMemoryPersistence, type Persistence, type Theme } from "../src/index.ts";
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

const newHost = (persistence = createMemoryPersistence()) => createHost({ persistence, locale: "fr-FR", theme: THEME });

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

  test("storage.keys accepts a request without payload", async () => {
    const response = await (await readyFrame()).request("storage.keys");
    assert.deepEqual(response.result, { keys: [] });
  });

  test("an unknown request type fails with unknown_type", async () => {
    const response = await (await readyFrame()).request("storage.clear", {});
    assert.equal(response.error?.code, "unknown_type");
  });

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
