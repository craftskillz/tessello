# 17: Une annulation faite pendant que la Vue relit le diagramme est perdue

Spec parente : `.scratch/diagram/spec.md`. Trouvé par le ticket 06 de `.scratch/e2e-reliability/` (déplacer les tests de Diagram), qui corrige les tests et non le Module.

**Status:** resolved

**Blocked by:** Aucun.

**Constat :** Quand la Vue est montrée de nouveau, elle relit les diagrammes (`load()`, `src/lib/store.svelte.ts`). Si l'Utilisateur annule (Ctrl/Cmd+Z), ou fait une autre modification, pendant cette relecture, sa modification est perdue : rien n'est écrit, l'écran revient au diagramme stocké, et l'historique repart de zéro.

**Reproduire :** `E2E_CPU_SLOWDOWN=4`, le test « undoes a move, a waypoint and a rename… » de `../tessello-diagram/e2e/diagrams.test.ts`, sans l'appel `answered(...)` autour de `setVisible(false)` / `setVisible(true)` : échoue 3 fois sur 3 (« Waited … for the change to be written »). Le test attend désormais la fin de la relecture avant Ctrl+Z.

**Cause probable :** `read()` décide qu'il n'y a rien d'écrit en attente (`status.saving` vaut 0) après avoir lu la liste, puis lit le diagramme. La modification arrive entre les deux : elle change `diagrams.open` et met son écriture en file. `show()` remplace ensuite `diagrams.open` par le diagramme lu, qui n'est plus le présent de l'historique : l'historique repart, et l'écriture en file écrit le diagramme relu.

- [x] Une modification faite pendant la relecture est gardée à l'écran, écrite, et reste annulable.
- [x] Test navigateur dans `../tessello-diagram/e2e/` qui la fait pendant la relecture (sans `answered`), et échoue sans la correction.

## Comments

- 2026-10-30 : réalisé dans `tessello-diagram` (979f670). `read()` (`src/lib/store.svelte.ts`) fait toutes ses lectures d'abord (liste, bibliothèques, valeurs par défaut, puis le diagramme à ouvrir), puis décide sans plus rien attendre : une modification faite pendant la relecture a déjà mis son écriture en file (`status.saving`), le diagramme à l'écran est donc gardé avec son historique. Le choix du diagramme à ouvrir est extrait en `toOpen(list, asked)`. Un diagramme ouvert depuis la liste pendant la relecture reste ouvert : le diagramme lu n'est montré que s'il est encore celui à ouvrir. Test navigateur « an undo made while the View reads the diagrams again… » (`e2e/diagrams.test.ts`) : l'aide `holdingRead` (`e2e/diagram.ts`) retient dans la page la demande de lecture d'un `diagram:*` jusqu'à ce que le test la libère. Le test échoue sans la correction (« Waited 5000 ms for the change to be written », à la deuxième annulation) et passe avec. 487 tests unitaires et 86 tests navigateur verts, typage sans erreur.
- 2026-10-30 : relecture à deux axes. Standards : aucune violation ; l'expression du diagramme à ouvrir, dupliquée, a été extraite en `toOpen` avant le commit. Restent des jugements : le transtypage de `window.__holdRead` répété dans `holdingRead`, et le script `HOLD_READ` dense ; la course pourrait être prouvée par un test unitaire de `load` si le store en avait. Spec : critères remplis ; le test couvre une annulation, pas une modification ordinaire (même chemin dans le store) ; la fenêtre où un diagramme ouvert pendant la lecture était remplacé par le diagramme lu a été fermée avant le commit.
