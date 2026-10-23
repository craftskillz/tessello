// The search script of the site, bundled to search.js. The cards are server-rendered; this only hides those that do
// not match, with the same searchModules the Host uses.

import type { MarketplaceIndex } from "../generator.ts";
import { searchModules } from "../search.ts";
import { permissionFilter } from "../permission-filter.ts";

const query = document.querySelector<HTMLInputElement>("#query");
const permissions = document.querySelector<HTMLSelectElement>("#permissions");
const empty = document.querySelector<HTMLElement>("#empty");
const cards = [...document.querySelectorAll<HTMLElement>("#cards [data-id]")];

if (query && permissions && empty) {
  const response = await fetch("index.json");
  if (response.ok) {
    const index = (await response.json()) as MarketplaceIndex;
    const update = () => {
      const accepts = permissionFilter(permissions.value);
      const found = new Set(searchModules(index.modules, accepts ? { query: query.value, accepts } : { query: query.value }).map((module) => module.id));
      for (const card of cards) card.hidden = !found.has(card.dataset.id ?? "");
      empty.hidden = cards.some((card) => !card.hidden);
    };
    query.addEventListener("input", update);
    permissions.addEventListener("change", update);
    query.form?.addEventListener("submit", (event) => event.preventDefault());
  }
}
