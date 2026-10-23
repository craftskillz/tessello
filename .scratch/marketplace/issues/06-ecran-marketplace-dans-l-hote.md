# 06: Écran Marketplace dans l'Hôte

Spec parente : `.scratch/marketplace/spec.md`. Vocabulaire : `GLOSSARY.md`. Décisions : ADR 0014 à 0018. Contrat : la Convention.

**What to build:** L'Utilisateur ouvre la Marketplace dans l'Hôte, cherche, lit la fiche d'un Module et l'installe par l'écran d'accord existant ; l'Hôte note que le Module vient de la Marketplace.

**Blocked by:** 02

**Status:** resolved

- [x] Le cœur de l'Hôte lit l'index par une interface (implémentation en mémoire pour les tests), à l'ouverture de l'écran, et garde la dernière copie dans `.tessello/` avec sa date. Hors ligne, l'écran montre cette copie et sa date.
- [x] Recherche et filtre par Permission, avec la fonction partagée du ticket 02.
- [x] Fiche d'un Module : icône, nom, Créateur, licence, lien vers le dépôt source, Permissions, Widgets, Guide d'utilisation (rendu comme au ticket 17 de tessello-v1), captures, et le texte de l'ADR 0015.
- [x] Installation : téléchargement, vérification de l'empreinte (message « ce paquet ne correspond plus à la Marketplace » en cas d'écart), Validateur, écran d'accord avec le même avertissement. Le registre note la provenance `marketplace`, la version et l'empreinte.
- [x] Un lien `#install=<URL>` dont l'URL et l'empreinte sont celles d'une version de l'index reçoit la même provenance ; sinon c'est une installation par URL ordinaire.
- [x] Un Module ajouté par le Dossier des Modules ou par un `.zip` local reste sans provenance `marketplace`.
- [x] L'adresse de l'index est configurable pour les tests, et inscrite dans l'Hôte pour la production.
- [x] Textes en anglais et en français.
- [x] Tests unitaires (cœur) : cache, recherche, provenance. Tests navigateur, avec un index et des paquets servis localement : installer depuis l'écran, refuser un paquet à l'empreinte fausse, consulter hors ligne.

## Comments

- 2026-10-23 — **Implémentation.**
  - Cœur (`packages/host-core/src/marketplace.ts`) : l'index est lu par `IndexSource` (`createMemoryIndexSource` pour les tests). `host.readMarketplace()` le télécharge à l'ouverture de l'écran et garde la copie dans `.tessello/marketplace.json` avec sa date (`receivedAt`) ; injoignable, il rend cette copie (`offline`), ou `unavailable` sans copie. `search()` passe par `searchModules` du ticket 02.
  - Provenance : `RegisteredModule.provenance` (`{ source: "marketplace", version, sha256 }`) dans `.tessello/modules.json`. `host.inspectRelease(release, zip)` refuse un paquet dont l'empreinte n'est pas celle de la version (`mismatch`). `host.inspectZip(zip, { url })` n'est appelé ainsi que pour un lien `#install=` : l'URL et l'empreinte doivent être celles d'une version de l'index. Une version bannie, ou d'un Module banni, ne donne pas de provenance. Une mise à jour par un `.zip` local retire la provenance, et un dossier dont la version change à la main la perd aussi : le code installé n'est plus celui dont l'empreinte a été vérifiée.
  - Hôte : bouton « Marketplace » du Lanceur, écran dans la scène (recherche, filtre par Permission traduit, fiche avec icône, Créateur, licence, dépôt source, Permissions, Widget, Guide rendu par `guideDocument` avec ses images téléchargées, captures, texte de l'ADR 0015). L'écran d'accord (installation et mise à jour) porte le même avertissement et le lien vers le dépôt source, lu dans la copie de l'index, sans nouveau téléchargement.
  - Adresse de l'index : `MARKETPLACE_INDEX_URL` (`packages/host/src/marketplace-index.ts`), `https://marketplace.tessello.app/index.json`, **provisoire** jusqu'au ticket 12 de tessello-v1. Les tests la remplacent par l'entrée `tessello.marketplace` du stockage local du navigateur.
  - Tests : 15 unitaires dans le cœur, 4 sur la source HTTP de l'index, 6 dans le navigateur (`packages/host/e2e/marketplace.test.ts` : installer depuis l'écran, empreinte fausse, hors ligne, sans index ni copie, lien d'installation et `.zip` local, français).
  - Suites : unitaires 1130/1131, navigateur 195/196. Les deux échecs ne viennent pas de ce ticket et échouent aussi sans lui. `packages/cli/test/examples.test.ts` signale des `guide/missing-image` dans le Guide de Skills Library, que quelqu'un est en train de modifier. Dans `skills-library.test.ts:1146` (survol du radar), le panneau ne se ferme pas : le test échoue dans le fichier complet et passe seul.
