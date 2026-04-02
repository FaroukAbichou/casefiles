import express from "express";
import cors from "cors";
import fs from "fs/promises";
import fsSync from "fs";
import { config as loadDotenv } from "dotenv";
import { v2 as cloudinary } from "cloudinary";
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

// Cloudinary (local + CI). In production, prefer real environment variables.
const CLOUDINARY_ENV = path.join(REPO_ROOT, ".env.cloudinary");
loadDotenv({ path: CLOUDINARY_ENV });
if (process.env.CLOUDINARY_CLOUD_NAME && process.env.CLOUDINARY_API_KEY && process.env.CLOUDINARY_API_SECRET) {
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
    secure: true,
  });
}

const SETTINGS_FILE = path.join(REPO_ROOT, ".dashboard-settings.json");
const DEFAULT_SETTINGS = {
  cloudinary: {
    autoSync: String(process.env.CLOUDINARY_AUTO_SYNC ?? "1").trim() !== "0",
    folderPrefix: (process.env.CLOUDINARY_FOLDER_PREFIX || "portfolio-content")
      .replace(/\/$/, ""),
  },
  security: {
    dashboardToken: process.env.DASHBOARD_TOKEN?.trim() || "",
  },
};

function sanitizeSettings(input) {
  const out = structuredClone(DEFAULT_SETTINGS);
  if (input && typeof input === "object") {
    if (input.cloudinary && typeof input.cloudinary === "object") {
      const c = input.cloudinary;
      if (typeof c.autoSync === "boolean") out.cloudinary.autoSync = c.autoSync;
      if (typeof c.folderPrefix === "string" && c.folderPrefix.trim()) {
        out.cloudinary.folderPrefix = c.folderPrefix.trim().replace(/^\/+/, "").replace(/\/$/, "");
      }
    }
    if (input.security && typeof input.security === "object") {
      const s = input.security;
      if (typeof s.dashboardToken === "string") out.security.dashboardToken = s.dashboardToken.trim();
    }
  }
  return out;
}

function loadSettings() {
  try {
    if (!fsSync.existsSync(SETTINGS_FILE)) return structuredClone(DEFAULT_SETTINGS);
    const raw = fsSync.readFileSync(SETTINGS_FILE, "utf8");
    return sanitizeSettings(JSON.parse(raw));
  } catch {
    return structuredClone(DEFAULT_SETTINGS);
  }
}

function saveSettings(next) {
  const clean = sanitizeSettings(next);
  fsSync.writeFileSync(SETTINGS_FILE, `${JSON.stringify(clean, null, 2)}\n`, "utf8");
  return clean;
}

let runtimeSettings = loadSettings();

function getCloudinaryPrefix() {
  return runtimeSettings.cloudinary.folderPrefix;
}

function isCloudinaryAutoSyncEnabled() {
  return Boolean(runtimeSettings.cloudinary.autoSync);
}

function requireDashboardToken(req, res, next) {
  // Local-only convenience: if dashboardToken is unset, allow.
  const expected = runtimeSettings.security.dashboardToken;
  if (!expected) return next();
  const token = String(req.headers["x-dashboard-token"] || "");
  if (token && token === expected) return next();
  res.status(401).json({ error: "Unauthorized" });
}

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

function ensureCloudinaryConfigured() {
  if (!process.env.CLOUDINARY_CLOUD_NAME) throw new Error("Missing CLOUDINARY_CLOUD_NAME");
  if (!process.env.CLOUDINARY_API_KEY) throw new Error("Missing CLOUDINARY_API_KEY");
  if (!process.env.CLOUDINARY_API_SECRET) throw new Error("Missing CLOUDINARY_API_SECRET");
}

const IMAGE_EXT_RE = /\.(png|jpe?g|gif|webp|svg|avif|ico)$/i;

function cloudinaryUrlForPublicId(publicId, resourceType) {
  const cloud = process.env.CLOUDINARY_CLOUD_NAME;
  if (resourceType === "image") {
    return `https://res.cloudinary.com/${cloud}/image/upload/${publicId}`;
  }
  return `https://res.cloudinary.com/${cloud}/raw/upload/${publicId}`;
}

