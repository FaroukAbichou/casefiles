# Project images (legacy path)

Per-case-study images now live next to the JSON:

`case-studies/<slug>/assets/`

Home `site.json` `projects[].image` and each `project.json` should use paths like:

`case-studies/<slug>/assets/<filename>.png`

## Unreferenced files

Raster files that are not yet assigned to a project can sit under `unreferenced/` until you move them into the right `case-studies/<slug>/assets/` folder.
