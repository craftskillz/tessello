import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { themeChoiceOf, themeOf } from "../src/theme.ts";

const COLOR = /^#[0-9a-f]{6}$/;

describe("the theme the Host gives its Modules", () => {
  test("light and dark have the shape of the Convention: a mode and six #rrggbb colors", () => {
    for (const mode of ["light", "dark"] as const) {
      const theme = themeOf(mode, false);
      assert.equal(theme.mode, mode);
      assert.deepEqual(Object.keys(theme.colors).sort(), ["accent", "background", "border", "surface", "text", "textMuted"]);
      for (const color of Object.values(theme.colors)) assert.match(color, COLOR);
    }
  });

  test("the dark theme has a dark background and a light text", () => {
    const { colors } = themeOf("dark", false);
    assert.equal(colors.background, "#14161a");
    assert.equal(colors.text, "#e8e9eb");
  });

  test("an explicit choice ignores the system", () => {
    assert.equal(themeOf("light", true).mode, "light");
    assert.equal(themeOf("dark", false).mode, "dark");
  });

  test("the system choice follows the system", () => {
    assert.equal(themeOf("system", true).mode, "dark");
    assert.equal(themeOf("system", false).mode, "light");
  });

  test("the saved choice is read back, and anything else is the system choice", () => {
    assert.equal(themeChoiceOf("dark"), "dark");
    assert.equal(themeChoiceOf("light"), "light");
    assert.equal(themeChoiceOf("system"), "system");
    for (const stored of [null, "", "blue", "Dark"]) assert.equal(themeChoiceOf(stored), "system", String(stored));
  });
});
