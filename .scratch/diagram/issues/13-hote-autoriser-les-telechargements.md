# 13: Hôte : autoriser les téléchargements demandés par une Vue

Spec parente : `.scratch/diagram/spec.md` (« Exports »). Vocabulaire : `GLOSSARY.md`. Contrat : la Convention.

**What to build:** Le bac à sable des iframes (`IFRAME_SANDBOX`, `packages/host/src/srcdoc.ts`) ne permet aucun téléchargement. Une Vue ne peut donc pas remettre un fichier à l'Utilisateur, ni un export `.drawio` ni un PNG. Le presse-papiers d'images est lui aussi refusé (constaté au ticket 15 de tessello-v1). L'Hôte ajoute `allow-downloads` aux iframes des Vues, et la Convention le documente. Il s'agit d'une révision mineure, puisqu'elle ajoute une capacité sans rien retirer.

**Blocked by:** aucun

**Status:** ready-for-agent

- [ ] Les iframes des **Vues** reçoivent `allow-downloads`. Celles des Widgets ne le reçoivent pas : un Widget est un aperçu, et un téléchargement doit venir d'un geste dans la Vue. À confirmer pendant l'implémentation, sinon à justifier dans un ADR.
- [ ] La Convention (§4) indique qu'une Vue peut proposer un fichier à télécharger (lien `download` vers un `blob:` ou un `data:` URL, à la suite d'un geste de l'Utilisateur), et qu'un Widget ne le peut pas. Le Validateur n'a rien à changer, sauf avis contraire à justifier.
- [ ] Un ADR consigne la décision : pas de Permission, car télécharger un fichier que l'Utilisateur vient de demander ne lui donne aucun accès nouveau. Il consigne aussi l'alternative écartée (une Permission `downloads`), et la vérification qu'un `blob:` créé dans une origine opaque se télécharge bien dans Chromium.
- [ ] Test navigateur : un Module d'essai télécharge un fichier depuis sa Vue (événement `download` de Playwright, contenu vérifié).
