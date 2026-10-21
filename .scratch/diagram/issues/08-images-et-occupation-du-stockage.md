# 08: Images et occupation du stockage

Spec parente : `.scratch/diagram/spec.md`. Vocabulaire : `GLOSSARY.md`. Contrat : la Convention. Rétrodoc : `/Users/ymedaghri/Documents/testRetrodocLivingDocByClaude/features/diagrams.md`.

**What to build:** L'Utilisateur insère une image, choisie ou collée, avec sa légende (parcours 8). L'image est rangée dans le stockage du Module, réduite et identifiée par son hash, puisqu'il n'y a plus de dossier `images/` côté serveur. La Vue affiche l'occupation du stockage.

**Blocked by:** 02 (Toutes les formes intégrées)

**Status:** resolved

- [x] Outil Image : un double-clic sur le canevas ouvre le sélecteur de fichier (`image/*`). Ctrl/Cmd+V avec une image dans le presse-papiers système la pose au centre de la vue.
- [x] L'image est réduite (côté le plus long : 1600 px au plus), puis réencodée en WebP, ou en PNG si elle a de la transparence. Un SVG est gardé tel quel. La clé est `image:<sha256>`, et une image déjà présente n'est pas réécrite.
- [x] Une image qui dépasse encore environ 900 Ko, ou qui ferait dépasser le quota, est refusée avec un message clair. Aucune forme n'est alors créée.
- [x] L'image est posée avec une légende en Texte libre, et les deux forment un groupe. La boîte de dialogue « Image name » de l'original est supprimée : la légende reprend le nom du fichier sans son extension, ou « image » pour un collage, et se modifie comme tout texte. Cela règle aussi le texte figé en français et l'écrasement d'images de même nom (Q-011).
- [x] Une image n'est supprimée du stockage que lorsque plus aucun diagramme ni aucune forme personnalisée ne s'en sert. Ce nettoyage a lieu après une suppression et au démarrage.
- [x] Une jauge « Storage: x.x MB / 5 MB » est visible dans la Vue, et elle passe en alerte au-delà de 80 %.
- [x] Une forme dont l'image manque affiche un cadre « missing image » au lieu de casser le rendu.
- [x] Tests unitaires : calcul de l'occupation (octets UTF-8 de la clé et de la valeur, comme §6.1) et recherche des images inutilisées.
- [x] Tests navigateur : insérer une image choisie, la retrouver après un rechargement, la supprimer et constater que la clé disparaît ; une image trop lourde est refusée.

## Comments

### Implémentation (2026-10-21)

- **Images** (`src/lib/images.ts`, fonctions pures) : `fittedSize` (réduction à 1600 px, sans agrandir), `captionOf` (nom du fichier sans extension, ou « image »), `placeImage` (l'image, 320 au plus, et sa légende en Texte libre dessous, en un groupe), `imagesIn`, `dropsImage` et `unusedImages`. Une image est référencée par le champ `imageKey`, à toute profondeur d'une valeur stockée : le ticket 09 doit garder ce nom de champ pour les formes personnalisées.
- **Encodage** (`src/lib/encoding.ts`, navigateur) : réduction sur un canvas, WebP, ou PNG s'il y a un pixel transparent, SVG gardé tel quel. La clé est `image:<sha256>` de la data URL stockée.
- **Occupation** (`src/lib/usage.ts`) : octets UTF-8 de la clé et de la valeur JSON (§6.1, ADR 0006), sur 5 Mo, alerte au-delà de 80 %. Elle est mesurée en lisant tout le stockage au démarrage, puis suivie à chaque écriture et suppression (`src/lib/storage.ts`).
- **Store** : `insertImage` refuse, avec un message et sans rien poser, un fichier illisible, une image de plus de 900 Ko (clé comprise), ou une image qui, avec la place de ses deux formes, ferait dépasser le quota. Une image déjà stockée n'est pas réécrite. `requestImages` lit les images que le diagramme montre ; une image absente est dessinée « missing image ».
- **Vue** : outil Image (I) dans la barre ; le double-clic ouvre le sélecteur. Ctrl/Cmd+V passe par l'événement `paste`, le seul qui voit le presse-papiers système : une image y est posée au centre de la vue, sinon ce que Ctrl/Cmd+C a copié est collé. La jauge « Storage: x.x MB / 5 MB » est en bas de la liste des diagrammes. Le Guide décrit les images et la jauge.
- **Tests** : `test/usage.test.ts`, `test/images.test.ts` ; sept tests navigateur (image choisie, groupée, stockée une seule fois, retrouvée après rechargement, annulée puis retirée du stockage ; PNG pour la transparence et SVG tel quel ; image trop lourde refusée ; collage ; suppression d'un diagramme ; image manquante).

**Choix** :
  - Une image à laquelle une étape de l'historique d'annulation se réfère est gardée, pour qu'un Ctrl+Z ne ramène jamais une « missing image ». Elle est retirée du stockage dès que l'historique ne la tient plus : à l'ouverture d'un autre diagramme, au démarrage, ou après la suppression d'un diagramme. Le message d'alerte de la jauge le dit.
  - Le nettoyage s'exécute aussi après un enregistrement qui retire une image du diagramme, et dans la même file que les écritures, pour ne jamais effacer une image en cours d'insertion.
  - Ajouts mineurs : le raccourci I, un message pour un fichier illisible, et un bouton pour fermer le message d'image.
