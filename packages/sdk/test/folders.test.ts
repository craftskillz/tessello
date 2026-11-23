// Folders the User grants a Module, and the files in them (ADR 0022), through the SDK's `connect()` and the Test Host.

import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { connect, TesselloError } from "../src/index.ts";
import { createTestHost, type TestHostOptions } from "../src/testing.ts";

const view = (options: TestHostOptions = {}) => {
  const host = createTestHost({ permissions: { folders: true }, ...options });
  return { host, module: connect({ transport: host.mount({ surface: "view" }).transport }) };
};

const refusal = (code: string) => (error: unknown) => error instanceof TesselloError && error.code === code;

describe("asking for a folder", () => {
  test("a Module that does not declare the folders Permission is refused", async () => {
    const { module } = view({ permissions: {} });

    await assert.rejects((await module).folders.request(), refusal("not_allowed"));
  });

  test("the folder the User chooses is granted: the Module gets an id and its name, never a path", async () => {
    const { host, module } = view();
    host.folders.choose(host.folders.create("docs", { "a.md": "# A" }));

    const folder = await (await module).folders.request();

    assert.equal(folder?.name, "docs");
    assert.equal(typeof folder?.id, "string");
    assert.ok(!folder?.id.includes("docs"));
  });

  test("the User cancels the picker: nothing is granted", async () => {
    const { host, module } = view();
    host.folders.choose(null);

    assert.equal(await (await module).folders.request(), null);
  });
});

/** A View of a Module the User has already granted a folder holding `files`. */
async function granted(files: Record<string, string | Uint8Array> = {}, options: TestHostOptions = {}) {
  const { host, module } = view(options);
  const disk = host.folders.create("docs", files);
  host.folders.choose(disk);
  const connected = await module;
  const folder = (await connected.folders.request())!;
  return { host, disk, module: connected, folder };
}

describe("reading files", () => {
  test("a file is read as text, with a version", async () => {
    const { module, folder } = await granted({ "guide/intro.md": "# Intro\n" });

    const file = await module.files.read(folder, "guide/intro.md");

    assert.equal(file.content, "# Intro\n");
    assert.equal(typeof file.version, "string");
  });

  test("a missing file is refused with not_found", async () => {
    const { module, folder } = await granted();

    await assert.rejects(module.files.read(folder, "nope.md"), refusal("not_found"));
  });
});

describe("paths stay inside the folder", () => {
  for (const path of ["../secret.md", "guide/../../secret.md", "/etc/hosts", "guide//intro.md", "./intro.md", "guide/", "a\\b.md"]) {
    test(`"${path}" is refused`, async () => {
      const { module, folder } = await granted({ "intro.md": "x" });

      await assert.rejects(module.files.read(folder, path), refusal("invalid_payload"));
    });
  }
});

describe("writing files", () => {
  test("a new file is created, with its folders, and the disk holds it", async () => {
    const { host, disk, module, folder } = await granted();

    await module.files.write(folder, "guide/new.md", "# New\n");

    assert.equal(host.folders.read(disk, "guide/new.md"), "# New\n");
  });

  test("a write returns the new version, the one a read then gives", async () => {
    const { module, folder } = await granted({ "a.md": "one" });

    const { version } = await module.files.write(folder, "a.md", "two");

    assert.equal((await module.files.read(folder, "a.md")).version, version);
  });

  test("a write with the version the Module read succeeds", async () => {
    const { host, disk, module, folder } = await granted({ "a.md": "one" });
    const { version } = await module.files.read(folder, "a.md");

    await module.files.write(folder, "a.md", "two", { ifVersion: version });

    assert.equal(host.folders.read(disk, "a.md"), "two");
  });

  test("a write is refused with conflict when someone else changed the file since the Module read it", async () => {
    const { host, disk, module, folder } = await granted({ "a.md": "one" });
    const { version } = await module.files.read(folder, "a.md");
    host.folders.write(disk, "a.md", "an agent's edit");

    await assert.rejects(module.files.write(folder, "a.md", "two", { ifVersion: version }), refusal("conflict"));
    assert.equal(host.folders.read(disk, "a.md"), "an agent's edit");
  });

  test("ifVersion null creates the file only if there is none, never overwrites", async () => {
    const { host, disk, module, folder } = await granted({ "image.png": "old" });

    await module.files.write(folder, "new.png", "fresh", { ifVersion: null });
    await assert.rejects(module.files.write(folder, "image.png", "new", { ifVersion: null }), refusal("conflict"));

    assert.equal(host.folders.read(disk, "new.png"), "fresh");
    assert.equal(host.folders.read(disk, "image.png"), "old");
  });

  test("a write with a version of a file deleted since is refused with conflict", async () => {
    const { host, disk, module, folder } = await granted({ "a.md": "one" });
    const { version } = await module.files.read(folder, "a.md");
    host.folders.remove(disk, "a.md");

    await assert.rejects(module.files.write(folder, "a.md", "two", { ifVersion: version }), refusal("conflict"));
  });
});

