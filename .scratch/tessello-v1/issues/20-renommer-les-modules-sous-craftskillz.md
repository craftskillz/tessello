# 20: Renommer les Modules du Mainteneur sous `@craftskillz` et migrer ses données

Spec parente : `.scratch/tessello-v1/spec.md`. Vocabulaire : `GLOSSARY.md`. Contrat : la Convention. Décisions : ADR 0003, ADR 0016 (marketplace).

**What to build:** Tous les Modules du dépôt prennent l'Espace de noms `@craftskillz`, celui du compte GitHub du Mainteneur. `@tessello` ne reste que pour les paquets npm des outils. Les données déjà enregistrées sous les anciens Identifiants sont déplacées par un script ponctuel.

**Blocked by:** aucun

**Status:** ready-for-agent

- [x] Nouveaux Identifiants : `@craftskillz/diagram`, `@craftskillz/watch-later` (corrige la faute `@craftskills`), `@craftskillz/survival-kit`, et pour les exemples `@craftskillz/notes`, `@craftskillz/meteo`, `@craftskillz/prometheus`. Manifestes, `package.json` des Modules, tests (unitaires et navigateur), Guides d'utilisation, Convention et documentation sont mis à jour. Les specs et tickets résolus ne sont pas réécrits.
- [x] Les paquets des outils gardent `@tessello/*` (`convention`, `sdk`, `host`, `host-core`, `cli`).
- [x] Un script ponctuel, documenté, déplace dans un Dossier des Modules les données et l'entrée du registre de chaque ancien Identifiant vers le nouveau (`.tessello/modules.json`, `.tessello/data/<Identifiant>/`, disposition de l'Accueil). Il fait d'abord un essai à blanc qui liste ce qu'il changerait, garde une copie de `.tessello/`, et ne touche à rien si un nouvel Identifiant a déjà des données.
- [x] Le même renommage s'applique à un fichier d'export de l'Espace, pour qui préfère passer par l'export et l'import.
- [x] Tests du script : registre, données, Accueil, refus en cas de conflit, essai à blanc sans écriture.
- [ ] Le Mainteneur lance le script sur son propre Dossier des Modules ; le résultat est noté dans le ticket.
