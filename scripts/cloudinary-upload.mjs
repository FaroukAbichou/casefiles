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

function readHeadBytes(fullPath, n) {
  const fd = fs.openSync(fullPath, "r");
  try {
    const buf = Buffer.alloc(n);
    fs.readSync(fd, buf, 0, n, 0);
    return buf;
  } finally {
    fs.closeSync(fd);
  }
}

function isValidImageSignature(ext, fullPath) {
  // Avoid uploading placeholders that have a .png extension but aren't real images.
  // We only validate a few common formats used in this repo.
  const e = ext.toLowerCase();
  try {
    if (e === ".png") {
      const b = readHeadBytes(fullPath, 8);
      // 89 50 4E 47 0D 0A 1A 0A
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
      // FF D8
      return b[0] === 0xff && b[1] === 0xd8;
    }
    if (e === ".webp") {
      const b = readHeadBytes(fullPath, 12);
      // RIFF....WEBP
      const riff = b.slice(0, 4).toString("ascii") === "RIFF";
      const webp = b.slice(8, 12).toString("ascii") === "WEBP";
      return riff && webp;
    }
    if (e === ".gif") {
      const b = readHeadBytes(fullPath, 6);
      const head = b.toString("ascii");
      return head.startsWith("GIF");
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
  let skipped = 0;

  for (const full of files) {
    const rel = path.relative(PORTFOLIO, full).split(path.sep).join("/");
    const ext = path.extname(full).toLowerCase();
    const resource_type = IMAGE_EXT.has(ext) ? "image" : "raw";
    const relPosix = rel.split(path.sep).join("/");
    const public_id =
      resource_type === "image"
        ? `${PREFIX}/${relPosix.replace(/\.[^./]+$/, "")}`
        : `${PREFIX}/${relPosix}`;

    if (resource_type === "image" && !isValidImageSignature(ext, full)) {
      console.warn(`⚠ skip invalid image file (${ext})`, rel);
      skipped++;
      continue;
    }

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

  console.log(`\nDone. ${ok} ok, ${skipped} skipped, ${fail} failed.`);
  if (fail) process.exit(1);
}

main();
