// What the View and the Widget share: the state of the Prometheus that runs on the User's computer, at the only origin
// declared in the Manifest's "localNetwork" Permission. Prometheus accepts requests from any origin by default
// (--web.cors.origin=".*"), including the origin "null" of a Module.

export const PROMETHEUS = "http://localhost:9090";

/** Why the state of Prometheus can't be shown: "blocked" by the browser, "unreachable", or a wrong "answer". */
export class PrometheusError extends Error {
  constructor(kind, message) {
    super(message);
    this.name = "PrometheusError";
    this.kind = kind;
  }
}

/**
 * Whether the browser lets Tessello reach the User's computer: "granted", "prompt" (it will ask), "denied", or null
 * when the browser does not say. Only Chrome and Edge know "local-network-access"; Firefox answers "denied" to its newer
 * names ("loopback-network", "local-network") even when it allows the request, so they are not asked.
 */
async function localNetworkAccess() {
  try {
    return (await navigator.permissions.query({ name: "local-network-access" })).state;
  } catch {
    return null;
  }
}

async function get(path) {
  let response;
  try {
    response = await fetch(PROMETHEUS + path);
  } catch {
    // The browser gives no detail: a refused connection, a CORS refusal and a blocked request all look the same.
    if ((await localNetworkAccess()) === "denied") throw new PrometheusError("blocked", "The browser blocks access to the local network.");
    throw new PrometheusError("unreachable", `No answer from ${PROMETHEUS}.`);
  }
  const body = await response.json().catch(() => null);
  if (!response.ok || body?.status !== "success") {
    throw new PrometheusError("answer", body?.error ?? `Prometheus answered ${response.status}.`);
  }
  return body.data;
}

/** The version of Prometheus, its active targets and its firing alerts. */
export async function prometheusState() {
  const [build, targets, alerts] = await Promise.all([get("/api/v1/status/buildinfo"), get("/api/v1/targets?state=active"), get("/api/v1/alerts")]);
  return {
    version: build.version,
    targets: targets.activeTargets.map((target) => ({
      job: target.labels?.job ?? target.scrapePool,
      instance: target.labels?.instance ?? target.scrapeUrl,
      up: target.health === "up",
      error: target.lastError || "",
    })),
    firing: alerts.alerts.filter((alert) => alert.state === "firing").map((alert) => alert.labels?.alertname ?? "Alert"),
  };
}

/** What to tell the User when the state can't be shown: a title and the steps to try. */
export function explain(error) {
  if (error instanceof PrometheusError && error.kind === "blocked") {
    return {
      title: "Your browser blocks access to your computer",
      steps: [
        "Open the site settings of Tessello (the icon left of the address) and allow access to the local network, or to the apps on this device.",
        "Then click Retry.",
      ],
    };
  }
  if (error instanceof PrometheusError && error.kind === "answer") {
    return { title: "Prometheus answered with an error", steps: [error.message] };
  }
  return {
    title: "Prometheus can't be reached",
    steps: [
      "Check that Prometheus runs on this computer and answers at http://localhost:9090.",
      "If your browser asks whether Tessello may reach devices on your local network or apps on this device, allow it.",
      "If Prometheus runs but still can't be reached, it may refuse other sites: start it without --web.cors.origin, or with --web.cors.origin='.*'.",
    ],
  };
}

export function applyTheme(theme) {
  const names = { background: "--background", surface: "--surface", text: "--text", textMuted: "--text-muted", accent: "--accent", border: "--border" };
  for (const [color, variable] of Object.entries(names)) document.documentElement.style.setProperty(variable, theme.colors[color]);
  document.documentElement.style.colorScheme = theme.mode;
}
