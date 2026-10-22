# 03: Dépôt de la Marketplace, sa CI et l'Approbation

Spec parente : `.scratch/marketplace/spec.md`. Vocabulaire : `GLOSSARY.md`. Décisions : ADR 0014 à 0018. Contrat : la Convention.

**What to build:** Le dépôt public `craftskillz/tessello-marketplace` : une pull request de Créateur est vérifiée par la CI ; un nouveau Module attend l'Approbation du Mainteneur, une nouvelle version est fusionnée automatiquement.

**Blocked by:** 01, 02, ticket 13 de tessello-v1 (Validateur et `@tessello/marketplace` sur npm)

**Status:** ready-for-agent

- [ ] Structure : `modules/<espace>/<nom>/entry.json` et ses captures, `namespaces.json`, `PUBLISHING.md`, modèle de pull request avec case d'acceptation, gabarit d'issue de signalement.
- [ ] `PUBLISHING.md` dit : l'Approbation à la seule discrétion du Mainteneur et sans garantie, les versions suivantes non relues, le Bannissement possible à tout moment et sans préavis, le code « tel quel » sous la seule responsabilité du Créateur, l'hébergement du `.zip` (GitHub Pages recommandé, une URL par version, jamais écrasée) et la licence OSI exigée.
- [ ] La CI télécharge les paquets, lit les métadonnées GitHub et appelle le Vérificateur. Elle commente la pull request avec les erreurs.
- [ ] Fusion : `new-module` attend le Mainteneur, qui ajoute l'Espace de noms à `namespaces.json` en fusionnant ; `new-version` et `metadata` sont fusionnés automatiquement si la CI passe.
- [ ] Sécurité : la CI n'exécute aucun code de la pull request ; le jeton qui fusionne n'est donné qu'à l'étape de décision ; une pull request ne touche qu'un dossier de fiche.
- [ ] À chaque fusion, le Générateur produit l'index et le site (le déploiement est le ticket 05).
- [ ] Essai réel sur un dépôt de test, avec un faux Créateur : nouveau Module, Approbation, nouvelle version fusionnée seule, version refusée. Résultat consigné dans le ticket.
- [ ] La création du dépôt et du jeton de fusion n'est faite qu'avec l'accord explicite du Mainteneur. `PUBLISHING.md` lui est soumis avant l'ouverture (relecture juridique conseillée).
