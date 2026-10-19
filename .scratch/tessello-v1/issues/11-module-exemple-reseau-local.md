# 11: Module d'exemple réseau local

Spec parente : `.scratch/tessello-v1/spec.md`. Vocabulaire : `GLOSSARY.md`. Contrat : la Convention.

**What to build:** Un Module d'exemple « Prometheus local » (Permission `localNetwork`) montre comment un Module interroge un service de la machine de l'Utilisateur. Ce ticket tranche la troisième question technique ouverte de la spec : le comportement réel des navigateurs face aux requêtes vers le réseau local depuis une iframe sandbox servie par un site public.

**Blocked by:** 06 (Permissions : accord à l'installation et blocage réel)

**Status:** resolved

- [x] Le Module passe le Validateur sans avertissement, et l'écran d'accord met en évidence sa Permission `localNetwork`.
- [x] Il affiche l'état d'un Prometheus local, ou une explication claire quand le service est injoignable ou que le navigateur bloque l'accès.
- [x] Le comportement de Chrome, Firefox et Safari (invite, blocage, conditions CORS) est vérifié et documenté pour les Créateurs.
- [x] Si un navigateur rend `localNetwork` inutilisable, l'écart est signalé avec une proposition (documentation, Pont, révision de la Convention).

## Comments

### Implémentation (2026-10-19)

**Question tranchée :** que font les navigateurs quand une iframe sandbox d'un site public demande la machine de l'Utilisateur ou son réseau local ? **Verdict** : dans Chrome et Edge, `localNetwork` fonctionne, à une condition que l'Hôte ne remplissait pas. Il faut que la page délègue la permission à l'iframe. Sans délégation, la permission vaut `denied` et l'Utilisateur n'est jamais consulté. Décision, mesures et conséquences : `docs/adr/0012-l-hote-delegue-le-reseau-local-aux-seuls-modules-qui-le-declarent.md`.

- **Sonde (source primaire)** : branche `prototype/11-local-network`, dossier `prototypes/11-local-network/` (`README.md`, `results-*.json`). Elle a tourné contre un vrai Prometheus 3.15 sur `localhost:9090`, dans Chromium 156, Chrome 155, Firefox 157 et WebKit 27.2 (Playwright).
- **Résumé des navigateurs** :
  - **Chrome et Edge** : une question par origine de l'Hôte, valable pour tous les Modules, et seulement pour une iframe délégataire. Pas de blocage du contenu mixte pour les adresses que la Convention admet. CORS doit accepter l'origine `null`.
  - **Firefox** : une question sans délégation nécessaire, mais `http://` vers une IPv4 privée ou un nom `.local` est bloqué depuis HTTPS (contenu mixte).
  - **WebKit** : aucune restriction.
- **Hôte** (`packages/host/src/srcdoc.ts`, `main.ts`) : `buildView` renvoie `allow`, posé sur l'iframe de la Vue et du Widget, soit `local-network-access; local-network; loopback-network` quand le Module déclare `localNetwork`, sinon rien.
- **Local Prometheus** (`examples/prometheus`, `@tessello/prometheus`) :
  - **Permission** : `localNetwork: ["http://localhost:9090"]`.
  - **Vue** : version, cibles actives (job, instance, erreur) et alertes déclenchées, avec un bouton **Retry**.
  - **Widget S** : « N/M up » et le nombre d'alertes, et ouvre la Vue.
  - **Erreurs** : une explication par cas. « Prometheus can't be reached » liste quoi vérifier, y compris CORS (`--web.cors.origin`). « Your browser blocks access to your computer » apparaît quand la permission `local-network-access`, lue par `navigator.permissions.query`, vaut `denied` (Firefox ne connaît pas ce nom et ment sur les nouveaux). « Prometheus answered with an error » couvre une réponse en erreur.
  - **Validateur et SDK** : il passe le Validateur sans avertissement, et sa copie du SDK est générée par `npm run build:sdk`.
- **Créateurs** : la Convention §3.1 gagne « Reaching the local network (non-normative) », et le §4 mentionne la délégation.
- **Tests** :
  - `cli/test/examples.test.ts` : Local Prometheus passe le Validateur.
  - `sdk/test/local-copy.test.ts` : sa copie du SDK est à jour.
  - `host/e2e/local-network.test.ts` : l'écran d'accord, la Vue et le Widget sur un Prometheus simulé, l'explication puis Retry, et la délégation (`prompt` pour un Module `localNetwork`, `denied` pour les autres).
  - Toujours dans `local-network.test.ts`, avec l'Hôte vu comme un site public (`useHost({ public: true })`) : l'accès à un service local accordé, refusé, ou non déclaré (bloqué par la CSP et jamais atteint), et le message « bloqué » de Local Prometheus après un refus simulé par CDP.
  - Vérifié à la main : l'exemple contre le vrai Prometheus 3.15, dans la Vue et le Widget.

**Écart signalé** : Firefox rendrait `localNetwork` inutilisable pour les appareils du réseau local en `http://`. Seul le loopback y passe. Sans effet en V1, puisque l'Hôte exige Chrome ou Edge. Propositions dans l'ADR 0012 : documenter et exiger `https://` pour ces appareils, passer par le Pont, ou réviser la Convention.

**Limites** :
  - Le vrai clic sur la question du navigateur n'est pas automatisable. Playwright accorde la permission, ou le test la refuse par CDP. Or `grantPermissions` passe outre la délégation, ce qui a été mesuré. La délégation est donc prouvée par l'état de la permission, pas par une requête aboutie.
  - Seul `fetch` a été mesuré. WebSocket, images et `.local` réel sur le réseau n'ont pas été mesurés.
  - Safari et Edge n'ont pas été vérifiés à la main. Edge partage le moteur de Chrome.
