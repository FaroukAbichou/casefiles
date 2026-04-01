import express from "express";
import cors from "cors";
import fs from "fs/promises";
import fsSync from "fs";
import multer from "multer";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "..", "..");
const CONTENT = path.join(REPO_ROOT, "portfolio-content");
const CASE_STUDIES = path.join(CONTENT, "case-studies");
const BLOG_ARTICLES = path.join(CONTENT, "blog", "articles.json");
const SITE_JSON = path.join(CONTENT, "site", "site.json");
const MANIFEST = path.join(CASE_STUDIES, "manifest.json");

const app = express();
app.use(cors({ origin: ["http://127.0.0.1:5173", "http://localhost:5173"] }));
app.use(express.json({ limit: "12mb" }));

async function readJson(filePath) {
  const raw = await fs.readFile(filePath, "utf8");
  return JSON.parse(raw);
}

async function writeJson(filePath, data) {
  const text = `${JSON.stringify(data, null, 2)}\n`;
  await fs.writeFile(filePath, text, "utf8");
}

function slugRe() {
  return /^[a-z0-9][a-z0-9-]{0,62}$/;
}

/** @param {string} slug */
async function resolveCaseStudyFile(slug) {
  const folderPath = path.join(CASE_STUDIES, slug, "project.json");
  try {
    await fs.access(folderPath);
    return { kind: "folder", filePath: folderPath };
  } catch {
    /* continue */
  }
  const flatPath = path.join(CASE_STUDIES, `${slug}.json`);
  try {
    await fs.access(flatPath);
    return { kind: "flat", filePath: flatPath };
  } catch {
    return null;
  }
}

async function readManifest() {
  return readJson(MANIFEST);
}

async function writeManifest(slugs) {
  const sorted = [...new Set(slugs)].sort();
  await writeJson(MANIFEST, { slugs: sorted });
}

async function readSite() {
  return readJson(SITE_JSON);
}

async function writeSite(site) {
  await writeJson(SITE_JSON, site);
}

function projectEntryFromCaseStudy(data) {
  const id = data.slug;
  const title =
    typeof data.title === "string" ? data.title : id;
  const description =
    typeof data.longDescription === "string"
      ? data.longDescription
      : typeof data.description === "string"
        ? data.description
        : "";
  const image =
    typeof data.src === "string"
      ? data.src
      : typeof data.previewSrc === "string"
        ? data.previewSrc
        : `case-studies/${id}/assets/cover.png`;
  return {
    id,
    title,
    description,
    image,
    link: `/projects/${id}`,
  };
}

function upsertSiteProject(site, entry) {
  const projects = Array.isArray(site.projects) ? [...site.projects] : [];
  const idx = projects.findIndex((p) => p && p.id === entry.id);
  if (idx === -1) {
    projects.push(entry);
  } else {
    const prev = projects[idx];
    projects[idx] = {
      ...prev,
      title: entry.title,
      description: entry.description,
      image: entry.image,
      link: entry.link,
    };
  }
  site.projects = projects;
}

function removeSiteProject(site, slug) {
  if (!Array.isArray(site.projects)) return;
  site.projects = site.projects.filter((p) => p && p.id !== slug);
}

const UPLOAD_CATEGORIES = new Set([
  "case-study",
  "blog",
  "experience",
  "education",
  "testimonial",
]);

const uploadStorage = multer.diskStorage({
  destination(req, _file, cb) {
    const category = String(req.query.category || "");
    const slug = String(req.query.slug || "").trim();
    let subdir;
    if (category === "case-study") {
      if (!slugRe().test(slug)) {
        cb(new Error("Invalid or missing slug for case-study upload"));
        return;
      }
      subdir = path.join(CASE_STUDIES, slug, "assets");
    } else if (category === "blog") {
      subdir = path.join(CONTENT, "media", "blog");
    } else if (category === "experience") {
      subdir = path.join(CONTENT, "media", "site", "experience");
    } else if (category === "education") {
      subdir = path.join(CONTENT, "media", "site", "education");
    } else if (category === "testimonial") {
      subdir = path.join(CONTENT, "media", "site", "testimonials");
    } else {
      cb(new Error("Invalid category"));
      return;
    }
    fsSync.mkdirSync(subdir, { recursive: true });
    cb(null, subdir);
  },
  filename(_req, file, cb) {
    const ext = path.extname(file.originalname).toLowerCase() || ".bin";
    const base = path
      .basename(file.originalname, ext)
      .replace(/[^a-zA-Z0-9._-]/g, "-")
      .slice(0, 60);
    cb(null, `${base}-${Date.now()}${ext}`);
  },
});

const upload = multer({
  storage: uploadStorage,
  limits: { fileSize: 12 * 1024 * 1024 },
  fileFilter(_req, file, cb) {
    const ok = /\.(jpe?g|png|gif|webp|svg)$/i.test(file.originalname);
    cb(null, ok);
  },
});

app.use("/api/raw-media", express.static(CONTENT, { fallthrough: true }));

const SITE_COLLECTIONS = new Set(["testimonials", "experience", "education"]);

