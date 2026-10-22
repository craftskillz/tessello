# 09: Déplacer une section par glisser-déposer

Spec parente : `.scratch/watch-later/spec.md`. Vocabulaire : `GLOSSARY.md`. Contrat : la Convention.

**What to build:** Une ligne (par son en-tête) ou un groupe (par son titre) se glisse-dépose au-dessus ou en dessous d'une autre section du même niveau. La Vue retient l'ordre donné.

**Blocked by:** 08

**Status:** resolved

### Modèle

- [x] `settings.sections` : les clés des sections placées, dans leur ordre. Une ligne a pour clé son tag en minuscules (`""` pour « Sans tag »), un groupe son nom en minuscules suivi de `/`.
- [x] Les sections placées viennent d'abord, puis les autres dans l'ordre par défaut (alphabétique, « Sans tag » en dernier).
- [x] Un déplacement place toutes les sections de son niveau ; les clés des sections disparues sont oubliées.
- [x] Une ligne d'un groupe ne sort pas de son groupe ; une section ne va pas dans un groupe.

### Vue

- [x] Une poignée ⠿ signale ce qui se glisse ; une barre montre où la section tombera, selon la moitié sous le pointeur.
- [x] Une section déplacée n'est pas prise pour un lien déposé à ajouter.
- [x] Tests unitaires : déplacement au haut de la Vue et dans un groupe, refus entre niveaux, oubli des clés disparues, lecture de `settings.sections`.
- [x] Test navigateur : une ligne passe sous un groupe, une ligne du groupe passe au-dessus de l'autre, l'ordre reste après un rechargement.

### Hors périmètre

- Déplacer au clavier ou au toucher.
