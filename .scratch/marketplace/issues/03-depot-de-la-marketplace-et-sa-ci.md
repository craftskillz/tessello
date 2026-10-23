# 03: Dépôt de la Marketplace, sa CI et l'Approbation

Spec parente : `.scratch/marketplace/spec.md`. Vocabulaire : `GLOSSARY.md`. Décisions : ADR 0014 à 0018. Contrat : la Convention.

**What to build:** Le dépôt public `craftskillz/tessello-marketplace` : une pull request de Créateur est vérifiée par la CI ; un nouveau Module attend l'Approbation du Mainteneur, une nouvelle version est fusionnée automatiquement.

**Blocked by:** 01, 02

**Status:** ready-for-agent

- [x] Structure : `modules/<espace>/<nom>/entry.json` et ses captures, `namespaces.json`, `PUBLISHING.md`, modèle de pull request avec case d'acceptation, gabarit d'issue de signalement.
- [x] `PUBLISHING.md` dit : l'Approbation à la seule discrétion du Mainteneur et sans garantie, les versions suivantes non relues, le Bannissement possible à tout moment et sans préavis, le code « tel quel » sous la seule responsabilité du Créateur, l'hébergement du `.zip` (GitHub Pages recommandé, une URL par version, jamais écrasée) et la licence OSI exigée.
- [x] La CI télécharge les paquets, lit les métadonnées GitHub et appelle le Vérificateur. Elle commente la pull request avec les erreurs.
- [x] Fusion : `new-module` attend le Mainteneur, qui ajoute l'Espace de noms à `namespaces.json` en fusionnant ; `new-version` et `metadata` sont fusionnés automatiquement si la CI passe.
- [x] Sécurité : la CI n'exécute aucun code de la pull request ; le jeton qui fusionne n'est donné qu'à l'étape de décision ; une pull request ne touche qu'un dossier de fiche.
- [x] À chaque fusion, le Générateur produit l'index et le site (le déploiement est le ticket 05).
- [ ] Essai réel sur un dépôt de test, avec un faux Créateur : nouveau Module, Approbation, nouvelle version fusionnée seule, version refusée. Résultat consigné dans le ticket.
- [ ] La création du dépôt et du jeton de fusion n'est faite qu'avec l'accord explicite du Mainteneur. `PUBLISHING.md` lui est soumis avant l'ouverture (relecture juridique conseillée).

## Comments

- 2026-10-23 — **Décision du Mainteneur : les outils viennent du dépôt `craftskillz/tessello`, pas de npm.** La CI de la Marketplace clone `craftskillz/tessello` à un commit épinglé, installe ses dépendances et importe `@tessello/convention` et `@tessello/marketplace` depuis ce clone. Ce ticket ne dépend donc plus du ticket 13 de tessello-v1. Aucun code de la pull request n'est exécuté : le clone est fixé par le dépôt de la Marketplace, pas par le Créateur. Monter le commit épinglé est une pull request du Mainteneur.
- 2026-10-23 — Le dépôt `craftskillz/tessello-marketplace` est créé par le Mainteneur (public, licence MIT, sans README).
- 2026-10-23 — **Implémentation.** Dans ce dépôt : `checkPullRequest` (`packages/marketplace/src/pull-request.ts`), pur, derrière l'interface `PullRequestSource`, et le script `packages/marketplace/scripts/check-pull-request.ts`, qui lit la pull request par l'API REST de GitHub (rien n'est extrait ni exécuté) et écrit `result.json` et `comment.md`. Nouveaux codes : `pull-request/outside-listing`, `several-listings`, `no-listing`, `unexpected-file`, `listing-removed`, `terms-not-accepted` (la case cochée vaut acceptation, ADR 0015). Le contenu du dépôt de la Marketplace est préparé dans un clone local, `../tessello-marketplace`, non poussé : `PUBLISHING.md`, `README.md` (notes du Mainteneur), `namespaces.json`, le modèle de pull request, le gabarit de signalement, `.github/tessello-commit` (le commit épinglé) et deux workflows. `check.yml` (`pull_request_target`) vérifie, commente et, dans un job séparé qui seul reçoit `secrets.MERGE_TOKEN`, fusionne : une nouvelle version ou des métadonnées dès que la CI passe ; un nouveau Module quand le Mainteneur pose le label `approved`, après avoir inscrit son Espace de noms dans `namespaces.json`. La fusion est épinglée au commit vu par l'événement (`--match-head-commit`), et un nouveau commit retire le label. `build.yml` construit l'index et le site à chaque fusion (artefact ; le déploiement est le ticket 05).
- 2026-10-23 — **Reste à faire, avec l'accord du Mainteneur :** relire `PUBLISHING.md` (relecture juridique conseillée) ; pousser ce commit de `craftskillz/tessello` (le commit épinglé doit exister sur GitHub) puis le contenu de `../tessello-marketplace` ; créer le jeton `MERGE_TOKEN` et les labels `approved` et `report` ; faire l'essai réel sur un dépôt de test avec un faux Créateur (nouveau Module, Approbation, nouvelle version fusionnée seule, version refusée) et en consigner le résultat ici.
- 2026-10-23 — Le Mainteneur a relu et accepté `PUBLISHING.md`, poussé `craftskillz/tessello` puis `craftskillz/tessello-marketplace`, créé le secret `MERGE_TOKEN` et les labels `approved` et `report`. Reste l'essai réel sur un dépôt de test.
