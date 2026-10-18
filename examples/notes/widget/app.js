// The Notes Widget: the newest note and how many there are. It opens the View, or the View on a new note with "+".
import { connect } from "../tessello-sdk.js";

const host = await connect();
const latest = document.getElementById("latest");
const count = document.getElementById("count");

function applyTheme(theme) {
  const names = { background: "--background", surface: "--surface", text: "--text", textMuted: "--text-muted", accent: "--accent", border: "--border" };
  for (const [color, variable] of Object.entries(names)) document.documentElement.style.setProperty(variable, theme.colors[color]);
  document.documentElement.style.colorScheme = theme.mode;
}

// The View writes the notes: they are read again each time the Widget is shown, since the Host does not push them.
async function render() {
  const notes = (await host.storage.get("notes")) ?? [];
  latest.textContent = notes.length > 0 ? notes[0].text : "No notes yet";
  count.textContent = notes.length > 1 ? `${notes.length} notes` : "";
}

document.getElementById("open").addEventListener("click", () => host.openView());
document.getElementById("new").addEventListener("click", () => host.openView({ note: "new" }));
host.onVisibilityChange((visible) => visible && render());
applyTheme(host.context.theme);
host.onThemeChange(applyTheme);
await render();
