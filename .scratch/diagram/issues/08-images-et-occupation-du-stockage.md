# 08: Images et occupation du stockage

Spec parente : `.scratch/diagram/spec.md`. Vocabulaire : `GLOSSARY.md`. Contrat : la Convention. Rétrodoc : `/Users/ymedaghri/Documents/testRetrodocLivingDocByClaude/features/diagrams.md`.

**What to build:** L'Utilisateur insère une image, choisie ou collée, avec sa légende (parcours 8). L'image est rangée dans le stockage du Module, réduite et identifiée par son hash, puisqu'il n'y a plus de dossier `images/` côté serveur. La Vue affiche l'occupation du stockage.

**Blocked by:** 02 (Toutes les formes intégrées)

**Status:** ready-for-agent

- [ ] Outil Image : un double-clic sur le canevas ouvre le sélecteur de fichier (`image/*`). Ctrl/Cmd+V avec une image dans le presse-papiers système la pose au centre de la vue.
- [ ] L'image est réduite (côté le plus long : 1600 px au plus), puis réencodée en WebP, ou en PNG si elle a de la transparence. Un SVG est gardé tel quel. La clé est `image:<sha256>`, et une image déjà présente n'est pas réécrite.
- [ ] Une image qui dépasse encore environ 900 Ko, ou qui ferait dépasser le quota, est refusée avec un message clair. Aucune forme n'est alors créée.
- [ ] L'image est posée avec une légende en Texte libre, et les deux forment un groupe. La boîte de dialogue « Image name » de l'original est supprimée : la légende reprend le nom du fichier sans son extension, ou « image » pour un collage, et se modifie comme tout texte. Cela règle aussi le texte figé en français et l'écrasement d'images de même nom (Q-011).
- [ ] Une image n'est supprimée du stockage que lorsque plus aucun diagramme ni aucune forme personnalisée ne s'en sert. Ce nettoyage a lieu après une suppression et au démarrage.
- [ ] Une jauge « Storage: x.x MB / 5 MB » est visible dans la Vue, et elle passe en alerte au-delà de 80 %.
- [ ] Une forme dont l'image manque affiche un cadre « missing image » au lieu de casser le rendu.
- [ ] Tests unitaires : calcul de l'occupation (octets UTF-8 de la clé et de la valeur, comme §6.1) et recherche des images inutilisées.
- [ ] Tests navigateur : insérer une image choisie, la retrouver après un rechargement, la supprimer et constater que la clé disparaît ; une image trop lourde est refusée.
