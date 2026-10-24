# 14: Skill de création

Spec parente : `.scratch/tessello-v1/spec.md`. Vocabulaire : `GLOSSARY.md`. Contrat : la Convention.

**What to build:** Un Créateur qui utilise un LLM, dans un terminal ou dans le navigateur, lui donne la skill de création Tessello, et le LLM produit un Module installable du premier coup.

**Blocked by:** 05 (Accueil et Widgets), 06 (Permissions : accord à l'installation et blocage réel), 13 (Publication npm)

**Status:** ready-for-agent

- [ ] La skill, en anglais, guide le LLM sur la structure du paquet, le Manifeste, l'usage du SDK en copie locale, le choix d'un Identifiant sous l'Espace de noms du Créateur, la déclaration des Permissions et les tailles de Widget.
- [ ] Elle impose la boucle `tessello validate` → corrections jusqu'à zéro erreur, puis l'empaquetage en `.zip` avec le contenu à la racine.
- [ ] Elle s'appuie sur la Convention et les Modules d'exemple sans les recopier.
- [ ] Elle est installable avec `npx skills add` depuis le dépôt et servie en simple fichier texte par le site de l'Hôte.
- [ ] Acceptation manuelle : à partir d'une demande simple, un LLM qui suit la skill produit un Module que le Validateur accepte et que l'Hôte installe et affiche correctement ; le résultat de l'essai est consigné dans le ticket.

### Guide d'utilisation (2026-10-19)

Depuis l'ADR 0010 et le ticket 16, le Validateur refuse un Module sans Guide d'utilisation. La skill doit donc faire écrire à chaque Module un `guide.md` destiné à l'Utilisateur, en suivant les recommandations de la Convention (§3.2) : à quoi sert le Module, comment se servir de sa Vue et de son Widget, ce que veulent dire ses messages, où vont ses données. Le Guide du Survival Kit (`sample-modules/survival-kit/guide/guide.md`) sert d'exemple.

### Marketplace (2026-10-22)

Décidé au grilling de la Marketplace (`.scratch/marketplace/spec.md`) :

- [ ] La skill s'arrête toujours au `.zip` qui passe `tessello validate`. Elle ne conduit pas la publication.
- [ ] Une courte section « Publishing » renvoie à `PUBLISHING.md` de la Marketplace, recommande GitHub Pages pour héberger le `.zip` (une URL par version, jamais écrasée), et rappelle que l'Identifiant doit être sous l'Espace de noms du compte GitHub du Créateur (ADR 0016).
- [ ] La note « Publishing your Module » de la Convention (§8) renvoie elle aussi à `PUBLISHING.md`.

## Comments

- 2026-10-24 — Ticket 09 de marketplace : la skill doit mentionner `tessello publish <paquet.zip> --url <URL> --accept-terms` pour la mise sur la Marketplace (et les modèles `craftskillz/tessello-template-svelte` et `-typescript`).
