# Approbation à l'entrée, Bannissement à tout moment, sans responsabilité du Mainteneur

Un nouveau Module n'entre dans la Marketplace qu'avec l'Approbation du Mainteneur, donnée une seule fois, à sa seule discrétion, sans liste de contrôle publiée. Les versions suivantes ne sont pas relues : la pull request qui ajoute une version est fusionnée automatiquement si la CI passe, si son auteur possède l'Espace de noms (ADR 0016) et si le Module n'est pas banni. Le Mainteneur peut refuser une soumission, ou bannir une version, un Module ou un Espace de noms entier, à tout moment et sans préavis. Ni l'Approbation ni le pouvoir de bannir ne le rendent responsable du code d'un Module : le Créateur répond de son code et de ce qu'il fait, et l'Utilisateur installe à ses risques (ADR 0008).

## Considered Options

- **Aucune relecture, seulement le Validateur** : rejeté. Le Mainteneur veut décider de qui entre dans la Marketplace.
- **Relecture de chaque version** : rejeté. Le Mainteneur ne contrôle pas les mises à jour, et la Marketplace ne doit pas laisser croire le contraire.
- **Une liste de contrôle publiée pour l'Approbation** : rejeté. Elle se lirait comme la promesse de ce qui a été vérifié, et ramènerait la responsabilité que cette décision écarte.

## Consequences

- **Créateurs** : `PUBLISHING.md` dit les règles, et la case à cocher du modèle de pull request vaut acceptation. L'Approbation n'est pas une garantie, les versions suivantes ne sont pas relues, le Module ou l'Espace de noms peut être banni sans préavis, et le code est fourni « tel quel », sous la seule responsabilité du Créateur.
- **Utilisateurs** : la fiche du Module, dans l'Hôte et sur le site, et l'écran d'accord disent : « Admis dans la Marketplace à sa première publication. Les mises à jour ne sont pas relues. Le Créateur répond de ce code, et vous l'installez à vos risques. » Avec un lien vers le dépôt source.
- **Traçabilité** : une Approbation est la fusion d'une pull request, et un Bannissement est un commit qui en donne la raison. L'historique public du dépôt en garde la trace.
- **Signalements** : un Utilisateur signale un Module par une issue GitHub du dépôt de la Marketplace.
- **Retrait** : un Créateur retire lui-même un de ses Modules ou une de ses versions, par une pull request fusionnée automatiquement. Un Retrait n'annule pas un Bannissement.
- **Texte juridique** : `PUBLISHING.md` est rédigé par le projet. Une relecture par un juriste est conseillée avant l'ouverture.
