// The Test Host (`@tessello/sdk/testing`) as a Creator's tests use it, through the SDK's own `connect()`.

import assert from "node:assert/strict";
import { afterEach, describe, test } from "node:test";
import { connect } from "../src/index.ts";
import { cpuSlowdown, createTestHost, setWaitTimeout, until } from "../src/testing.ts";

describe("the context", () => {
  test("a View gets the Module, the language, the theme and its params the test chose", async () => {
    const host = createTestHost({ module: { id: "@me/notes", version: "1.2.0" }, locale: "fr-FR", theme: "dark" });

    const view = await connect({ transport: host.mount({ surface: "view", params: { note: "new" } }).transport });

    assert.equal(view.context.surface, "view");
    assert.deepEqual(view.context.module, { id: "@me/notes", version: "1.2.0" });
    assert.equal(view.context.locale, "fr-FR");
    assert.equal(view.context.theme.mode, "dark");
    assert.equal(view.context.theme.colors.background, "#14161a");
    assert.deepEqual(view.context.params, { note: "new" });
  });

  test("by default, a Widget of a test Module, in English and the light theme", async () => {
    const host = createTestHost();

    const widget = await connect({ transport: host.mount({ surface: "widget" }).transport });

    assert.equal(widget.context.surface, "widget");
    assert.equal(widget.context.locale, "en-US");
    assert.equal(widget.context.theme.mode, "light");
    assert.equal(widget.context.theme.colors.background, "#fafaf7");
    assert.equal(widget.context.params, undefined);
  });
});

describe("the storage", () => {
  test("starts with what the test put in it, and the View and the Widget share it", async () => {
    const host = createTestHost({ storage: { notes: [{ text: "milk" }] } });
    const view = await connect({ transport: host.mount({ surface: "view" }).transport });
    const widget = await connect({ transport: host.mount({ surface: "widget" }).transport });

    assert.deepEqual(await widget.storage.get("notes"), [{ text: "milk" }]);
    await view.storage.set("notes", [{ text: "bread" }]);
    assert.deepEqual(await widget.storage.get("notes"), [{ text: "bread" }]);
  });

  test("the test reads what the Module wrote, and changes it as another surface would", async () => {
    const host = createTestHost();
    const view = await connect({ transport: host.mount({ surface: "view" }).transport });

    await view.storage.set("count", 2);
    assert.equal(await host.storage.get("count"), 2);
    assert.equal(await host.storage.get("missing"), null);

    await host.storage.set("count", 3);
    assert.equal(await view.storage.get("count"), 3);
    await host.storage.delete("count");
    assert.deepEqual(await view.storage.keys(), []);
  });

  test("refuses what the Host refuses, with its error code", async () => {
    const host = createTestHost();
    const view = await connect({ transport: host.mount({ surface: "view" }).transport });

    await assert.rejects(view.storage.set("big", "x".repeat(1024 * 1024)), { name: "TesselloError", code: "quota_exceeded" });
    await assert.rejects(view.storage.set("", 1), { code: "invalid_payload" });
  });
});

describe("a refused write", () => {
  test("is refused as a full storage until the test stops it, and nothing is written", async () => {
    const host = createTestHost();
    const view = await connect({ transport: host.mount({ surface: "view" }).transport });

    const stop = host.refuseWrites();
    await assert.rejects(view.storage.set("notes", ["milk"]), { name: "TesselloError", code: "quota_exceeded" });
    await assert.rejects(view.storage.delete("notes"), { code: "quota_exceeded" });
    assert.equal(await host.storage.get("notes"), null);
    assert.equal(await view.storage.get("notes"), null);

    stop();
    await view.storage.set("notes", ["milk"]);
    assert.deepEqual(await host.storage.get("notes"), ["milk"]);
  });

  test("comes after the Host's own checks: a write before the handshake is still not_ready", async () => {
    const host = createTestHost();
    const { transport } = host.mount({ surface: "view" });
    host.refuseWrites();

    const response = new Promise((resolve) => transport.subscribe(resolve));
    transport.send({ tessello: 1, type: "storage.set", id: "early", payload: { key: "notes", value: 1 } });

    assert.deepEqual(await response, {
      tessello: 1,
      type: "response",
      id: "early",
      ok: false,
      error: { code: "not_ready", message: 'Send "ready" before "storage.set".' },
    });
  });

  test("can be another failure, and only for one key", async () => {
    const host = createTestHost();
    const view = await connect({ transport: host.mount({ surface: "view" }).transport });

    host.refuseWrites({ key: "images", code: "internal", message: "The disk is gone." });
    await assert.rejects(view.storage.set("images", 1), { code: "internal", message: "The disk is gone." });
    await view.storage.set("notes", 1);
    assert.equal(await host.storage.get("notes"), 1);
  });
});

