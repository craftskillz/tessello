# 13: Hôte : autoriser les téléchargements demandés par une Vue

Spec parente : `.scratch/diagram/spec.md` (« Exports »). Vocabulaire : `GLOSSARY.md`. Contrat : la Convention.

**What to build:** Le bac à sable des iframes (`IFRAME_SANDBOX`, `packages/host/src/srcdoc.ts`) ne permet aucun téléchargement. Une Vue ne peut donc pas remettre un fichier à l'Utilisateur, ni un export `.drawio` ni un PNG. Le presse-papiers d'images est lui aussi refusé (constaté au ticket 15 de tessello-v1). L'Hôte ajoute `allow-downloads` aux iframes des Vues, et la Convention le documente. Il s'agit d'une révision mineure, puisqu'elle ajoute une capacité sans rien retirer.

**Blocked by:** aucun

**Status:** resolved

- [x] Les iframes des **Vues** reçoivent `allow-downloads`. Celles des Widgets ne le reçoivent pas : un Widget est un aperçu, et un téléchargement doit venir d'un geste dans la Vue. À confirmer pendant l'implémentation, sinon à justifier dans un ADR.
- [x] La Convention (§4) indique qu'une Vue peut proposer un fichier à télécharger (lien `download` vers un `blob:` ou un `data:` URL, à la suite d'un geste de l'Utilisateur), et qu'un Widget ne le peut pas. Le Validateur n'a rien à changer, sauf avis contraire à justifier.
- [x] Un ADR consigne la décision : pas de Permission, car télécharger un fichier que l'Utilisateur vient de demander ne lui donne aucun accès nouveau. Il consigne aussi l'alternative écartée (une Permission `downloads`), et la vérification qu'un `blob:` créé dans une origine opaque se télécharge bien dans Chromium.
- [x] Test navigateur : un Module d'essai télécharge un fichier depuis sa Vue (événement `download` de Playwright, contenu vérifié).

## Comments

- Deux constantes remplacent `IFRAME_SANDBOX` : `WIDGET_SANDBOX` (inchangé) et `VIEW_SANDBOX` (le même, plus `allow-downloads`). Décision consignée dans l'ADR 0013.
- Le test vérifie aussi un `data:` URL, puisque la Convention le cite à côté du `blob:`.
- Le §12 de la Convention range désormais les capacités de l'environnement d'exécution (§4) parmi les révisions mineures, pour que cette révision le soit au sens du texte.
- Le Validateur ne change pas : il ne peut pas savoir statiquement si un lien `download` est créé dans une Vue ou dans un Widget.
- Le presse-papiers d'images reste refusé : `allow-downloads` n'y change rien.
