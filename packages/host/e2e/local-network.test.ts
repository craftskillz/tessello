import assert from "node:assert/strict";
import { createServer } from "node:http";
import { after, before, describe, test } from "node:test";
import type { Page } from "playwright";
import { dropFile, showLauncher, useHost, zip, zipExample } from "./browser.ts";

const host = useHost();
// The Host as it is once deployed: a public site, to which Chrome applies Local Network Access.
const publicHost = useHost({ public: true });

/** Answers in place of a Prometheus on localhost:9090: two targets up, one down, and one firing alert. */
async function fakePrometheus(page: Page) {
  const data: Record<string, unknown> = {
    "/api/v1/status/buildinfo": { version: "3.15.0" },
    "/api/v1/targets": {
      activeTargets: [
        { labels: { job: "prometheus", instance: "localhost:9090" }, health: "up", lastError: "" },
        { labels: { job: "node", instance: "localhost:9100" }, health: "up", lastError: "" },
        { labels: { job: "api", instance: "localhost:8000" }, health: "down", lastError: "connection refused" },
      ],
    },
    "/api/v1/alerts": { alerts: [{ labels: { alertname: "ApiDown" }, state: "firing" }, { labels: { alertname: "Slow" }, state: "pending" }] },
  };
  await page.route("http://localhost:9090/**", (route) =>
    route.fulfill({
      headers: { "Access-Control-Allow-Origin": "null" },
      contentType: "application/json",
      body: JSON.stringify({ status: "success", data: data[new URL(route.request().url()).pathname] }),
    }),
  );
}

async function install(page: Page) {
  await dropFile(page, "prometheus.zip", await zipExample("prometheus"));
  await page.getByRole("dialog", { name: "Install Local Prometheus?" }).getByRole("button", { name: "Accept and install" }).click();
}

describe("the Local Prometheus Module", () => {
  test("the consent screen highlights its access to the local network", async () => {
    const page = await host.newPage();
    await dropFile(page, "prometheus.zip", await zipExample("prometheus"));
    const permissions = page.getByRole("dialog", { name: "Install Local Prometheus?" }).getByRole("region", { name: "What Local Prometheus can do" });
    assert.match(await permissions.locator(".sensitive").innerText(), /Local network[\s\S]*localhost:9090/);
  });

  test("shows the state of the local Prometheus in its View and its Widget, which opens the View", async () => {
    const page = await host.newPage();
    await fakePrometheus(page);
    await install(page);
    const view = page.frameLocator("iframe[title='Local Prometheus']");
    await view.getByText("Prometheus 3.15.0 · 2 of 3 targets up").waitFor();
    assert.match(await view.getByRole("list").first().innerText(), /Down\s+api · localhost:8000\s+connection refused/);
    await view.getByRole("listitem").filter({ hasText: "ApiDown" }).waitFor();
    assert.equal(await view.getByText("Slow").count(), 0, "a pending alert is not firing");

    await (await showLauncher(page)).getByRole("button", { name: "Tessello" }).click();
    const widget = page.frameLocator("iframe[title='Local Prometheus widget']");
    await widget.getByText("2/3 up").waitFor();
    await widget.getByText("1 alert firing").waitFor();
    await widget.getByRole("button", { name: "Open Local Prometheus" }).click();
    await view.getByText("Prometheus 3.15.0 · 2 of 3 targets up").waitFor();
  });

  test("explains what to check when Prometheus can't be reached, and asks again on Retry", async () => {
    const page = await host.newPage();
    await page.route("http://localhost:9090/**", (route) => route.abort("connectionrefused"));
    await install(page);
    const view = page.frameLocator("iframe[title='Local Prometheus']");
    const alert = view.getByRole("alert");
    await alert.getByRole("heading", { name: "Prometheus can't be reached" }).waitFor();
    assert.match(await alert.innerText(), /runs on this computer and answers at http:\/\/localhost:9090/);
    assert.match(await alert.innerText(), /--web\.cors\.origin/);

    await page.unroute("http://localhost:9090/**");
    await fakePrometheus(page);
    await view.getByRole("button", { name: "Retry" }).click();
    await view.getByText("Prometheus 3.15.0 · 2 of 3 targets up").waitFor();
  });

  test("shows the error Prometheus answers", async () => {
    const page = await host.newPage();
    await page.route("http://localhost:9090/**", (route) =>
      route.fulfill({
        status: 503,
        headers: { "Access-Control-Allow-Origin": "null" },
        contentType: "application/json",
        body: JSON.stringify({ status: "error", errorType: "unavailable", error: "TSDB not ready" }),
      }),
    );
    await install(page);
    const alert = page.frameLocator("iframe[title='Local Prometheus']").getByRole("alert");
    await alert.getByRole("heading", { name: "Prometheus answered with an error" }).waitFor();
    await alert.getByText("TSDB not ready").waitFor();
  });
});