describe("binary files", () => {
  test("bytes are written and read back unchanged", async () => {
    const { module, folder } = await granted();
    const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0, 255]);

    await module.files.write(folder, "images/logo.png", png);
    const file = await module.files.read(folder, "images/logo.png", { as: "bytes" });

    assert.deepEqual(file.content, png);
  });
});

describe("listing a folder", () => {
  test("every file and folder, at any depth, files with their version", async () => {
    const { module, folder } = await granted({ "a.md": "a", "guide/b.md": "b", "guide/deep/c.png": "c" });
    const { version } = await module.files.read(folder, "guide/b.md");

    const entries = await module.files.list(folder);

    assert.deepEqual(
      entries.map((entry) => `${entry.kind} ${entry.path}`).sort(),
      ["file a.md", "file guide/b.md", "file guide/deep/c.png", "folder guide", "folder guide/deep"],
    );
    const b = entries.find((entry) => entry.path === "guide/b.md");
    assert.equal(b?.kind === "file" && b.version, version);
  });

  test("a file carries when it was last modified, a folder does not", async () => {
    const before = Date.now();
    const { module, folder } = await granted({ "guide/b.md": "b" });

    const entries = await module.files.list(folder);

    const file = entries.find((entry) => entry.path === "guide/b.md");
    assert.ok(file?.kind === "file" && file.modified >= before && file.modified <= Date.now());
    const guide = entries.find((entry) => entry.path === "guide")!;
    assert.ok(!("modified" in guide));
  });

  test("a write by the Module moves the modification time forward", async () => {
    const { module, folder } = await granted({ "a.md": "a" });
    const modified = async () => {
      const entry = (await module.files.list(folder)).find((each) => each.path === "a.md");
      return entry?.kind === "file" ? entry.modified : NaN;
    };
    const before = await modified();

    await module.files.write(folder, "a.md", "changed");

    assert.ok((await modified()) > before);
  });

  test("a test sets the modification time of a file exactly", async () => {
    const { host, disk, module, folder } = await granted({ "a.md": "a" });

    host.folders.write(disk, "a.md", "edited", { modified: 1_700_000_000_000 });

    const entry = (await module.files.list(folder)).find((each) => each.path === "a.md");
    assert.equal(entry?.kind === "file" && entry.modified, 1_700_000_000_000);
  });

  test("only what is under a path", async () => {
    const { module, folder } = await granted({ "a.md": "a", "guide/b.md": "b", "guide/deep/c.md": "c" });

    const entries = await module.files.list(folder, "guide/deep");

    assert.deepEqual(entries.map((entry) => entry.path), ["guide/deep/c.md"]);
  });

  test("under a path that does not exist: not_found", async () => {
    const { module, folder } = await granted({ "a.md": "a" });

    await assert.rejects(module.files.list(folder, "nope"), refusal("not_found"));
  });
});

describe("deleting", () => {
  test("a file", async () => {
    const { host, disk, module, folder } = await granted({ "a.md": "a" });

    await module.files.delete(folder, "a.md");

    assert.equal(host.folders.read(disk, "a.md"), null);
  });

  test("a folder, with everything in it", async () => {
    const { module, folder } = await granted({ "keep.md": "k", "old/a.md": "a", "old/deep/b.md": "b" });

    await module.files.delete(folder, "old");

    assert.deepEqual((await module.files.list(folder)).map((entry) => entry.path), ["keep.md"]);
  });

  test("nothing at that path: not_found", async () => {
    const { module, folder } = await granted();

    await assert.rejects(module.files.delete(folder, "nope.md"), refusal("not_found"));
  });
});

