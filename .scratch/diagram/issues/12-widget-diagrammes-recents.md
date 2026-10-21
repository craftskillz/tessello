# 12: Widget M : diagrammes récents

Spec parente : `.scratch/diagram/spec.md`. Vocabulaire : `GLOSSARY.md`. Contrat : la Convention. Rétrodoc : `/Users/ymedaghri/Documents/testRetrodocLivingDocByClaude/features/diagrams.md`.

**What to build:** Le Widget du Module, de taille M (2 × 1), liste les diagrammes récemment modifiés et ouvre la Vue sur l'un d'eux.

**Blocked by:** 01 (Squelette)

**Status:** resolved

- [x] Le Widget affiche les 3 ou 4 diagrammes modifiés le plus récemment (titre et date relative), lus dans la clé `diagrams`. S'il n'y en a aucun, il affiche un message et le bouton « + New ».
- [x] Un clic sur un diagramme ouvre la Vue sur lui (`navigation.openView` avec `params: { id }`). « + New » ouvre la Vue avec `params: { new: true }`, et la Vue crée alors un diagramme.
- [x] Le Widget relit le stockage quand il redevient visible, ne défile pas et s'adapte à sa cellule (§7.1).
- [x] Test navigateur : le Widget affiche un diagramme créé dans la Vue, puis l'ouvre.

## Comments

- Les params de navigation ne portent que des chaînes (Convention §6.3, `Record<string, string>` dans le SDK) : « + New » envoie donc `params: { new: "true" }`.
- Le Widget liste les 4 diagrammes modifiés le plus récemment ; « + New » et « Open ↗ » sont toujours dans son en-tête, pas seulement quand la liste est vide.
- La Vue relit désormais le stockage après les écritures déjà en file, et garde à l'écran un diagramme dont l'écriture est encore en cours : sinon, la relecture déclenchée par le retour de la Vue effaçait le diagramme que « + New » venait de créer.
