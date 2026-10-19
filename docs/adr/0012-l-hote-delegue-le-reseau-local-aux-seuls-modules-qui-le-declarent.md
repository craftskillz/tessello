# L'Hôte délègue l'accès au réseau local aux seuls Modules qui le déclarent

L'Hôte pose `allow="local-network-access; local-network; loopback-network"` sur l'iframe d'une Vue ou d'un Widget dont le Module déclare `localNetwork`, et sur aucune autre. Chrome et Edge appliquent désormais *Local Network Access* : avant qu'un site public joigne la machine de l'Utilisateur (`localhost`, loopback) ou son réseau local (adresses privées, noms `.local`), le navigateur lui pose une question. Une iframe ne peut la déclencher que si la page lui délègue la permission par sa Permissions Policy. Sans délégation, la permission vaut `denied` dans l'iframe, et ses requêtes échouent sans que l'Utilisateur soit jamais consulté. La CSP continue de limiter ce Module aux origines déclarées (ADR 0004, ADR 0008).

## Mesures (ticket 11)

Une sonde reproduit l'iframe de l'Hôte : `srcdoc`, sandbox sans `allow-same-origin`, CSP en `<meta>`. La page est servie en HTTPS et marquée « publique » (`--ip-address-space-overrides` dans Chromium, `network.lna.address_space.public.override` dans Firefox). Ses cibles sont un vrai Prometheus 3.15 sur `localhost:9090` et un service marqué « privé ». Navigateurs : Chromium 156, Chrome 155, Firefox 157 et WebKit 27.2 (Playwright). Edge, du même moteur que Chrome, n'a pas été mesuré.

- **Chrome et Edge** :
  - Sans `allow`, la permission vaut `denied` dans l'iframe. Avec `local-network-access`, les trois noms valent `prompt`. Avec seulement `local-network; loopback-network`, l'ancien nom reste `denied`. L'Hôte délègue donc les trois noms.
  - La question porte sur l'origine de l'Hôte, pas sur le Module : refuser (ou accepter) vaut pour tous les Modules. Un refus se corrige dans les paramètres du site.
  - Les adresses que la Convention autorise dans `localNetwork` (`localhost`, loopback, IPv4 privée littérale, nom `.local`) sont exemptées du blocage du contenu mixte depuis l'Hôte en HTTPS. Un nom ordinaire qui pointe vers une adresse privée reste bloqué, sauf avec `fetch(url, { targetAddressSpace: "local" })`. La Convention l'interdit déjà.
  - Plus de pré-requête `Access-Control-Request-Private-Network` : seul CORS reste, avec l'origine `null`. Prometheus l'accepte par défaut (`--web.cors.origin=".*"`).
  - Une requête vers une origine locale non déclarée reste bloquée par la CSP, même une fois l'accès accordé.
- **Firefox 157** : *Local Network Access* est actif par défaut. La question porte sur le site principal, et l'iframe n'a pas besoin de délégation. En revanche, depuis l'Hôte en HTTPS, `http://` vers une IPv4 privée ou un nom `.local` est bloqué comme contenu mixte : seul le loopback passe. `navigator.permissions.query` répond toujours `denied`, même quand l'accès est accordé.
- **WebKit 27.2 (Playwright)** : ni question ni blocage. Le loopback et le réseau privé sont joints directement, y compris `http://192.168.x` depuis HTTPS. Safari n'a pas été vérifié à la main.

L'Hôte ne tourne aujourd'hui que dans Chrome et Edge, seuls à offrir `showDirectoryPicker` (ADR 0007). Les écarts de Firefox et de Safari n'ont donc pas d'effet en V1.

## Considered Options

- **Déléguer à toutes les iframes** : rejeté. Un Module sans `localNetwork` n'en a pas besoin, et la délégation lui permettrait de faire apparaître la question du navigateur au nom de Tessello, même si la CSP bloquerait ensuite la requête.
- **Ne déléguer que les noms correspondant aux entrées déclarées** (`loopback-network` pour `localhost`, `local-network` pour une adresse privée) : écarté. Les mesures montrent que l'ancien nom `local-network-access` reste nécessaire tant que Chrome le connaît, et il couvre les deux. Le gain serait nul.
- **Demander l'accès au nom du Module, dans l'écran d'accord de Tessello** : impossible. Seul le navigateur pose la question, et il la pose pour l'origine de l'Hôte.

## Consequences

- **Écran d'accord** : il reste celui du ticket 06. Le guide d'utilisation du Module prévient que le navigateur posera sa propre question.
- **Modules** : une requête refusée ressemble à un service éteint (`TypeError`). Un Module peut lire `navigator.permissions.query({ name: "local-network-access" })` pour savoir si le navigateur bloque. Firefox ne connaît pas ce nom, et répond `denied` aux nouveaux noms même quand il laisse passer : seul l'ancien nom est fiable. Le Module d'exemple « Local Prometheus » le fait.
- **Convention** : le §3.1 détaille ces règles pour les Créateurs.
- **Écart signalé (Firefox)** : si l'Hôte s'ouvre un jour à Firefox, `localNetwork` y sera limité au loopback, puisque `http://` vers une adresse privée est bloqué depuis l'Hôte en HTTPS. Pistes : le documenter et exiger `https://` pour ces appareils, passer par le Pont (qui fera les appels hors du navigateur), ou réviser la Convention pour n'admettre en `http://` que le loopback.
- **Tests** : `--ip-address-space-overrides` fait passer l'Hôte de test pour un site public. Le refus de l'Utilisateur se simule par `Browser.setPermission` (CDP), au niveau de l'origine de l'Hôte.