function readHeadBytes(fullPath, n) {
  const fd = fsSync.openSync(fullPath, "r");
  try {
    const buf = Buffer.alloc(n);
    fsSync.readSync(fd, buf, 0, n, 0);
    return buf;
  } finally {
    fsSync.closeSync(fd);
  }
}

function isValidImageSignature(ext, fullPath) {
  const e = ext.toLowerCase();
  try {
    if (e === ".png") {
      const b = readHeadBytes(fullPath, 8);
      return (
        b[0] === 0x89 &&
        b[1] === 0x50 &&
        b[2] === 0x4e &&
        b[3] === 0x47 &&
        b[4] === 0x0d &&
        b[5] === 0x0a &&
        b[6] === 0x1a &&
        b[7] === 0x0a
      );
    }
    if (e === ".jpg" || e === ".jpeg") {
      const b = readHeadBytes(fullPath, 2);
      return b[0] === 0xff && b[1] === 0xd8;
    }
    if (e === ".webp") {
      const b = readHeadBytes(fullPath, 12);
      const riff = b.slice(0, 4).toString("ascii") === "RIFF";
      const webp = b.slice(8, 12).toString("ascii") === "WEBP";
      return riff && webp;
    }
    if (e === ".gif") {
      const b = readHeadBytes(fullPath, 6);
      return b.toString("ascii").startsWith("GIF");
    }
    if (e === ".svg") {
      const b = readHeadBytes(fullPath, 250);
      const s = b.toString("utf8").trimStart();
      return s.startsWith("<svg") || s.includes("<svg");
    }
    return true;
  } catch {
    return false;
  }
}

async function cloudinaryUpsertFromLocal(relativeToContent) {
  if (!isCloudinaryAutoSyncEnabled()) return;
  if (!process.env.CLOUDINARY_CLOUD_NAME) return;
  const rel = String(relativeToContent || "").replace(/^\/+/, "");
  if (!rel) return;

  const fullPath = path.join(CONTENT, rel);
  const ext = path.extname(rel).toLowerCase();
  const isImage = IMAGE_EXT_RE.test(rel);
  const resource_type = isImage ? "image" : "raw";

  const public_id =
    resource_type === "image"
      ? `${getCloudinaryPrefix()}/${rel.replace(/\.[^./]+$/, "")}`
      : `${getCloudinaryPrefix()}/${rel}`;

  if (resource_type === "image" && !isValidImageSignature(ext, fullPath)) {
    console.warn("[cloudinary] skip invalid image", rel);
    return;
  }

  await cloudinary.uploader.upload(fullPath, {
    public_id,
    resource_type,
    overwrite: true,
    invalidate: true,
    use_filename: false,
    unique_filename: false,
  });
}

async function cloudinaryDestroyByRel(relativeToContent) {
  if (!isCloudinaryAutoSyncEnabled()) return;
  if (!process.env.CLOUDINARY_CLOUD_NAME) return;
  const rel = String(relativeToContent || "").replace(/^\/+/, "");
  if (!rel) return;
  const isImage = IMAGE_EXT_RE.test(rel);
  const resource_type = isImage ? "image" : "raw";
  const public_id =
    resource_type === "image"
      ? `${getCloudinaryPrefix()}/${rel.replace(/\.[^./]+$/, "")}`
      : `${getCloudinaryPrefix()}/${rel}`;
  await cloudinary.uploader.destroy(public_id, {
    resource_type,
    type: "upload",
    invalidate: true,
  });
}

app.get("/api/cloudinary/config", requireDashboardToken, (req, res) => {
  res.json({
    cloudName: process.env.CLOUDINARY_CLOUD_NAME || null,
    prefix: getCloudinaryPrefix(),
    hasTokenGate: Boolean(runtimeSettings.security.dashboardToken),
  });
});

app.get("/api/settings", requireDashboardToken, (_req, res) => {
  res.json(runtimeSettings);
});

