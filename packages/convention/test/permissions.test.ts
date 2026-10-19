import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { strToU8 } from "fflate";
import { isCovered, validatePackage, type ValidationReport } from "../src/index.ts";

const READY = `<script>parent.postMessage({ tessello: 1, type: "ready", id: "1" }, "*")</script>`;

function moduleWith(permissions: unknown, viewSource = READY) {
  const manifest = {
    convention: 1,
    id: "@yassine/observability",
    name: "Observability",
    version: "1.0.0",
    icon: "icon.svg",
    view: { entry: "view/index.html" },
    guide: "guide.md",
    ...(permissions === undefined ? {} : { permissions }),
  };
  return validatePackage(
    new Map([
      ["manifest.json", strToU8(JSON.stringify(manifest))],
      ["icon.svg", strToU8("<svg/>")],
      ["view/index.html", strToU8(viewSource)],
      ["guide.md", strToU8("# Observability")],
    ]),
  );
}

const codes = (report: ValidationReport, severity: "error" | "warning" = "error") =>
  report.issues.filter((issue) => issue.severity === severity).map((issue) => issue.code);

describe("declaring Permissions", () => {
  test("valid network and localNetwork entries", () => {
    const report = moduleWith({
      network: ["https://api.datadoghq.com", "https://*.grafana.net", "wss://stream.example.com", "https://api.example.com:8443"],
      localNetwork: ["http://localhost:9090", "http://127.0.0.1", "http://192.168.1.20:3000", "ws://[::1]:8080", "http://nas.local"],
    });
    assert.deepEqual(report.issues, []);
    assert.deepEqual(report.manifest?.permissions?.localNetwork?.[0], "http://localhost:9090");
  });

  test("an empty permissions object is valid", () => {
    assert.deepEqual(moduleWith({}).issues, []);
  });

  test("unknown Permission", () => {
    assert.deepEqual(codes(moduleWith({ commands: ["kubectl get pods"] })), ["permissions/unknown"]);
  });

  test("permissions that is not an object, or a Permission that is not an array of strings", () => {
    assert.deepEqual(codes(moduleWith(["https://x.com"])), ["permissions/invalid"]);
    assert.deepEqual(codes(moduleWith({ network: "https://x.com" })), ["permissions/invalid"]);
    assert.deepEqual(codes(moduleWith({ network: [42] })), ["permissions/invalid"]);
  });

  const invalidNetwork = [
    "http://api.example.com", // not https
    "https://api.example.com/", // trailing slash
    "https://api.example.com/v1", // path
    "api.example.com", // no scheme
    "https://*", // bare wildcard
    "https://api.*.com", // wildcard not leftmost
    "https://localhost:9090", // local address in network
    "https://192.168.1.2", // private address in network
    "https://api.example.com:70000", // invalid port
  ];
  for (const entry of invalidNetwork) {
    test(`invalid network entry ${JSON.stringify(entry)}`, () => {
      assert.deepEqual(codes(moduleWith({ network: [entry] })), ["permissions/invalid"]);
    });
  }

  for (const entry of ["https://api.example.com", "http://*.local", "http://8.8.8.8", "http://172.32.0.1"]) {
    test(`invalid localNetwork entry ${JSON.stringify(entry)}`, () => {
      assert.deepEqual(codes(moduleWith({ localNetwork: [entry] })), ["permissions/invalid"]);
    });
  }

  test("the error message tells where a local address belongs", () => {
    const report = moduleWith({ network: ["https://localhost:9090"] });
    assert.match(report.issues[0]!.message, /declare it in "localNetwork"/);
  });
});

describe("undeclared origins (warning)", () => {
  test("fetch to an undeclared origin", () => {
    const report = moduleWith({}, `${READY}<script>fetch("https://api.datadoghq.com/api/v1/query")</script>`);
    assert.equal(report.valid, true);
    assert.deepEqual(codes(report, "warning"), ["permissions/undeclared-origin"]);
    assert.match(report.issues[0]!.message, /https:\/\/api\.datadoghq\.com/);
  });

  test("remote script, stylesheet and WebSocket without Permissions", () => {
    const view = `${READY}
      <script src="https://cdn.example.com/lib.js"></script>
      <link rel="stylesheet" href="https://fonts.example.com/a.css">
      <script>new WebSocket("wss://stream.example.com/live")</script>`;
    assert.equal(codes(moduleWith(undefined, view), "warning").length, 3);
  });

  test("declared origins, wildcards and the https/wss family are covered", () => {
    const view = `${READY}
      <script src="https://cdn.example.com/lib.js"></script>
      <script>fetch("https://eu.grafana.net/api"); new WebSocket("wss://cdn.example.com/ws"); fetch("http://localhost:9090/api/v1/query")</script>`;
    const report = moduleWith({ network: ["https://cdn.example.com", "https://*.grafana.net"], localNetwork: ["http://localhost:9090"] }, view);
    assert.deepEqual(report.issues, []);
  });

  test("plain links and template-literal URLs are not reported", () => {
    const view = `${READY}<a href="https://docs.example.com" target="_blank">docs</a><script>fetch(\`https://\${host}/api\`)</script>`;
    assert.deepEqual(codes(moduleWith({}, view), "warning"), []);
  });

  test("the same origin is reported once per file", () => {
    const view = `${READY}<script>fetch("https://a.example.com/1"); fetch("https://a.example.com/2")</script>`;
    assert.equal(codes(moduleWith({}, view), "warning").length, 1);
  });
});

describe("isCovered", () => {
  test("a port must match, default ports included", () => {
    assert.equal(isCovered("https://api.example.com/x", ["https://api.example.com"]), true);
    assert.equal(isCovered("https://api.example.com:443/x", ["https://api.example.com"]), true);
    assert.equal(isCovered("https://api.example.com:8443/x", ["https://api.example.com"]), false);
  });

  test("a wildcard matches subdomains only", () => {
    assert.equal(isCovered("https://a.b.grafana.net", ["https://*.grafana.net"]), true);
    assert.equal(isCovered("https://grafana.net", ["https://*.grafana.net"]), false);
    assert.equal(isCovered("https://evilgrafana.net", ["https://*.grafana.net"]), false);
  });

  test("https does not cover http", () => {
    assert.equal(isCovered("http://api.example.com", ["https://api.example.com"]), false);
  });
});
