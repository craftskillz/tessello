# 01: Format de la fiche et Vérificateur de fiche

Spec parente : `.scratch/marketplace/spec.md`. Vocabulaire : `GLOSSARY.md`. Décisions : ADR 0014 à 0018. Contrat : la Convention.

**What to build:** Le paquet `@tessello/marketplace` (`packages/marketplace`), avec le format de `entry.json` et le Vérificateur de fiche : une fonction pure qui dit si l'ajout d'un Module ou d'une version est acceptable, et quel type de changement c'est.

**Blocked by:** aucun

**Status:** ready-for-agent

- [ ] Le format de la fiche est défini et documenté : `id`, `source`, `license`, `tags`, `screenshots`, `versions` (`version`, `url`, `sha256`).
- [ ] Le Vérificateur prend la fiche, la fiche précédente (ou rien), le paquet téléchargé de chaque nouvelle version, les métadonnées GitHub (auteur de la pull request et son identifiant numérique, appartenance à l'organisation, visibilité et licence du dépôt source) et `namespaces.json`. Il ne fait aucun accès réseau.
- [ ] Il rend une liste d'erreurs à codes stables, sur le modèle du Validateur, et le type de changement : `new-module`, `new-version`, `metadata` ou `other`.
- [ ] Règles : Espace de noms possédé par l'auteur (compte ou membre public de l'organisation, identifiant numérique conforme) ; `@tessello` réservé ; URL en `https:` ; empreinte conforme ; zéro erreur du Validateur ; Identifiant et version du Manifeste égaux à ceux de la fiche ; version strictement supérieure (semver) ; versions publiées inchangées ; dépôt source public ; licence SPDX approuvée par l'OSI et égale à celle que rapporte GitHub ; captures (3 au plus, PNG ou WebP, 500 Ko au plus).
- [ ] Le paquet est isomorphe, comme `@tessello/convention`, et il est ajouté à la publication npm (ticket 13 de tessello-v1).
- [ ] Tests unitaires : chaque règle, en acceptation et en refus, avec des paquets construits en mémoire.
