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
