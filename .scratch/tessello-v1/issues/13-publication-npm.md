# 13: Publication npm

Spec parente : `.scratch/tessello-v1/spec.md`. Vocabulaire : `GLOSSARY.md`. Contrat : la Convention.

**What to build:** Un Créateur utilise `npx tessello`, le SDK et le Validateur hors de ce dépôt, et peut copier le SDK en un seul fichier dans son paquet.

**Blocked by:** 03 (Thème, visibilité, navigation et erreurs du protocole)

**Status:** ready-for-agent

- [ ] Le CLI, le SDK et le Validateur sont compilés en JavaScript et leurs paquets ne contiennent que ce qui est nécessaire.
- [ ] Le SDK est aussi disponible en un fichier ES module unique, sans dépendance, utilisable par un Module sans outil de build ni Permission réseau.
- [ ] Une installation locale des paquets construits (sans publication) permet de lancer `tessello validate` depuis un autre dossier.
- [ ] Les noms de paquets sont vérifiés comme disponibles ; la publication réelle sur npm n'est faite qu'avec l'accord explicite du mainteneur.
- [ ] La suite de tests existante passe sur le code compilé.

### Marketplace (2026-10-22)

Décidé au grilling de la Marketplace (`.scratch/marketplace/spec.md`, ADR 0014 à 0018) :

- [ ] Pas de commande `publish` dans ce ticket : elle viendra avec la Marketplace (ticket 09 de marketplace).
- [ ] Le scope npm `@tessello` est vérifié comme disponible et réservé (création de l'organisation npm avec l'accord du Mainteneur). Il reste celui des outils ; les Modules sont publiés sous l'Espace de noms de leur Créateur (ADR 0016).
- [ ] Le futur paquet `@tessello/marketplace` (ticket 01 de marketplace) est publié de la même façon quand il existe.
