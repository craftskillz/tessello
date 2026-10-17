# 02: Handshake et stockage, du SDK au cœur de l'Hôte

Spec parente : `.scratch/tessello-v1/spec.md`. Vocabulaire : `GLOSSARY.md`. Contrat : la Convention.

**What to build:** Un Créateur écrit un Module qui se connecte à l'Hôte avec le SDK, reçoit son contexte et lit ou écrit ses données. Côté Hôte, un cœur sans interface traite le protocole de messages pour chaque surface (Vue ou Widget) et gère le stockage de chaque Module. Ce ticket pose le point d'entrée de test C : le SDK et le cœur de l'Hôte reliés par un canal de messages en mémoire, avec une persistance en mémoire derrière une interface qu'une implémentation navigateur remplacera ensuite.

**Blocked by:** None (can start immediately)

**Status:** ready-for-agent

- [ ] Le SDK expose une connexion qui envoie `ready` et renvoie le contexte défini par la Convention (surface, Module, langue, thème, paramètres).
- [ ] Toute requête envoyée avant le handshake reçoit `not_ready`, et aucun événement n'est émis avant celui-ci.
- [ ] Le SDK permet de lire, écrire, supprimer et lister les clés du stockage ; une clé absente se lit comme `null`.
- [ ] Le stockage d'un Module est invisible pour un autre Module et partagé entre la Vue et le Widget d'un même Module.
- [ ] Les limites (longueur de clé, taille d'une valeur, total par Module) viennent du paquet de la Convention et un dépassement renvoie `quota_exceeded` sans rien modifier.
- [ ] Les erreurs du protocole remontent dans le SDK comme des erreurs portant leur code.
- [ ] Le cœur de l'Hôte n'accepte que les messages de la surface qu'il a créée et ignore ceux qui ne portent pas l'enveloppe du protocole.
- [ ] Tous les comportements ci-dessus sont couverts par des tests au point d'entrée C.
