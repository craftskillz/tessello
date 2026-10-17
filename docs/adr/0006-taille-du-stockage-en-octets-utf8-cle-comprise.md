# La taille du stockage d'un Module se compte en octets UTF-8, clé comprise

La Convention (§6.1) limite une valeur à 1 Mo « once serialized » et le stockage d'un Module à 5 Mo au total, sans dire comment on mesure. L'Hôte compte la taille d'une valeur en octets UTF-8 de sa sérialisation JSON, et le total comme la somme, pour chaque entrée, des octets UTF-8 de la clé et de ceux de la valeur sérialisée. Les limites de §11 sont exprimées en octets, et l'octet UTF-8 est ce que coûte réellement une entrée dans un export ou sur le disque. Compter la clé empêche aussi de contourner le quota avec beaucoup de clés longues associées à de petites valeurs.

## Considered Options

- **Longueur de la chaîne JavaScript** (unités UTF-16) : rejeté. Un texte non latin ou des émojis dépasseraient le volume réel annoncé, et le résultat ne correspondrait ni à l'export ni à IndexedDB.
- **Valeurs seules, sans les clés** : rejeté. 5 Mo de clés de 256 caractères resteraient hors quota.

## Consequences

- La Convention (§6.1) est précisée en révision mineure : elle ne définissait pas la mesure, et aucun Hôte ne l'appliquait encore.
- Un Module proche du plafond doit compter avec ses clés : 5 valeurs de 1 Mo exactement ne tiennent pas.