/** Resolves with the next value a `listener`-taking SDK method gives. */
const next = <T>(on: (listener: (value: T) => void) => () => void) =>
  new Promise<T>((resolve) => {
    const stop = on((value) => {
      stop();
      resolve(value);
    });
  });

describe("theme and visibility", () => {
  test("the test changes the theme of every surface", async () => {
    const host = createTestHost();
    const view = await connect({ transport: host.mount({ surface: "view" }).transport });
    const widget = await connect({ transport: host.mount({ surface: "widget" }).transport });

    const themes = Promise.all([next(view.onThemeChange), next(widget.onThemeChange)]);
    host.setTheme("dark");

    assert.deepEqual((await themes).map((theme) => theme.colors.background), ["#14161a", "#14161a"]);
  });

  test("the test hides a surface and shows it again", async () => {
    const host = createTestHost();
    const surface = host.mount({ surface: "widget" });
    const widget = await connect({ transport: surface.transport });

    const hidden = next(widget.onVisibilityChange);
    surface.setVisible(false);
    assert.equal(await hidden, false);
    const shown = next(widget.onVisibilityChange);
    surface.setVisible(true);
    assert.equal(await shown, true);
  });
});

describe("navigation", () => {
  test("the test sees each time the Widget opens the View, with its params", async () => {
    const host = createTestHost();
    const widget = await connect({ transport: host.mount({ surface: "widget" }).transport });

    await widget.openView();
    await widget.openView({ filter: "urgent" });

    assert.deepEqual(host.openedViews, [{}, { filter: "urgent" }]);
  });

  test("the View already loaded gets the params the Widget opens it with", async () => {
    const host = createTestHost();
    const view = await connect({ transport: host.mount({ surface: "view" }).transport });
    const widget = await connect({ transport: host.mount({ surface: "widget" }).transport });

    const params = next(view.onNavigationParams);
    await widget.openView({ id: "d1" });

    assert.deepEqual(await params, { id: "d1" });
  });

  test("the test opens the View already loaded with params, as its Widget would", async () => {
    const host = createTestHost();
    const view = await connect({ transport: host.mount({ surface: "view" }).transport });

    const params = next(view.onNavigationParams);
    host.openView({ new: "1" });

    assert.deepEqual(await params, { new: "1" });
    assert.deepEqual(host.openedViews, []);
  });
});

describe("waiting", () => {
  afterEach(() => {
    setWaitTimeout(5_000);
    delete process.env.E2E_CPU_SLOWDOWN;
  });

  test("until() reads again until a value comes, even after a read that throws", async () => {
    const host = createTestHost();
    const view = await connect({ transport: host.mount({ surface: "view" }).transport });
    let reads = 0;

    setTimeout(() => void view.storage.set("notes", ["milk"]), 50);
    const notes = await until(async () => {
      reads++;
      if (reads === 1) throw new Error("not there yet");
      return host.storage.get("notes");
    });

    assert.deepEqual(notes, ["milk"]);
    assert.ok(reads > 2);
  });

  test("until() gives up at the deadline, with what it waited for and the last error", async () => {
    setWaitTimeout(100);
    const started = Date.now();

    await assert.rejects(
      until(() => {
        throw new Error("no such element");
      }, "the note is shown"),
      /Waited 100 ms for the note is shown: no such element/,
    );
    assert.ok(Date.now() - started >= 100);
  });

  test("the deadline grows with E2E_CPU_SLOWDOWN, which must be 1 or more", async () => {
    setWaitTimeout(50);
    process.env.E2E_CPU_SLOWDOWN = "4";
    assert.equal(cpuSlowdown(), 4);
    const started = Date.now();
    await assert.rejects(until(() => false), /200 ms/);
    assert.ok(Date.now() - started >= 200);

    process.env.E2E_CPU_SLOWDOWN = "fast";
    assert.throws(() => cpuSlowdown(), /E2E_CPU_SLOWDOWN.*1 or more.*"fast"/);
  });
});
