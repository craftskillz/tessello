# 02: Glisser-déposer, doublons et entrées refusées

Spec parente : `.scratch/watch-later/spec.md`. Vocabulaire : `GLOSSARY.md`. Contrat : la Convention.

**What to build:** On ajoute une vidéo en déposant un lien sur la Vue. Une vidéo n'est jamais ajoutée deux fois, et ce qui n'est pas une vidéo YouTube est refusé avec un message.

**Blocked by:** 01 (Squelette)

**Status:** resolved

- [x] Glisser un lien au-dessus de la Vue montre une zone de dépôt (« Déposer pour ajouter »). Le dépôt lit `text/uri-list`, puis `text/plain`.
- [x] Un collage ou un dépôt de plusieurs lignes ajoute chaque URL reconnue, et indique combien ont été ajoutées, combien étaient déjà là et combien ont été ignorées.
- [x] Une vidéo déjà présente (même `videoId`, même avec un autre timestamp ou une autre forme d'URL) n'est pas ajoutée : la Vue fait défiler jusqu'à sa carte et la met en évidence un instant.
- [x] Un texte qui n'est pas une URL YouTube affiche un message bref (« Ce n'est pas une vidéo YouTube »), sans boîte de dialogue bloquante.
- [x] Tests unitaires : lecture d'un dépôt de plusieurs lignes, ajout sans doublon.
- [x] Test navigateur : un dépôt simulé ajoute une vidéo, et un deuxième dépôt de la même vidéo ne crée pas de doublon.
