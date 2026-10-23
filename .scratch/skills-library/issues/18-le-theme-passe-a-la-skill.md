# 18: Le Thème passe à la Skill, un point par Thème sur le radar

Spec parente : `.scratch/skills-library/spec.md` (révision « tickets 17 à 19 »). Vocabulaire : `GLOSSARY.md` et « Vocabulaire du Module » de la spec. Contrat : la Convention.

**What to build:** Chaque Skill a son Thème, un seul ; l'Ensemble n'en a plus, et couvre les Thèmes de ses Skills. Sur le radar, un Ensemble a un point dans chacun de ses Thèmes, tous avec le même numéro, le même Anneau et le même marqueur ; l'infobulle d'un point ne liste que les Skills de ce Thème. Les données existantes sont converties.

**Blocked by:** 17

**Status:** ready-for-agent

- [ ] Modèle (spec, « Modèle de données ») : `topic` (0 à 4) sur la Skill, plus de `quadrant` sur l'Ensemble. Les Thèmes d'un Ensemble sont dérivés de ses Skills. Le **Thème par défaut** d'un Ensemble (le plus fréquent, à égalité le plus petit indice, 0 sans Skill) sert à « Add skill » et au rafraîchissement.
- [ ] Migration (spec, « Migration des Quadrants vers les Thèmes ») : au chargement, chaque Skill d'un Ensemble qui a un `quadrant` prend ce `topic` ; l'Ensemble perd `quadrant`. `readEdition` fait de même à la lecture des Éditions publiées avant, sans les réécrire. Tests unitaires : bibliothèque et Édition converties, migration faite une seule fois, Skill qui a déjà un `topic` non touchée.
- [ ] Import : l'aperçu a un sélecteur « Topic » (le premier par défaut) appliqué à toutes les Skills importées.
- [ ] Panneau d'édition : plus de Thème au niveau de l'Ensemble ; chaque ligne de Skill montre son Thème, et son dépliant permet de le changer.
- [ ] Library : la colonne Thèmes liste ceux de l'Ensemble ; le filtre par Thème garde un Ensemble dont une Skill est dans un Thème choisi. Un Ensemble sans Skill affiche « No skill — not on the radar ».
- [ ] Radar : un point par couple (Ensemble, Thème), position hachée sur l'`id` et l'indice du Thème ; **un numéro par Ensemble** (ordre : premier Thème, Anneau, nom) ; `<title>` « <n>. <Ensemble> — <Anneau> · <Thème> » puis les seules Skills de ce Thème ; `data-set-id`, `data-number`, `data-topic`. Un Ensemble sans Skill n'a pas de point. La légende de la Vue garde une ligne par Ensemble.
- [ ] Changements : un Ensemble sans Skill compte comme hors du radar (*retiré* s'il était dans la dernière Édition, *de retour* quand il retrouve une Skill) et n'est pas figé dans une Édition. Changer le Thème d'une Skill n'est pas un Changement. Tests unitaires de ces cas.
- [ ] Publier fige `topic` sur chaque Skill d'une entrée, et plus de `quadrant` sur l'entrée.
- [ ] Tests unitaires de `renderRadar` : un Ensemble à 2 Thèmes donne 2 points de même numéro et même marqueur, chacun dans son secteur, chacun avec ses seules Skills dans `<title>` ; positions stables ; Ensemble vide sans point.
- [ ] Test navigateur : importer un ensemble dans un Thème, passer une de ses Skills dans un autre Thème, voir deux points numérotés pareil sur le radar ; filtrer la Library par le second Thème et retrouver l'Ensemble.
