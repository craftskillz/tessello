# 03: Dépôt de la Marketplace, sa CI et l'Approbation

Spec parente : `.scratch/marketplace/spec.md`. Vocabulaire : `GLOSSARY.md`. Décisions : ADR 0014 à 0018. Contrat : la Convention.

**What to build:** Le dépôt public `craftskillz/tessello-marketplace` : une pull request de Créateur est vérifiée par la CI ; un nouveau Module attend l'Approbation du Mainteneur, une nouvelle version est fusionnée automatiquement.

**Blocked by:** 01, 02

**Status:** resolved

- [x] Structure : `modules/<espace>/<nom>/entry.json` et ses captures, `namespaces.json`, `PUBLISHING.md`, modèle de pull request avec case d'acceptation, gabarit d'issue de signalement.
- [x] `PUBLISHING.md` dit : l'Approbation à la seule discrétion du Mainteneur et sans garantie, les versions suivantes non relues, le Bannissement possible à tout moment et sans préavis, le code « tel quel » sous la seule responsabilité du Créateur, l'hébergement du `.zip` (GitHub Pages recommandé, une URL par version, jamais écrasée) et la licence OSI exigée.
- [x] La CI télécharge les paquets, lit les métadonnées GitHub et appelle le Vérificateur. Elle commente la pull request avec les erreurs.
- [x] Fusion : `new-module` attend le Mainteneur, qui ajoute l'Espace de noms à `namespaces.json` en fusionnant ; `new-version` et `metadata` sont fusionnés automatiquement si la CI passe.
- [x] Sécurité : la CI n'exécute aucun code de la pull request ; le jeton qui fusionne n'est donné qu'à l'étape de décision ; une pull request ne touche qu'un dossier de fiche.
- [x] À chaque fusion, le Générateur produit l'index et le site (le déploiement est le ticket 05).
- [x] Essai réel sur un dépôt de test, avec un faux Créateur : nouveau Module, Approbation, nouvelle version fusionnée seule, version refusée. Résultat consigné dans le ticket.
- [x] La création du dépôt et du jeton de fusion n'est faite qu'avec l'accord explicite du Mainteneur. `PUBLISHING.md` lui est soumis avant l'ouverture (relecture juridique conseillée).

## Comments

- 2026-10-23 — **Décision du Mainteneur : les outils viennent du dépôt `craftskillz/tessello`, pas de npm.** La CI de la Marketplace clone `craftskillz/tessello` à un commit épinglé, installe ses dépendances et importe `@tessello/convention` et `@tessello/marketplace` depuis ce clone. Ce ticket ne dépend donc plus du ticket 13 de tessello-v1. Aucun code de la pull request n'est exécuté : le clone est fixé par le dépôt de la Marketplace, pas par le Créateur. Monter le commit épinglé est une pull request du Mainteneur.
- 2026-10-23 — Le dépôt `craftskillz/tessello-marketplace` est créé par le Mainteneur (public, licence MIT, sans README).
- 2026-10-23 — **Implémentation.** Dans ce dépôt : `checkPullRequest` (`packages/marketplace/src/pull-request.ts`), pur, derrière l'interface `PullRequestSource`, et le script `packages/marketplace/scripts/check-pull-request.ts`, qui lit la pull request par l'API REST de GitHub (rien n'est extrait ni exécuté) et écrit `result.json` et `comment.md`. Nouveaux codes : `pull-request/outside-listing`, `several-listings`, `no-listing`, `unexpected-file`, `listing-removed`, `terms-not-accepted` (la case cochée vaut acceptation, ADR 0015). Le contenu du dépôt de la Marketplace est préparé dans un clone local, `../tessello-marketplace`, non poussé : `PUBLISHING.md`, `README.md` (notes du Mainteneur), `namespaces.json`, le modèle de pull request, le gabarit de signalement, `.github/tessello-commit` (le commit épinglé) et deux workflows. `check.yml` (`pull_request_target`) vérifie, commente et, dans un job séparé qui seul reçoit `secrets.MERGE_TOKEN`, fusionne : une nouvelle version ou des métadonnées dès que la CI passe ; un nouveau Module quand le Mainteneur pose le label `approved`, après avoir inscrit son Espace de noms dans `namespaces.json`. La fusion est épinglée au commit vu par l'événement (`--match-head-commit`), et un nouveau commit retire le label. `build.yml` construit l'index et le site à chaque fusion (artefact ; le déploiement est le ticket 05).
- 2026-10-23 — **Reste à faire, avec l'accord du Mainteneur :** relire `PUBLISHING.md` (relecture juridique conseillée) ; pousser ce commit de `craftskillz/tessello` (le commit épinglé doit exister sur GitHub) puis le contenu de `../tessello-marketplace` ; créer le jeton `MERGE_TOKEN` et les labels `approved` et `report` ; faire l'essai réel sur un dépôt de test avec un faux Créateur (nouveau Module, Approbation, nouvelle version fusionnée seule, version refusée) et en consigner le résultat ici.
- 2026-10-23 — Le Mainteneur a relu et accepté `PUBLISHING.md`, poussé `craftskillz/tessello` puis `craftskillz/tessello-marketplace`, créé le secret `MERGE_TOKEN` et les labels `approved` et `report`. Reste l'essai réel sur un dépôt de test.
- 2026-10-23 — **Essai réel, réussi**, sur `craftskillz/tessello-marketplace-test` (copie du dépôt, son propre `MERGE_TOKEN`, labels `approved` et `report`), avec le faux Créateur `yarolla` (id 346972572) et son Module `@yarolla/notes`, paquets servis par GitHub Pages depuis `yarolla/notes` (MIT, `access-control-allow-origin: *`).
  1. **Nouveau Module** (PR #1, 1.0.0) : `verify` passe, commentaire « awaits the Maintainer's Approval », `decide` sauté.
  2. **Approbation** : le Mainteneur pose `approved`. Premier essai refusé par GitHub (403 au push de `namespaces.json`) : le jeton n'avait pas le dépôt de test dans son accès. Rien n'a été fusionné, comme prévu, puisque l'Espace de noms est inscrit avant la fusion. Jeton corrigé, label reposé : `namespaces.json` reçoit `yarolla` (`account`, `id`, `active`), puis la PR est fusionnée, et la fusion lance Build.
  3. **Nouvelle version** (PR #2, 1.1.0) : décision `merge`, fusionnée seule en 25 s ; l'`index.json` de Build liste 1.0.0 et 1.1.0, `latest` 1.1.0.
  4. **Version refusée** (PR #3, 1.2.0, dont le Manifeste dit 1.1.0) : `verify` échoue, commentaire `version/version-mismatch`, rien n'est fusionné.
  Constat : `actions/checkout`, `setup-node`, `upload-artifact` et `download-artifact` en `@v4` tournent sur Node.js 20, déprécié par GitHub ; à monter à leur version majeure suivante.
