# 15: Rafraîchir un Ensemble depuis GitHub

Spec parente : `.scratch/skills-library/spec.md`. Vocabulaire : `GLOSSARY.md` et « Vocabulaire du Module » de la spec. Contrat : la Convention.

**What to build:** « Refresh from GitHub » sur un Ensemble importé relance la découverte : les Skills apparues depuis l'import sont ajoutées (non évaluées), celles qui ont disparu sont signalées sans être effacées (spec, « Rafraîchir un Ensemble »).

**Blocked by:** 13

**Status:** resolved

- [x] Le bouton n'apparaît que pour un Ensemble dont la `sourceUrl` est une URL GitHub reconnue.
- [x] Une Skill trouvée absente de l'Ensemble (par `sourceUrl`) est ajoutée à la fin, non évaluée, avec le modèle de Notes. Une Skill de l'Ensemble qui n'est plus trouvée reçoit `goneUpstream: true` et s'affiche « Removed upstream » ; retrouvée, elle le perd. Noms, descriptions, Notes existants ne sont pas touchés. Une Skill ajoutée à la main sans URL n'est jamais marquée.
- [x] Un résumé s'affiche (« 2 skills added, 1 removed upstream », ou « Already up to date ») ; une erreur de découverte s'affiche et ne change rien.
- [x] Les Skills ajoutées rendent l'Ensemble *mis à jour* (détail : Skills ajoutées) ; `goneUpstream` seul n'est pas un Changement.
- [x] Tests unitaires de la fusion (ajout, disparition, réapparition, Skill sans URL, rien de neuf).
- [x] Test navigateur (GitHub simulé) : importer un ensemble, changer la réponse simulée (une skill en plus, une en moins), rafraîchir, lire le résumé et les marques.
