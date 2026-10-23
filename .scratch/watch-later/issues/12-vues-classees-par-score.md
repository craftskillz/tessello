# 12: Les vidéos vues classées par score dans chaque ligne

Spec parente : `.scratch/watch-later/spec.md`. Vocabulaire : `GLOSSARY.md`. Contrat : la Convention.

**What to build:** Quand les vidéos vues sont montrées, chaque ligne commence par les vidéos vues, du meilleur score au moins bon, afin de voir d'abord les plus intéressantes. Les vidéos à voir viennent après, dans l'ordre d'aujourd'hui.

**Blocked by:** 11

**Status:** resolved

### Ordre d'une ligne

- [x] Dans chaque ligne, les vidéos vues viennent d'abord, par score décroissant (5 puis 4… puis 0), puis les vidéos vues sans score. À score égal, la plus récemment vue d'abord (`watchedAt`).
- [x] Puis viennent les vidéos à voir, dans l'ordre du ticket 08 : celles jamais placées d'abord, les plus récentes d'abord, puis celles placées, dans l'ordre retenu.
- [x] Quand « Cacher les vues » est actif, rien ne change par rapport à aujourd'hui.
- [x] L'ordre vaut pour les lignes simples, les lignes des groupes et « Sans tag ». Le nombre de vidéos des lignes et des groupes ne change pas.

### Déplacer une vidéo (ticket 08)

- [x] Seules les vidéos à voir sont rangées par `settings.order`. Une vidéo vue garde sa place donnée par le score : la déposer dans sa ligne ne la déplace pas.
- [x] Une vidéo vue déposée dans une autre ligne change de tag comme aujourd'hui, et prend sa place par score dans la ligne d'arrivée.
- [x] Une vidéo à voir déposée parmi les vidéos vues prend la première place des vidéos à voir. La barre de dépôt ne s'affiche pas parmi les vidéos vues pour une vidéo à voir.
- [x] Une vidéo vue n'est jamais écrite dans `settings.order`. Repassée à voir, elle reprend sa place d'avant si elle y était encore, sinon elle vient parmi les jamais placées.

### Hors périmètre

- Le Widget ne change pas : il ne montre que des vidéos à voir.
- Trier les vidéos à voir par score, ou trier les lignes entre elles par score.

### Tests

- [x] Tests unitaires : ordre d'une ligne mêlant vues avec score, vues sans score, à voir placées et jamais placées ; égalité de score ; déplacement d'une vidéo vue dans sa ligne et vers une autre ligne ; dépôt d'une vidéo à voir parmi les vues.
- [x] Test navigateur : avec « Cacher les vues » décoché, trois vidéos vues avec les scores 2, 5 et 0 et une vidéo à voir apparaissent dans l'ordre 5, 2, 0, à voir, et l'ordre reste après un rechargement.

## Comments

### Implémentation (2026-10-23)

- Chaque ligne commence par les vidéos vues, du score 5 au score 0, puis celles sans score ; à score égal, la plus récemment vue vient d’abord. Les lignes simples, celles des groupes et « Sans tag » partagent cet ordre, sans modifier leurs comptes ni le Widget.
- Les vidéos à voir gardent leur ordre : jamais placées, les plus récentes d’abord, puis placements retenus. Le dépôt parmi les vues les place au début des vidéos à voir, avec une barre à cette frontière.
- Une vidéo vue ne se range pas manuellement dans sa ligne et ne crée aucun placement. Vers une autre ligne, ses tags changent et le score décide de sa position. Un ancien placement reste utilisable au retour à voir s’il est encore conservé ; reconstruire l’ordre d’une ligne n’y ajoute que ses vidéos à voir.
- Validation : 71 tests unitaires Watch Later et les 19 tests navigateur Watch Later passent, dont le classement 5, 2, 0, à voir après rechargement, la modification du score et les déplacements. TypeScript passe. Paquet 0.5.0 construit et validé sans erreur ni avertissement.
