# 06: Permissions : accord à l'installation et blocage réel

Spec parente : `.scratch/tessello-v1/spec.md`. Vocabulaire : `GLOSSARY.md`. Contrat : la Convention.

**What to build:** Avant d'activer un Module, l'Utilisateur voit en langage simple tout ce qu'il pourra faire et accepte tout ou annule (ADR 0004). Une fois le Module installé, l'Hôte bloque réellement tout accès réseau qui n'est pas couvert par ses Permissions. Un nouveau Module d'exemple « Météo » (Permission `network` vers une API publique compatible CORS, Widget M, ouverture de la Vue sur une ville) démontre le parcours.

**Blocked by:** 04 (Premier Module dans le navigateur)

**Status:** ready-for-agent

- [ ] L'écran d'installation liste les Permissions en langage simple, met en évidence `localNetwork` et indique explicitement l'absence d'accès réseau pour un Module sans Permission.
- [ ] L'Utilisateur peut seulement tout accepter ou annuler ; une annulation n'installe rien.
- [ ] Une requête ou une ressource distante vers une origine déclarée fonctionne ; vers une origine non déclarée, elle est bloquée.
- [ ] Les Permissions accordées sont enregistrées avec le Module et consultables depuis l'Hôte.
- [ ] Le Module « Météo » passe le Validateur sans avertissement, affiche la météo dans sa Vue et son Widget M, et son Widget ouvre la Vue sur une ville précise.
- [ ] Des tests navigateur couvrent l'accord, l'annulation et le blocage effectif d'une origine non déclarée.
