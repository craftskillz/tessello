# 10 : Les tests de l'Hôte qui restent : une seule façon d'attendre

**Status:** ready-for-agent

**Blocked by:** 02 — Mesurer ; 06, 07, 08, 09 — les tests des Modules déplacés.

Spec parente : [des tests navigateur rapides et fiables](../spec.md), section « Règles communes ».

**What to build:** Les tests navigateur qui restent dans `packages/host/e2e/` attendent tous un état observable, par un seul utilitaire, et passent de façon répétée sur une machine ralentie. L'échec CI de `home.test.ts:95` (événement `filechooser` jamais reçu) disparaît, ainsi que ceux relevés dans `mesures.md` pour les fichiers restants.

## Critères d'acceptation

- [ ] `e2e/browser.ts` utilise l'utilitaire d'attente du SDK (ticket 04), ou en exporte un de même contrat : il réessaie jusqu'à une échéance commune, plus longue en CI (`process.env.CI`) ou avec `E2E_CPU_SLOWDOWN`, et une exception compte comme « pas encore ». `readFolder` et les lectures du Dossier des Modules qui attendent une écriture passent par lui.
- [ ] Il ne reste aucun `setTimeout` ni `waitForTimeout` d'attente dans `packages/host/e2e/`. Une durée simulée volontairement (horloge, délai d'un serveur de test) reste, avec un commentaire qui le dit.
- [ ] Pour `home.test.ts:95` et chaque autre test instable de `mesures.md` encore présent, la cause est établie et notée dans `mesures.md` (ce qui n'était pas prêt), puis le test attend cet état. Si la cause est un défaut de l'Hôte, un ticket est ouvert, et le test n'est pas affaibli.
- [ ] La suite navigateur complète de ce dépôt passe 5 fois de suite, dont 3 avec `E2E_CPU_SLOWDOWN=4`. Sa durée locale et en CI, avant et après la spec, est ajoutée à `mesures.md`, avec une recommandation : faire tourner les fichiers en parallèle vaut-il encore la peine ?
- [ ] Si la suite complète est devenue rapide et fiable, le ticket propose (sans le faire) de la remettre comme condition du déploiement, dans `deploy-host.yml` (ticket 01).
