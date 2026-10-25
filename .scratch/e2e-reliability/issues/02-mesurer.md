# 02 : Mesurer : durées par fichier, tests instables, machine ralentie

**Status:** ready-for-agent

**Blocked by:** Aucun (peut commencer immédiatement).

Spec parente : [des tests navigateur rapides et fiables](../spec.md), section « Règles communes ».

**What to build:** Le Mainteneur et les tickets suivants disposent de chiffres : la durée de chaque fichier de tests navigateur, et pour chaque test, combien de fois il échoue sur plusieurs passages, sur une machine normale puis ralentie. Ils servent de point de départ, et à montrer à la fin ce que le déplacement des tests a changé.

## Critères d'acceptation

- [ ] Avec la variable d'environnement `E2E_CPU_SLOWDOWN` (par exemple `4`), `useHost().newPage()` de `e2e/browser.ts` ralentit le processeur de chaque page (CDP `Emulation.setCPUThrottlingRate`). Sans elle, rien ne change. Elle est documentée dans l'en-tête de `browser.ts` et dans `README.md`, à côté de `HEADED=1`.
- [ ] `just e2e-repeat N [fichiers…]` répète la suite, ou certains fichiers, N fois. Il produit un résumé : durée par fichier (médiane, maximum), et chaque test qui a échoué au moins une fois, avec son nombre d'échecs et son premier message d'erreur. Le traitement se fait dans un script de `scripts/` qui lit la sortie du reporter `node:test`.
- [ ] `.scratch/e2e-reliability/mesures.md` consigne au moins 3 passages de la suite complète sans ralentissement et 3 avec `E2E_CPU_SLOWDOWN=4`, avec la machine, les versions de Node et de Chromium, et la date. Il dit si les 4 échecs de la CI (spec, « Problème ») se reproduisent en local avec ralentissement, et liste les autres tests instables trouvés.
- [ ] Aucun test n'est modifié dans ce ticket.
