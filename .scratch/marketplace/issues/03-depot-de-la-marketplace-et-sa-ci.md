# 03: Dépôt de la Marketplace, sa CI et l'Approbation

Spec parente : `.scratch/marketplace/spec.md`. Vocabulaire : `GLOSSARY.md`. Décisions : ADR 0014 à 0018. Contrat : la Convention.

**What to build:** Le dépôt public `craftskillz/tessello-marketplace` : une pull request de Créateur est vérifiée par la CI ; un nouveau Module attend l'Approbation du Mainteneur, une nouvelle version est fusionnée automatiquement.

**Blocked by:** 01, 02

**Status:** ready-for-agent

- [ ] Structure : `modules/<espace>/<nom>/entry.json` et ses captures, `namespaces.json`, `PUBLISHING.md`, modèle de pull request avec case d'acceptation, gabarit d'issue de signalement.
- [ ] `PUBLISHING.md` dit : l'Approbation à la seule discrétion du Mainteneur et sans garantie, les versions suivantes non relues, le Bannissement possible à tout moment et sans préavis, le code « tel quel » sous la seule responsabilité du Créateur, l'hébergement du `.zip` (GitHub Pages recommandé, une URL par version, jamais écrasée) et la licence OSI exigée.
- [ ] La CI télécharge les paquets, lit les métadonnées GitHub et appelle le Vérificateur. Elle commente la pull request avec les erreurs.
- [ ] Fusion : `new-module` attend le Mainteneur, qui ajoute l'Espace de noms à `namespaces.json` en fusionnant ; `new-version` et `metadata` sont fusionnés automatiquement si la CI passe.
- [ ] Sécurité : la CI n'exécute aucun code de la pull request ; le jeton qui fusionne n'est donné qu'à l'étape de décision ; une pull request ne touche qu'un dossier de fiche.
- [ ] À chaque fusion, le Générateur produit l'index et le site (le déploiement est le ticket 05).
- [ ] Essai réel sur un dépôt de test, avec un faux Créateur : nouveau Module, Approbation, nouvelle version fusionnée seule, version refusée. Résultat consigné dans le ticket.
- [ ] La création du dépôt et du jeton de fusion n'est faite qu'avec l'accord explicite du Mainteneur. `PUBLISHING.md` lui est soumis avant l'ouverture (relecture juridique conseillée).

## Comments

- 2026-10-23 — **Décision du Mainteneur : les outils viennent du dépôt `craftskillz/tessello`, pas de npm.** La CI de la Marketplace clone `craftskillz/tessello` à un commit épinglé, installe ses dépendances et importe `@tessello/convention` et `@tessello/marketplace` depuis ce clone. Ce ticket ne dépend donc plus du ticket 13 de tessello-v1. Aucun code de la pull request n'est exécuté : le clone est fixé par le dépôt de la Marketplace, pas par le Créateur. Monter le commit épinglé est une pull request du Mainteneur.
- 2026-10-23 — Le dépôt `craftskillz/tessello-marketplace` est créé par le Mainteneur (public, licence MIT, sans README).
