import assert from "node:assert/strict";
import { describe, test } from "node:test";
import type { Page } from "playwright";
import { dropFile, useHost, zip, zipExample } from "./browser.ts";

const host = useHost();

/** Answers Open-Meteo in place of the real API: the temperature is the city's latitude, rounded. */
async function fakeOpenMeteo(page: Page) {
  await page.route("https://api.open-meteo.com/**", (route) => {
    const latitude = Number(new URL(route.request().url()).searchParams.get("latitude"));
    void route.fulfill({
      headers: { "Access-Control-Allow-Origin": "*" },
      contentType: "application/json",
      body: JSON.stringify({
        current: { temperature_2m: latitude, weather_code: 0, wind_speed_10m: 12 },
        daily: { temperature_2m_min: [latitude - 5], temperature_2m_max: [latitude + 5] },
      }),
    });
  });
}

describe("the consent screen", () => {
  test("lists in plain language the servers a Module will contact, what is isolated, and what is not guaranteed", async () => {
    const page = await host.newPage();
    await dropFile(page, "meteo.zip", await zipExample("meteo"));

    const consent = page.getByRole("dialog", { name: "Install Weather?" });
    await consent.waitFor();
    const permissions = consent.getByRole("region", { name: "What Weather can do" });
    assert.match(await permissions.innerText(), /Limited[\s\S]*only these servers[\s\S]*api\.open-meteo\.com/);
    assert.match(await permissions.innerText(), /Isolated[\s\S]*your files, Tessello or your other Modules/);
    assert.match(await permissions.innerText(), /Not guaranteed[\s\S]*Install only Modules you trust/);
    assert.equal(await permissions.getByText("Local network").count(), 0);
  });

  test("a Module without Permission is shown with no network access", async () => {
    const page = await host.newPage();
    await dropFile(page, "notes.zip", await zipExample("notes"));
    const permissions = page.getByRole("dialog", { name: "Install Notes?" }).getByRole("region", { name: "What Notes can do" });
    await permissions.getByText("No network access: Notes declares no server, and Tessello blocks the requests it would make.").waitFor();
  });

  test("access to the local network is highlighted", async () => {
    const page = await host.newPage();
    await dropFile(
      page,
      "prometheus.zip",
      zip({
        "manifest.json": {
          convention: 1,
          id: "@test/prometheus",
          name: "Prometheus",
          version: "1.0.0",
          icon: "icon.svg", guide: "guide.md",
          view: { entry: "index.html" },
          permissions: { localNetwork: ["http://localhost:9090"] },
        },
        "icon.svg": "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 1 1'/>", "guide.md": "# Guide",
        "index.html": `<script>parent.postMessage({ tessello: 1, type: "ready", id: "1" }, "*")</script>`,
      }),
    );
    const permissions = page.getByRole("dialog", { name: "Install Prometheus?" }).getByRole("region", { name: "What Prometheus can do" });
    const local = permissions.locator(".sensitive");
    assert.match(await local.innerText(), /Local network[\s\S]*localhost:9090/);
  });

  test("cancelling installs nothing; accepting installs the Module with every Permission, which the Host shows", async () => {
    const page = await host.newPage();
    await fakeOpenMeteo(page);
    const launcher = page.getByRole("navigation", { name: "Launcher" });
    await dropFile(page, "meteo.zip", await zipExample("meteo"));
    await page.getByRole("dialog", { name: "Install Weather?" }).getByRole("button", { name: "Cancel" }).click();
    await page.reload();
    await launcher.waitFor();
    assert.equal(await launcher.getByRole("listitem").count(), 0, "nothing is installed after cancelling");

    await dropFile(page, "meteo.zip", await zipExample("meteo"));
    const consent = page.getByRole("dialog", { name: "Install Weather?" });
    await consent.waitFor();
    assert.deepEqual(await consent.getByRole("button").allInnerTexts(), ["Cancel", "Accept and install"], "accepting all or cancelling are the only choices");
    await consent.getByRole("button", { name: "Accept and install" }).click();
    await page.frameLocator("iframe[title='Weather']").getByRole("heading", { name: "Paris" }).waitFor();

    await launcher.getByRole("listitem").filter({ hasText: "Weather" }).getByRole("button", { name: "Permissions" }).click();
    const granted = page.getByRole("dialog", { name: "Permissions of Weather" });
    assert.match(await granted.innerText(), /Limited[\s\S]*only these servers[\s\S]*api\.open-meteo\.com/);
  });
});

