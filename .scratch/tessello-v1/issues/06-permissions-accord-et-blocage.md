# 06: Permissions : accord à l'installation et blocage réel

Spec parente : `.scratch/tessello-v1/spec.md`. Vocabulaire : `GLOSSARY.md`. Contrat : la Convention.

**What to build:** Avant d'activer un Module, l'Utilisateur voit en langage simple tout ce qu'il pourra faire et accepte tout ou annule (ADR 0004). Une fois le Module installé, l'Hôte bloque réellement tout accès réseau qui n'est pas couvert par ses Permissions. Un nouveau Module d'exemple « Météo » (Permission `network` vers une API publique compatible CORS, Widget M, ouverture de la Vue sur une ville) démontre le parcours.

**Blocked by:** 04 (Premier Module dans le navigateur)

**Status:** resolved

- [x] L'écran d'installation liste les Permissions en langage simple, met en évidence `localNetwork` et indique explicitement l'absence d'accès réseau pour un Module sans Permission.
- [x] L'Utilisateur peut seulement tout accepter ou annuler ; une annulation n'installe rien.
- [x] Une requête ou une ressource distante vers une origine déclarée fonctionne ; vers une origine non déclarée, elle est bloquée.
- [x] Les Permissions accordées sont enregistrées avec le Module et consultables depuis l'Hôte.
- [x] Le Module « Météo » passe le Validateur sans avertissement, affiche la météo dans sa Vue et son Widget M, et son Widget ouvre la Vue sur une ville précise.
- [x] Des tests navigateur couvrent l'accord, l'annulation et le blocage effectif d'une origine non déclarée.

## Comments

### Implémentation (2026-10-18)

- **Cœur de l'Hôte** (`packages/host-core`) : `ModuleEntry` gagne `permissions`, les Permissions accordées enregistrées dans le registre (pour un Module `active` ou `missing`), jamais celles du Manifeste relu sur disque ; null pour un dossier non activé. L'enregistrement des Permissions à l'installation et la CSP qui les suit existaient déjà (tickets 04 et 04 bis).
- **Interface** (`packages/host/src/main.ts`) :
  - L'écran d'installation ou d'activation présente une section « What <Module> can do », en trois cas (ADR 0008) : **Limited** (les serveurs contactés, sans le schéma ; `*.` devient « any subdomain of », `ws(s)` est signalé comme « live connection »), **Isolated** (fichiers, Tessello, autres Modules) et **Not guaranteed** (« Install only Modules you trust »).
  - `localNetwork` est mis en évidence dans un encadré rouge. Un Module sans Permission est présenté comme « No network access: … declares no server, and Tessello blocks the requests it would make ». La formulation évite « cannot contact any server », que l'ADR 0008 interdit de promettre.
  - Seuls deux boutons : « Cancel » et « Accept and install » (ou « Accept and activate » pour un dossier).
  - L'écran des nouvelles Permissions d'un dossier modifié reprend la même section, limitée à ce qui s'ajoute (« What <Module> can now also do »).
  - Chaque Module actif du Lanceur a un bouton ⓘ « Permissions », qui montre les Permissions accordées.
- **Météo** (`examples/meteo`, `@tessello/meteo`, nommé « Weather » dans l'interface, en anglais) : il utilise l'API Open-Meteo (CORS ouvert, sans clé) et une liste de villes prédéfinies. La Vue suit les villes choisies (clé `cities`) et affiche la météo de la ville sélectionnée. Le Widget M montre les trois premières villes, et chacune ouvre la Vue avec `{ city: "<id>" }`. Le Module passe le Validateur sans avertissement, et sa copie du SDK est générée par `npm run build:sdk`.
- **Tests** :
  - `host-core/test/modules.test.ts` : Permissions accordées dans le Lanceur.
  - `cli/test/examples.test.ts` : Météo passe le Validateur.
  - `host/e2e/permissions.test.ts` : l'écran d'accord, l'absence de réseau, la mise en évidence du réseau local, l'annulation, l'accord puis la consultation, Météo dans sa Vue et son Widget, et le blocage effectif. Une requête et une image vers une origine non déclarée sont refusées par la CSP (`requestfailed` : `csp`) et n'atteignent jamais le réseau. Open-Meteo est simulé par `page.route`.
- **Limites** :
  - Le blocage n'est testé en navigateur que pour `fetch` et `<img>`. WebSocket, l'autorisation de `wss` et les jokers ne sont couverts que par les tests unitaires de `isCovered`.
  - Les Permissions d'un Module `missing` ne sont pas consultables dans l'interface, seulement dans le cœur.
  - La consultation des Permissions sur le parcours d'activation d'un dossier n'est pas testée en navigateur : elle passe par le même code que le parcours `.zip`.
