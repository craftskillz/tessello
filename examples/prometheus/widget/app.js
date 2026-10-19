// The Local Prometheus Widget: how many targets are up, and the firing alerts. It opens the View, which explains what
// to do when Prometheus can't be reached.
import { connect } from "../tessello-sdk.js";
import { applyTheme, explain, prometheusState } from "../prometheus.js";

const host = await connect();
const summary = document.getElementById("summary");
const detail = document.getElementById("detail");

async function render() {
  try {
    const { targets, firing } = await prometheusState();
    const up = targets.filter((target) => target.up).length;
    summary.textContent = `${up}/${targets.length} up`;
    summary.className = `summary ${up === targets.length ? "up" : "down"}`;
    detail.textContent = firing.length === 0 ? "No alert firing" : firing.length === 1 ? "1 alert firing" : `${firing.length} alerts firing`;
  } catch (error) {
    console.error("The state of Prometheus could not be loaded:", error);
    summary.textContent = "Unavailable";
    summary.className = "summary down";
    detail.textContent = explain(error).title;
  }
}

document.getElementById("open").addEventListener("click", () => host.openView());
host.onVisibilityChange((visible) => visible && render());
applyTheme(host.context.theme);
host.onThemeChange(applyTheme);
await render();
