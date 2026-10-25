# 05 : Les tests de contrat des Modules dans l'Hôte

**Status:** ready-for-agent

**Blocked by:** 03 — Audit (sa liste des tests de contrat retenus).

Spec parente : [des tests navigateur rapides et fiables](../spec.md), section « Résultat attendu », niveau 1.

**What to build:** Pour chaque Module @craftskillz, ce dépôt garde un court test de contrat de son paquet publié (`packages/host/e2e/fixtures/<name>.zip`). Il prouve que cette version fonctionne dans l'Hôte, ce qu'aucun test du dépôt du Module ne peut prouver : sandbox, CSP, Permissions, handshake, Dossier des Modules.

## Critères d'acceptation

- [ ] Pour chaque Module (diagram, skills-library, watch-later, survival-kit), au plus 3 tests, ceux retenus par l'audit. Ensemble, ils prouvent au moins : le paquet s'installe avec ses Permissions ; sa Vue et, s'il en a un, son Widget terminent leur handshake et s'affichent ; une donnée écrite depuis la Vue est dans le Dossier des Modules, et se relit après un rechargement ; son Guide d'utilisation s'ouvre depuis le Lanceur ; une requête réseau qu'il déclare passe, si le Module en déclare.
- [ ] La forme de ces tests est commune (par exemple un fichier `modules-contract.test.ts` qui parcourt les fixtures, ou une même fonction appelée depuis chaque fichier), pour qu'un nouveau Module @craftskillz y gagne son test de contrat en une ligne.
- [ ] Ils attendent un état observable, jamais une durée fixe (spec, « Règles communes »).
- [ ] Ils sont ajoutés à côté des tests existants. Rien n'est supprimé dans ce ticket : ce sont les tickets 06 à 09 qui retirent les anciens tests.
- [ ] Ils passent 3 fois de suite avec `E2E_CPU_SLOWDOWN=4` (`just e2e-repeat`, ticket 02).
