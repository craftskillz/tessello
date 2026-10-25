# 05 : Les tests de contrat des Modules dans l'Hôte

**Status:** resolved

**Blocked by:** 03 — Audit (sa liste des tests de contrat retenus).

Spec parente : [des tests navigateur rapides et fiables](../spec.md), section « Résultat attendu », niveau 1.

**What to build:** Pour chaque Module @craftskillz, ce dépôt garde un court test de contrat de son paquet publié (`packages/host/e2e/fixtures/<name>.zip`). Il prouve que cette version fonctionne dans l'Hôte, ce qu'aucun test du dépôt du Module ne peut prouver : sandbox, CSP, Permissions, handshake, Dossier des Modules.

## Critères d'acceptation

- [x] Pour chaque Module (diagram, skills-library, watch-later, survival-kit), au plus 3 tests, ceux retenus par l'audit. Ensemble, ils prouvent au moins : le paquet s'installe avec ses Permissions ; sa Vue et, s'il en a un, son Widget terminent leur handshake et s'affichent ; une donnée écrite depuis la Vue est dans le Dossier des Modules, et se relit après un rechargement ; son Guide d'utilisation s'ouvre depuis le Lanceur ; une requête réseau qu'il déclare passe, si le Module en déclare.
- [x] La forme de ces tests est commune (par exemple un fichier `modules-contract.test.ts` qui parcourt les fixtures, ou une même fonction appelée depuis chaque fichier), pour qu'un nouveau Module @craftskillz y gagne son test de contrat en une ligne.
- [x] Ils attendent un état observable, jamais une durée fixe (spec, « Règles communes »).
- [x] Ils sont ajoutés à côté des tests existants. Rien n'est supprimé dans ce ticket : ce sont les tickets 06 à 09 qui retirent les anciens tests.
- [x] Ils passent 3 fois de suite avec `E2E_CPU_SLOWDOWN=4` (`just e2e-repeat`, ticket 02).

## Comments

- 2026-10-25 — **Implémentation.** `packages/host/e2e/modules-contract.test.ts` : une entrée de `CONTRACTS` par Module (comment il démarre, ce qu'il écrit depuis la Vue, comment il le relit, ce que montre son Widget et comment il ouvre la Vue, et les serveurs qu'il déclare, simulés par `page.route`). Le manifeste est lu dans le `.zip` : nom, `id`, Permissions, nombre d'images du Guide. Trois tests par Module, mêmes pour tous : (1) le consentement liste les serveurs déclarés (ou « No network access »), la Vue démarre, la donnée écrite est dans `modules/.tessello/data/<id>/` et se relit après un rechargement ; (2) le Widget démarre, montre la donnée écrite par la Vue, et ouvre la Vue, chargée derrière l'Accueil (paramètres par événement) puis non chargée après un rechargement (paramètres dans le handshake) ; (3) « About » montre les Permissions accordées, et le Guide s'ouvre avec toutes ses images chargées. Toutes les attentes du fichier passent par `until` de `@tessello/sdk/testing` (devDependency de l'Hôte), une seule échéance, jamais une durée fixe ; les actions de Playwright gardent leur propre attente d'actionnabilité.
- **Écart avec l'audit.** Skills Library C1 importe un set depuis une URL GitHub (SKILL.md simulé) au lieu de l'ajouter à la main : c'est sa seule façon d'écrire qui passe par le réseau qu'il déclare (critère « une requête réseau qu'il déclare passe »). Watch Later C1 vérifie aussi la miniature (`i.ytimg.com`). Les C3 « Guide » de Watch Later et Skills Library, à écrire selon l'audit, sont la forme commune.
- **Vu échouer** en cassant chaque garantie : une donnée jamais écrite attendue après rechargement, l'oEmbed de Watch Later non servi, un serveur non déclaré attendu au consentement, un Widget qui attend une vidéo jamais ajoutée, une Vue ouverte par le Widget sur un autre filtre, une image de plus attendue dans le Guide.
- **Mesure.** `E2E_CPU_SLOWDOWN=4 just e2e-repeat 3 modules-contract` : 3 passages, 12 tests, aucun échec, 38,7 s médiane (environ 17 s sans ralentissement).
- **Non fait, à décider :** les contrats ne sont pas dans `test:browser:host` (les tests dont dépend le déploiement, ticket 01). Ils prouvent l'Hôte avec les paquets publiés : les y ajouter quand les tickets 06 à 09 auront retiré les anciens tests ?
- **Suite complète** (`npm run test:browser`) : 218 tests, 217 passent ; l'échec est `watch-later.test.ts:590` (`NotFoundError`), l'instabilité connue de `mesures.md`, revue 2 fois sur 3 avec `just e2e-repeat 3 watch-later` ; le ticket 08 la retire. Les contrats lisent le stockage dans `until`, qui tolère cette lecture qui lève.
