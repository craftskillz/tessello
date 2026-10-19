# 05: Style et étiquette des flèches

Spec parente : `.scratch/diagram/spec.md`. Vocabulaire : `GLOSSARY.md`. Contrat : la Convention. Rétrodoc : `/Users/ymedaghri/Documents/testRetrodocLivingDocByClaude/features/diagrams.md`.

**What to build:** Le panneau de flèche de l'original, simplifié : pointes, pointillé, épaisseur, couleur, et une étiquette que l'on déplace en la glissant (parcours 4, étape 3).

**Blocked by:** 03 (Connexions)

**Status:** ready-for-agent

- [ ] Pointes : aucune, au début, à la fin ou aux deux bouts. Trait plein ou pointillé. Épaisseur de 1 à 8 par pas de 0,5. Couleur prise dans la palette.
- [ ] Étiquette : double-clic sur la flèche ou sur son étiquette, ou bouton « Edit arrow label ». Taille du texte 8–48, et rotation par pas de 15°.
- [ ] L'étiquette se **glisse** : elle coulisse le long du tracé et peut être écartée sur le côté. Une poignée règle sa largeur, et « Reset label » la remet au milieu, à sa largeur automatique. Ces réglages remplacent les quatre boutons de position de l'original.
- [ ] L'étiquette a un fond qui masque le trait sous elle, et elle reste lisible dans les deux thèmes.
- [ ] Le style s'applique à toutes les flèches sélectionnées.
- [ ] Tests unitaires : position d'une étiquette à une fraction du tracé, avec son décalage, sur chaque mode de tracé.
- [ ] Test navigateur : une flèche en pointillé, double pointe, épaisseur 3, avec une étiquette déplacée, retrouvée après un rechargement.
