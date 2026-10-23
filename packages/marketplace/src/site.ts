import { escapeHtml, renderGuide } from "@tessello/convention";
import type { IndexModule, IndexRelease, MarketplaceIndex } from "./generator.ts";
import { PERMISSION_FILTERS } from "./permission-filter.ts";
import { declaredPermissions, searchModules } from "./search.ts";
import { STYLE } from "./style.ts";

export interface SiteOptions {
  /** The Host's address, e.g. "https://tessello.app/". */
  hostUrl: string;
}

/** Site path → content: the HTML pages and the stylesheet. The search script (search.js) is bundled separately. */
export function renderSite(index: MarketplaceIndex, options: SiteOptions): Map<string, string> {
  const pages = new Map<string, string>();
  pages.set("index.html", listPage(index));
  pages.set("style.css", STYLE);
  for (const module of index.modules) pages.set(modulePath(module.id), modulePage(module, options));
  return pages;
}

const CSP = "default-src 'none'; img-src 'self'; style-src 'self'; script-src 'self'; connect-src 'self'";

/** A page of the site; `root` is the relative path from the page to the site root ("" or "../../../"). */
function layout(title: string, root: string, body: string, script = ""): string {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta http-equiv="Content-Security-Policy" content="${CSP}">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(title)}</title>
<link rel="stylesheet" href="${root}style.css">
</head>
<body>
<header class="top"><a href="${root}index.html">Tessello Marketplace</a></header>
<main>
${body}
</main>
${script}</body>
</html>
`;
}

const modulePath = (id: string) => `modules/${id.slice(1)}/index.html`;

function listPage(index: MarketplaceIndex): string {
  const cards = searchModules(index.modules).map((module) => {
    const latest = module.latest as IndexRelease;
    const tags = module.tags.map((tag) => `<li>${escapeHtml(tag)}</li>`).join("");
    return `<li class="card" data-id="${escapeHtml(module.id)}">
<img class="icon" src="${escapeHtml(latest.icon)}" alt="" width="48" height="48">
<div>
<h2><a href="${escapeHtml(modulePath(module.id))}">${escapeHtml(latest.name)}</a></h2>
<p class="creator">${escapeHtml(module.creator)}</p>
<p>${escapeHtml(latest.description ?? "")}</p>
<ul class="tags">${tags}</ul>
</div>
</li>`;
  });
  const options = PERMISSION_FILTERS.map((filter) => `<option value="${filter.value}">${escapeHtml(filter.label)}</option>`).join("");
  const body = `<h1>Modules for Tessello</h1>
<form class="controls" role="search">
<input type="search" id="query" placeholder="Search by name, description, tag or creator" aria-label="Search">
<select id="permissions" aria-label="Permissions">${options}</select>
</form>
<ul class="cards" id="cards">
${cards.join("\n")}
</ul>
<p id="empty" hidden>No Module matches your search.</p>
<p class="generated">Index generated on <time datetime="${escapeHtml(index.generatedAt)}">${escapeHtml(index.generatedAt.slice(0, 10))}</time>.</p>`;
  return layout("Tessello Marketplace", "", body, `<script type="module" src="search.js"></script>\n`);
}

const MODULE_ROOT = "../../../";

/** The page of a banned or withdrawn Module, or of one with no usable version: no guide, no install link. */
function unavailablePage(module: IndexModule): string {
  const name = module.latest?.name ?? module.id;
  const why =
    module.state === "banned"
      ? `This Module was banned from the Marketplace. Reason: ${escapeHtml(module.reason ?? "none given")}`
      : module.state === "withdrawn"
        ? "This Module was withdrawn by its Creator."
        : "This Module has no version that can be installed from the Marketplace.";
  const body = `<h1>${escapeHtml(name)}</h1>
<p class="creator">${escapeHtml(module.creator)}</p>
<p class="unavailable">This Module is no longer available. ${why}</p>`;
  return layout(name, MODULE_ROOT, body);
}

function modulePage(module: IndexModule, options: SiteOptions): string {
  const latest = module.latest;
  if (module.state !== "listed" || !latest) return unavailablePage(module);
  const asset = (path: string) => escapeHtml(MODULE_ROOT + path);
  const permissions = declaredPermissions(latest.permissions);
  const permissionList =
    permissions.length === 0
      ? "<p>No Permissions</p>"
      : `<ul>${permissions.map(([name, origins]) => `<li><code>${escapeHtml(name)}</code>: ${origins.map((origin) => `<code>${escapeHtml(origin)}</code>`).join(", ")}</li>`).join("")}</ul>`;
  const guide = renderGuide(latest.guide.markdown, latest.guide.path, (path) => {
    const url = latest.guide.images[path];
    return url ? MODULE_ROOT + url : null;
  });
  const install = `${options.hostUrl}#install=${encodeURIComponent(latest.url)}`;
  const source = escapeHtml(module.source);
  const body = `<div class="module-head">
<img class="icon" src="${asset(latest.icon)}" alt="" width="64" height="64">
<div>
<h1>${escapeHtml(latest.name)}</h1>
<p class="creator">${escapeHtml(module.creator)} &middot; version ${escapeHtml(latest.version)}</p>
</div>
</div>
<p>${escapeHtml(latest.description ?? "")}</p>
<p><a class="button" href="${escapeHtml(install)}">Install in Tessello</a></p>
<p class="warning">Admitted to the Marketplace at its first publication. Updates are not reviewed. The Creator answers for this code, and you install it at your own risk. <a href="${source}">Source repository</a></p>
<dl>
<dt>Licence</dt><dd>${escapeHtml(module.license)}</dd>
<dt>Source</dt><dd><a href="${source}">${source}</a></dd>
<dt>Permissions</dt><dd>${permissionList}</dd>
<dt>Widget</dt><dd>${latest.widget ? `Size ${latest.widget.size}` : "No Widget"}</dd>
<dt>Tags</dt><dd><ul class="tags">${module.tags.map((tag) => `<li>${escapeHtml(tag)}</li>`).join("")}</ul></dd>
</dl>
<div class="screenshots">${module.screenshots.map((path) => `<img src="${asset(path)}" alt="Screenshot of ${escapeHtml(latest.name)}">`).join("")}</div>
<section class="guide">
${guide}</section>`;
  return layout(latest.name, MODULE_ROOT, body);
}
