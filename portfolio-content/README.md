# portfolio-content

Single source of truth for portfolio **case studies**, **writing list**, and **shared media** consumed by [farouk.work](https://farouk.work) (or any frontend).

## Layout

| Path | Purpose |
|------|---------|
| `case-studies/manifest.json` | `{ "slugs": ["blinkdo", "ecoquest", …] }` — drives project discovery |
| `case-studies/{slug}.json` | One `ProjectData` file per case study (same schema as before) |
| `blog/articles.json` | `{ "articles": [ … ] }` — writing section links |
| `media/` | Images, GIFs, thumbnails referenced as `media/...` inside JSON |

## URL rules in JSON

- Use **lowercase** filenames, no spaces: e.g. `media/projects/tamdone.png`.
- Reference assets with paths **relative to this folder**, starting with `media/`:
  - Good: `"src": "media/projects/tamdone.png"`
  - Avoid: `/images/projects/...` (old app-local paths)

The frontend prepends your GitHub raw base URL (see env vars in the Next app).

## GitHub raw base

After pushing this repo to GitHub (e.g. `github.com/you/casefiles` on branch `main`):

```text
https://raw.githubusercontent.com/you/casefiles/main/portfolio-content
```

Use that value (no trailing slash) for `PORTFOLIO_CONTENT_BASE_URL` and `NEXT_PUBLIC_PORTFOLIO_CONTENT_BASE_URL` in the Next.js app.

## Local editing without pushing

Set in the Next app `.env.local`:

```bash
PORTFOLIO_CONTENT_ROOT=/absolute/path/to/portfolio-content
```

JSON is read from disk; image URLs still need the public `NEXT_PUBLIC_PORTFOLIO_CONTENT_BASE_URL` unless you only care about copy (thumbnails may stay as `media/...` until the base is set).

## Adding a case study

1. Add `media/projects/{slug}.png` (or matching assets under `media/`).
2. Add `case-studies/{slug}.json` (see schema in the former `content/projects/README.md` in the main repo, now mirrored below).
3. Append `slug` to `case-studies/manifest.json` → `slugs` array.
4. Commit and push `casefiles`.

## Blog / writing

Edit `blog/articles.json`. Shape:

```json
{
  "articles": [
    {
      "id": "article-1",
      "title": "Post title",
      "url": "https://…",
      "readTime": "2 m",
      "date": "May 30, 2025",
      "description": "Optional"
    }
  ]
}
```
