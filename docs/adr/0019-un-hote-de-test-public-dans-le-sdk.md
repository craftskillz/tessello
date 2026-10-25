# Un Hôte de test public dans le SDK, qui répond avec le protocole et le stockage de l'Hôte

Les règles d'un Module qui ont besoin d'un vrai navigateur (glisser, survol, clavier, gestes) se testent dans le dépôt du Module, sur sa propre page, et non plus dans les tests navigateur de l'Hôte (spec « des tests navigateur rapides et fiables », niveau 3). Pour cela, `@tessello/sdk` publie un **Hôte de test** sur un point d'entrée séparé, `@tessello/sdk/testing`. Le test ouvre la Vue ou le Widget du Module en haut de l'onglet. Le `connect()` du SDK envoie ses requêtes à `window.parent`, ici la page elle-même : un script ajouté à la page les transmet au test, qui y répond avec `createHost` de `@tessello/host-core`, en mémoire. Le code du Module ne change pas.

## Ce qu'il garantit

- **Le même protocole et les mêmes limites que l'Hôte** : les réponses, les codes d'erreur (`quota_exceeded`, `invalid_payload`, `not_ready`…), les limites de taille du stockage, la transmission des paramètres d'`openView` à une Vue chargée ou non, sont ceux de `@tessello/host-core`, que l'Hôte utilise aussi. Les deux thèmes sont ceux de l'Hôte.
- **Un stockage partagé par la Vue et le Widget**, gardé quand la page est rechargée, que le test pré-remplit, lit et modifie.

## Ce qu'il ne garantit pas

Ni bac à sable (`sandbox`), ni CSP, ni Permissions, ni Dossier des Modules, ni Manifeste lu, ni Validateur : la page du Module tourne sans iframe. Qu'un paquet publié fonctionne dans l'Hôte reste prouvé par les tests de contrat de l'Hôte (ticket 05 de la même spec). Un Module qui joint le réseau sans le déclarer passe donc ses propres tests : seul le contrat le voit.

## Considered Options

- **Un Hôte écrit pour les seuls tests, dans le SDK** : rejeté. Il aurait ses propres réponses et ses propres limites, qui s'écarteraient de celles de l'Hôte sans qu'aucun test le voie.
- **Ouvrir le Module dans une iframe d'une page de test** : rejeté. L'iframe est ce que les tests de contrat de l'Hôte prouvent déjà ; elle rendrait les tests du Module plus lents et plus difficiles à écrire (sélecteurs dans un cadre), sans rien prouver de plus sur le Module.
- **Publier `@tessello/host-core`** : rejeté. Il deviendrait une interface publique à maintenir. Le point d'entrée `testing` l'embarque compilé dans un seul fichier : le SDK reste sans dépendance, et le code d'un Module qui n'importe que `@tessello/sdk` n'en contient rien.

## Consequences

- Les déclarations de type de `@tessello/sdk/testing` ne mentionnent aucun type de `@tessello/host-core` : elles sont écrites à partir de ses seuls exports (`ts.transpileDeclaration`).
- Playwright n'est pas une dépendance du SDK : l'Hôte de test n'en demande que ce qu'il utilise d'une `Page` (`exposeFunction`, `addInitScript`, `evaluate`).
- L'utilitaire d'attente des tests (`until`, échéance réglable par `setWaitTimeout`, multipliée par `E2E_CPU_SLOWDOWN`) est publié au même endroit, pour que chaque Module n'ait pas à le réécrire.
