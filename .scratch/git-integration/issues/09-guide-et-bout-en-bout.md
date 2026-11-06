# 09: Guide d'utilisation et test de bout en bout

Spec parente : `.scratch/git-integration/spec.md`. Décision : `docs/adr/0020-git-integration-et-tessello-sync-parlent-par-le-stockage-du-module.md`. Vocabulaire : `GLOSSARY.md`.

**What to build:** Le Guide d'utilisation du Module, et un test qui prouve que le canal marche dans le vrai Hôte.

**Blocked by:** 07, 08

**Status:** ready-for-agent

- [ ] Le Guide est la documentation de l'Utilisateur : le README du CLI ne donne que la référence de `tessello sync` et renvoie au Guide. Il explique : à quoi sert le Module, la commande à lancer et qu'elle doit tourner, ce qui est versionné et ce qui ne l'est pas (les Modules, l'Accueil, le registre, la `config` ; jamais les données des Modules non choisis, le `status`, les dossiers qui ont leur propre `.git` ; un Module décoché sort de l'index et ses fichiers restent sur le disque ; la section `# >>> tessello sync` du `.gitignore`, où l'Utilisateur peut ajouter ses lignes autour), l'identité `tessello sync` des commits quand git n'en a pas, les secrets et le dépôt privé, chaque alerte et quoi faire, la restauration. Il dit qu'aucun serveur n'est contacté par le Module lui-même. Une ou deux captures prises dans l'Hôte.
- [ ] Un test de bout en bout dans `tessello` (comme les tests des Modules de `packages/host/e2e/fixtures/`) : on installe le Module dans l'Hôte, on saisit un dépôt (un dépôt nu local) et on coche un Module, puis un autre Module écrit une clé. `tessello sync --once` la commite et la pousse, et la Vue affiche le nouveau commit.
- [ ] Le paquet passe `tessello validate` sans erreur ni avertissement.
