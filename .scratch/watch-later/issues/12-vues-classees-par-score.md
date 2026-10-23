# 12: Les vidéos vues classées par score dans chaque ligne

Spec parente : `.scratch/watch-later/spec.md`. Vocabulaire : `GLOSSARY.md`. Contrat : la Convention.

**What to build:** Quand les vidéos vues sont montrées, chaque ligne commence par les vidéos vues, du meilleur score au moins bon, afin de voir d'abord les plus intéressantes. Les vidéos à voir viennent après, dans l'ordre d'aujourd'hui.

**Blocked by:** 11

**Status:** ready-for-agent

### Ordre d'une ligne

- [ ] Dans chaque ligne, les vidéos vues viennent d'abord, par score décroissant (5 puis 4… puis 0), puis les vidéos vues sans score. À score égal, la plus récemment vue d'abord (`watchedAt`).
- [ ] Puis viennent les vidéos à voir, dans l'ordre du ticket 08 : celles jamais placées d'abord, les plus récentes d'abord, puis celles placées, dans l'ordre retenu.
- [ ] Quand « Cacher les vues » est actif, rien ne change par rapport à aujourd'hui.
- [ ] L'ordre vaut pour les lignes simples, les lignes des groupes et « Sans tag ». Le nombre de vidéos des lignes et des groupes ne change pas.

### Déplacer une vidéo (ticket 08)

- [ ] Seules les vidéos à voir sont rangées par `settings.order`. Une vidéo vue garde sa place donnée par le score : la déposer dans sa ligne ne la déplace pas.
- [ ] Une vidéo vue déposée dans une autre ligne change de tag comme aujourd'hui, et prend sa place par score dans la ligne d'arrivée.
- [ ] Une vidéo à voir déposée parmi les vidéos vues prend la première place des vidéos à voir. La barre de dépôt ne s'affiche pas parmi les vidéos vues pour une vidéo à voir.
- [ ] Une vidéo vue n'est jamais écrite dans `settings.order`. Repassée à voir, elle reprend sa place d'avant si elle y était encore, sinon elle vient parmi les jamais placées.

### Hors périmètre

- Le Widget ne change pas : il ne montre que des vidéos à voir.
- Trier les vidéos à voir par score, ou trier les lignes entre elles par score.

### Tests

- [ ] Tests unitaires : ordre d'une ligne mêlant vues avec score, vues sans score, à voir placées et jamais placées ; égalité de score ; déplacement d'une vidéo vue dans sa ligne et vers une autre ligne ; dépôt d'une vidéo à voir parmi les vues.
- [ ] Test navigateur : avec « Cacher les vues » décoché, trois vidéos vues avec les scores 2, 5 et 0 et une vidéo à voir apparaissent dans l'ordre 5, 2, 0, à voir, et l'ordre reste après un rechargement.
