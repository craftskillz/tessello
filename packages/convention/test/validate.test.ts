import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { strToU8, zipSync } from "fflate";
import { LIMITS, validatePackage, validateZip, type ValidationReport } from "../src/index.ts";

const READY_VIEW = `<!doctype html><script>parent.postMessage({ tessello: 1, type: "ready", id: "1" }, "*")</script>`;

function manifest(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    convention: 1,
    id: "@yassine/weather",
    name: "Weather",
    version: "1.0.0",
    icon: "icon.svg",
    view: { entry: "view/index.html" },
    ...overrides,
  };
}

function pkg(files: Record<string, string | Uint8Array | object>): Map<string, Uint8Array> {
  return new Map(
    Object.entries(files).map(([path, content]) => [
      path,
      content instanceof Uint8Array ? content : strToU8(typeof content === "string" ? content : JSON.stringify(content)),
    ]),
  );
}

function validModule(manifestOverrides: Record<string, unknown> = {}, extraFiles: Record<string, string | Uint8Array> = {}) {
  return pkg({
    "manifest.json": manifest(manifestOverrides),
    "icon.svg": "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 1 1'/>",
    "view/index.html": READY_VIEW,
    ...extraFiles,
  });
}

/** Minimal PNG: signature + IHDR header (CRC is not checked by the Validator). */
function png(width: number, height: number): Uint8Array {
  const bytes = new Uint8Array(33);
  bytes.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13, 0x49, 0x48, 0x44, 0x52]);
  const view = new DataView(bytes.buffer);
  view.setUint32(16, width);
  view.setUint32(20, height);
  return bytes;
}

const codes = (report: ValidationReport, severity: "error" | "warning" = "error") =>
  report.issues.filter((issue) => issue.severity === severity).map((issue) => issue.code);

describe("a valid Module", () => {
  test("has no issue and exposes its Manifest", () => {
    const report = validatePackage(validModule());
    assert.deepEqual(report.issues, []);
    assert.equal(report.valid, true);
    assert.equal(report.manifest?.id, "@yassine/weather");
  });

  test("may declare a Widget, a description and a pre-release version", () => {
    const report = validatePackage(
      validModule(
        { widget: { entry: "widget/index.html", size: "M" }, description: "Forecast", version: "2.1.0-beta.1" },
        { "widget/index.html": READY_VIEW },
      ),
    );
    assert.deepEqual(report.issues, []);
  });

  test("may use a square PNG icon of at least 256 px", () => {
    const report = validatePackage(validModule({ icon: "icon.png" }, { "icon.png": png(512, 512) }));
    assert.deepEqual(codes(report), []);
  });
});

