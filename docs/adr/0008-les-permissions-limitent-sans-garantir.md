# Les Permissions limitent ce qu'un Module peut faire, sans le garantir

L'Hôte garde ses contrôles, mais ne les présente jamais comme une garantie. Il dit à l'Utilisateur qu'installer un Module, c'est lui faire confiance. Certains contrôles sont garantis par le navigateur. Un Module tourne dans une iframe sandbox d'origine opaque (ADR 0001) : il ne lit ni les fichiers du Dossier des Modules, ni l'Hôte, ni les autres Modules, et une page web ne peut lancer aucun processus sur la machine. Ce qu'un Module voit se limite donc à son stockage, à ce que l'Utilisateur y saisit et au contexte que l'Hôte lui donne. D'autres contrôles ne sont pas étanches :

- **le réseau** : la CSP bloque les requêtes vers une origine non déclarée, mais WebRTC et l'ouverture d'un onglet laissent sortir des données (fuites mesurées, ADR 0005) ;
- **le code** : un `git pull` change le code d'un Module sans nouvel accord, tant que ses Permissions ne changent pas (ADR 0007) ;
- **le disque** : un dossier de Module reste un dossier comme un autre. Tessello n'en exécute rien hors de l'iframe, mais les outils de l'Utilisateur peuvent le faire, par exemple `npm install`, les tâches proposées par un éditeur ou un exécutable lancé d'un double-clic.

La confiance dans un Module vient de la lecture de son code, par l'Utilisateur ou par un audit, par exemple sur une future marketplace. Elle ne vient pas des Permissions.

## Considered Options

- **Présenter les Permissions comme une garantie** (lecture littérale de l'ADR 0004, « l'Hôte bloque tout accès non déclaré ») : rejeté. Aucune CSP ne bloque WebRTC : promettre plus que ce qui est appliqué tromperait l'Utilisateur.
- **Supprimer les contrôles et seulement avertir** : rejeté. L'isolation vis-à-vis du disque, de l'Hôte et des autres Modules est réelle et ne coûte rien. La CSP bloque le cas courant (`fetch`, images, formulaires), et les Permissions déclarées disent ce que le Module prétend faire.
- **Fermer les fuites dans le runtime** (supprimer `RTCPeerConnection`, intercepter `window.open`) : rejeté. Le runtime n'est pas une frontière de sécurité : un Module le contourne (ADR 0005).

## Consequences

- **Écran d'accord (ticket 06)** : il doit présenter les trois cas, sans promettre plus :
  - ce qui est isolé : les fichiers, l'Hôte, les autres Modules ;
  - ce qui est limité : les serveurs que le Module contacte ;
  - ce qui n'est pas garanti : un Module peut envoyer ailleurs ce que l'Utilisateur y saisit. N'installer que des Modules de confiance.
- **ADR 0004** : « l'Hôte bloque tout accès non déclaré » se lit désormais comme « l'Hôte limite » : le blocage est appliqué, mais il n'est pas étanche.
- **Dossier des Modules** : le guide des Créateurs et le texte du premier lancement doivent rappeler de ne rien lancer dans un dossier de Module sans savoir ce que c'est (`npm install`, exécutable, tâches d'éditeur).
- **Marketplace** : l'audit du code source est l'endroit où une confiance réelle peut s'établir, et cela reste à discuter.
- **Pont** : dès qu'il exécutera des commandes, limiter ne suffira plus. Son ADR devra définir ce qui est réellement garanti.
