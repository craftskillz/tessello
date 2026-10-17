# 07: Mise à jour et désinstallation

Spec parente : `.scratch/tessello-v1/spec.md`. Vocabulaire : `GLOSSARY.md`. Contrat : la Convention.

**What to build:** L'Utilisateur met à jour un Module en installant sa nouvelle version, sans perdre ses données ni accorder d'accès à son insu, et peut désinstaller un Module proprement (ADR 0003 et 0004).

**Blocked by:** 06 (Permissions : accord à l'installation et blocage réel)

**Status:** ready-for-agent

- [ ] Installer un paquet dont l'Identifiant est déjà installé est présenté comme une mise à jour, avec le nom et la version installés et entrants, et demande une confirmation.
- [ ] Une mise à jour remplace le code du Module et conserve son stockage.
- [ ] Si la nouvelle version déclare des Permissions supplémentaires, seules celles-ci sont présentées et un nouvel accord est demandé ; en cas de refus, la version installée reste intacte.
- [ ] La désinstallation demande confirmation, puis supprime le Module et son stockage.
- [ ] Le Lanceur et l'Accueil reflètent immédiatement chaque installation, mise à jour et désinstallation.
- [ ] Ces parcours sont couverts au point d'entrée C (règles) et par au moins un test navigateur (mise à jour avec nouvelle Permission).