/** A Module whose View shows what the browser answers when it asks about the local network. */
function probe(name: string, permissions: object) {
  return zip({
    "manifest.json": { convention: 1, id: `@test/${name.toLowerCase()}`, name, version: "1.0.0", icon: "icon.svg", guide: "guide.md", view: { entry: "index.html" }, permissions },
    "icon.svg": "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 1 1'/>",
    "guide.md": "# Guide",
    "index.html": `<!doctype html><pre id="result"></pre><script type="module">
      const state = async (name) => (await navigator.permissions.query({ name })).state;
      document.getElementById("result").textContent = JSON.stringify({ loopback: await state("loopback-network"), local: await state("local-network"), legacy: await state("local-network-access") });
      parent.postMessage({ tessello: 1, type: "ready", id: "ready" }, "*");
    </script>`,
  });
}

describe("the browser's access to the local network", () => {
  // Chrome and Edge ask the User before a public site reaches the local network, and only for a frame the page
  // delegates it to: the Host delegates it to the Modules that declare "localNetwork", and to no other.
  for (const [name, permissions, expected] of [
    ["Local", { localNetwork: ["http://localhost:9090"] }, "prompt"],
    ["Remote", { network: ["https://api.example.com"] }, "denied"],
    ["Isolated", {}, "denied"],
  ] as const) {
    test(`a Module ${expected === "prompt" ? "that declares" : "that does not declare"} "localNetwork" ${expected === "prompt" ? "can" : "cannot"} ask for it (${name})`, async () => {
      const page = await host.newPage();
      await dropFile(page, `${name}.zip`, probe(name, permissions));
      await page.getByRole("dialog", { name: `Install ${name}?` }).getByRole("button", { name: "Accept and install" }).click();
      const result = page.frameLocator(`iframe[title='${name}']`).locator("#result");
      await result.filter({ hasText: "{" }).waitFor();
      assert.deepEqual(JSON.parse(await result.innerText()), { loopback: expected, local: expected, legacy: expected });
    });
  }
});

describe("the Host as a public site", () => {
  // A service on the User's computer, which answers any origin; `requests` lists what reaches it.
  const service = { url: "", requests: [] as string[] };
  let close: () => void;
  before(async () => {
    const server = createServer((request, response) => {
      service.requests.push(request.url ?? "");
      response.writeHead(200, { "Access-Control-Allow-Origin": "*", "Content-Type": "application/json" }).end('{"ok":true}');
    });
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    const address = server.address();
    service.url = `http://localhost:${typeof address === "object" && address ? address.port : 0}`;
    close = () => server.close();
  });
  after(() => close?.());

  /** A Module that requests the service, declared or not, and shows what happened. */
  const caller = (declared: boolean) =>
    zip({
      "manifest.json": {
        convention: 1, id: "@test/caller", name: "Caller", version: "1.0.0", icon: "icon.svg", guide: "guide.md", view: { entry: "index.html" },
        permissions: declared ? { localNetwork: [service.url] } : { localNetwork: ["http://localhost:1"] },
      },
      "icon.svg": "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 1 1'/>",
      "guide.md": "# Guide",
      "index.html": `<!doctype html><pre id="result"></pre><script type="module">
        const result = await fetch(${JSON.stringify(service.url)} + "/status").then((response) => response.json()).then(() => "reached", () => "failed");
        document.getElementById("result").textContent = result;
        parent.postMessage({ tessello: 1, type: "ready", id: "ready" }, "*");
      </script>`,
    });

  async function run(declared: boolean, allow: boolean) {
    const page = await publicHost.newPage();
    if (allow) await page.context().grantPermissions(["local-network-access"]);
    service.requests.length = 0;
    await dropFile(page, "caller.zip", caller(declared));
    await page.getByRole("dialog", { name: "Install Caller?" }).getByRole("button", { name: "Accept and install" }).click();
    const result = page.frameLocator("iframe[title='Caller']").locator("#result");
    await result.filter({ hasText: /reached|failed/ }).waitFor();
    return { result: await result.innerText(), requests: [...service.requests] };
  }

  test("a Module reaches a declared service of the User's computer once the User allows it", async () => {
    assert.deepEqual(await run(true, true), { result: "reached", requests: ["/status"] });
  });

  test("without the User's consent, the browser blocks it before it reaches the service", async () => {
    assert.deepEqual(await run(true, false), { result: "failed", requests: [] });
  });

  test("a service the Module does not declare stays blocked, even once the User allows the local network", async () => {
    assert.deepEqual(await run(false, true), { result: "failed", requests: [] });
  });

  test("Local Prometheus says the browser blocks it when the User refused", async () => {
    const page = await publicHost.newPage();
    // As when the User answers "Block" to the browser's question (Playwright cannot click it). The answer belongs to
    // the Host's origin, whichever Module made the request.
    const cdp = await page.context().newCDPSession(page);
    const { targetInfo } = await cdp.send("Target.getTargetInfo");
    for (const name of ["local-network-access", "local-network", "loopback-network"]) {
      await cdp.send("Browser.setPermission", {
        permission: { name },
        setting: "denied",
        origin: new URL(publicHost.url).origin,
        browserContextId: targetInfo.browserContextId,
      });
    }
    await install(page);
    const alert = page.frameLocator("iframe[title='Local Prometheus']").getByRole("alert");
    await alert.getByRole("heading", { name: "Your browser blocks access to your computer" }).waitFor();
    assert.match(await alert.innerText(), /site settings of Tessello/);
  });
});
