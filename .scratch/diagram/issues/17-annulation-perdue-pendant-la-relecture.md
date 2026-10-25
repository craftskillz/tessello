# 17: Une annulation faite pendant que la Vue relit le diagramme est perdue

Spec parente : `.scratch/diagram/spec.md`. Trouvé par le ticket 06 de `.scratch/e2e-reliability/` (déplacer les tests de Diagram), qui corrige les tests et non le Module.

**Status:** needs-triage

**Blocked by:** Aucun.

**Constat :** Quand la Vue est montrée de nouveau, elle relit les diagrammes (`load()`, `src/lib/store.svelte.ts`). Si l'Utilisateur annule (Ctrl/Cmd+Z), ou fait une autre modification, pendant cette relecture, sa modification est perdue : rien n'est écrit, l'écran revient au diagramme stocké, et l'historique repart de zéro.

**Reproduire :** `E2E_CPU_SLOWDOWN=4`, le test « undoes a move, a waypoint and a rename… » de `../tessello-diagram/e2e/diagrams.test.ts`, sans l'appel `answered(...)` autour de `setVisible(false)` / `setVisible(true)` : échoue 3 fois sur 3 (« Waited … for the change to be written »). Le test attend désormais la fin de la relecture avant Ctrl+Z.

**Cause probable :** `read()` décide qu'il n'y a rien d'écrit en attente (`status.saving` vaut 0) après avoir lu la liste, puis lit le diagramme. La modification arrive entre les deux : elle change `diagrams.open` et met son écriture en file. `show()` remplace ensuite `diagrams.open` par le diagramme lu, qui n'est plus le présent de l'historique : l'historique repart, et l'écriture en file écrit le diagramme relu.

- [ ] Une modification faite pendant la relecture est gardée à l'écran, écrite, et reste annulable.
- [ ] Test navigateur dans `../tessello-diagram/e2e/` qui la fait pendant la relecture (sans `answered`), et échoue sans la correction.

## Comments
