# 09: Guide d'utilisation et test de bout en bout

Spec parente : `.scratch/git-integration/spec.md`. Décision : `docs/adr/0020-git-integration-et-tessello-sync-parlent-par-le-stockage-du-module.md`. Vocabulaire : `GLOSSARY.md`.

**What to build:** Le Guide d'utilisation du Module, et un test qui prouve que le canal marche dans le vrai Hôte.

**Blocked by:** 07, 08

**Status:** resolved

- [x] Le Guide est la documentation de l'Utilisateur : le README du CLI ne donne que la référence de `tessello sync` et renvoie au Guide. Il explique : à quoi sert le Module, la commande à lancer et qu'elle doit tourner, ce qui est versionné et ce qui ne l'est pas (les Modules, l'Accueil, le registre, la `config` ; jamais les données des Modules non choisis, le `status`, les dossiers qui ont leur propre `.git` ; un Module décoché sort de l'index et ses fichiers restent sur le disque ; la section `# >>> tessello sync` du `.gitignore`, où l'Utilisateur peut ajouter ses lignes autour), l'identité `tessello sync` des commits quand git n'en a pas, les secrets et le dépôt privé, chaque alerte et quoi faire, la restauration. Il dit qu'aucun serveur n'est contacté par le Module lui-même. Une ou deux captures prises dans l'Hôte.
- [x] Un test de bout en bout dans `tessello` (comme les tests des Modules de `packages/host/e2e/fixtures/`) : on installe le Module dans l'Hôte, on saisit un dépôt (un dépôt nu local) et on coche un Module, puis un autre Module écrit une clé. `tessello sync --once` la commite et la pousse, et la Vue affiche le nouveau commit.
- [x] Le paquet passe `tessello validate` sans erreur ni avertissement.

## Comments

- 2026-11-06 : réalisé. Le Guide (`guide/guide.md` de `craftskillz/tessello-git-integration`, avec `images/view.png` et `images/widget.png` prises dans l'Hôte) ; le README du CLI ne donne plus que la référence de `tessello sync` et renvoie au Guide. Le test de bout en bout est `packages/host/e2e/git-integration.test.ts`, et le paquet est une nouvelle fixture (`fixtures/git-integration.zip`, construite depuis `main`) avec son entrée dans `modules-contract.test.ts`. `tessello validate` : 0 avertissement. Choix faits :
  - Le Dossier des Modules des tests est dans l'OPFS, qu'aucun programme hors du navigateur n'ouvre : le test copie ce dossier, octet par octet (`readFolderBytes`), dans un dossier du disque gardé d'un tour à l'autre, y lance le vrai `tessello sync --once`, puis réécrit dans l'OPFS le `status.json` laissé par la commande. Les fichiers copiés sont datés d'une minute plus tôt, pour passer la période de calme de 10 s.
  - git ne voit pas la configuration du développeur (`GIT_CONFIG_GLOBAL` vide, `GIT_CONFIG_NOSYSTEM`) : la commande commite sous l'identité `tessello sync`. Le dépôt distant est un dépôt nu local, donc aucune requête de visibilité.
  - Les deux commits du test touchent Git Integration (sa `config` et `seen` sont versionnées) et Survival Kit : le texte de la Vue est le même. Le test vérifie que le `status` nomme le nouveau commit du dépôt nu, puis que la Vue affiche « Last commit just now » et « Last push just now ».
  - Le problème `not-a-modules-folder` n'arrive jamais à la Vue : la commande s'arrête avant d'écrire le `status`. Le Guide le décrit comme un message du terminal ; le texte de la Vue (`problem_not_a_modules_folder`) reste, inatteignable.
