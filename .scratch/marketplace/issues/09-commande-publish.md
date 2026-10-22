# 09: Commande `tessello publish`

Spec parente : `.scratch/marketplace/spec.md`. Vocabulaire : `GLOSSARY.md`. Décisions : ADR 0014 à 0018. Contrat : la Convention.

**What to build:** Un Créateur lance `tessello publish <paquet.zip> --url <URL>` : le CLI prépare ou met à jour la fiche et ouvre la pull request.

**Blocked by:** 03

**Status:** ready-for-agent

- [ ] Le CLI valide le paquet, calcule l'empreinte, vérifie que l'URL sert bien les mêmes octets avec les en-têtes CORS, et écrit ou complète `entry.json`.
- [ ] Il ouvre la pull request par `gh` (fork du dépôt de la Marketplace si besoin), sans aucun serveur de Tessello. Sans `gh`, il écrit la fiche et dit quoi faire.
- [ ] Il lance le Vérificateur en local avant d'ouvrir la pull request, pour échouer tôt.
- [ ] La skill de création et `PUBLISHING.md` mentionnent la commande.
- [ ] Tests du CLI : dossier temporaire et serveur local pour l'URL, `gh` simulé.