describe("Manifest errors", () => {
  test("missing manifest.json", () => {
    const report = validatePackage(pkg({ "view/index.html": READY_VIEW }));
    assert.deepEqual(codes(report), ["manifest/missing"]);
    assert.equal(report.valid, false);
    assert.equal(report.manifest, null);
  });

  test("manifest.json in a nested folder gets a hint", () => {
    const report = validatePackage(pkg({ "weather/manifest.json": manifest() }));
    assert.match(report.issues[0]!.message, /found in "weather\/"/);
  });

  test("invalid JSON", () => {
    assert.deepEqual(codes(validatePackage(pkg({ "manifest.json": "{ nope" }))), ["manifest/invalid-json"]);
  });

  test("JSON that is not an object", () => {
    assert.deepEqual(codes(validatePackage(pkg({ "manifest.json": "[]" }))), ["manifest/invalid-json"]);
  });

  for (const field of ["convention", "id", "name", "version", "icon", "view"]) {
    test(`missing required field "${field}"`, () => {
      const files = validModule();
      const m = manifest();
      delete m[field];
      files.set("manifest.json", strToU8(JSON.stringify(m)));
      const report = validatePackage(files);
      assert.ok(codes(report).includes("manifest/field-required"), JSON.stringify(report.issues));
    });
  }

  test("unsupported convention version", () => {
    assert.deepEqual(codes(validatePackage(validModule({ convention: 2 }))), ["manifest/unsupported-convention"]);
  });

  test("non-integer convention", () => {
    assert.deepEqual(codes(validatePackage(validModule({ convention: "1" }))), ["manifest/invalid-convention"]);
  });

  for (const id of ["weather", "@Yassine/weather", "@yassine/", "@-x/weather", `@${"a".repeat(40)}/weather`]) {
    test(`invalid id ${JSON.stringify(id)}`, () => {
      assert.deepEqual(codes(validatePackage(validModule({ id }))), ["manifest/invalid-id"]);
    });
  }

  test("wrong type for a string field", () => {
    assert.deepEqual(codes(validatePackage(validModule({ name: 42 }))), ["manifest/invalid-type"]);
  });

  test("name too long", () => {
    assert.deepEqual(codes(validatePackage(validModule({ name: "x".repeat(41) }))), ["manifest/invalid-name"]);
  });

  for (const version of ["1.0", "v1.0.0", "01.0.0", "1.0.0+build"]) {
    test(`invalid version ${JSON.stringify(version)}`, () => {
      assert.deepEqual(codes(validatePackage(validModule({ version }))), ["manifest/invalid-version"]);
    });
  }

  test("description too long", () => {
    assert.deepEqual(codes(validatePackage(validModule({ description: "x".repeat(201) }))), ["manifest/invalid-description"]);
  });

  test("view that is not an object", () => {
    assert.deepEqual(codes(validatePackage(validModule({ view: "view/index.html" }))), ["manifest/invalid-type"]);
  });

  test("entry that is not an HTML page", () => {
    const report = validatePackage(validModule({ view: { entry: "view/app.js" } }, { "view/app.js": "connect()" }));
    assert.deepEqual(codes(report), ["manifest/entry-not-html"]);
  });

  test("widget without size, and widget with an invalid size", () => {
    const files = { "widget/index.html": READY_VIEW };
    assert.deepEqual(codes(validatePackage(validModule({ widget: { entry: "widget/index.html" } }, files))), [
      "manifest/field-required",
    ]);
    const report = validatePackage(validModule({ widget: { entry: "widget/index.html", size: "big" } }, files));
    assert.deepEqual(codes(report), ["manifest/invalid-widget-size"]);
    assert.match(report.issues[0]!.message, /"big"; expected "S", "M" or "L"/);
  });

  test("several errors are all reported", () => {
    const report = validatePackage(validModule({ id: "nope", version: "1", widget: { entry: "w.html", size: "XL" } }));
    assert.deepEqual(codes(report).sort(), [
      "manifest/file-not-found",
      "manifest/invalid-id",
      "manifest/invalid-version",
      "manifest/invalid-widget-size",
    ]);
  });
});

describe("paths", () => {
  test("Manifest path to a missing file", () => {
    assert.deepEqual(codes(validatePackage(validModule({ icon: "missing.svg" }))), ["manifest/file-not-found"]);
  });

  for (const entry of ["/view/index.html", "../view/index.html", "view/../../x.html"]) {
    test(`unsafe Manifest path ${JSON.stringify(entry)}`, () => {
      assert.deepEqual(codes(validatePackage(validModule({ view: { entry } }))), ["manifest/unsafe-path"]);
    });
  }

  test("unsafe path inside the package", () => {
    assert.deepEqual(codes(validatePackage(validModule({}, { "../evil.js": "" }))), ["package/unsafe-path"]);
  });
});

describe("icon", () => {
  test("unsupported format", () => {
    assert.deepEqual(codes(validatePackage(validModule({ icon: "icon.jpg" }, { "icon.jpg": "x" }))), ["icon/invalid-format"]);
  });

  test("PNG that is not square", () => {
    assert.deepEqual(codes(validatePackage(validModule({ icon: "icon.png" }, { "icon.png": png(512, 256) }))), ["icon/not-square"]);
  });

  test("PNG that is too small", () => {
    assert.deepEqual(codes(validatePackage(validModule({ icon: "icon.png" }, { "icon.png": png(128, 128) }))), ["icon/too-small"]);
  });

  test("file named .png that is not a PNG", () => {
    assert.deepEqual(codes(validatePackage(validModule({ icon: "icon.png" }, { "icon.png": "not a png" }))), ["icon/invalid-png"]);
  });
});

