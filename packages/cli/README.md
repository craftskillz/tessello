# tessello

The Tessello command-line tool.

```sh
npx tessello validate my-module          # a Module folder
npx tessello validate my-module.zip      # or its .zip
npx tessello validate my-module --json   # the report as JSON
```

It checks the Module against the Tessello [Convention](https://github.com/craftskillz/tessello/blob/main/convention/CONVENTION.md) and exits with 1 when the Module is not installable, 0 otherwise. Every error and warning names the file and says what to change: fix them until there is no error left, then zip the *contents* of the folder (not the folder itself).
