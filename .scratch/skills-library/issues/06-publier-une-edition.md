# 06: Publier une Édition, expliquer les déplacements, l'historique

Spec parente : `.scratch/skills-library/spec.md`. Vocabulaire : `GLOSSARY.md` et « Vocabulaire du Module » de la spec. Contrat : la Convention.

**What to build:** Figer l'état de la bibliothèque en une Édition numérotée et datée, avec une introduction. Après une première Édition, les Changements se calculent par rapport à elle, et tout déplacement d'Anneau demande une explication avant la publication suivante. L'onglet *Editions* liste l'historique.

**Blocked by:** 04, 05

**Status:** ready-for-agent

- [ ] « Publish edition <n> » (onglet *Radar*) ouvre une boîte de dialogue : introduction Markdown (requise), puis confirmation. La publication écrit `edition:<n>` (contenu figé de la spec), puis l'index `editions`, et efface `moveReason` de toutes les Skills. Un `quota_exceeded` est affiché et rien n'est publié.
- [ ] Quand l'Anneau d'une Skill diffère de celui de la dernière Édition, son panneau d'édition demande « Why did it move? » (1 à 280 caractères). Revenir à l'Anneau publié efface l'explication. La publication est refusée tant qu'une Skill déplacée n'en a pas : la boîte de dialogue liste celles qui manquent, avec un lien vers chacune.
- [ ] Une Skill présente dans une Édition ne montre plus « Delete », seulement « Archive ».
- [ ] *Editions* liste les Éditions (numéro, date, nombre de Skills par Anneau), la plus récente en premier. Une Édition publiée ne se modifie pas.
- [ ] Test navigateur : publier l'Édition 1 ; déplacer une Skill, ne pas pouvoir publier sans explication, l'écrire ; archiver une autre Skill ; voir les changements en attente ; publier l'Édition 2 ; recharger, les deux Éditions sont dans l'historique.

## Comments

- Depuis le ticket 04, « Delete » n'apparaît que si `canDelete(id, editions.published)` (`src/lib/skills.ts`) : `editions.published` dans `src/lib/store.svelte.ts` est encore une liste vide. Il faut la remplir avec les Éditions lues (`edition:<n>`) au chargement et après chaque publication ; `PublishedEdition` (`entries: { id }[]`) est la part d'une Édition que la règle lit.
- Depuis le ticket 05, `changesSince(skills, editions)` et `pendingCount`/`isPending` sont dans `src/lib/changes.ts` ; `editions.published` est typé `ComparedEdition[]` (`number`, et pour chaque entrée `id`, `ring`, `score`, `notes`). Le `change` et le `previousRing` d'une entrée figée viennent de ce calcul ; les Skills *retirées* se lisent sur `skills.list` (archivées), pas sur les entrées du radar.
- Les positions du radar dépendent de l'`id` et des points déjà placés dans la même case (Quadrant × Anneau) : une autre Skill ajoutée dans la même case peut écarter un point. Entre cases, la position ne bouge pas.
