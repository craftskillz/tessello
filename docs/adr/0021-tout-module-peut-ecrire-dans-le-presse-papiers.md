# Tout Module peut écrire dans le presse-papiers, jamais le lire

L'Hôte pose `clipboard-write` dans l'attribut `allow` de l'iframe de chaque Vue et de chaque Widget, sans Permission à déclarer. Sans cette délégation, Chrome et Edge refusent `navigator.clipboard.writeText` dans l'iframe (`NotAllowedError`, « blocked because of a permissions policy »). Les boutons **Copy** de Git Integration ne copiaient donc rien, et le Survival Kit se rabattait sur « selected: press Ctrl+C ». `clipboard-read` n'est jamais délégué.

## Considered Options

- **Une Permission `clipboard` déclarée dans le Manifest et accordée à l'écran d'accord** : écartée. Elle touche le Validateur, l'écran d'accord et la Convention, pour un droit d'écriture que tout site web possède déjà sur sa propre page.
- **Laisser chaque Module se rabattre sur la sélection du texte** : écartée. Le bouton **Copy** ne copierait toujours pas.

## Consequences

- **Risque accepté** : un Module peut remplacer le contenu du presse-papiers, y compris sans geste de l'Utilisateur tant que l'onglet a le focus. Il ne peut pas le lire.
- **Convention** : le §4 le dit aux Créateurs. Un Module garde un repli (texte sélectionnable) pour les navigateurs qui refuseraient quand même.
- **Tests** : `packages/host/e2e/clipboard.test.ts` copie depuis une Vue et depuis un Widget.
