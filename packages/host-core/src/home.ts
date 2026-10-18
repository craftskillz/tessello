// The Home (CONVENTION.md §7.1): the Widgets of the active Modules, in the order the User arranged them.

import type { ModuleEntry, WidgetSize } from "./modules.ts";
import type { Persistence } from "./persistence.ts";

/** A Widget of the Home. */
export interface HomeWidget {
  /** Its Module's ID. */
  id: string;
  name: string;
  size: WidgetSize;
}

export function createHome(persistence: Persistence, scan: () => Promise<ModuleEntry[]>) {
  return {
    /**
     * The arranged Widgets first, in their order, then the others in the order their Modules were activated. A Module
     * that is no longer active, or no longer has a Widget, is left out but keeps its place for when it comes back.
     */
    async widgets(): Promise<HomeWidget[]> {
      const widgets = (await scan()).flatMap((entry) =>
        entry.status === "active" && entry.widget ? [{ id: entry.id!, name: entry.name, size: entry.widget }] : [],
      );
      const order = await persistence.home.read();
      const rank = (widget: HomeWidget) => {
        const index = order.indexOf(widget.id);
        return index === -1 ? order.length : index;
      };
      // A stable sort: the Widgets not arranged yet keep the order of activation.
      return widgets.sort((a, b) => rank(a) - rank(b));
    },
    /**
     * Saves the order of the Widgets shown, as Module IDs. A Module the Home does not show (its folder is missing, for
     * instance) keeps its place among them; the shown Widgets take, in the new order, the places they had.
     */
    async arrange(order: string[]) {
      const saved = await persistence.home.read();
      const shown = new Set(order);
      const next = [...order];
      const arranged = saved.map((id) => (shown.has(id) ? next.shift()! : id));
      await persistence.home.write([...arranged, ...next]);
    },
    /** Forgets the place of an uninstalled Module's Widget. */
    async forget(id: string) {
      const saved = await persistence.home.read();
      if (saved.includes(id)) await persistence.home.write(saved.filter((other) => other !== id));
    },
  };
}
