async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });
  const text = await res.text();
  let data: unknown = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = { error: text };
  }
  if (!res.ok) {
    const msg =
      typeof data === "object" && data && "error" in data
        ? String((data as { error: string }).error)
        : res.statusText;
    throw new Error(msg);
  }
  return data as T;
}

export type BlogArticle = {
  id: string;
  title: string;
  url: string;
  readTime: string;
  date: string;
  description: string;
  /** Optional cover / card image (path under portfolio-content or absolute URL). */
  image?: string;
};

export type BlogData = { articles: BlogArticle[] };

export type CaseStudyListItem = {
  slug: string;
  missing: boolean;
  storage: "folder" | "flat" | null;
  title: string;
  date: string | null;
  shortDescription: string;
};

export function getHealth() {
  return api<{ ok: boolean; contentRoot: string }>("/api/health");
}

export function getBlog() {
  return api<BlogData>("/api/blog");
}

export function createBlogArticle(article: BlogArticle) {
  return api<BlogData>("/api/blog/articles", {
    method: "POST",
    body: JSON.stringify(article),
  });
}

export function patchBlogArticle(id: string, patch: Partial<BlogArticle>) {
  return api<BlogData>(`/api/blog/articles/${encodeURIComponent(id)}`, {
    method: "PATCH",
    body: JSON.stringify(patch),
  });
}

export function deleteBlogArticle(id: string) {
  return api<BlogData>(`/api/blog/articles/${encodeURIComponent(id)}`, {
    method: "DELETE",
  });
}

export function getCaseStudies() {
  return api<{ items: CaseStudyListItem[] }>("/api/case-studies");
}

export function getCaseStudy(slug: string) {
  return api<Record<string, unknown> & { _storage?: string }>(
    `/api/case-studies/${encodeURIComponent(slug)}`
  );
}

export function saveCaseStudy(slug: string, data: Record<string, unknown>) {
  return api<{ ok: boolean }>(`/api/case-studies/${encodeURIComponent(slug)}`, {
    method: "PUT",
    body: JSON.stringify(data),
  });
}

export function createCaseStudy(slug: string, title?: string) {
  return api<{ ok: boolean; slug: string }>("/api/case-studies", {
    method: "POST",
    body: JSON.stringify({ slug, title }),
  });
}

export function deleteCaseStudy(slug: string) {
  return api<{ ok: boolean }>(`/api/case-studies/${encodeURIComponent(slug)}`, {
    method: "DELETE",
  });
}

export type SiteCollection = "testimonials" | "experience" | "education";

export type SiteCollectionsResponse = {
  testimonials: unknown[];
  experience: unknown[];
  education: unknown[];
  projectIds: string[];
};

export function getSiteCollections() {
  return api<SiteCollectionsResponse>("/api/site/collections");
}

export function createSiteItem(collection: SiteCollection, item: unknown) {
  return api<unknown[]>(`/api/site/${collection}`, {
    method: "POST",
    body: JSON.stringify(item),
  });
}

export function updateSiteItem(collection: SiteCollection, id: string, item: unknown) {
  return api<unknown[]>(`/api/site/${collection}/${encodeURIComponent(id)}`, {
    method: "PUT",
    body: JSON.stringify(item),
  });
}

export function deleteSiteItem(collection: SiteCollection, id: string) {
  return api<unknown[]>(`/api/site/${collection}/${encodeURIComponent(id)}`, {
    method: "DELETE",
  });
}

export type UploadCategory =
  | "case-study"
  | "blog"
  | "experience"
  | "education"
  | "testimonial";

export async function uploadImage(
  file: File,
  category: UploadCategory,
  slug?: string
): Promise<{ path: string }> {
  const q = new URLSearchParams({ category });
  if (slug) q.set("slug", slug);
  const body = new FormData();
  body.append("file", file);
  const res = await fetch(`/api/upload?${q}`, { method: "POST", body });
  const text = await res.text();
  let data: unknown = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = { error: text };
  }
  if (!res.ok) {
    const msg =
      typeof data === "object" && data && "error" in data
        ? String((data as { error: string }).error)
        : res.statusText;
    throw new Error(msg);
  }
  return data as { path: string };
}
