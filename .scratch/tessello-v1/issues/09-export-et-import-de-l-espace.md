# 09: Export et import de l'espace

Spec parente : `.scratch/tessello-v1/spec.md`. Vocabulaire : `GLOSSARY.md`. Contrat : la Convention.

**What to build:** L'Utilisateur exporte tout son espace en un seul fichier et le retrouve à l'identique sur un autre navigateur ou appareil (ADR 0002).

**Blocked by:** 06 (Permissions : accord à l'installation et blocage réel)

**Status:** ready-for-agent

- [ ] L'export produit un fichier unique et autonome contenant les Modules (Manifeste et code), leurs données, les Permissions accordées et la disposition de l'Accueil.
- [ ] L'import d'un fichier valide restitue exactement l'espace exporté ; un fichier invalide est refusé avec une explication et ne modifie rien.
- [ ] Chaque Module importé repasse par le Validateur.
- [ ] Avant d'activer les Modules importés, l'Hôte présente leurs Permissions et demande l'accord de l'Utilisateur.
- [ ] Le comportement face à un espace non vide (remplacer ou fusionner) est défini, présenté à l'Utilisateur et documenté.
- [ ] L'aller-retour export → import est couvert au point d'entrée C.
