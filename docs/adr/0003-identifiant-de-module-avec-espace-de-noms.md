# Un Module est identifié par un Identifiant avec Espace de noms

Chaque Module déclare dans son Manifeste un Identifiant de la forme `@espace/nom`, stable entre ses versions. C'est cet Identifiant — et non l'URL ou le fichier d'origine — qui permet à l'Hôte de reconnaître une mise à jour et de rattacher les données stockées du Module ; le changer revient donc à créer un nouveau Module et à perdre ses données.

## Considered Options

- **Identifiant libre sans préfixe** : rejeté, collisions inévitables dès que plusieurs Créateurs publient.
- **Identification par URL d'origine** : rejeté, inapplicable à l'installation par fichier.

## Consequences

- En local, l'Hôte ne peut pas distinguer une mise à jour d'un autre Module réutilisant le même Identifiant : il traite toujours un Identifiant connu comme une mise à jour, après confirmation de l'Utilisateur (nom et version installés vs entrants).
- La marketplace devra réserver les Espaces de noms à leurs Créateurs.
