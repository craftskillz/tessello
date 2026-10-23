# 13: Le Guide d'utilisation parle du score

Spec parente : `.scratch/watch-later/spec.md`. Vocabulaire : `GLOSSARY.md`. Contrat : la Convention.

**What to build:** Le Guide d'utilisation (`guide/guide.md`) décrit le score et l'ordre qu'il donne aux lignes.

**Blocked by:** 11, 12

**Status:** resolved

- [x] La section sur « marquer comme vue » explique la boîte de dialogue : un score de 0 à 5, obligatoire, et la note, facultative, qu'on peut y corriger.
- [x] Le guide dit que, quand les vues sont montrées, chaque ligne commence par les vidéos vues les mieux notées, et que le glisser-déposer ne range que les vidéos à voir.
- [x] Il dit où changer le score (le panneau de détail) et que repasser une vidéo à voir oublie son score.
- [x] La capture du panneau de détail est refaite si elle ne montre plus ce qu'il contient. Le paquet passe le Validateur sans avertissement.

## Comments

### Implémentation (2026-10-23)

- Guide en anglais mis à jour : score obligatoire de 0 à 5 et note facultative dans la boîte de dialogue, choix des étoiles et du zéro, annulation, modification du score dans le détail et oubli du score au retour à voir.
- Le Guide décrit le classement des vues et le glisser-déposer réservé à l’ordre des vidéos à voir, y compris le dépôt parmi les vues et le changement de tag d’une vidéo vue.
- Capture du panneau de détail refaite dans l’Hôte, avec une vidéo vue notée 4/5, son tag et sa note ; vérification visuelle effectuée.
- Paquet 0.5.0 reconstruit avec le Guide et sa capture, Validateur sans erreur ni avertissement. Les 71 tests unitaires et les 19 tests navigateur Watch Later passent ; TypeScript passe également.
