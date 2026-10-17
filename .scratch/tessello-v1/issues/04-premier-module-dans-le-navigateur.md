# 04: Premier Module dans le navigateur

Spec parente : `.scratch/tessello-v1/spec.md`. Vocabulaire : `GLOSSARY.md`. Contrat : la Convention.

**What to build:** Premier parcours complet de l'Utilisateur dans un vrai navigateur. Il ouvre l'Hôte, dépose le `.zip` du Module d'exemple « Notes » (sans Permission, avec une Vue), le Validateur l'accepte, le Module apparaît dans le Lanceur et sa Vue s'ouvre en plein écran dans une iframe sandbox, en suivant la solution retenue au ticket 01. Les notes saisies sont conservées après rechargement. Un Module non conforme est refusé avec le rapport du Validateur. Ce ticket pose le point d'entrée de test D (navigateur réel).

**Blocked by:** 01 (Servir un Module à une iframe sandbox avec blocage réseau), 02 (Handshake et stockage, du SDK au cœur de l'Hôte)

**Status:** ready-for-agent

- [ ] L'Hôte est une application web statique qui s'ouvre sans compte.
- [ ] Déposer un `.zip` lance le Validateur dans le navigateur ; en cas d'erreur, l'Utilisateur voit les erreurs et rien n'est installé.
- [ ] Avant l'installation, l'Utilisateur voit le nom, la version, l'icône, la description et l'Identifiant du Module.
- [ ] Un Module installé apparaît dans un Lanceur toujours visible ; le sélectionner affiche sa Vue en plein écran dans une iframe sandbox.
- [ ] Le Module « Notes » utilise le SDK en copie locale, passe le Validateur sans erreur ni avertissement et enregistre ses notes via le stockage de l'Hôte.
- [ ] Les Modules installés et leurs données persistent après rechargement de la page (persistance navigateur derrière l'interface du ticket 02).
- [ ] Si une Vue n'envoie pas `ready` dans le délai de la Convention, un message d'erreur clair remplace la Vue sans affecter le reste de l'Hôte.
- [ ] Des tests navigateur couvrent l'installation, le refus d'un Module non conforme, l'ouverture de la Vue et la persistance.

## Comments

### Pointeur vers le ticket 01 (2026-10-17)

Le mécanisme d'affichage est tranché par l'ADR 0005 (`srcdoc` autonome, CSP en `<meta>`, fichiers locaux en URL `data:`). Le prototype à reprendre se trouve sur la branche `prototype/01-iframe-sandbox`, dossier `prototypes/01-iframe-sandbox/` (`public/inline.js`, `public/module.js`). La liste de ce qu'il faut reprendre ou compléter est dans le ticket 01, section « Ce que le ticket 04 doit reprendre du prototype ».
