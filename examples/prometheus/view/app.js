// The Local Prometheus View: the version of the Prometheus on the User's computer, its targets and its firing alerts,
// or what to do when it can't be reached. It asks again each time it is shown, and on Retry.
import { connect } from "../tessello-sdk.js";
import { applyTheme, explain, prometheusState } from "../prometheus.js";

const host = await connect();
const state = document.getElementById("state");

function element(tag, props = {}, ...children) {
  const node = Object.assign(document.createElement(tag), props);
  node.append(...children);
  return node;
}

function target({ job, instance, up, error }) {
  const item = element("li", { className: up ? "up" : "down" }, element("span", { className: "health" }, up ? "Up" : "Down"), element("span", {}, `${job} · ${instance}`));
  if (error) item.append(element("span", { className: "muted" }, error));
  return item;
}

// The latest request: a slower answer to an earlier one does not replace it.
let latestRequest = 0;
async function render() {
  const request = ++latestRequest;
  state.replaceChildren(element("p", { className: "muted" }, "Asking Prometheus…"));
  try {
    const { version, targets, firing } = await prometheusState();
    if (request !== latestRequest) return;
    const down = targets.filter((t) => !t.up).length;
    state.replaceChildren(
      element("p", {}, `Prometheus ${version} · ${targets.length - down} of ${targets.length} targets up`),
      element("h2", {}, "Targets"),
      targets.length ? element("ul", { className: "targets" }, ...targets.map(target)) : element("p", { className: "muted" }, "No active target."),
      element("h2", {}, "Firing alerts"),
      firing.length ? element("ul", { className: "alerts" }, ...firing.map((name) => element("li", {}, name))) : element("p", { className: "muted" }, "No alert is firing."),
    );
  } catch (error) {
    if (request !== latestRequest) return;
    console.error("The state of Prometheus could not be loaded:", error);
    const { title, steps } = explain(error);
    state.replaceChildren(element("div", { role: "alert" }, element("h2", {}, title), element("ul", {}, ...steps.map((step) => element("li", {}, step)))));
  }
}

document.getElementById("retry").addEventListener("click", render);
host.onVisibilityChange((visible) => visible && render());
applyTheme(host.context.theme);
host.onThemeChange(applyTheme);
await render();
