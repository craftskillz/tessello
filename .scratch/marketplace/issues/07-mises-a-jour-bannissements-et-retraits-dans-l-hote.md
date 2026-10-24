# 07: Mises à jour, Bannissements et Retraits dans l'Hôte

Spec parente : `.scratch/marketplace/spec.md`. Vocabulaire : `GLOSSARY.md`. Décisions : ADR 0014 à 0018. Contrat : la Convention.

**What to build:** Pour les Modules venus de la Marketplace, l'Hôte propose les nouvelles versions et signale les Bannissements et les Retraits, sans jamais agir de lui-même (ADR 0018).

**Blocked by:** 04, 06

**Status:** resolved

- [x] Au démarrage, l'Hôte relit l'index au plus une fois par jour.
- [x] Une version plus récente donne un badge « mise à jour » dans le Lanceur ; un clic lance le parcours existant (empreinte, Validateur, écran de différence des Permissions). Rien ne se met à jour sans ce clic.
- [x] Un Module ou une version bannis donnent un badge d'avertissement dans le Lanceur et sur le Widget ; l'avertissement donne la raison, propose de désinstaller et, pour une version bannie, recommande la plus récente si elle existe. Le Module continue de fonctionner.
- [x] Un Retrait donne une note neutre, distincte de l'avertissement.
- [x] Aucun signal pour un Module sans provenance `marketplace`.
- [x] Textes en anglais et en français.
- [x] Tests unitaires (cœur) : une interrogation par jour, mise à jour proposée, Bannissement de version, de Module et d'Espace de noms, Retrait, Module local ignoré. Tests navigateur : mettre à jour depuis le badge, voir l'avertissement de Bannissement.

## Comments

- 2026-10-24 — **Implémentation.**
  - Cœur (`packages/host-core/src/marketplace.ts`) : `host.checkMarketplace()`, appelé au démarrage, télécharge l'index si un Module de provenance `marketplace` est installé et que la copie a un jour ou plus. Sans Module de la Marketplace, l'Hôte ne la contacte jamais au démarrage. Injoignable, la copie reste et l'Hôte réessaie au démarrage suivant. `host.marketplaceNotices()` lit la seule copie et rend, par Module de la Marketplace, `MarketplaceNotice` : `version` installée, `update` (la version la plus récente, si elle est plus récente), `ban` (`module`, que donne aussi un Bannissement d'Espace de noms, ou `version`, avec la raison et `recommended`), `withdrawal` (`module` ou `version`). La version installée est retrouvée par l'empreinte de la provenance. Un Module banni ou retiré ne propose pas de mise à jour ; un Bannissement masque un Retrait.
  - Hôte : badges dans le Lanceur, entre le Module et « À propos ». « Mise à jour » lance `installFromMarketplace` (téléchargement, empreinte, Validateur, écran de mise à jour avec la différence des Permissions). « ⚠ » ouvre l'avertissement de Bannissement : raison, le Module continue de fonctionner, « Désinstaller… », et « Mettre à jour en X » pour une version bannie quand une plus récente existe. « Retiré » ouvre une note neutre. Sur le Widget, le Bannissement ou le Retrait est une bande sous le Widget, pour ne couvrir aucun de ses boutons. Les notices sont relues à chaque `refresh()` et après l'ouverture de l'écran de la Marketplace.
  - Tests : 13 unitaires dans le cœur (dont un Bannissement d'Espace de noms produit par `buildIndex`), 3 dans le navigateur (mettre à jour depuis le badge, avertissement de Bannissement dans le Lanceur et sur le Widget puis mise à jour recommandée, Retrait en français).
  - Suites : unitaires 1144/1144, navigateur 199/199.
