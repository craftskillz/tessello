# 09: Commande `tessello publish`

Spec parente : `.scratch/marketplace/spec.md`. Vocabulaire : `GLOSSARY.md`. Décisions : ADR 0014 à 0018. Contrat : la Convention.

**What to build:** Un Créateur lance `tessello publish <paquet.zip> --url <URL>` : le CLI prépare ou met à jour la fiche et ouvre la pull request.

**Blocked by:** 03

**Status:** resolved

- [x] Le CLI valide le paquet, calcule l'empreinte, vérifie que l'URL sert bien les mêmes octets avec les en-têtes CORS, et écrit ou complète `entry.json`.
- [x] Il ouvre la pull request par `gh` (fork du dépôt de la Marketplace si besoin), sans aucun serveur de Tessello. Sans `gh`, il écrit la fiche et dit quoi faire.
- [x] Il lance le Vérificateur en local avant d'ouvrir la pull request, pour échouer tôt.
- [ ] La skill de création et `PUBLISHING.md` mentionnent la commande.
- [x] Tests du CLI : dossier temporaire et serveur local pour l'URL, `gh` simulé.

## Comments

- 2026-10-24 — **Fait.** `tessello publish <paquet.zip> --url <URL> --accept-terms` (`packages/cli/src/publish-command.ts`, sur `prepareListing` de `packages/cli/src/listing.ts`) : valide le paquet, calcule son SHA-256, vérifie que l'URL répond 200 avec les mêmes octets et `Access-Control-Allow-Origin: *`, lit la fiche sur `main` par l'API GitHub (pas `raw.githubusercontent.com`, mis en cache), écrit la fiche ou y ajoute la version, puis lance en local le contrôle même de la CI (`checkPullRequest`) avec le compte de `gh`. Avec `gh` : la pull request s'ouvre depuis une branche `publish/<espace>-<nom>-<version>` de la Marketplace (Mainteneur) ou d'une fork synchronisée (Créateur), par l'API seulement ; une relance réutilise la branche. Sans `gh`, ou avec `--dry-run`, la fiche est écrite dans `tessello-listing/` avec les étapes à la main. `--accept-terms` est exigé : cocher la case est l'acceptation du Créateur (ADR 0015), le CLI ne la donne pas à sa place. Source par défaut : le remote `origin` ; licence par défaut : celle que GitHub rapporte. 37 tests (serveur local pour GitHub et l'URL, `gh` simulé). Essai réel en `--dry-run` sur Watch Later 0.6.0 publié : fiche correcte, contrôle local passé. Le CLI passe en 0.2.0 ; à publier sur npm (`@tessello/marketplace` 0.1.0 publié suffit, il n'a pas changé).
- `PUBLISHING.md` (dépôt de la Marketplace) : section « Publishing with `tessello publish` », par pull request du Mainteneur. La skill de création (ticket 14 de tessello-v1) n'existe pas encore : noté sur le ticket 14 pour qu'elle mentionne la commande.
- Reste à faire (revue) : le CLI recopie l'accès à GitHub de `packages/marketplace/scripts/check-pull-request.ts` ; un `PullRequestSource` sur GitHub partagé dans `@tessello/marketplace` éviterait qu'ils divergent, au prix d'une nouvelle version de ce paquet.