describe("moving", () => {
  test("a file, into a folder that did not exist; it keeps its content", async () => {
    const { host, disk, module, folder } = await granted({ "a.md": "# A" });

    await module.files.move(folder, "a.md", "archive/2026/a.md");

    assert.equal(host.folders.read(disk, "a.md"), null);
    assert.equal(host.folders.read(disk, "archive/2026/a.md"), "# A");
  });

  test("a folder, with everything in it", async () => {
    const { host, disk, module, folder } = await granted({ "todo/a.md": "a", "todo/deep/b.png": "b" });

    await module.files.move(folder, "todo", "done");

    assert.deepEqual((await module.files.list(folder)).map((entry) => `${entry.kind} ${entry.path}`).sort(), [
      "file done/a.md",
      "file done/deep/b.png",
      "folder done",
      "folder done/deep",
    ]);
    assert.equal(host.folders.read(disk, "done/deep/b.png"), "b");
  });

  test("onto something that exists: conflict, and nothing moves", async () => {
    const { host, disk, module, folder } = await granted({ "a.md": "a", "b.md": "b", "x/c.md": "c", "y/d.md": "d" });

    await assert.rejects(module.files.move(folder, "a.md", "b.md"), refusal("conflict"));
    await assert.rejects(module.files.move(folder, "x", "y"), refusal("conflict"));

    assert.equal(host.folders.read(disk, "a.md"), "a");
    assert.equal(host.folders.read(disk, "x/c.md"), "c");
  });

  test("a folder into itself is refused", async () => {
    const { module, folder } = await granted({ "x/c.md": "c" });

    await assert.rejects(module.files.move(folder, "x", "x/inner"), refusal("invalid_payload"));
  });

  test("nothing at the source: not_found", async () => {
    const { module, folder } = await granted();

    await assert.rejects(module.files.move(folder, "nope.md", "b.md"), refusal("not_found"));
  });
});

describe("the granted folders", () => {
  test("choosing a folder already granted gives the same id", async () => {
    const { host, disk, module, folder } = await granted();
    host.folders.choose(disk);

    assert.deepEqual(await module.folders.request(), folder);
  });

  test("are listed, granted, and kept for the next visit", async () => {
    const { host, folder } = await granted();
    const next = await connect({ transport: host.mount({ surface: "view" }).transport });

    assert.deepEqual(await next.folders.list(), [{ ...folder, state: "granted" }]);
  });

  test("a released folder is no longer granted", async () => {
    const { module, folder } = await granted({ "a.md": "a" });

    await module.folders.release(folder);

    assert.deepEqual(await module.folders.list(), []);
    await assert.rejects(module.files.read(folder, "a.md"), refusal("not_found"));
  });
});

describe("a folder that must contain a granted one", () => {
  test("a folder holding the granted folder is accepted", async () => {
    const { host, module, folder } = await contained();
    host.folders.choose(host.repository);

    const repository = await module.folders.request({ mustContain: folder });

    assert.equal(repository?.name, "project");
    assert.equal((await module.files.read(repository!, "docs/a.md")).content, "a");
  });

  test("a folder that does not hold it is refused with not_containing, and not granted", async () => {
    const { host, module, folder } = await contained();
    host.folders.choose(host.folders.create("elsewhere"));

    await assert.rejects(module.folders.request({ mustContain: folder }), refusal("not_containing"));
    assert.deepEqual((await module.folders.list()).map((each) => each.name), ["docs"]);
  });

  test("the granted folder itself is accepted", async () => {
    const { host, module, folder } = await contained();
    host.folders.choose(host.docs);

    assert.deepEqual(await module.folders.request({ mustContain: folder }), folder);
  });
});

/** A Module granted `project/docs`, the User's repository being `project`. */
async function contained() {
  const { host, module } = view();
  const repository = host.folders.create("project", { "docs/a.md": "a", "src/main.ts": "" });
  const docs = host.folders.inside(repository, "docs");
  host.folders.choose(docs);
  const connected = await module;
  const folder = (await connected.folders.request())!;
  return { host: Object.assign(host, { repository, docs }), module: connected, folder };
}

describe("after the browser restarts", () => {
  test("a granted folder waits for the User: listed as prompt, its files refused with unavailable", async () => {
    const { host, module, folder } = await granted({ "a.md": "a" });

    host.folders.restart();

    assert.deepEqual(await module.folders.list(), [{ ...folder, state: "prompt" }]);
    await assert.rejects(module.files.read(folder, "a.md"), refusal("unavailable"));
  });

  test("reconnecting, from the User's click, grants it again", async () => {
    const { host, module, folder } = await granted({ "a.md": "a" });
    host.folders.restart();

    assert.equal(await module.folders.reconnect(folder), "granted");
    assert.equal((await module.files.read(folder, "a.md")).content, "a");
  });

  test("the User may refuse", async () => {
    const { host, module, folder } = await granted({ "a.md": "a" });
    host.folders.restart();
    host.folders.refuseReconnect();

    assert.equal(await module.folders.reconnect(folder), "prompt");
    await assert.rejects(module.files.read(folder, "a.md"), refusal("unavailable"));
  });
});