app.put("/api/settings", requireDashboardToken, (req, res) => {
  try {
    const next = req.body ?? {};
    // Merge patch-like payload with current settings.
    const merged = {
      ...runtimeSettings,
      ...(typeof next === "object" && next ? next : {}),
      cloudinary: {
        ...runtimeSettings.cloudinary,
        ...(next?.cloudinary && typeof next.cloudinary === "object" ? next.cloudinary : {}),
      },
      security: {
        ...runtimeSettings.security,
        ...(next?.security && typeof next.security === "object" ? next.security : {}),
      },
    };
    runtimeSettings = saveSettings(merged);
    res.json(runtimeSettings);
  } catch (e) {
    res.status(500).json({ error: String(e?.message || e) });
  }
});

app.get("/api/cloudinary/folders", requireDashboardToken, async (req, res) => {
  try {
    ensureCloudinaryConfigured();
    const prefix = String(req.query.prefix || getCloudinaryPrefix()).replace(/^\/+/, "").replace(/\/$/, "");
    const r = await cloudinary.api.sub_folders(prefix);
    res.json({ prefix, folders: r.folders ?? [] });
  } catch (e) {
    res.status(500).json({ error: String(e?.message || e) });
  }
});

app.get("/api/cloudinary/resources", requireDashboardToken, async (req, res) => {
  try {
    ensureCloudinaryConfigured();
    const prefix = String(req.query.prefix || getCloudinaryPrefix()).replace(/^\/+/, "").replace(/\/$/, "");
    const type = String(req.query.type || "image"); // image | raw
    const nextCursor = String(req.query.next_cursor || "");
    const max = Math.min(Number(req.query.max_results || 50) || 50, 200);

    const r = await cloudinary.api.resources({
      type: "upload",
      resource_type: type,
      prefix,
      max_results: max,
      next_cursor: nextCursor || undefined,
    });
    res.json({
      prefix,
      type,
      next_cursor: r.next_cursor ?? null,
      resources: (r.resources ?? []).map((x) => ({
        asset_id: x.asset_id,
        public_id: x.public_id,
        resource_type: x.resource_type,
        format: x.format,
        bytes: x.bytes,
        created_at: x.created_at,
        secure_url: x.secure_url,
      })),
    });
  } catch (e) {
    res.status(500).json({ error: String(e?.message || e) });
  }
});

const cloudinaryUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024 },
});

app.post("/api/cloudinary/upload", requireDashboardToken, cloudinaryUpload.single("file"), async (req, res) => {
  try {
    ensureCloudinaryConfigured();
    const folder = String(req.query.folder || getCloudinaryPrefix()).replace(/^\/+/, "").replace(/\/$/, "");
    const filename = String(req.query.filename || "").trim();
    const forceType = String(req.query.type || "").trim(); // image|raw|auto
    if (!req.file) {
      res.status(400).json({ error: "No file (field name: file)" });
      return;
    }
    const original = filename || req.file.originalname || `upload-${Date.now()}`;
    const ext = path.extname(original).toLowerCase();
    const isImage = IMAGE_EXT_RE.test(original);
    const resource_type = forceType === "raw" ? "raw" : forceType === "image" ? "image" : isImage ? "image" : "raw";

    const relPath = `${folder}/${original.replace(/^\/+/, "")}`.replace(/\/{2,}/g, "/");
    const public_id =
      resource_type === "image" ? relPath.replace(/\.[^./]+$/, "") : relPath;

    const r = await cloudinary.uploader.upload(`data:${req.file.mimetype};base64,${req.file.buffer.toString("base64")}`, {
      public_id,
      resource_type,
      overwrite: true,
      invalidate: true,
      use_filename: false,
      unique_filename: false,
    });

    res.json({
      public_id: r.public_id,
      resource_type: r.resource_type,
      secure_url: r.secure_url,
    });
  } catch (e) {
    res.status(500).json({ error: String(e?.message || e) });
  }
});

app.delete("/api/cloudinary/resource", requireDashboardToken, async (req, res) => {
  try {
    ensureCloudinaryConfigured();
    const public_id = String(req.query.public_id || "").trim();
    const type = String(req.query.type || "image").trim(); // image|raw
    if (!public_id) {
      res.status(400).json({ error: "public_id is required" });
      return;
    }
    const r = await cloudinary.uploader.destroy(public_id, {
      resource_type: type,
      type: "upload",
      invalidate: true,
    });
    res.json({ result: r.result ?? null });
  } catch (e) {
    res.status(500).json({ error: String(e?.message || e) });
  }
});

