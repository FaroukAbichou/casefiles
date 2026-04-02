# portfolio-content

Single source of truth for portfolio **site copy**, **case studies**, **writing list**, and **media** consumed by [farouk.work](https://farouk.work).

## Layout

| Path | Purpose |
|------|---------|
| `site/site.json` | Home page: hero, optional `brandAssets` (favicon, photo, signatures), optional `documents` (PDF paths), `projects[]` (each entry may set `homeCanvasPriority`: lower = higher on the home canvas; only prioritized entries appear there, max 6 desktop / 4 tablet), experience, education, testimonials, certifications, sections metadata, etc. |
| `case-studies/manifest.json` | `{ "slugs": [...] }` — case study discovery |
| `case-studies/{slug}/project.json` | One case study file per project (`ProjectData`). Use `relatedProjects: ["other-slug", ...]` to cross-link. |
| `case-studies/{slug}/assets/` | Raster images, GIFs, and other files used only by that case study. Reference them in JSON as `case-studies/{slug}/assets/<file>`. |
| `blog/articles.json` | `{ "articles": [ … ] }` — writing section |
| `media/site/` | Site-wide assets: `icons/`, `brand/`, `people/`, `education/`, `experience/`, root SVGs like `softylines.svg` |
| `media/marketing/banners/` | Open Graph / social preview images (referenced from the Next app) |
| `media/documents/` | CV and resume PDFs (`cv-product-designer-*.pdf`, `resume-*.pdf`) |
| `media/tools/` | Case study tool strip: `{icon}-light.svg` and `{icon}-dark.svg` per `tools[].icon` in case study JSON. Regenerate from the Next repo: `npm run sync-tool-icons`. |
| `media/projects/unreferenced/` | Optional holding area for images not yet tied to a case study folder |

## After you edit content

1. Commit and push this repo (`casefiles`).
2. If you use **Cloudinary** for delivery, run `npm run cloudinary:upload` from the repo root (after configuring `.env.cloudinary`). See `integrations/CLOUDINARY.md`.
3. Sync the Next app fallback (used if remote JSON is slow or 404): copy `site/site.json` → `farouk.work/app/home/data/site.fallback.json`.
4. After adding or renaming `tools[].icon` entries, run `npm run sync-tool-icons` in `farouk.work` (writes into this repo’s `media/tools/`).

## URL rules in JSON

- Use **lowercase** filenames where possible.
- In-repo assets: paths starting with `media/` (site-wide) or `case-studies/{slug}/assets/` (per project).
- External URLs (Unsplash, Clearbit, etc.) stay full `https://...` strings.

### Serving assets: GitHub raw (legacy) or Cloudinary

**GitHub raw:** the Next app can prepend a base URL for every relative `media/...` and `case-studies/...` path:

```text
https://raw.githubusercontent.com/FaroukAbichou/casefiles/main/portfolio-content
```

Override with `PORTFOLIO_CONTENT_BASE_URL` / `NEXT_PUBLIC_PORTFOLIO_CONTENT_BASE_URL` if the repo or branch differs.

**Cloudinary (recommended CDN):** use `integrations/resolve-portfolio-asset-url.ts` in the Next app and upload this folder with `npm run cloudinary:upload`. Full steps: **`integrations/CLOUDINARY.md`**.

## Adding a case study

1. Create `case-studies/<slug>/assets/` and add thumbnails and inline images there.
2. Add `case-studies/<slug>/project.json` and set `relatedProjects` to other slugs.
3. Append `slug` to `case-studies/manifest.json`.
4. Add or update the project entry in `site/site.json` (`projects[]`) with `"link": "/projects/{slug}"` and matching `image`: `case-studies/{slug}/assets/<thumbnail>.png` (or webp).

## Blog / writing

Edit `blog/articles.json` (see previous schema docs).
