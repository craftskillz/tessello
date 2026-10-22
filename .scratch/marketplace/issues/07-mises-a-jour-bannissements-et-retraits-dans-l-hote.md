# 07: Mises à jour, Bannissements et Retraits dans l'Hôte

Spec parente : `.scratch/marketplace/spec.md`. Vocabulaire : `GLOSSARY.md`. Décisions : ADR 0014 à 0018. Contrat : la Convention.

**What to build:** Pour les Modules venus de la Marketplace, l'Hôte propose les nouvelles versions et signale les Bannissements et les Retraits, sans jamais agir de lui-même (ADR 0018).

**Blocked by:** 04, 06

**Status:** ready-for-agent

- [ ] Au démarrage, l'Hôte relit l'index au plus une fois par jour.
- [ ] Une version plus récente donne un badge « mise à jour » dans le Lanceur ; un clic lance le parcours existant (empreinte, Validateur, écran de différence des Permissions). Rien ne se met à jour sans ce clic.
- [ ] Un Module ou une version bannis donnent un badge d'avertissement dans le Lanceur et sur le Widget ; l'avertissement donne la raison, propose de désinstaller et, pour une version bannie, recommande la plus récente si elle existe. Le Module continue de fonctionner.
- [ ] Un Retrait donne une note neutre, distincte de l'avertissement.
- [ ] Aucun signal pour un Module sans provenance `marketplace`.
- [ ] Textes en anglais et en français.
- [ ] Tests unitaires (cœur) : une interrogation par jour, mise à jour proposée, Bannissement de version, de Module et d'Espace de noms, Retrait, Module local ignoré. Tests navigateur : mettre à jour depuis le badge, voir l'avertissement de Bannissement.
