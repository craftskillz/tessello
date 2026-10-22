# L'Hôte propose les mises à jour et signale les Bannissements, sans jamais rien faire à la place de l'Utilisateur

Pour un Module venu de la Marketplace, l'Hôte signale une nouvelle version, un Bannissement ou un Retrait, mais ne met jamais à jour et ne désinstalle jamais de lui-même. Une mise à jour passe par le parcours existant : téléchargement, vérification de l'empreinte, Validateur, puis écran de différence des Permissions, et n'a lieu que sur un clic de l'Utilisateur. Un Module banni continue de fonctionner, avec un avertissement qui donne la raison et propose de le désinstaller. L'Espace appartient à l'Utilisateur (ADR 0002) : désinstaller à sa place détruirait ses données sans son accord, et mettre à jour à sa place installerait un code que personne n'a relu (ADR 0015).

## Considered Options

- **Désinstaller automatiquement un Module banni** : rejeté. Les données de l'Utilisateur seraient perdues sans qu'il le décide, et le Bannissement pourrait viser un défaut sans gravité.
- **Mettre à jour automatiquement** : rejeté. La spec V1 l'avait déjà écarté pour l'installation par URL, et une nouvelle version est précisément du code non relu.

## Consequences

- **Provenance** : le registre de l'Hôte note d'où vient chaque Module. Un Module n'est « de la Marketplace » que si le paquet installé a l'empreinte d'une de ses versions. Un Module de même Identifiant ajouté par le Dossier des Modules ou par un `.zip` local, comme celui d'un Créateur qui le développe, reste local : ni proposition de mise à jour, ni avertissement de Bannissement.
- **Interrogation de la Marketplace** : l'Hôte télécharge l'index à l'ouverture de l'écran de la Marketplace, et au démarrage au plus une fois par jour. Il garde la dernière copie, consultable hors ligne avec sa date.
- **Signaux** : un badge dans le Lanceur et sur le Widget. Un Bannissement donne un avertissement. Un Retrait par le Créateur donne une note neutre. Une version bannie donne le même avertissement, qui recommande la version la plus récente si elle existe.