app.get("/api/site/collections", async (_req, res) => {
  try {
    const site = await readSite();
    const projectIds = Array.isArray(site.projects)
      ? site.projects.map((p) => (p && p.id ? String(p.id) : "")).filter(Boolean)
      : [];
    res.json({
      testimonials: Array.isArray(site.testimonials) ? site.testimonials : [],
      experience: Array.isArray(site.experience) ? site.experience : [],
      education: Array.isArray(site.education) ? site.education : [],
      projectIds,
    });
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});

app.post("/api/site/:collection", async (req, res) => {
  try {
    const { collection } = req.params;
    if (!SITE_COLLECTIONS.has(collection)) {
      res.status(400).json({ error: "Invalid collection" });
      return;
    }
    const item = req.body;
    if (!item || typeof item !== "object" || typeof item.id !== "string") {
      res.status(400).json({ error: "Body must be an object with string id" });
      return;
    }
    const site = await readSite();
    const arr = Array.isArray(site[collection]) ? [...site[collection]] : [];
    if (arr.some((x) => x && x.id === item.id)) {
      res.status(409).json({ error: `Duplicate id: ${item.id}` });
      return;
    }
    arr.push(item);
    site[collection] = arr;
    await writeSite(site);
    res.status(201).json(site[collection]);
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});

app.put("/api/site/:collection/:id", async (req, res) => {
  try {
    const { collection, id } = req.params;
    if (!SITE_COLLECTIONS.has(collection)) {
      res.status(400).json({ error: "Invalid collection" });
      return;
    }
    const item = req.body;
    if (!item || typeof item !== "object" || item.id !== id) {
      res.status(400).json({ error: "Body id must match URL" });
      return;
    }
    const site = await readSite();
    const arr = Array.isArray(site[collection]) ? [...site[collection]] : [];
    const idx = arr.findIndex((x) => x && x.id === id);
    if (idx === -1) {
      res.status(404).json({ error: "Not found" });
      return;
    }
    arr[idx] = item;
    site[collection] = arr;
    await writeSite(site);
    res.json(site[collection]);
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});

app.delete("/api/site/:collection/:id", async (req, res) => {
  try {
    const { collection, id } = req.params;
    if (!SITE_COLLECTIONS.has(collection)) {
      res.status(400).json({ error: "Invalid collection" });
      return;
    }
    const site = await readSite();
    const arr = Array.isArray(site[collection]) ? site[collection] : [];
    const next = arr.filter((x) => !x || x.id !== id);
    if (next.length === arr.length) {
      res.status(404).json({ error: "Not found" });
      return;
    }
    site[collection] = next;
    await writeSite(site);
    res.json(site[collection]);
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});

app.post(
  "/api/upload",
  (req, res, next) => {
    const category = String(req.query.category || "");
    if (!UPLOAD_CATEGORIES.has(category)) {
      res.status(400).json({ error: "Invalid or missing category query" });
      return;
    }
    next();
  },
  upload.single("file"),
  (req, res) => {
    try {
      if (!req.file) {
        res.status(400).json({ error: "No file (field name: file)" });
        return;
      }
      const rel = path.relative(CONTENT, req.file.path).split(path.sep).join("/");
      res.json({ path: rel });
    } catch (e) {
      res.status(500).json({ error: String(e) });
    }
  }
);

app.get("/api/health", (_req, res) => {
  res.json({ ok: true, contentRoot: CONTENT });
});

app.get("/api/blog", async (_req, res) => {
  try {
    const data = await readJson(BLOG_ARTICLES);
    res.json(data);
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});

app.post("/api/blog/articles", async (req, res) => {
  try {
    const article = req.body;
    if (!article || typeof article.id !== "string") {
      res.status(400).json({ error: "Article must include string id" });
      return;
    }
    const data = await readJson(BLOG_ARTICLES);
    const list = Array.isArray(data.articles) ? data.articles : [];
    if (list.some((a) => a.id === article.id)) {
      res.status(409).json({ error: `Article id already exists: ${article.id}` });
      return;
    }
    data.articles = [article, ...list];
    await writeJson(BLOG_ARTICLES, data);
    res.json(data);
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});

app.patch("/api/blog/articles/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const patch = req.body;
    if (!patch || typeof patch !== "object") {
      res.status(400).json({ error: "Invalid body" });
      return;
    }
    const data = await readJson(BLOG_ARTICLES);
    const list = Array.isArray(data.articles) ? data.articles : [];
    const idx = list.findIndex((a) => a.id === id);
    if (idx === -1) {
      res.status(404).json({ error: "Not found" });
      return;
    }
    list[idx] = { ...list[idx], ...patch, id };
    data.articles = list;
    await writeJson(BLOG_ARTICLES, data);
    res.json(data);
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});

app.delete("/api/blog/articles/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const data = await readJson(BLOG_ARTICLES);
    const list = Array.isArray(data.articles) ? data.articles : [];
    const next = list.filter((a) => a.id !== id);
    if (next.length === list.length) {
      res.status(404).json({ error: "Not found" });
      return;
    }
    data.articles = next;
    await writeJson(BLOG_ARTICLES, data);
    res.json(data);
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});

app.get("/api/case-studies", async (_req, res) => {
  try {
    const { slugs } = await readManifest();
    const items = [];
    for (const slug of slugs) {
      const loc = await resolveCaseStudyFile(slug);
      if (!loc) {
        items.push({ slug, missing: true, storage: null });
        continue;
      }
      const data = await readJson(loc.filePath);
      items.push({
        slug,
        missing: false,
        storage: loc.kind,
        title: data.title ?? slug,
        date: data.date ?? null,
        shortDescription: data.shortDescription ?? data.description ?? "",
      });
    }
    res.json({ items });
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});

app.get("/api/case-studies/:slug", async (req, res) => {
  try {
    const { slug } = req.params;
    const loc = await resolveCaseStudyFile(slug);
    if (!loc) {
      res.status(404).json({ error: "Case study not found" });
      return;
    }
    const data = await readJson(loc.filePath);
    res.json({ ...data, _storage: loc.kind });
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});

app.put("/api/case-studies/:slug", async (req, res) => {
  try {
    const { slug } = req.params;
    const body = req.body;
    if (!body || typeof body !== "object") {
      res.status(400).json({ error: "Invalid JSON body" });
      return;
    }
    if (body.slug !== slug) {
      res.status(400).json({ error: "Body slug must match URL slug" });
      return;
    }
    const loc = await resolveCaseStudyFile(slug);
    if (!loc) {
      res.status(404).json({ error: "Case study not found" });
      return;
    }
    const { _storage, ...rest } = body;
    void _storage;
    await writeJson(loc.filePath, rest);

    const site = await readSite();
    upsertSiteProject(site, projectEntryFromCaseStudy(rest));
    await writeSite(site);

    res.json({ ok: true, storage: loc.kind });
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});

const defaultCaseStudy = (slug, title) => ({
  slug,
  title,
  src: `case-studies/${slug}/assets/cover.png`,
  previewSrc: `case-studies/${slug}/assets/cover.png`,
  websiteUrl: "",
  date: new Date().toISOString().slice(0, 10),
  shortDescription: "",
  longDescription: "",
  description: "",
  figmaEmbedUrl: "",
  result: "",
  team: "",
  duration: "",
  caseType: "",
  role: "",
  tools: [],
  caseStudy: [],
  relatedProjects: [],
});

app.post("/api/case-studies", async (req, res) => {
  try {
    const { slug, title } = req.body ?? {};
    if (typeof slug !== "string" || !slugRe().test(slug)) {
      res
        .status(400)
        .json({ error: "Valid slug required (lowercase letters, numbers, hyphens)" });
      return;
    }
    const existing = await resolveCaseStudyFile(slug);
    if (existing) {
      res.status(409).json({ error: "Case study already exists" });
      return;
    }
    const manifest = await readManifest();
    const slugs = Array.isArray(manifest.slugs) ? manifest.slugs : [];
    if (slugs.includes(slug)) {
      res.status(409).json({ error: "Slug already in manifest" });
      return;
    }

    const dir = path.join(CASE_STUDIES, slug);
    const assets = path.join(dir, "assets");
    await fs.mkdir(assets, { recursive: true });

    const projectTitle =
      typeof title === "string" && title.trim() ? title.trim() : slug;
    const data = defaultCaseStudy(slug, projectTitle);
    const filePath = path.join(dir, "project.json");
    await writeJson(filePath, data);

    slugs.push(slug);
    await writeManifest(slugs);

    const site = await readSite();
    upsertSiteProject(site, projectEntryFromCaseStudy(data));
    await writeSite(site);

    res.status(201).json({ ok: true, slug, storage: "folder" });
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});

app.delete("/api/case-studies/:slug", async (req, res) => {
  try {
    const { slug } = req.params;
    const manifest = await readManifest();
    const slugs = Array.isArray(manifest.slugs) ? manifest.slugs : [];
    if (!slugs.includes(slug)) {
      res.status(404).json({ error: "Slug not in manifest" });
      return;
    }

    const loc = await resolveCaseStudyFile(slug);
    if (loc?.kind === "folder") {
      await fs.rm(path.join(CASE_STUDIES, slug), { recursive: true, force: true });
    } else if (loc?.kind === "flat") {
      await fs.unlink(loc.filePath);
    }
    const orphanFlat = path.join(CASE_STUDIES, `${slug}.json`);
    try {
      await fs.unlink(orphanFlat);
    } catch {
      /* no duplicate flat file */
    }

    await writeManifest(slugs.filter((s) => s !== slug));

    const site = await readSite();
    removeSiteProject(site, slug);
    await writeSite(site);

    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});

app.use((err, _req, res, _next) => {
  if (err instanceof multer.MulterError) {
    res.status(400).json({ error: err.message });
    return;
  }
  if (err) {
    res.status(400).json({ error: String(err.message || err) });
    return;
  }
  _next();
});

const PORT = 8787;
app.listen(PORT, () => {
  console.log(`API http://127.0.0.1:${PORT}`);
});
