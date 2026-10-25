// The Host's themes (CONVENTION.md §6.2): the User chooses light, dark, or the one of their system.

import { THEMES, type Theme } from "@tessello/host-core";

export type ThemeChoice = "system" | "light" | "dark";

export const THEME_CHOICES: readonly ThemeChoice[] = ["system", "light", "dark"];

/** The choice saved by the User; anything else, such as nothing saved yet, is the system's. */
export const themeChoiceOf = (stored: string | null): ThemeChoice =>
  THEME_CHOICES.find((choice) => choice === stored) ?? "system";

/** The theme of a choice, `systemDark` telling whether the system prefers dark. */
export function themeOf(choice: ThemeChoice, systemDark: boolean): Theme {
  const mode = choice === "system" ? (systemDark ? "dark" : "light") : choice;
  return THEMES[mode];
}
