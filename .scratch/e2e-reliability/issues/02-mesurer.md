# 02 : Mesurer : durées par fichier, tests instables, machine ralentie

**Status:** resolved

**Blocked by:** Aucun (peut commencer immédiatement).

Spec parente : [des tests navigateur rapides et fiables](../spec.md), section « Règles communes ».

**What to build:** Le Mainteneur et les tickets suivants disposent de chiffres : la durée de chaque fichier de tests navigateur, et pour chaque test, combien de fois il échoue sur plusieurs passages, sur une machine normale puis ralentie. Ils servent de point de départ, et à montrer à la fin ce que le déplacement des tests a changé.

## Critères d'acceptation

- [x] Avec la variable d'environnement `E2E_CPU_SLOWDOWN` (par exemple `4`), `useHost().newPage()` de `e2e/browser.ts` ralentit le processeur de chaque page (CDP `Emulation.setCPUThrottlingRate`). Sans elle, rien ne change. Elle est documentée dans l'en-tête de `browser.ts` et dans `README.md`, à côté de `HEADED=1`.
- [x] `just e2e-repeat N [fichiers…]` répète la suite, ou certains fichiers, N fois. Il produit un résumé : durée par fichier (médiane, maximum), et chaque test qui a échoué au moins une fois, avec son nombre d'échecs et son premier message d'erreur. Le traitement se fait dans un script de `scripts/` qui lit la sortie du reporter `node:test`.
- [x] `.scratch/e2e-reliability/mesures.md` consigne au moins 3 passages de la suite complète sans ralentissement et 3 avec `E2E_CPU_SLOWDOWN=4`, avec la machine, les versions de Node et de Chromium, et la date. Il dit si les 4 échecs de la CI (spec, « Problème ») se reproduisent en local avec ralentissement, et liste les autres tests instables trouvés.
- [x] Aucun test n'est modifié dans ce ticket.

## Comments

**2026-10-25, implémentation.** `E2E_CPU_SLOWDOWN` est lu une fois par fichier, avant le lancement de Chromium : une valeur qui n'est pas un nombre ≥ 1 arrête le fichier avec un message. Les iframes des Modules (`sandbox` sans `allow-same-origin`) tournent dans le processus de la page sous Chromium 156, et sont donc ralenties aussi ; vérifié en chronométrant une boucle dans la page et dans une telle iframe (×3,7 pour les deux).

`just e2e-repeat N [noms…]` s'appuie sur `packages/host/scripts/e2e-repeat.ts`, à côté des autres scripts de l'Hôte, pour que son test unitaire (`packages/host/test/e2e-repeat.test.ts`) tourne dans `npm test`. Il lance chaque fichier avec `run()` de `node:test` (pour le chronométrer seul), affiche la progression avec le reporter `spec`, et lit les événements du reporter. Une suite qui échoue parce qu'un de ses tests échoue, ou un test arrêté par un hook en échec, ne compte pas : seul l'échec d'origine compte. Le résumé est en Markdown, avec la machine et les versions.

Résultats dans [mesures.md](../mesures.md) : 4 min 36 normal, 21 min 23 ralenti ×4. Seul `watch-later.test.ts:590` des 4 échecs de la CI se reproduit (1/3, sans ralentissement). Ralenti, `diagram.test.ts:1489` échoue 3 fois sur 3.
