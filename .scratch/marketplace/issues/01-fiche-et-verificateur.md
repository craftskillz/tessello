# 01: Format de la fiche et Vérificateur de fiche

Spec parente : `.scratch/marketplace/spec.md`. Vocabulaire : `GLOSSARY.md`. Décisions : ADR 0014 à 0018. Contrat : la Convention.

**What to build:** Le paquet `@tessello/marketplace` (`packages/marketplace`), avec le format de `entry.json` et le Vérificateur de fiche : une fonction pure qui dit si l'ajout d'un Module ou d'une version est acceptable, et quel type de changement c'est.

**Blocked by:** aucun

**Status:** resolved

- [x] Le format de la fiche est défini et documenté : `id`, `source`, `license`, `tags`, `screenshots`, `versions` (`version`, `url`, `sha256`).
- [x] Le Vérificateur prend la fiche, la fiche précédente (ou rien), le paquet téléchargé de chaque nouvelle version, les métadonnées GitHub (auteur de la pull request et son identifiant numérique, appartenance à l'organisation, visibilité et licence du dépôt source) et `namespaces.json`. Il ne fait aucun accès réseau.
- [x] Il rend une liste d'erreurs à codes stables, sur le modèle du Validateur, et le type de changement : `new-module`, `new-version`, `metadata` ou `other`.
- [x] Règles : Espace de noms possédé par l'auteur (compte ou membre public de l'organisation, identifiant numérique conforme) ; `@tessello` réservé ; URL en `https:` ; empreinte conforme ; zéro erreur du Validateur ; Identifiant et version du Manifeste égaux à ceux de la fiche ; version strictement supérieure (semver) ; versions publiées inchangées ; dépôt source public ; licence SPDX approuvée par l'OSI et égale à celle que rapporte GitHub ; captures (3 au plus, PNG ou WebP, 500 Ko au plus).
- [x] Le paquet est isomorphe, comme `@tessello/convention`, et il est ajouté à la publication npm (ticket 13 de tessello-v1).
- [x] Tests unitaires : chaque règle, en acceptation et en refus, avec des paquets construits en mémoire.

## Comments

- 2026-10-23 — Fait. `packages/marketplace` : `parseEntry` (`src/entry.ts`, le format), `verifyEntry` (`src/verify.ts`, le Vérificateur, asynchrone pour calculer le SHA-256 avec Web Crypto), `compareVersions` (`src/semver.ts`) et `OSI_LICENSES` (`src/licenses.ts`, tiré de la SPDX License List 3.29.0 : identifiants approuvés par l'OSI, non dépréciés). Le format, `namespaces.json` et les codes sont documentés dans `packages/marketplace/README.md`. `@tessello/convention` exporte désormais `isModuleId` et `isSemver`, que la fiche et le Validateur partagent.
- **Entrées du Vérificateur** : en plus de la liste du ticket, `folder` (le dossier de la fiche, comparé à l'Identifiant : `entry/folder-mismatch`) et `files` (les fichiers du dossier, pour les captures). Les métadonnées GitHub : l'auteur (login, identifiant), le compte qui porte le nom de l'Espace de noms (login, identifiant, `User` ou `Organization`), l'appartenance publique de l'auteur à cette organisation, et le dépôt source (privé ou non, licence rapportée).
- **Choix** : une version nouvelle doit dépasser toutes les versions qui la précèdent dans la fiche (les publiées étant déjà ordonnées, c'est « la dernière »). Les erreurs du Validateur gardent leur propre code. Un champ inconnu dans `entry.json` est une erreur (le Validateur n'en fait qu'un avertissement dans le Manifeste) : la CI tourne avec le Vérificateur épinglé, et une faute de frappe comme `screenshot` ne doit pas passer en silence. `source` est exactement `https://github.com/<owner>/<repo>`. Les captures sont reconnues à leurs premiers octets (PNG, `RIFF…WEBP`), pas seulement à leur extension. Tags : 10 au plus, minuscules, chiffres et tirets.
- **Type de changement** : `new-module` sans fiche précédente ; `other` si l'Identifiant, la source, la licence, un Retrait ou un Bannissement change, ou si une version publiée change ou disparaît ; sinon `new-version` si une version est ajoutée (un changement de tags ou de captures peut l'accompagner) ; sinon `metadata`. Les types `withdrawal` et `ban` viendront au ticket 04, avec les états des Espaces de noms.
- **Publication npm** : la ligne correspondante existe déjà au ticket 13 de tessello-v1. Avec la décision du ticket 03 (la CI prend les outils dans ce dépôt), la Marketplace n'en dépend plus.
- `GLOSSARY.md` gagne **Fiche** (*Listing*) et **Vérificateur de fiche** (*Listing Verifier*), distinct du Validateur.
- Tests : 16 sur le format, 42 sur le Vérificateur (paquets `.zip` construits en mémoire), 4 sur `compareVersions`. Suite complète verte.