describe("the Weather Module", () => {
  test("shows the weather in its View and its Widget, whose cities open the View on them", async () => {
    const page = await host.newPage();
    await fakeOpenMeteo(page);
    await dropFile(page, "meteo.zip", await zipExample("meteo"));
    await page.getByRole("dialog", { name: "Install Weather?" }).getByRole("button", { name: "Accept and install" }).click();
    const view = page.frameLocator("iframe[title='Weather']");
    await view.getByText("49 °C").waitFor();

    await page.getByRole("button", { name: "Tessello" }).click();
    const widget = page.frameLocator("iframe[title='Weather widget']");
    await widget.getByRole("button", { name: "Open the weather of Tokyo" }).getByText("36 °C").waitFor();
    assert.equal(await page.getByRole("listitem", { name: "Weather" }).getAttribute("class"), "widget size-M");

    await widget.getByRole("button", { name: "Open the weather of Tokyo" }).click();
    await view.getByRole("heading", { name: "Tokyo" }).waitFor();
    await view.getByText("Today 31 °C to 41 °C · wind 12 km/h").waitFor();
  });
});

describe("blocking", () => {
  test("a request or a remote resource reaches a declared origin, and never an undeclared one", async () => {
    const page = await host.newPage();
    const reached: string[] = [];
    const failures: string[] = [];
    page.on("requestfailed", (request) => failures.push(`${request.url()} ${request.failure()?.errorText}`));
    // 1×1 PNG.
    const dot = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=", "base64");
    await page.route(/^https:\/\/(declared|undeclared)\.example\.com\//, (route) => {
      reached.push(route.request().url());
      return route.fulfill({
        headers: { "Access-Control-Allow-Origin": "*" },
        contentType: route.request().url().endsWith(".png") ? "image/png" : "application/json",
        body: route.request().url().endsWith(".png") ? dot : JSON.stringify({ ok: true }),
      });
    });
    await dropFile(
      page,
      "probe.zip",
      zip({
        "manifest.json": {
          convention: 1,
          id: "@test/probe",
          name: "Probe",
          version: "1.0.0",
          icon: "icon.svg", guide: "guide.md",
          view: { entry: "index.html" },
          permissions: { network: ["https://declared.example.com"] },
        },
        "icon.svg": "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 1 1'/>", "guide.md": "# Guide",
        "index.html": `<!doctype html><pre id="result"></pre><script type="module">
          const request = (origin) => fetch(origin + "/data.json").then((response) => response.json()).then(() => "reached", () => "blocked");
          const image = (origin) => new Promise((resolve) => {
            const img = new Image();
            img.onload = () => resolve("reached");
            img.onerror = () => resolve("blocked");
            img.src = origin + "/dot.png";
          });
          const origins = ["https://declared.example.com", "https://" + "undeclared.example.com"];
          const [declared, undeclared] = origins;
          const result = { declaredRequest: await request(declared), declaredImage: await image(declared), undeclaredRequest: await request(undeclared), undeclaredImage: await image(undeclared) };
          document.getElementById("result").textContent = JSON.stringify(result);
          parent.postMessage({ tessello: 1, type: "ready", id: "ready" }, "*");
        </script>`,
      }),
    );
    await page.getByRole("dialog", { name: "Install Probe?" }).getByRole("button", { name: "Accept and install" }).click();

    const result = page.frameLocator("iframe[title='Probe']").locator("#result");
    await result.filter({ hasText: "{" }).waitFor();
    assert.deepEqual(JSON.parse(await result.innerText()), {
      declaredRequest: "reached",
      declaredImage: "reached",
      undeclaredRequest: "blocked",
      undeclaredImage: "blocked",
    });
    assert.deepEqual(reached.filter((url) => url.startsWith("https://undeclared.example.com")), [], "the browser never sends it");
    // Chromium reports the image it did not load, blocked by the Content Security Policy.
    assert.deepEqual(failures, ["https://undeclared.example.com/dot.png csp"]);
  });
});
