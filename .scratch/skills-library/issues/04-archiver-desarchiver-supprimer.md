# 04: Archiver, désarchiver et supprimer une skill

Spec parente : `.scratch/skills-library/spec.md`. Vocabulaire : `GLOSSARY.md` et « Vocabulaire du Module » de la spec. Contrat : la Convention.

**What to build:** Retirer une Skill du radar sans perdre ce qu'on en a écrit (archiver), l'y remettre (désarchiver), et supprimer un ajout par erreur.

**Blocked by:** 03

**Status:** ready-for-agent

- [ ] Le panneau d'édition a « Archive » / « Unarchive ». Une Skill archivée est cachée de *Library* sauf avec l'interrupteur « Show archived », où elle apparaît grisée.
- [ ] « Delete » (après une confirmation du Module, pas `confirm`) supprime la Skill. Il n'apparaît que pour une Skill qui n'est dans aucune Édition ; la règle est testée unitairement, et elle est vérifiée de bout en bout au ticket 06.
- [ ] Une Skill archivée reste une clé de doublon (ticket 02).
- [ ] Test navigateur : archiver une Skill, la voir disparaître, afficher les archivées, la désarchiver ; supprimer une Skill jamais publiée.

## Comments

- Depuis le ticket 02, une URL déjà présente met en évidence la Skill existante. Si elle est archivée et que « Show archived » est éteint, sa ligne n'est pas affichée : il faut alors l'afficher (ou allumer l'interrupteur) avant de la mettre en évidence.
