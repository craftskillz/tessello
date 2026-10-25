# 07 : Skills Library : déplacer ses tests

**Status:** ready-for-agent

**Blocked by:** 02 — Mesurer ; 04 — Un Hôte de test dans le SDK ; 05 — Les tests de contrat des Modules dans l'Hôte.

Spec parente : [des tests navigateur rapides et fiables](../spec.md). Table de référence : `.scratch/e2e-reliability/audit.md`, section Skills Library.

**What to build:** Les 54 tests navigateur de `packages/host/e2e/skills-library.test.ts` quittent ce dépôt selon l'audit. Ses règles sont prouvées dans `../tessello-skills-library` par des tests unitaires, ou par une petite suite navigateur contre l'Hôte de test. Il ne reste ici que ses tests de contrat (ticket 05), et ceux que l'audit classe « Hôte ».

Notes pour ce Module : L'import depuis GitHub simule aujourd'hui l'API dans le test navigateur : la logique (`github`, `changes`) se teste en unitaire, et la suite navigateur n'en garde que l'affichage. Le radar et son panneau de survol (souris, clavier, toucher, 360 px) relèvent de sa suite navigateur, avec `panel-position` en unitaire. L'échec CI `skills-library.test.ts:1146` est à reproduire dans la nouvelle suite : s'il vient du Module (panneau qui ne se ferme pas quand le pointeur quitte vite), il fait l'objet de son propre ticket, et le test n'est pas affaibli.

## Critères d'acceptation

- [ ] Dans `../tessello-skills-library` : chaque ligne « unitaire » de l'audit a son test unitaire dans `test/`. Chaque ligne « navigateur du Module » a son test dans une suite navigateur du Module (par exemple `e2e/`, lancée par `npm run test:browser` et `just e2e`), qui sert le `dist/` du Module et utilise l'Hôte de test du SDK (ticket 04) et son utilitaire d'attente. Le README du Module dit comment la lancer. Les sources du Module ne changent pas.
- [ ] **Pas de perte de couverture :** pour chaque nouveau test, on casse volontairement, une fois, le comportement qu'il protège dans le code du Module, on le voit échouer, puis on annule. Le résultat (test, modification faite, échec observé) est noté dans `audit.md`, en face de la ligne. Une ligne « déjà couvert » est vérifiée de la même façon sur le test cité.
- [ ] Le workflow de CI du Module (s'il y en a un, sinon un nouveau) lance ses tests unitaires et sa suite navigateur à chaque push. `just publish` du Module les lance aussi avant de publier.
- [ ] Dans ce dépôt : les tests déplacés sont supprimés de `packages/host/e2e/skills-library.test.ts`, ou le fichier entier s'il n'y reste rien, avec les utilitaires qui ne servent plus. Les tests de contrat et les tests « Hôte » restent.
- [ ] La suite navigateur du Module passe 3 fois de suite avec `E2E_CPU_SLOWDOWN=4`. La suite navigateur de ce dépôt passe toujours. Les durées avant et après, des deux côtés, sont ajoutées à `mesures.md`.
- [ ] Pousser `craftskillz/tessello-skills-library` demande l'accord du Mainteneur : le ticket se termine avec des commits locaux dans les deux dépôts, et la liste de ce qu'il reste à pousser.
