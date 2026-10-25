// The Host's two themes (CONVENTION.md §6.2), shared by its interface and the SDK's Test Host.

import type { Theme } from "./host.ts";

export const THEMES: Readonly<Record<Theme["mode"], Theme>> = {
  light: {
    mode: "light",
    colors: { background: "#fafaf7", surface: "#ffffff", text: "#242f2a", textMuted: "#666e67", accent: "#265c46", border: "#e1e5dd" },
  },
  dark: {
    mode: "dark",
    colors: { background: "#14161a", surface: "#1d2420", text: "#e8e9eb", textMuted: "#afb9ae", accent: "#a8cba7", border: "#344039" },
  },
};
