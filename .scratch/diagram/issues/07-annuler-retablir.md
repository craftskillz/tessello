# 07: Annuler et rétablir

Spec parente : `.scratch/diagram/spec.md`. Vocabulaire : `GLOSSARY.md`. Contrat : la Convention. Rétrodoc : `/Users/ymedaghri/Documents/testRetrodocLivingDocByClaude/features/diagrams.md`.

**What to build:** Ctrl/Cmd+Z et Ctrl/Cmd+Maj+Z annulent et rétablissent **toute** modification du diagramme. L'original oubliait l'identité des formes personnalisées, le placement de leur texte, la position et la largeur des étiquettes, le titre, la grille et les guides (Q-015).

**Blocked by:** 06 (Groupes, verrous…)

**Status:** resolved

- [x] Chaque geste terminé (le même événement qui déclenche l'enregistrement) crée une étape. Un glisser ne crée qu'une étape, et non une par image d'animation.
- [x] Sont couverts : formes, flèches, extrémités et points de passage, styles, étiquettes, groupes, verrous, ordre, titre, grille et guides. Ne sont pas couverts : la sélection, le zoom et la position de la vue.
- [x] Il y a 100 étapes au plus par diagramme. L'historique repart de zéro à l'ouverture d'un diagramme. Une annulation est enregistrée comme toute modification.
- [x] Les raccourcis restent ceux de l'édition de texte quand un champ a le focus.
- [x] Les tickets suivants (08 et au-delà) ajoutent leurs propres modifications à l'historique.
- [x] Tests unitaires : pile d'annulation (limite, branche abandonnée après une nouvelle modification), et restitution complète d'un diagramme qui contient chaque type d'élément.
- [x] Test navigateur : déplacer une forme, ajouter un point de passage, renommer le diagramme, puis tout annuler, tout rétablir, et recharger.

## Comments

### Implémentation (2026-10-21)

- **Historique** (`src/lib/history.ts`) : `startHistory`, `record`, `undo` et `redo`. Une étape tient tout le contenu du diagramme en JSON, sauf son id et `updatedAt` : les formes et flèches avec toutes leurs valeurs, l'ordre, le titre, la grille et les guides, et tout ce qu'un ticket suivant y ajoutera. Au-delà de 100 étapes, la plus ancienne est oubliée ; une nouvelle modification abandonne ce qui avait été annulé.
- **Store** (`src/lib/store.svelte.ts`) : `save()`, appelé à la fin de chaque geste, enregistre l'étape. Les tickets 08 et suivants passent donc dans l'historique sans rien faire de plus. `undo()` et `redo()` restaurent le diagramme puis l'enregistrent comme toute modification, et retirent de la sélection ce qui n'existe plus. L'historique repart de zéro à l'ouverture, à la création et à la suppression d'un diagramme.
- **Vue** : `Canvas.svelte` gère Ctrl/Cmd+Z et Ctrl/Cmd+Maj+Z. Ces raccourcis sont laissés au champ qui a le focus et au texte en cours d'édition, et ignorés au milieu d'un geste. Le Guide les décrit.
- **Tests** : `test/history.test.ts` (annuler, rétablir, branche abandonnée, sauvegarde sans changement, limite de 100, restitution complète avec chaque type de forme, reprise d'un diagramme relu inchangé, champ en trop retiré). Deux tests navigateur : déplacement, point de passage et renommage annulés un à un, rétablis, encore annulables après que la page a été cachée puis montrée, puis retrouvés après rechargement ; Ctrl+Z dans le champ du titre.

**Choix** :
  - Un enregistrement qui ne change rien n'est pas une étape, ce qui évite que l'enregistrement d'une annulation n'en crée une.
  - Quand la Vue redevient visible, elle relit le diagramme. S'il est inchangé, il garde son historique. S'il a changé entre-temps, son historique repart de zéro, pour qu'une annulation n'écrase jamais une modification faite ailleurs. Un clic sur le Lanceur démarre une nouvelle Vue, donc un nouvel historique.
  - Une restitution retire du diagramme les champs que l'étape ne contenait pas, au cas où un ticket suivant ajouterait un champ facultatif.
  - Ni Ctrl+Y ni bouton : le ticket ne demande que les deux raccourcis.