app.post("/api/cloudinary/move", requireDashboardToken, async (req, res) => {
  try {
    ensureCloudinaryConfigured();
    const { from_public_id, to_public_id, type } = req.body ?? {};
    if (typeof from_public_id !== "string" || typeof to_public_id !== "string") {
      res.status(400).json({ error: "from_public_id and to_public_id are required" });
      return;
    }
    const resource_type = typeof type === "string" && type ? type : "image";
    const r = await cloudinary.uploader.rename(from_public_id, to_public_id, {
      resource_type,
      type: "upload",
      overwrite: true,
      invalidate: true,
    });
    res.json({ public_id: r.public_id, secure_url: r.secure_url, resource_type: r.resource_type });
  } catch (e) {
    res.status(500).json({ error: String(e?.message || e) });
  }
});

app.get("/api/cloudinary/raw-text", requireDashboardToken, async (req, res) => {
  try {
    ensureCloudinaryConfigured();
    const public_id = String(req.query.public_id || "").trim();
    if (!public_id) {
      res.status(400).json({ error: "public_id is required" });
      return;
    }
    const url = cloudinaryUrlForPublicId(public_id, "raw");
    const r = await fetch(url);
    if (!r.ok) {
      res.status(404).json({ error: `Fetch failed: ${r.status}` });
      return;
    }
    const text = await r.text();
    res.json({ public_id, text });
  } catch (e) {
    res.status(500).json({ error: String(e?.message || e) });
  }
});

app.put("/api/cloudinary/raw-text", requireDashboardToken, async (req, res) => {
  try {
    ensureCloudinaryConfigured();
    const public_id = String(req.query.public_id || "").trim();
    const text = typeof req.body?.text === "string" ? req.body.text : null;
    if (!public_id || text === null) {
      res.status(400).json({ error: "public_id query and { text } body required" });
      return;
    }
    const r = await cloudinary.uploader.upload(`data:text/plain;base64,${Buffer.from(text, "utf8").toString("base64")}`, {
      public_id,
      resource_type: "raw",
      overwrite: true,
      invalidate: true,
      use_filename: false,
      unique_filename: false,
    });
    res.json({ public_id: r.public_id, secure_url: r.secure_url });
  } catch (e) {
    res.status(500).json({ error: String(e?.message || e) });
  }
});

const SITE_COLLECTIONS = new Set(["testimonials", "experience", "education"]);

// ---- Layout helper (filesystem) ----
async function listCaseStudiesOnDisk() {
  const entries = await fs.readdir(CASE_STUDIES, { withFileTypes: true });
  const folderSlugs = [];
  const flatSlugs = [];
  for (const ent of entries) {
    if (ent.isDirectory()) {
      folderSlugs.push(ent.name);
    } else if (ent.isFile() && ent.name.endsWith(".json") && ent.name !== "manifest.json") {
      flatSlugs.push(ent.name.replace(/\.json$/, ""));
    }
  }
  return { folderSlugs: folderSlugs.sort(), flatSlugs: flatSlugs.sort() };
}

app.get("/api/tools/layout/report", async (_req, res) => {
  try {
    const manifest = await readManifest();
    const manifestSlugs = Array.isArray(manifest.slugs) ? manifest.slugs : [];
    const { folderSlugs, flatSlugs } = await listCaseStudiesOnDisk();

    const folderSet = new Set(folderSlugs);
    const flatSet = new Set(flatSlugs);
    const duplicates = folderSlugs.filter((s) => flatSet.has(s));
    const missingInManifest = [...folderSet]
      .filter((s) => !manifestSlugs.includes(s))
      .sort();
    const missingFilesForManifest = manifestSlugs
      .filter((s) => !folderSet.has(s) && !flatSet.has(s))
      .sort();

    res.json({
      manifestSlugs: [...manifestSlugs].sort(),
      folderSlugs,
      flatSlugs,
      duplicates,
      missingInManifest,
      missingFilesForManifest,
    });
  } catch (e) {
    res.status(500).json({ error: String(e?.message || e) });
  }
});

