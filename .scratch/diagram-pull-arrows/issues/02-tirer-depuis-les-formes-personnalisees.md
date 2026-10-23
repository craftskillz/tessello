# 02 : Tirer une flèche depuis une forme personnalisée en respectant ses ancres

**Status:** resolved

**Blocked by:** 01 — Tirer une flèche depuis les quatre côtés d'une forme intégrée ou d'une image.

Spec parente : [tirer une flèche depuis une forme](../spec.md), section « Formes personnalisées » et comportement commun.

**What to build:** L'Utilisateur retrouve les quatre poignées et le même geste sur ses formes personnalisées. Chaque départ s'attache à une ancre réelle de la définition, ou devient automatique si la forme n'en possède pas. Une forme personnalisée ne gagne pas artificiellement des points N/E/S/W.

## Critères d'acceptation

- [x] Survoler ou sélectionner seule une forme personnalisée propose les quatre poignées, avec les mêmes règles de visibilité, verrouillage, sélection, zoom, rotation et priorité que dans le ticket 01.
- [x] Chaque direction choisit l'ancre existante la plus proche du milieu correspondant du cadre local, par distance euclidienne normalisée ; en cas d'égalité, la première dans la définition gagne. Le choix ne dépend ni du zoom, ni du panoramique, ni de la rotation.
- [x] L'aperçu et la flèche validée partent de cette ancre réelle. L'extrémité enregistrée référence son identifiant exact, y compris un nom arbitraire sans rapport avec N/E/S/W. Plusieurs directions peuvent partager la même ancre.
- [x] Une forme sans ancre, ou dont la définition a été supprimée, reste utilisable : la source est attachée automatiquement. Le point de sortie peut suivre la destination ; aucun point nommé fictif n'est enregistré.
- [x] Le déplacement et les transformations de la forme font suivre la flèche. Après modification ou suppression de l'ancre ou de la définition, les règles existantes de repli automatique s'appliquent.
- [x] Viser une cible, relâcher dans le vide, appliquer les valeurs par défaut, abandonner, enregistrer, annuler et rétablir fonctionnent comme dans le ticket 01.
- [x] Le Guide d'utilisation précise le choix parmi les ancres existantes et le comportement automatique d'une forme sans ancre.

## Validation attendue

- [x] Tests unitaires du choix d'ancre dans les quatre directions : ancres asymétriques, noms arbitraires, égalité, ancre unique, aucune ancre et définition absente. Vérifier qu'une forme non carrée utilise bien la distance normalisée.
- [x] Parcours navigateur dans l'Hôte : tirer depuis une forme personnalisée avec ancres asymétriques puis depuis une forme sans ancre ; vérifier les extrémités persistées après réouverture.
- [x] Vérifier une source personnalisée tournée et redimensionnée, l'annulation/rétablissement de sa flèche et le repli après suppression de l'ancre utilisée.
- [x] Les parcours du ticket 01 et de l'éditeur de formes restent verts ; la construction et la validation du paquet réussissent.

## Comments

Implémenté : les quatre poignées de connexion utilisent les extrémités et la géométrie existantes, sans migration. Le geste partage les valeurs par défaut, l’aperçu, l’enregistrement et l’historique de l’outil Flèche. Le Guide d’utilisation et les libellés anglais/français sont à jour.

Validation : tests unitaires de géométrie (`sample-modules/diagram/test/geometry.test.ts`), parcours du Module construit et installé dans l’Hôte (`packages/host/e2e/diagram.test.ts`), `npm run typecheck`, suite complète `npm test` (1 071 tests) et suite complète `npm run test:browser` (189 tests). Une régression navigateur supplémentaire couvre les poignées et leur corridor au-dessus d’une forme voisine, ainsi que le survol de la forme au premier plan.

Revue : aucun constat Standards ; le constat Spec sur l’accès aux poignées près d’une autre forme a été corrigé et sa résolution confirmée.

Paquet local reconstruit avec `just module diagram` : `dist/` et `diagram.zip` à jour, Validateur sans avertissement. La seconde suite navigateur complète a réussi 189 tests sur 190 : seule la lecture concurrente d’un fichier du test d’import Survival Kit a levé `NotReadableError` ; la relance isolée de ce fichier a réussi ses 7 tests. Le test de régression final sur le corridor a également réussi après la dernière correction.
