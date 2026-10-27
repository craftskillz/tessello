# 14: Skill de création

Spec parente : `.scratch/tessello-v1/spec.md`. Vocabulaire : `GLOSSARY.md`. Contrat : la Convention.

**What to build:** Un Créateur qui utilise un LLM, dans un terminal ou dans le navigateur, lui donne la skill de création Tessello, et le LLM produit un Module installable du premier coup.

**Blocked by:** 05 (Accueil et Widgets), 06 (Permissions : accord à l'installation et blocage réel), 13 (Publication npm)

**Status:** resolved

- [x] La skill, en anglais, guide le LLM sur la structure du paquet, le Manifeste, l'usage du SDK en copie locale, le choix d'un Identifiant sous l'Espace de noms du Créateur, la déclaration des Permissions et les tailles de Widget.
- [x] Elle impose la boucle `tessello validate` → corrections jusqu'à zéro erreur, puis l'empaquetage en `.zip` avec le contenu à la racine.
- [x] Elle s'appuie sur la Convention et les Modules d'exemple sans les recopier.
- [x] Elle est installable avec `npx skills add` depuis le dépôt et servie en simple fichier texte par le site de l'Hôte.
- [x] Acceptation manuelle : à partir d'une demande simple, un LLM qui suit la skill produit un Module que le Validateur accepte et que l'Hôte installe et affiche correctement ; le résultat de l'essai est consigné dans le ticket.

### Guide d'utilisation (2026-10-19)

Depuis l'ADR 0010 et le ticket 16, le Validateur refuse un Module sans Guide d'utilisation. La skill doit donc faire écrire à chaque Module un `guide.md` destiné à l'Utilisateur, en suivant les recommandations de la Convention (§3.2) : à quoi sert le Module, comment se servir de sa Vue et de son Widget, ce que veulent dire ses messages, où vont ses données. Le Guide du Survival Kit (`sample-modules/survival-kit/guide/guide.md`) sert d'exemple.

### Marketplace (2026-10-22)

Décidé au grilling de la Marketplace (`.scratch/marketplace/spec.md`) :

- [x] La skill s'arrête toujours au `.zip` qui passe `tessello validate`. Elle ne conduit pas la publication.
- [x] Une courte section « Publishing » renvoie à `PUBLISHING.md` de la Marketplace, recommande GitHub Pages pour héberger le `.zip` (une URL par version, jamais écrasée), et rappelle que l'Identifiant doit être sous l'Espace de noms du compte GitHub du Créateur (ADR 0016).
- [x] La note « Publishing your Module » de la Convention (§8) renvoie elle aussi à `PUBLISHING.md`.

## Comments

- 2026-10-24 — Ticket 09 de marketplace : la skill doit mentionner `tessello publish <paquet.zip> --url <URL> --accept-terms` pour la mise sur la Marketplace (et les modèles `craftskillz/tessello-template-svelte` et `-typescript`).
- 2026-10-27 — Livré : `skills/create-tessello-module/SKILL.md`. `npx skills add craftskillz/tessello` ne trouve que cette skill (les skills d'agent du dépôt, dans `.agents/skills/`, ne sont pas proposées). L'Hôte la sert en texte brut à `/create-tessello-module.txt` (copiée au build, hors du SHELL du service worker ; test `packages/host/test/skill.test.ts`). La Convention §8 renvoie à `PUBLISHING.md`. Le Guide d'exemple cité est `examples/notes/guide.md`, puisque le Survival Kit a quitté le dépôt.
- 2026-10-27 — Essai d'acceptation. Un agent Sonnet partait à froid, avec la skill pour seule consigne. La demande : « un suivi d'eau bu, un bouton par verre, objectif de 8 modifiable, un petit Widget avec le compte et un +, compte GitHub jane-doe ». Il a produit `@jane-doe/water-intake` 1.0.0 : Widget S, sans Permission, avec un `guide.md`. `npx tessello validate` (0.2.0) a répondu « ✓ 0 warnings » dès le premier passage, sur le dossier comme sur le `.zip`. Installé dans l'Hôte (Playwright) : écran d'accord, Widget sur l'Accueil où « + » donne 1/8, ouverture de la Vue depuis le Widget, stockage partagé (2/8 après « + Add a glass »), thème suivi. Ses remarques ont donné deux retouches de la skill : `openView()` sans paramètre, et la sortie attendue du Validateur.