app.post("/api/tools/layout/migrate-flat/:slug", async (req, res) => {
  try {
    const slug = String(req.params.slug || "");
    if (!slugRe().test(slug)) {
      res.status(400).json({ error: "Invalid slug" });
      return;
    }
    const flatPath = path.join(CASE_STUDIES, `${slug}.json`);
    const folderPath = path.join(CASE_STUDIES, slug, "project.json");

    let flat;
    try {
      flat = await readJson(flatPath);
    } catch {
      flat = null;
    }

    await fs.mkdir(path.join(CASE_STUDIES, slug, "assets"), { recursive: true });
    if (flat && !(await resolveCaseStudyFile(slug))?.kind === "folder") {
      // If folder already exists, we won't overwrite. Otherwise write folder format.
      try {
        await fs.access(folderPath);
      } catch {
        const data = { ...flat, slug };
        await writeJson(folderPath, data);
      }
    }

    // Remove flat file if folder exists now.
    try {
      await fs.access(folderPath);
      await fs.unlink(flatPath);
      await cloudinaryDestroyByRel(`case-studies/${slug}.json`);
    } catch {
      /* ignore */
    }

    const manifest = await readManifest();
    const slugs = Array.isArray(manifest.slugs) ? manifest.slugs : [];
    if (!slugs.includes(slug)) {
      slugs.push(slug);
      await writeManifest(slugs);
    }
    await cloudinaryUpsertFromLocal("case-studies/manifest.json");

    // Ensure site.json project entry exists/updated from folder content.
    const loc = await resolveCaseStudyFile(slug);
    if (loc) {
      const data = await readJson(loc.filePath);
      const site = await readSite();
      upsertSiteProject(site, projectEntryFromCaseStudy(data));
      await writeSite(site);
      await cloudinaryUpsertFromLocal("site/site.json");
      {
        const rel = path.relative(CONTENT, loc.filePath).split(path.sep).join("/");
        await cloudinaryUpsertFromLocal(rel);
      }
    }

    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: String(e?.message || e) });
  }
});

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
    await cloudinaryUpsertFromLocal("site/site.json");
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
    await cloudinaryUpsertFromLocal("site/site.json");
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
    await cloudinaryUpsertFromLocal("site/site.json");
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
  async (req, res) => {
    try {
      if (!req.file) {
        res.status(400).json({ error: "No file (field name: file)" });
        return;
      }
      const rel = path.relative(CONTENT, req.file.path).split(path.sep).join("/");
      await cloudinaryUpsertFromLocal(rel);
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
    await cloudinaryUpsertFromLocal("blog/articles.json");
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
    await cloudinaryUpsertFromLocal("blog/articles.json");
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
    await cloudinaryUpsertFromLocal("blog/articles.json");
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
    {
      const rel = path.relative(CONTENT, loc.filePath).split(path.sep).join("/");
      await cloudinaryUpsertFromLocal(rel);
    }

    const site = await readSite();
    upsertSiteProject(site, projectEntryFromCaseStudy(rest));
    await writeSite(site);
    await cloudinaryUpsertFromLocal("site/site.json");

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
    await cloudinaryUpsertFromLocal(`case-studies/${slug}/project.json`);

    slugs.push(slug);
    await writeManifest(slugs);
    await cloudinaryUpsertFromLocal("case-studies/manifest.json");

    const site = await readSite();
    upsertSiteProject(site, projectEntryFromCaseStudy(data));
    await writeSite(site);
    await cloudinaryUpsertFromLocal("site/site.json");

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
      await cloudinaryDestroyByRel(`case-studies/${slug}/project.json`);
    } else if (loc?.kind === "flat") {
      await fs.unlink(loc.filePath);
      await cloudinaryDestroyByRel(`case-studies/${slug}.json`);
    }
    const orphanFlat = path.join(CASE_STUDIES, `${slug}.json`);
    try {
      await fs.unlink(orphanFlat);
    } catch {
      /* no duplicate flat file */
    }

    await writeManifest(slugs.filter((s) => s !== slug));
    await cloudinaryUpsertFromLocal("case-studies/manifest.json");

    const site = await readSite();
    removeSiteProject(site, slug);
    await writeSite(site);
    await cloudinaryUpsertFromLocal("site/site.json");

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
