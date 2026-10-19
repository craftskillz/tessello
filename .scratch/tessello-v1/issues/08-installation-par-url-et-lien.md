# 08: Installation par URL et lien d'installation

Spec parente : `.scratch/tessello-v1/spec.md`. Vocabulaire : `GLOSSARY.md`. Contrat : la Convention. Décision : ADR 0009.

**What to build:** L'Utilisateur installe un Module en collant l'URL de son `.zip`, ou en ouvrant un lien d'installation qui l'amène dans l'Hôte avec le Module prêt à installer. L'Hôte télécharge le paquet directement depuis le navigateur, sans intermédiaire (ADR 0009), puis suit le même parcours que l'installation par fichier : Validateur, écran d'accord, ou écran de mise à jour si l'Identifiant est déjà installé. `tessello install` est retiré de la V1 (voir les commentaires).

**Blocked by:** 04 (Premier Module dans le navigateur)

**Status:** ready-for-agent

- [ ] Un champ « Install from a URL », à côté du choix d'un `.zip`, télécharge le paquet et lance le même parcours que l'installation par fichier. L'écran d'accord affiche l'URL d'origine sous le nom, la version et l'Identifiant.
- [ ] Seules les URL `https:` sont acceptées, plus `http://localhost` et `http://127.0.0.1` pour les Créateurs. Toute autre URL (`http:` ailleurs, `data:`, `blob:`, `file:`…) est refusée avant toute requête, avec une explication.
- [ ] Un échec réseau et un refus CORS, que le navigateur ne distingue pas, donnent un seul message : le serveur est injoignable ou n'autorise pas Tessello à télécharger le fichier. Le message propose de télécharger le `.zip` soi-même et de le déposer dans l'Hôte.
- [ ] Un téléchargement qui dépasse `LIMITS.packageBytes` est interrompu, d'abord d'après `Content-Length`, puis en comptant les octets reçus. Il est refusé avec le code `package/too-large`.
- [ ] Le lien d'installation a la forme `https://<Hôte>/#install=<URL encodée>`. L'Hôte lit le fragment au chargement, puis le retire avec `history.replaceState` pour qu'un rechargement ne relance pas l'installation.
- [ ] Si le Dossier des Modules n'est pas encore choisi ou autorisé, l'URL en attente est conservée pendant le choix ou la reconnexion du dossier. Le téléchargement démarre ensuite seul. Rien n'est jamais installé sans l'accord de l'écran d'installation.
- [ ] Un Module installé par URL se comporte exactement comme un Module installé par `.zip`. Le registre n'enregistre pas son URL d'origine (pas de mise à jour automatique en V1).
- [ ] La page « navigateur non pris en charge » explique la vraie raison : le navigateur ne laisse pas une page web utiliser un dossier de l'ordinateur, alors que Chrome et Edge sur ordinateur le font. La détection reste celle de `showDirectoryPicker`. Ouverte par un lien d'installation, elle indique aussi l'URL du Module et propose un bouton qui copie le lien.
- [ ] La règle « contenu à la racine du `.zip` » reste stricte. Un « Download ZIP » de dépôt GitHub (dossier racine imbriqué, sans CORS) n'est pas pris en charge.
- [ ] La Convention (§8) contient une note « Publishing your Module » : un hébergement qui envoie les en-têtes CORS (GitHub Pages, `raw.githubusercontent.com`) et un contenu à la racine du `.zip`.
- [ ] Les vérifications du schéma d'URL et de la taille sont testées là où elles sont écrites. Les tests navigateur (point d'entrée D) couvrent : le lien avec le dossier prêt, le lien conservé pendant le choix du dossier, l'installation par URL, une URL servie sans CORS depuis une seconde origine, un téléchargement trop gros interrompu et un schéma refusé. Le serveur de test ouvre un second port, servi avec et sans CORS.

## Comments

### À revoir après l'ADR 0007 (2026-10-18)

Un Module est désormais un dossier du Dossier des Modules. Il y entre par `git clone`, par copie, ou parce que son Créateur y travaille sur place. `tessello install <dossier>` n'a donc plus d'objet, et la question « comment transmettre un dossier local à l'Hôte » disparaît. Restent l'installation par URL, le lien d'installation et `tessello install <zip|url>` : leur utilité et leur forme sont à retrancher avant de passer ce ticket en `ready-for-agent`.

### Triage (2026-10-19)

Session de grilling. Décisions :

- **`tessello install` retiré de la V1.** Un Créateur travaille sur place dans le Dossier des Modules, et pour tester son `.zip` il le dépose dans l'Hôte. Pour une URL, la commande ne ferait qu'ouvrir un lien. Le seul cas difficile, un `.zip` local, coûtait trop cher : un serveur local temporaire déclenche l'invite d'accès au réseau local de Chrome, et une décompression dans le dossier aurait exigé que le CLI connaisse son emplacement. L'histoire 6 passe hors périmètre, et la question technique de la spec sur le `.zip` local devient sans objet.
- **Téléchargement direct, sans proxy** (ADR 0009). Un proxy règlerait CORS, mais ce serait un serveur à faire tourner, contraire au local-first et à la contrainte de coût.
- **Lien dans le fragment** (`#install=`), qui ne part jamais vers Cloudflare, et retiré une fois lu.
- **URL en attente conservée** pendant le choix du dossier, téléchargement automatique ensuite, et URL d'origine affichée à l'écran d'accord.
- **Schémas** limités à `https:` et au `localhost` des Créateurs. **Taille** interrompue au-delà de la limite du paquet.
- **Aucun champ nouveau** dans le registre.
- **Navigateur non pris en charge** : la détection est fonctionnelle (`showDirectoryPicker`), pas un nom de navigateur. Elle n'a pas à être configurable : sans cette API, l'Hôte ne peut pas ouvrir le Dossier des Modules. Opera, Vivaldi, Arc et Brave (une fois le réglage activé dans `brave://flags`) passent d'eux-mêmes. Seul le message change : il donne la raison au lieu de nommer deux navigateurs.
- **Ticket 12** : si l'Hôte reçoit sa propre CSP, `connect-src` doit autoriser `https:` et le `localhost` des Créateurs.
