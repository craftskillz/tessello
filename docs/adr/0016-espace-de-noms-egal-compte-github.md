# L'Espace de noms d'un Créateur est son compte GitHub

L'Espace de noms `@nom` appartient au compte ou à l'organisation GitHub `nom`, en minuscules. Il n'y a pas d'inscription : la CI de la Marketplace vérifie que l'auteur de la pull request est ce compte, ou un membre public de cette organisation. Elle enregistre aussi l'identifiant numérique du compte, qui ne change jamais, à côté de son nom. Cela réserve les Espaces de noms à leurs Créateurs, comme l'exigeait l'ADR 0003, sans gérer de comptes (ADR 0014).

## Considered Options

- **Un Espace de noms libre, réservé par le premier qui le soumet** : rejeté. N'importe qui pourrait prendre le nom d'un autre, et le Mainteneur devrait trancher les litiges.
- **Une réservation par preuve DNS ou par fichier sur un site** : rejeté. C'est plus lourd pour le Créateur, alors que tout passe déjà par GitHub.

## Consequences

- **`@tessello` est réservé** : personne ne peut publier sous ce nom, qui reste celui des paquets npm du projet (`@tessello/sdk`, `@tessello/convention`…). Les Modules du Mainteneur sont publiés sous `@craftskillz`.
- **Cas rares, traités à la main** : si un compte GitHub est renommé, supprimé ou transféré, l'Espace de noms est gelé jusqu'à ce que le Mainteneur tranche. Un nouveau compte qui reprend un ancien nom n'hérite jamais de l'Espace de noms, puisque son identifiant numérique est différent.
- **Hors Marketplace**, rien ne change : l'Hôte accepte toujours n'importe quel Identifiant installé par fichier, par dossier ou par URL (ADR 0003).
