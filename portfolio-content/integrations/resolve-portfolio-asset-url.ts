/**
 * Drop this into farouk.work (e.g. lib/resolve-portfolio-asset-url.ts) and use
 * wherever you currently prepend DEFAULT_PORTFOLIO_CONTENT_BASE / GitHub raw.
 *
 * Env (Next.js):
 *   NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME=your_cloud_name
 *   NEXT_PUBLIC_CLOUDINARY_IMAGE_TRANSFORMS=f_auto,q_auto   (optional)
 */

const IMAGE_EXT = /\.(png|jpe?g|gif|webp|svg|avif|ico)$/i;

function isAbsoluteUrl(s: string): boolean {
  return /^https?:\/\//i.test(s.trim());
}

export type ResolvePortfolioUrlOptions = {
  cloudName: string;
  /** Default image delivery transforms (no leading/trailing slashes). */
  imageTransforms?: string;
  /**
   * Public ID prefix used when uploading (see scripts/cloudinary-upload.mjs).
   * Must match uploads. Default: portfolio-content
   */
  folderPrefix?: string;
};

/**
 * Turn a JSON path like `case-studies/kotteb/assets/cover.png` or
 * `media/site/people/photo.png` into a Cloudinary HTTPS URL.
 * Full `https://...` values are returned unchanged.
 */
export function resolvePortfolioAssetUrl(
  pathOrUrl: string | null | undefined,
  opts: ResolvePortfolioUrlOptions
): string {
  if (pathOrUrl == null) return "";
  const s = pathOrUrl.trim();
  if (!s) return "";
  if (isAbsoluteUrl(s)) return s;

  const rel = s.replace(/^\/+/, "");
  const prefix = (opts.folderPrefix ?? "portfolio-content").replace(/\/$/, "");
  const cloud = opts.cloudName;
  const transforms = (opts.imageTransforms ?? "f_auto,q_auto").replace(/^\/+|\/+$/g, "");

  if (IMAGE_EXT.test(rel)) {
    const withoutExt = rel.replace(/\.[^./\\]+$/, "");
    const publicId = `${prefix}/${withoutExt}`;
    const t = transforms ? `${transforms}/` : "";
    return `https://res.cloudinary.com/${cloud}/image/upload/${t}${publicId}`;
  }

  const publicPath = `${prefix}/${rel}`;
  return `https://res.cloudinary.com/${cloud}/raw/upload/${publicPath}`;
}

/** Next.js-friendly helper using public env vars */
export function resolvePortfolioAssetUrlFromEnv(
  pathOrUrl: string | null | undefined
): string {
  const cloudName = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME ?? "";
  if (!cloudName) {
    console.warn(
      "resolvePortfolioAssetUrlFromEnv: NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME is not set"
    );
    return (pathOrUrl ?? "").trim();
  }
  return resolvePortfolioAssetUrl(pathOrUrl, {
    cloudName,
    imageTransforms: process.env.NEXT_PUBLIC_CLOUDINARY_IMAGE_TRANSFORMS,
    folderPrefix: process.env.NEXT_PUBLIC_CLOUDINARY_FOLDER_PREFIX,
  });
}
