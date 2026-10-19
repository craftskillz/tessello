# L'import d'un espace fusionne sans rien écraser

L'export de l'espace (ADR 0002) est un `.zip` : `tessello-space.json` décrit l'espace (pour chaque Module son Identifiant, son dossier, sa version, les Permissions accordées et ses données ; puis la disposition de l'Accueil), et les fichiers de chaque Module sont sous `modules/<dossier>/`. Un Module enregistré dont le dossier a disparu ne peut pas être exporté sans son code : il est laissé de côté, et l'Hôte le dit.

Importer dans un espace qui n'est pas vide **fusionne** : les Modules dont l'Identifiant n'est pas installé sont ajoutés, avec leurs données, les Permissions accordées et leur place sur l'Accueil, après les Widgets déjà affichés. Un Module dont l'Identifiant est déjà installé est laissé tel quel, son code et ses données compris, et l'écran d'import le liste comme tel. Dans un espace vide, l'import restitue donc exactement l'espace exporté. L'import n'écrase jamais rien : il ne peut pas faire perdre de données.

Le fichier est vérifié en entier avant que rien ne soit écrit : ses tailles déclarées d'abord, pour ne jamais décompresser une archive démesurée ; puis chaque Module repasse le Validateur, les Permissions accordées doivent être des origines valides (la CSP en dépend) et les données doivent respecter les limites du stockage (§11). L'import n'accorde que les Permissions accordées que le Manifeste déclare encore : un export modifié à la main ne peut pas élargir ce que la CSP laisse passer, et une Permission que le Module ne déclare plus ne lui servait plus. Un seul défaut, et tout le fichier est refusé avec son explication. L'Utilisateur voit ensuite les Permissions de chaque Module ajouté et les accepte en bloc, ou annule (ADR 0004).

## Considered Options

- **Remplacer l'espace** : rejeté. C'est un chemin destructif, qui supprime des Modules et leurs données sur un geste, alors que le même résultat s'obtient en choisissant un Dossier des Modules vide avant d'importer.
- **Proposer à l'import le choix entre remplacer et fusionner** : rejeté pour la même raison, et pour garder un seul comportement simple à expliquer.
- **N'importer que dans un espace vide** : rejeté. Plus sûr, mais il interdit de rassembler deux espaces, et la fusion sans écrasement est tout aussi sûre.
- **Remplacer un Module déjà installé par la version importée** : rejeté. L'Hôte ne sait pas lequel des deux l'Utilisateur veut garder, et les données de l'installé seraient perdues. Pour reprendre la version importée, l'Utilisateur désinstalle d'abord le Module, puis importe.

## Consequences

- Les Modules ajoutés sont enregistrés en dernier : un import interrompu laisse des dossiers « nouveaux, à activer », jamais un Module enregistré sans ses données.
- Le format porte un numéro de version : un fichier d'une autre version est refusé avec une explication.
