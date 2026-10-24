# 13: Publication npm

Spec parente : `.scratch/tessello-v1/spec.md`. Vocabulaire : `GLOSSARY.md`. Contrat : la Convention.

**What to build:** Un Créateur utilise `npx tessello`, le SDK et le Validateur hors de ce dépôt, et peut copier le SDK en un seul fichier dans son paquet.

**Blocked by:** 03 (Thème, visibilité, navigation et erreurs du protocole)

**Status:** ready-for-human

- [x] Le CLI, le SDK et le Validateur sont compilés en JavaScript et leurs paquets ne contiennent que ce qui est nécessaire.
- [x] Le SDK est aussi disponible en un fichier ES module unique, sans dépendance, utilisable par un Module sans outil de build ni Permission réseau.
- [x] Une installation locale des paquets construits (sans publication) permet de lancer `tessello validate` depuis un autre dossier.
- [ ] Les noms de paquets sont vérifiés comme disponibles ; la publication réelle sur npm n'est faite qu'avec l'accord explicite du mainteneur.
- [x] La suite de tests existante passe sur le code compilé.

### Marketplace (2026-10-22)

Décidé au grilling de la Marketplace (`.scratch/marketplace/spec.md`, ADR 0014 à 0018) :

- [x] Pas de commande `publish` dans ce ticket : elle viendra avec la Marketplace (ticket 09 de marketplace).
- [ ] Le scope npm `@tessello` est vérifié comme disponible et réservé (création de l'organisation npm avec l'accord du Mainteneur). Il reste celui des outils ; les Modules sont publiés sous l'Espace de noms de leur Créateur (ADR 0016).
- [x] Le futur paquet `@tessello/marketplace` (ticket 01 de marketplace) est publié de la même façon quand il existe.

## Comments

- 2026-10-24 — Fait, sauf la publication réelle et la réservation du scope, qui attendent le Mainteneur. `scripts/build-packages.ts` (`npm run build:packages`) compile `tessello`, `@tessello/sdk`, `@tessello/convention` et `@tessello/marketplace` avec `tsc` (`rewriteRelativeImportExtensions`) dans `packages/<nom>/dist/`, qui est le paquet : JavaScript, déclarations de types (sauf pour le CLI), un `package.json` réécrit vers ces fichiers (`exports`, `bin`, `engines`, `repository`), le README et la licence. Rien d'autre : ni sources TypeScript, ni tests, ni scripts. Les `package.json` de l'espace de travail ne changent pas : le dépôt continue de tourner sur les sources. On publie donc `dist/`, jamais le dossier du paquet (README, « The npm packages »).
- **SDK en un fichier** : `@tessello/sdk` contient `tessello-sdk.js`, la copie locale déjà produite par `build-local-copy.ts`, sans aucun import.
- **Tests sur le code compilé** : `npm run test:compiled` lance toute la suite (`npm test`) avec `scripts/use-compiled.ts`, un hook de résolution de Node qui remplace chaque fichier `src/*.ts` des quatre paquets par son `dist/*.js`. Il échoue si un fichier source n'a pas d'équivalent compilé. Vérifié en sabotant `dist/` : la suite compilée échoue et `npm test` passe. 1145 tests verts.
- **Installation locale** : `npm run test:packed` (`packages/cli/packed/install.test.ts`) construit les paquets, les emballe par `npm pack`, les installe dans un dossier temporaire, puis y lance `tessello validate` (exit 0 sur un Module installable, exit 1 sur un Module cassé), importe les trois bibliothèques par leur nom, vérifie leurs types avec `tsc` et contrôle le contenu des archives. 6 tests verts. `just packages` lance les deux.
- **Node** : le CLI ne s'appuie plus sur `import.meta.main` (Node 24) mais compare le chemin réel de `process.argv[1]`, car npm le lance par un lien symbolique. `engines: >=22.12` est vérifié : le CLI installé valide un dossier et un `.zip` sous Node 22.12.0.
- **Noms** : le 2026-10-24, le registre npm répond 404 pour `tessello`, `@tessello/sdk`, `@tessello/convention` et `@tessello/marketplace`, et « Scope not found » pour `@tessello` : aucun compte ni aucune organisation ne le détient.
- **Reste pour le Mainteneur** : créer l'organisation `tessello` sur npm (gratuite pour des paquets publics), qui réserve `@tessello`, puis publier dans l'ordre donné par le README (`npm publish --access public packages/<nom>/dist`). Après la publication, le ticket 10 de marketplace peut prendre `@tessello/sdk` sur npm.