describe("package size", () => {
  test("package over the limit", () => {
    const report = validatePackage(validModule({}, { "big.bin": new Uint8Array(LIMITS.packageBytes) }));
    assert.deepEqual(codes(report), ["package/too-large"]);
  });
});

describe("warnings (the Module stays installable)", () => {
  test("unknown Manifest field", () => {
    const report = validatePackage(validModule({ homepage: "https://example.com" }));
    assert.equal(report.valid, true);
    assert.deepEqual(codes(report, "warning"), ["manifest/unknown-field"]);
  });

  test("absolute local path in an entry page, but not protocol-relative or remote URLs", () => {
    const view = `${READY_VIEW}<script src="/app.js"></script><img src="//cdn.example.com/a.png"><a href="https://example.com">x</a>`;
    const report = validatePackage(validModule({}, { "view/index.html": view }));
    assert.deepEqual(codes(report, "warning"), ["source/absolute-path"]);
  });

  test("APIs unavailable in the sandbox", () => {
    const script = `localStorage.setItem("a", "1"); if (confirm("sure?")) {} window.top.location = "x";`;
    const report = validatePackage(validModule({}, { "view/app.js": script }));
    assert.equal(report.valid, true);
    assert.equal(codes(report, "warning").filter((code) => code === "sandbox/unavailable-api").length, 3);
  });

  test("embedding a frame, even from a declared origin", () => {
    const view = `${READY_VIEW}<iframe src="https://maps.example.com/embed"></iframe>`;
    const report = validatePackage(validModule({ permissions: { network: ["https://maps.example.com"] } }, { "view/index.html": view }));
    assert.equal(report.valid, true);
    assert.deepEqual(codes(report, "warning"), ["sandbox/unavailable-api"]);
  });

  test("method calls named like dialogs are not flagged", () => {
    const report = validatePackage(validModule({}, { "view/app.js": `llm.prompt("hi"); ui.alert(); myconfirm();` }));
    assert.deepEqual(codes(report, "warning"), []);
  });

  test("no source sends ready", () => {
    const report = validatePackage(validModule({}, { "view/index.html": "<!doctype html><p>hi</p>" }));
    assert.deepEqual(codes(report, "warning"), ["lifecycle/no-ready"]);
  });

  test("importing the SDK counts as sending ready", () => {
    const view = `<script type="module">import { connect } from "@tessello/sdk"; connect();</script>`;
    assert.deepEqual(codes(validatePackage(validModule({}, { "view/index.html": view })), "warning"), []);
  });
});

describe("validateZip", () => {
  const zip = (files: Record<string, string | Uint8Array>) =>
    zipSync(Object.fromEntries(Object.entries(files).map(([p, c]) => [p, typeof c === "string" ? strToU8(c) : c])));

  test("valid archive, ignoring macOS metadata", () => {
    const report = validateZip(
      zip({
        "manifest.json": JSON.stringify(manifest()),
        "icon.svg": "<svg/>",
        "view/index.html": READY_VIEW,
        "__MACOSX/._manifest.json": "junk",
        ".DS_Store": "junk",
      }),
    );
    assert.deepEqual(report.issues, []);
  });

  test("not a zip", () => {
    assert.deepEqual(codes(validateZip(strToU8("hello"))), ["package/invalid-zip"]);
  });

  test("archive over the size limit is rejected", () => {
    const report = validateZip(zip({ "manifest.json": "{}", "big.bin": new Uint8Array(LIMITS.packageBytes + 1) }));
    assert.deepEqual(codes(report), ["package/too-large"]);
  });
});
