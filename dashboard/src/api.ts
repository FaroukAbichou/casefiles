const DASHBOARD_TOKEN_STORAGE_KEY = "dashboardToken";

function getDashboardToken(): string {
  if (typeof window === "undefined") return "";
  return window.localStorage.getItem(DASHBOARD_TOKEN_STORAGE_KEY)?.trim() || "";
}

export function setDashboardToken(token: string) {
  if (typeof window === "undefined") return;
  const next = token.trim();
  if (!next) {
    window.localStorage.removeItem(DASHBOARD_TOKEN_STORAGE_KEY);
    return;
  }
  window.localStorage.setItem(DASHBOARD_TOKEN_STORAGE_KEY, next);
}

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const token = getDashboardToken();
  const res = await fetch(path, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { "x-dashboard-token": token } : {}),
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
  const token = getDashboardToken();
  const res = await fetch(`/api/upload?${q}`, {
    method: "POST",
    body,
    headers: token ? { "x-dashboard-token": token } : undefined,
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
  return data as { path: string };
}

// ---- Cloudinary management (server-side credentials) ----

export type CloudinaryResourceType = "image" | "raw";

export type CloudinaryConfig = {
  cloudName: string | null;
  prefix: string;
  hasTokenGate: boolean;
};

export type CloudinaryFolder = { name: string; path: string };

export type CloudinaryResource = {
  public_id: string;
  resource_type: CloudinaryResourceType;
  format?: string;
  bytes?: number;
  created_at?: string;
  secure_url?: string;
};

export function getCloudinaryConfig() {
  return api<CloudinaryConfig>("/api/cloudinary/config");
}

export function listCloudinaryFolders(prefix?: string) {
  const q = new URLSearchParams();
  if (prefix) q.set("prefix", prefix);
  return api<{ prefix: string; folders: CloudinaryFolder[] }>(
    `/api/cloudinary/folders?${q.toString()}`
  );
}

export function listCloudinaryResources(params: {
  prefix?: string;
  type?: CloudinaryResourceType;
  next_cursor?: string | null;
  max_results?: number;
}) {
  const q = new URLSearchParams();
  if (params.prefix) q.set("prefix", params.prefix);
  if (params.type) q.set("type", params.type);
  if (params.next_cursor) q.set("next_cursor", params.next_cursor);
  if (params.max_results) q.set("max_results", String(params.max_results));
  return api<{
    prefix: string;
    type: CloudinaryResourceType;
    next_cursor: string | null;
    resources: CloudinaryResource[];
  }>(`/api/cloudinary/resources?${q.toString()}`);
}

export async function cloudinaryUploadFile(opts: {
  file: File;
  folder: string;
  filename?: string;
  type?: CloudinaryResourceType | "auto";
}): Promise<{ public_id: string; resource_type: string; secure_url: string }> {
  const q = new URLSearchParams();
  q.set("folder", opts.folder);
  if (opts.filename) q.set("filename", opts.filename);
  if (opts.type) q.set("type", opts.type);
  const body = new FormData();
  body.append("file", opts.file);
  const token = getDashboardToken();
  const res = await fetch(`/api/cloudinary/upload?${q}`, {
    method: "POST",
    body,
    headers: token ? { "x-dashboard-token": token } : undefined,
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
  return data as { public_id: string; resource_type: string; secure_url: string };
}

export function cloudinaryDelete(public_id: string, type: CloudinaryResourceType) {
  const q = new URLSearchParams({ public_id, type });
  return api<{ result: string | null }>(`/api/cloudinary/resource?${q}`, {
    method: "DELETE",
  });
}

export function cloudinaryMove(from_public_id: string, to_public_id: string, type: CloudinaryResourceType) {
  return api<{ public_id: string; secure_url: string; resource_type: string }>(
    "/api/cloudinary/move",
    { method: "POST", body: JSON.stringify({ from_public_id, to_public_id, type }) }
  );
}

export function cloudinaryGetRawText(public_id: string) {
  const q = new URLSearchParams({ public_id });
  return api<{ public_id: string; text: string }>(`/api/cloudinary/raw-text?${q}`);
}

export function cloudinaryPutRawText(public_id: string, text: string) {
  const q = new URLSearchParams({ public_id });
  return api<{ public_id: string; secure_url: string }>(`/api/cloudinary/raw-text?${q}`, {
    method: "PUT",
    body: JSON.stringify({ text }),
  });
}

// ---- Dashboard runtime settings ----
export type DashboardSettings = {
  cloudinary: {
    autoSync: boolean;
    folderPrefix: string;
  };
  security: {
    dashboardToken: string;
  };
};

export function getDashboardSettings() {
  return api<DashboardSettings>("/api/settings");
}

export function saveDashboardSettings(settings: Partial<DashboardSettings>) {
  return api<DashboardSettings>("/api/settings", {
    method: "PUT",
    body: JSON.stringify(settings),
  });
}
