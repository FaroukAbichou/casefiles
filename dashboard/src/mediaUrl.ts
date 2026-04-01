/** Resolve portfolio-relative paths for <img src> via the dev API static mount. */
export function mediaUrl(rel: string | undefined | null): string {
  const s = (rel ?? "").trim();
  if (!s) return "";
  if (/^https?:\/\//i.test(s)) return s;
  return `/api/raw-media/${s.replace(/^\//, "")}`;
}
