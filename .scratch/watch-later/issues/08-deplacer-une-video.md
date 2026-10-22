# 08: Déplacer une vidéo par glisser-déposer

Spec parente : `.scratch/watch-later/spec.md`. Vocabulaire : `GLOSSARY.md`. Contrat : la Convention.

**What to build:** Une carte se glisse-dépose dans sa ligne pour changer de place, ou vers une autre ligne pour changer de tag. La Vue retient l'ordre donné.

**Blocked by:** 07

**Status:** resolved

### Modèle

- [x] `settings.order` : par ligne (tag en minuscules, `""` pour « Sans tag »), les vidéos placées, dans leur ordre. `videos` ne change pas.
- [x] Dans une ligne, les vidéos jamais placées viennent d'abord, les plus récentes d'abord, puis les autres dans l'ordre retenu.
- [x] Vers une autre ligne : la vidéo perd le tag quitté et prend celui d'arrivée, garde ses autres tags. « Sans tag » n'accepte que si le tag quitté était le seul.
- [x] L'ordre des lignes disparues ou des vidéos qui n'y sont plus est oublié à chaque déplacement.

### Vue

- [x] Une barre montre où la carte tombera ; la carte déplacée est estompée.
- [x] Une carte déplacée n'est pas prise pour un lien déposé à ajouter.
- [x] Le Widget et la Home ne changent pas (les plus récentes d'abord).
- [x] Tests unitaires : déplacement dans la ligne, vers une autre ligne, vers « Sans tag », lecture de `settings.order`.
- [x] Test navigateur : déplacer dans « Sans tag », puis vers une autre ligne, et retrouver l'ordre après un rechargement.

### Hors périmètre

- Déplacer au clavier ou au toucher.
