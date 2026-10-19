// The Host's themes (CONVENTION.md §6.2): the User chooses light, dark, or the one of their system.

import type { Theme } from "@tessello/host-core";

export type ThemeChoice = "system" | "light" | "dark";

export const THEME_CHOICES: readonly ThemeChoice[] = ["system", "light", "dark"];

const LIGHT: Theme = {
  mode: "light",
  colors: { background: "#ffffff", surface: "#f4f5f7", text: "#16181d", textMuted: "#5f6670", accent: "#2f6fec", border: "#d9dce1" },
};

const DARK: Theme = {
  mode: "dark",
  colors: { background: "#14161a", surface: "#1d2026", text: "#e8e9eb", textMuted: "#9aa0a8", accent: "#4f8cff", border: "#2c3038" },
};

/** The choice saved by the User; anything else, such as nothing saved yet, is the system's. */
export const themeChoiceOf = (stored: string | null): ThemeChoice =>
  THEME_CHOICES.find((choice) => choice === stored) ?? "system";

/** The theme of a choice, `systemDark` telling whether the system prefers dark. */
export function themeOf(choice: ThemeChoice, systemDark: boolean): Theme {
  const mode = choice === "system" ? (systemDark ? "dark" : "light") : choice;
  return mode === "dark" ? DARK : LIGHT;
}
