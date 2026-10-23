# 02 : Tirer une flèche depuis une forme personnalisée en respectant ses ancres

**Status:** ready-for-agent

**Blocked by:** 01 — Tirer une flèche depuis les quatre côtés d'une forme intégrée ou d'une image.

Spec parente : [tirer une flèche depuis une forme](../spec.md), section « Formes personnalisées » et comportement commun.

**What to build:** L'Utilisateur retrouve les quatre poignées et le même geste sur ses formes personnalisées. Chaque départ s'attache à une ancre réelle de la définition, ou devient automatique si la forme n'en possède pas. Une forme personnalisée ne gagne pas artificiellement des points N/E/S/W.

## Critères d'acceptation

- [ ] Survoler ou sélectionner seule une forme personnalisée propose les quatre poignées, avec les mêmes règles de visibilité, verrouillage, sélection, zoom, rotation et priorité que dans le ticket 01.
- [ ] Chaque direction choisit l'ancre existante la plus proche du milieu correspondant du cadre local, par distance euclidienne normalisée ; en cas d'égalité, la première dans la définition gagne. Le choix ne dépend ni du zoom, ni du panoramique, ni de la rotation.
- [ ] L'aperçu et la flèche validée partent de cette ancre réelle. L'extrémité enregistrée référence son identifiant exact, y compris un nom arbitraire sans rapport avec N/E/S/W. Plusieurs directions peuvent partager la même ancre.
- [ ] Une forme sans ancre, ou dont la définition a été supprimée, reste utilisable : la source est attachée automatiquement. Le point de sortie peut suivre la destination ; aucun point nommé fictif n'est enregistré.
- [ ] Le déplacement et les transformations de la forme font suivre la flèche. Après modification ou suppression de l'ancre ou de la définition, les règles existantes de repli automatique s'appliquent.
- [ ] Viser une cible, relâcher dans le vide, appliquer les valeurs par défaut, abandonner, enregistrer, annuler et rétablir fonctionnent comme dans le ticket 01.
- [ ] Le Guide d'utilisation précise le choix parmi les ancres existantes et le comportement automatique d'une forme sans ancre.

## Validation attendue

- [ ] Tests unitaires du choix d'ancre dans les quatre directions : ancres asymétriques, noms arbitraires, égalité, ancre unique, aucune ancre et définition absente. Vérifier qu'une forme non carrée utilise bien la distance normalisée.
- [ ] Parcours navigateur dans l'Hôte : tirer depuis une forme personnalisée avec ancres asymétriques puis depuis une forme sans ancre ; vérifier les extrémités persistées après réouverture.
- [ ] Vérifier une source personnalisée tournée et redimensionnée, l'annulation/rétablissement de sa flèche et le repli après suppression de l'ancre utilisée.
- [ ] Les parcours du ticket 01 et de l'éditeur de formes restent verts ; la construction et la validation du paquet réussissent.
