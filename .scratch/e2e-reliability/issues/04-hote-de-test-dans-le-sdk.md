# 04 : Un Hôte de test dans le SDK

**Status:** ready-for-agent

**Blocked by:** 03 — Audit (sa liste des besoins de chaque Module).

Spec parente : [des tests navigateur rapides et fiables](../spec.md), section « Résultat attendu », niveau 3.

**What to build:** Un Créateur teste la Vue ou le Widget de son Module dans un navigateur sans Hôte. Sa page se connecte, comme d'habitude avec `connect()` du SDK, à un **Hôte de test** en mémoire, que le test prépare et inspecte : stockage de départ, thème, langue, visibilité, navigation. C'est ce que les tickets 06 à 09 utilisent pour les tests « navigateur du Module » de l'audit.

## Critères d'acceptation

- [ ] `@tessello/sdk` expose l'Hôte de test sur un point d'entrée séparé (par exemple `@tessello/sdk/testing`), absent du code d'un Module en production. Il s'appuie sur le `transport` déjà injectable de `connect()` (`ConnectOptions`) et répond au protocole de la Convention (§6). Il réutilise si possible le protocole et le stockage de `@tessello/host-core`, pour que ses réponses (erreurs et limites de taille comprises) soient celles du vrai Hôte.
- [ ] Le test peut : fixer le contexte (surface, Module, langue, thème) ; pré-remplir le stockage et le relire, ou attendre qu'une clé soit écrite ; changer le thème et la visibilité ; recevoir les `openView` avec leurs paramètres et envoyer des paramètres de navigation ; faire échouer une écriture pour tester le message « ne peut pas être enregistré ». La liste couvre les besoins notés dans l'audit ; un besoin non couvert est signalé dans le ticket, pas ignoré.
- [ ] Il fournit l'utilitaire d'attente de la spec (« Règles communes »), avec son échéance réglable et `E2E_CPU_SLOWDOWN`, pour que chaque Module n'ait pas à le réécrire.
- [ ] Un exemple court montre comment une suite navigateur de Module l'utilise avec `playwright` et `node:test` : servir le `dist/` du Module, ouvrir sa Vue ou son Widget, brancher l'Hôte de test. Il est testé dans ce dépôt sur un Module d'exemple de `examples/`.
- [ ] Les tests unitaires de l'Hôte de test passent avec `npm test`, et compilés et empaquetés avec `just packages`. Le README du SDK le documente. Une ADR consigne la décision : un Hôte de test public dans le SDK, ce qu'il garantit (même protocole et mêmes limites que l'Hôte) et ce qu'il ne garantit pas (pas de sandbox, de CSP ni de Permissions : les tests de contrat de l'Hôte s'en chargent).
- [ ] Le numéro de version du SDK est augmenté. La publication sur npm (`just npm-publish`) est faite par le Mainteneur.
