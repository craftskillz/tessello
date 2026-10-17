# 02: Handshake et stockage, du SDK au cœur de l'Hôte

Spec parente : `.scratch/tessello-v1/spec.md`. Vocabulaire : `GLOSSARY.md`. Contrat : la Convention.

**What to build:** Un Créateur écrit un Module qui se connecte à l'Hôte avec le SDK, reçoit son contexte et lit ou écrit ses données. Côté Hôte, un cœur sans interface traite le protocole de messages pour chaque surface (Vue ou Widget) et gère le stockage de chaque Module. Ce ticket pose le point d'entrée de test C : le SDK et le cœur de l'Hôte reliés par un canal de messages en mémoire, avec une persistance en mémoire derrière une interface qu'une implémentation navigateur remplacera ensuite.

**Blocked by:** None (can start immediately)

**Status:** done

- [x] Le SDK expose une connexion qui envoie `ready` et renvoie le contexte défini par la Convention (surface, Module, langue, thème, paramètres).
- [x] Toute requête envoyée avant le handshake reçoit `not_ready`, et aucun événement n'est émis avant celui-ci.
- [x] Le SDK permet de lire, écrire, supprimer et lister les clés du stockage ; une clé absente se lit comme `null`.
- [x] Le stockage d'un Module est invisible pour un autre Module et partagé entre la Vue et le Widget d'un même Module.
- [x] Les limites (longueur de clé, taille d'une valeur, total par Module) viennent du paquet de la Convention et un dépassement renvoie `quota_exceeded` sans rien modifier.
- [x] Les erreurs du protocole remontent dans le SDK comme des erreurs portant leur code.
- [x] Le cœur de l'Hôte n'accepte que les messages de la surface qu'il a créée et ignore ceux qui ne portent pas l'enveloppe du protocole.
- [x] Tous les comportements ci-dessus sont couverts par des tests au point d'entrée C.

## Comments

### Implémentation (2026-10-18)

- `@tessello/sdk` (`packages/sdk`) : `connect({ transport? })` envoie `ready` et renvoie `{ context, storage }` ; les erreurs du protocole sont des `TesselloError` portant `code`. Sans dépendance, le transport par défaut parle à `window.parent`.
- `@tessello/host-core` (`packages/host-core`) : `createHost({ persistence, locale, theme })`, puis `mountSurface({ frame, module, surface, params })` pour chaque iframe créée et `receive({ source, data })` branché sur l'événement `message`. La persistance est l'interface `Persistence`, avec `createMemoryPersistence()` ; l'implémentation IndexedDB viendra au ticket 04.
- Point d'entrée C : `packages/host-core/test/memory-channel.ts` (canal en mémoire, livraison asynchrone et clonée comme `postMessage`) et `protocol.test.ts`.
- Choix : la taille d'une valeur et le total comptent les octets UTF-8 (clé + valeur sérialisée pour le total) ; une clé trop longue renvoie `quota_exceeded` à l'écriture. Les requêtes d'un même Module sont traitées l'une après l'autre, pour qu'une écriture concurrente de la Vue et du Widget ne dépasse pas le total.
- Pris d'avance sur le ticket 03, au minimum nécessaire : `host.setTheme()` émet `theme.changed` (seulement après le handshake, ce qui permet de tester « aucun événement avant ») ; une requête de type inconnu reçoit `unknown_type` et une charge utile de stockage non conforme `invalid_payload`, pour qu'aucune requête ne reste sans réponse. L'abonnement côté SDK (`onThemeChange`) reste au ticket 03.
