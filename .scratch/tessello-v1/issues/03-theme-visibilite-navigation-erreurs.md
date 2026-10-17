# 03: Thème, visibilité, navigation et erreurs du protocole

Spec parente : `.scratch/tessello-v1/spec.md`. Vocabulaire : `GLOSSARY.md`. Contrat : la Convention.

**What to build:** Le reste du protocole de la Convention fonctionne de bout en bout entre le SDK et le cœur de l'Hôte : un Module suit le thème, sait quand il est masqué, et un Widget peut ouvrir la Vue de son Module avec des paramètres. Toutes les erreurs du protocole sont produites dans les bons cas.

**Blocked by:** 02 (Handshake et stockage, du SDK au cœur de l'Hôte)

**Status:** ready-for-agent

- [ ] Le SDK permet de s'abonner aux changements de thème ; le cœur de l'Hôte émet `theme.changed` à chaque changement.
- [ ] Le SDK permet de s'abonner aux changements de visibilité ; un Module est visible après le handshake et reçoit `visibility` quand il est masqué ou affiché.
- [ ] Un Widget peut demander l'ouverture de sa Vue avec des paramètres ; depuis une Vue, la demande échoue avec `not_allowed`, et des paramètres trop volumineux échouent avec `invalid_payload`.
- [ ] La Vue ouverte reçoit les paramètres dans son contexte, ou par `navigation.params` si elle était déjà chargée.
- [ ] Une requête de type inconnu reçoit `unknown_type` et une charge utile non conforme reçoit `invalid_payload` ; le SDK ignore les événements de type inconnu.
- [ ] Tous les comportements ci-dessus sont couverts par des tests au point d'entrée C.
