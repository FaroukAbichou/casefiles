# portfolio-content

Single source of truth for portfolio **site copy**, **case studies**, **writing list**, and **media** consumed by [farouk.work](https://farouk.work).

## Layout

| Path | Purpose |
|------|---------|
| `site/site.json` | Home page: hero, optional `brandAssets` (favicon, photo, signatures), optional `documents` (PDF paths), projects list, experience, education, testimonials, certifications, sections metadata, etc. |
| `case-studies/manifest.json` | `{ "slugs": [...] }` — case study discovery |
| `case-studies/{slug}.json` | One case study file per project (`ProjectData`). Use `relatedProjects: ["other-slug", ...]` to cross-link. |
| `blog/articles.json` | `{ "articles": [ … ] }` — writing section |
| `media/projects/` | Project thumbnails & case study images (`media/projects/{slug}.png`) |
| `media/site/` | Site-wide assets: `icons/`, `brand/`, `people/`, `education/`, `experience/`, root SVGs like `softylines.svg` |
| `media/marketing/banners/` | Open Graph / social preview images (referenced from the Next app) |
| `media/documents/` | CV and resume PDFs (`cv-product-designer-*.pdf`, `resume-*.pdf`) |
| `media/tools/` | Case study tool strip: `{icon}-light.svg` and `{icon}-dark.svg` per `tools[].icon` in case study JSON. Regenerate from the Next repo: `npm run sync-tool-icons`. |

## After you edit content

1. Commit and push this repo (`casefiles`).
2. Sync the Next app fallback (used if GitHub is slow or 404): copy `site/site.json` → `farouk.work/app/home/data/site.fallback.json`.
3. After adding or renaming `tools[].icon` entries, run `npm run sync-tool-icons` in `farouk.work` (writes into this repo’s `media/tools/`).

## URL rules in JSON

- Use **lowercase** filenames where possible.
- In-repo assets: paths starting with `media/` (e.g. `media/site/icons/badge.svg`).
- External URLs (Unsplash, Clearbit, etc.) stay full `https://...` strings.

The Next app prepends the GitHub raw base for every `media/...` value (see `DEFAULT_PORTFOLIO_CONTENT_BASE` in the frontend).

## GitHub raw base

```text
https://raw.githubusercontent.com/FaroukAbichou/casefiles/main/portfolio-content
```

Override with `PORTFOLIO_CONTENT_BASE_URL` / `NEXT_PUBLIC_PORTFOLIO_CONTENT_BASE_URL` if the repo or branch differs.

## Adding a case study

1. Add assets under `media/projects/`.
2. Add `case-studies/{slug}.json` and set `relatedProjects` to other slugs.
3. Append `slug` to `case-studies/manifest.json`.
4. Add or update the project entry in `site/site.json` (`projects[]`) with `"link": "/projects/{slug}"` and matching `image`: `media/projects/{slug}.png`.

## Blog / writing

Edit `blog/articles.json` (see previous schema docs).
