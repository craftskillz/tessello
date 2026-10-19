import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { languageOf, messagesOf } from "../src/i18n.ts";

describe("the language of the Host's interface", () => {
  test("English by default, French when the User chose it", () => {
    assert.equal(languageOf("fr"), "fr");
    assert.equal(languageOf("en"), "en");
    for (const stored of [null, "", "de", "FR", "fr-FR"]) assert.equal(languageOf(stored), "en", String(stored));
  });

  test("every message of the interface exists in French, with the same parameters", () => {
    const en = messagesOf("en");
    const fr = messagesOf("fr");
    assert.deepEqual(Object.keys(fr).sort(), Object.keys(en).sort());
    for (const [key, message] of Object.entries(en)) {
      const french = fr[key as keyof typeof fr];
      assert.equal(typeof french, typeof message, key);
      if (typeof message === "function") assert.equal((french as typeof message).length, message.length, key);
    }
  });

  test("messages are written in the language chosen, with the vocabulary of the glossary", () => {
    assert.equal(messagesOf("en").installTitle("Notes"), "Install Notes?");
    assert.equal(messagesOf("fr").installTitle("Notes"), "Installer Notes\u00a0?");
    assert.equal(messagesOf("en").launcher, "Launcher");
    assert.equal(messagesOf("fr").launcher, "Lanceur");
    assert.equal(messagesOf("fr").chooseFolderTitle, "Choisissez votre Dossier des Modules");
  });

  test("a refused URL is explained in the language chosen", () => {
    assert.match(messagesOf("en").urlRefused({ reason: "insecure", protocol: "ftp:" }), /only over https:.*ftp:/);
    assert.match(messagesOf("fr").urlRefused({ reason: "insecure", protocol: "ftp:" }), /uniquement en https:.*ftp:/);
    assert.match(messagesOf("fr").urlRefused({ reason: "credentials" }), /nom d’utilisateur ou un mot de passe/);
    assert.match(messagesOf("fr").urlRefused({ reason: "not-a-url" }), /n’est pas une URL/);
  });
});
