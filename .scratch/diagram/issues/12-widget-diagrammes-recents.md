# 12: Widget M : diagrammes récents

Spec parente : `.scratch/diagram/spec.md`. Vocabulaire : `GLOSSARY.md`. Contrat : la Convention. Rétrodoc : `/Users/ymedaghri/Documents/testRetrodocLivingDocByClaude/features/diagrams.md`.

**What to build:** Le Widget du Module, de taille M (2 × 1), liste les diagrammes récemment modifiés et ouvre la Vue sur l'un d'eux.

**Blocked by:** 01 (Squelette)

**Status:** ready-for-agent

- [ ] Le Widget affiche les 3 ou 4 diagrammes modifiés le plus récemment (titre et date relative), lus dans la clé `diagrams`. S'il n'y en a aucun, il affiche un message et le bouton « + New ».
- [ ] Un clic sur un diagramme ouvre la Vue sur lui (`navigation.openView` avec `params: { id }`). « + New » ouvre la Vue avec `params: { new: true }`, et la Vue crée alors un diagramme.
- [ ] Le Widget relit le stockage quand il redevient visible, ne défile pas et s'adapte à sa cellule (§7.1).
- [ ] Test navigateur : le Widget affiche un diagramme créé dans la Vue, puis l'ouvre.
