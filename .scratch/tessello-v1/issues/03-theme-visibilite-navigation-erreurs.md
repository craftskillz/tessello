# 03: Thème, visibilité, navigation et erreurs du protocole

Spec parente : `.scratch/tessello-v1/spec.md`. Vocabulaire : `GLOSSARY.md`. Contrat : la Convention.

**What to build:** Le reste du protocole de la Convention fonctionne de bout en bout entre le SDK et le cœur de l'Hôte : un Module suit le thème, sait quand il est masqué, et un Widget peut ouvrir la Vue de son Module avec des paramètres. Toutes les erreurs du protocole sont produites dans les bons cas.

**Blocked by:** 02 (Handshake et stockage, du SDK au cœur de l'Hôte)

**Status:** resolved

- [x] Le SDK permet de s'abonner aux changements de thème ; le cœur de l'Hôte émet `theme.changed` à chaque changement.
- [x] Le SDK permet de s'abonner aux changements de visibilité ; un Module est visible après le handshake et reçoit `visibility` quand il est masqué ou affiché.
- [x] Un Widget peut demander l'ouverture de sa Vue avec des paramètres ; depuis une Vue, la demande échoue avec `not_allowed`, et des paramètres trop volumineux échouent avec `invalid_payload`.
- [x] La Vue ouverte reçoit les paramètres dans son contexte, ou par `navigation.params` si elle était déjà chargée.
- [x] Une requête de type inconnu reçoit `unknown_type` et une charge utile non conforme reçoit `invalid_payload` ; le SDK ignore les événements de type inconnu.
- [x] Tous les comportements ci-dessus sont couverts par des tests au point d'entrée C.

## Comments

### Implémentation (2026-10-18)

- SDK : `onThemeChange`, `onVisibilityChange`, `onNavigationParams` (chacun renvoie une fonction qui arrête l'écoute) et `openView(params?)`. Le SDK ignore les événements de type inconnu, et aussi ceux d'un type connu dont il ne sait pas lire la charge utile.
- Cœur de l'Hôte : `mountSurface()` renvoie désormais un `MountedSurface` avec `setVisible(visible)` et `unmount()`. `unmount()` sert à ce qu'une Vue retirée ne reçoive plus ni `navigation.params` ni `theme.changed`. `HostOptions.openView({ module, params })` est appelé à chaque demande d'un Widget, que la Vue soit chargée ou non, pour que l'interface l'affiche.
- Choix :
  - `visibility` n'est émis que lors d'un changement. Une surface masquée avant son handshake reçoit `visibility: false` juste après la réponse à `ready`, car le Module se croit visible à ce moment-là.
  - Une Vue montée mais pas encore passée par son handshake voit ses paramètres de contexte remplacés par ceux de la dernière demande.
  - La limite de 2 Ko porte sur `JSON.stringify(params)` en octets UTF-8, comme pour le stockage (ADR 0006).
  - `ready` avec une charge utile qui n'est pas un objet reçoit `invalid_payload`.
  - Seules les clés propres de la table des requêtes comptent, pour que `toString` ou `constructor` reçoivent `unknown_type`.
- Convention §10 (non normative) : l'exemple du SDK montre aussi `onNavigationParams`.
