// Turns a fresh copy of a Module template (craftskillz/tessello-template-svelte or -typescript) into the Module <name>:
// `my-module` and `My Module` become the name and its title in every file git tracks, and the README loses the section
// about the template. Run by `just new-module`: `node scripts/rename-module.ts <folder> <name>`.

import { execFileSync } from "node:child_process";
import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

/** A Module name is lowercase words joined by dashes, as in its Identifier `@craftskillz/<name>`. */
export const isModuleName = (name: string) => /^[a-z0-9]+(-[a-z0-9]+)*$/.test(name);

/** The title of a Module from its name: `watch-later` → `Watch Later`. */
export const titleOf = (name: string) => name.split("-").map((word) => word[0].toUpperCase() + word.slice(1)).join(" ");

/** Renames the template in `folder` to the Module `name`. */
export async function renameModule(folder: string, name: string): Promise<void> {
  if (!isModuleName(name)) throw new Error(`"${name}" is not a Module name: lowercase words joined by dashes, e.g. watch-later.`);
  const files = execFileSync("git", ["ls-files", "-z"], { cwd: folder, encoding: "utf8" }).split("\0").filter(Boolean);
  for (const file of files) {
    if (/\.(png|jpe?g|gif|webp|zip)$/i.test(file)) continue;
    const path = join(folder, file);
    const before = await readFile(path, "utf8");
    let after = before.replaceAll("my-module", name).replaceAll("My Module", titleOf(name));
    if (file === "README.md") after = after.replace(/<!-- template -->[\s\S]*?<!-- \/template -->\n/, "");
    if (after !== before) await writeFile(path, after);
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const [folder, name] = process.argv.slice(2);
  await renameModule(folder, name);
}
