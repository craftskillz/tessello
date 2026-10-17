// The Notes View: notes are kept in the Host storage under the key "notes", as [{ id, text }], newest first.
import { connect } from "./tessello-sdk.js";

const host = await connect();
const form = document.getElementById("new-note");
const text = document.getElementById("text");
const list = document.getElementById("notes");
const empty = document.getElementById("empty");

let notes = (await host.storage.get("notes")) ?? [];

function applyTheme(theme) {
  const names = { background: "--background", surface: "--surface", text: "--text", textMuted: "--text-muted", accent: "--accent", border: "--border" };
  for (const [color, variable] of Object.entries(names)) document.documentElement.style.setProperty(variable, theme.colors[color]);
  document.documentElement.style.colorScheme = theme.mode;
}

function render() {
  empty.hidden = notes.length > 0;
  list.replaceChildren(
    ...notes.map((note) => {
      const item = document.createElement("li");
      const content = document.createElement("span");
      content.textContent = note.text;
      const remove = document.createElement("button");
      remove.type = "button";
      remove.textContent = "Delete";
      remove.setAttribute("aria-label", `Delete note: ${note.text}`);
      remove.addEventListener("click", () => change((current) => current.filter((other) => other.id !== note.id)));
      item.append(content, remove);
      return item;
    }),
  );
}

// Saves each change as soon as it is made, since the Host may unload the View at any time, and shows it once saved.
// Changes run one after the other, so that each one starts from the notes saved by the previous one.
let saving = Promise.resolve();
function change(update) {
  saving = saving.then(async () => {
    const next = update(notes);
    if (next.length > 0) await host.storage.set("notes", next);
    else await host.storage.delete("notes");
    notes = next;
    render();
  }).catch((error) => console.error("Notes could not be saved:", error)); // A failed change must not block the next ones.
}

form.addEventListener("submit", (event) => {
  event.preventDefault();
  const value = text.value.trim();
  if (!value) return;
  text.value = "";
  change((current) => [{ id: `${Date.now()}-${Math.random().toString(36).slice(2)}`, text: value }, ...current]);
});

applyTheme(host.context.theme);
host.onThemeChange(applyTheme);
render();
