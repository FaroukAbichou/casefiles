#!/usr/bin/env node
/**
 * Upload portfolio-content/ to Cloudinary with public IDs that match
 * ../portfolio-content/integrations/resolve-portfolio-asset-url.ts
 *
 * Usage: load env from .env.cloudinary (see .env.cloudinary.example), then:
 *   npm run cloudinary:upload
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { config as loadDotenv } from "dotenv";
import { v2 as cloudinary } from "cloudinary";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.join(__dirname, "..");
const PORTFOLIO = path.join(REPO_ROOT, "portfolio-content");
const ENV_FILE = path.join(REPO_ROOT, ".env.cloudinary");

loadDotenv({ path: ENV_FILE });

const PREFIX = (process.env.CLOUDINARY_FOLDER_PREFIX ?? "portfolio-content").replace(
  /\/$/,
  ""
);

const IMAGE_EXT = new Set([
  ".png",
  ".jpg",
  ".jpeg",
  ".webp",
  ".gif",
  ".svg",
  ".avif",
  ".ico",
]);

function walkFiles(dir, out = []) {
  if (!fs.existsSync(dir)) {
    throw new Error(`Missing folder: ${dir}`);
  }
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    if (ent.name.startsWith(".")) continue;
    const full = path.join(dir, ent.name);
    if (ent.isDirectory()) walkFiles(full, out);
    else out.push(full);
  }
  return out;
}

async function main() {
  const { CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET } =
    process.env;

  if (!CLOUDINARY_CLOUD_NAME || !CLOUDINARY_API_KEY || !CLOUDINARY_API_SECRET) {
    console.error(
      "Set CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET in .env.cloudinary"
    );
    console.error(`Expected file: ${ENV_FILE}`);
    process.exit(1);
  }

  cloudinary.config({
    cloud_name: CLOUDINARY_CLOUD_NAME,
    api_key: CLOUDINARY_API_KEY,
    api_secret: CLOUDINARY_API_SECRET,
    secure: true,
  });

  const files = walkFiles(PORTFOLIO);
  console.log(`Uploading ${files.length} files under prefix "${PREFIX}/"…\n`);

  let ok = 0;
  let fail = 0;

  for (const full of files) {
    const rel = path.relative(PORTFOLIO, full).split(path.sep).join("/");
    const ext = path.extname(full).toLowerCase();
    const resource_type = IMAGE_EXT.has(ext) ? "image" : "raw";
    const relPosix = rel.split(path.sep).join("/");
    const public_id =
      resource_type === "image"
        ? `${PREFIX}/${relPosix.replace(/\.[^./]+$/, "")}`
        : `${PREFIX}/${relPosix}`;

    try {
      const res = await cloudinary.uploader.upload(full, {
        public_id,
        resource_type,
        overwrite: true,
        invalidate: true,
        use_filename: false,
        unique_filename: false,
      });
      console.log("✓", rel, "→", res.secure_url);
      ok++;
    } catch (e) {
      console.error("✗", rel, e?.message ?? e);
      fail++;
    }
  }

  console.log(`\nDone. ${ok} ok, ${fail} failed.`);
  if (fail) process.exit(1);
}

main();
