# Cloudinary instead of GitHub raw

Your Next app ([farouk.work](https://farouk.work)) currently turns paths like `media/...` and `case-studies/...` into GitHub raw URLs:

```text
https://raw.githubusercontent.com/FaroukAbichou/casefiles/main/portfolio-content/<path>
```

To **switch delivery to Cloudinary**, you:

1. **Upload** this folder’s files under a fixed prefix (default: `portfolio-content/…`).
2. **Change the frontend** to build Cloudinary URLs instead of GitHub raw (use `resolve-portfolio-asset-url.ts` in this folder).

Cloudinary is a **CDN**, not a Git API: you still edit JSON in this repo (and/or use the local dashboard). After edits, run the upload script (or a CI job) so production matches the repo.

## 1. Cloudinary account

- Create a free account at [cloudinary.com](https://cloudinary.com).
- Dashboard → copy **Cloud name**, **API Key**, **API Secret**.

## 2. Upload from this repo

From the **casefiles** repo root (not `portfolio-content` only):

```bash
cp .env.cloudinary.example .env.cloudinary   # fill in secrets
npm install                                    # adds cloudinary for the script
npm run cloudinary:upload
```

`.env.cloudinary` is gitignored. Never commit secrets.

The script uploads everything under `portfolio-content/` with public IDs:

- **Images** (png, jpg, webp, gif, svg, avif, ico): `portfolio-content/<path-without-extension>`
- **Other files** (pdf, json, …): `portfolio-content/<full-relative-path>`

That matches `resolve-portfolio-asset-url.ts`.

## 3. Next.js (farouk.work)

Install nothing extra for **URL building** (optional: `@cloudinary/url-gen` later).

1. Copy `integrations/resolve-portfolio-asset-url.ts` into your Next repo.
2. Set in `.env.local`:

```bash
NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME=your_cloud_name
# optional:
NEXT_PUBLIC_CLOUDINARY_IMAGE_TRANSFORMS=f_auto,q_auto
NEXT_PUBLIC_CLOUDINARY_FOLDER_PREFIX=portfolio-content
```

3. Replace usages of `DEFAULT_PORTFOLIO_CONTENT_BASE` + string concat for **relative** asset paths with:

```ts
import { resolvePortfolioAssetUrlFromEnv } from "@/lib/resolve-portfolio-asset-url";

const src = resolvePortfolioAssetUrlFromEnv(project.image);
```

4. For **fetching JSON** (`site.json`, `manifest.json`, case study `project.json`):

- **Option A — keep GitHub for JSON only:** one small `fetch` still uses `raw.githubusercontent.com/.../site/site.json` while images use Cloudinary.
- **Option B — JSON on Cloudinary too:** upload includes `.json` as **raw**; use:

```ts
const base = `https://res.cloudinary.com/${cloud}/raw/upload/portfolio-content`;
await fetch(`${base}/site/site.json`);
```

(Use the exact path your uploads created; the upload script uses `portfolio-content/site/site.json` style public IDs for raw files.)

## 4. Caching & invalidation

The upload script uses `invalidate: true` so URLs refresh after re-upload. For heavy traffic, read Cloudinary’s cache docs.

## 5. Workflow summary

| Step | Where |
|------|--------|
| Edit content | This repo + dashboard, commit as usual |
| Deploy assets | `npm run cloudinary:upload` (or GitHub Action with secrets) |
| Site reads data | Next.js: Cloudinary URLs (+ optional GitHub fetch for JSON) |

If you want a **GitHub Action** that runs `cloudinary:upload` on every push to `main`, say so and we can add `.github/workflows/cloudinary-sync.yml`.
