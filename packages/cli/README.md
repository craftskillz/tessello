# tessello

The Tessello command-line tool.

```sh
npx tessello validate my-module          # a Module folder
npx tessello validate my-module.zip      # or its .zip
npx tessello validate my-module --json   # the report as JSON
```

It checks the Module against the Tessello [Convention](https://github.com/craftskillz/tessello/blob/main/convention/CONVENTION.md) and exits with 1 when the Module is not installable, 0 otherwise. Every error and warning names the file and says what to change: fix them until there is no error left, then zip the *contents* of the folder (not the folder itself).

## Publishing a Module

```sh
npx tessello publish my-module.zip --url https://me.github.io/modules/my-module-1.0.0.zip --accept-terms
```

Host the `.zip` somewhere first, then run this. `tessello publish` prepares the Marketplace listing for that exact package and opens the pull request, with no Tessello server in between. A new Module awaits the Maintainer's Approval; a new version of a listed Module is merged automatically once the CI passes.

Before anything is opened it runs, on your machine, the checks the Marketplace CI will run: the package is validated, the URL must answer 200 with the same bytes as your `.zip` and send `Access-Control-Allow-Origin: *` (GitHub Pages does; GitHub Releases does not), the version must be new, and the Namespace must be yours. Every problem is printed with a `✗` and the command exits with 1.

| Option | |
| --- | --- |
| `--url <URL>` | Where you published this exact `.zip` (required). |
| `--accept-terms` | You have read [PUBLISHING.md](https://github.com/craftskillz/tessello-marketplace/blob/main/PUBLISHING.md) and accept its terms. Required: the pull request ticks the box in your name. |
| `--source <repo URL>` | `https://github.com/<owner>/<repo>`, for a new Module. Default: the git remote `origin` of the current folder, when it is on GitHub. |
| `--license <SPDX>` | For a new Module. Default: the license GitHub reports for the source. |
| `--tag <tag>` | A tag for the listing; repeat it for several. They replace the previous tags. |
| `--marketplace <owner/name>` | Another Marketplace repository. Default: `craftskillz/tessello-marketplace`. |
| `--out <folder>` | Where the listing is written when no pull request is opened. Default: `./tessello-listing`. |
| `--dry-run` | Run every check and write the listing, but open nothing. |

With the [GitHub CLI](https://cli.github.com) (`gh`) installed and logged in, the pull request is opened for you: your fork of the Marketplace is created and synced if you cannot push to it, a branch `publish/<namespace>-<name>-<version>` carries the listing, and the pull request is opened from it. If an earlier run stopped half-way, running it again reuses that branch and updates the listing on it; if its pull request is already open, the command shows it. If a step fails, it says which one and keeps the listing in the `--out` folder so nothing is lost.

Without `gh`, or with `--dry-run`, the listing is written to `tessello-listing/modules/<namespace>/<name>/entry.json`. Without `gh` the command also lists the steps by hand: fork the Marketplace, add that file at the same path, open a pull request, tick the box.

It exits with 0 when done, 1 when a check or a step fails, and 2 on a usage error.

## Running the Host on your computer

If https://tessello.pages.dev/ is filtered or stopped, your installed Modules are still in your Modules folder. To reach them:

```sh
npx tessello serve
```

Open http://127.0.0.1:7355/ in Chrome or Edge and choose your Modules folder: your Modules, their data, their accepted Permissions and your Home are there. Only your theme and language are set again. Nothing else on your network can reach this server. To be ready even when npm cannot be reached, run `npm install --global tessello` beforehand; `tessello serve` then needs no network.

The port is part of the address, so use `--port <number>` only if 7355 is taken: on another port you choose the folder again. Once opened, the Host also reopens at this address when the command is not running, but it only updates while it runs. Modules that call an outside service still need that service to be reachable.

It exits with 1 if the port is already in use and 2 on a usage error.

## Backing up your Modules folder with git

```sh
npx tessello sync                     # the current folder, until Ctrl+C
npx tessello sync my-modules          # or the folder you choose
npx tessello sync --once              # a single round, then it stops
```

Run it in your Modules folder: it commits what changed to the folder's git repository. It is the engine of the Git Integration Module, where you choose what is versioned. That Module's guide explains how to set it up, what is kept out of the repository and how to restore on another machine. It runs in the foreground, one round every interval you set in that Module (re-read at each round), and stops cleanly on Ctrl+C; `--once` makes a single round. Only one instance runs per folder (`.tessello/sync.lock`; a lock left by a dead process is taken over). Nothing is pushed yet.

With `--once` it exits with 0 when the round ran without problem, 1 when there is one (not a Modules folder, git missing, no configuration, another instance running; the message says what to do), and 2 on a usage error.
