/**
 * One-shot static image optimizer for `public/`.
 *
 * - Backs up every original to `public/_originals/<relpath>` (gitignored) before touching it.
 * - Recompresses in place keeping the SAME filename/extension so no code refs break.
 * - Caps the longest edge at MAX_EDGE; downscales only (never upscales).
 * - JPEG → mozjpeg q80, PNG → palette/q80, WEBP passthrough re-encode.
 * - webp/avif *delivery* is handled by next/image at runtime; this just shrinks sources.
 *
 * Idempotent: skips a file if a backup already exists (already optimized in a prior run),
 * unless --force is passed.
 *
 * Usage:
 *   npx tsx scripts/optimize-images.ts            # optimize public/
 *   npx tsx scripts/optimize-images.ts --dry      # report only, no writes
 *   npx tsx scripts/optimize-images.ts --force    # re-optimize even if backup exists
 *   npx tsx scripts/optimize-images.ts public/food  # restrict to a subdir
 */
import fs from "fs";
import path from "path";
import sharp from "sharp";

const MAX_EDGE = 2000;
const JPEG_Q = 80;
const PNG_Q = 80;
const WEBP_Q = 82;
const MIN_BYTES = 50 * 1024; // skip already-small files (<50KB)

const args = process.argv.slice(2);
const DRY = args.includes("--dry");
const FORCE = args.includes("--force");
const roots = args.filter((a) => !a.startsWith("--"));

const PUBLIC_DIR = path.join(process.cwd(), "public");
const BACKUP_DIR = path.join(PUBLIC_DIR, "_originals");
const SCAN_ROOTS = roots.length ? roots.map((r) => path.resolve(r)) : [PUBLIC_DIR];

const EXTS = new Set([".jpg", ".jpeg", ".png", ".webp"]);

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (full === BACKUP_DIR) continue; // never recurse into backups
      walk(full, out);
    } else if (EXTS.has(path.extname(entry.name).toLowerCase())) {
      out.push(full);
    }
  }
  return out;
}

function mb(bytes: number): string {
  return `${(bytes / 1048576).toFixed(2)}MB`;
}

async function optimize(file: string) {
  const rel = path.relative(PUBLIC_DIR, file);
  const backupPath = path.join(BACKUP_DIR, rel);
  const before = fs.statSync(file).size;

  if (before < MIN_BYTES) return { rel, skipped: "small", before, after: before };
  if (fs.existsSync(backupPath) && !FORCE) {
    return { rel, skipped: "done", before, after: before };
  }

  const ext = path.extname(file).toLowerCase();
  const input = fs.readFileSync(file);
  let pipeline = sharp(input, { failOn: "none" }).rotate(); // honor EXIF orientation

  const meta = await pipeline.metadata();
  const longest = Math.max(meta.width ?? 0, meta.height ?? 0);
  if (longest > MAX_EDGE) {
    pipeline = pipeline.resize({
      width: meta.width! >= meta.height! ? MAX_EDGE : undefined,
      height: meta.height! > meta.width! ? MAX_EDGE : undefined,
      withoutEnlargement: true,
    });
  }

  if (ext === ".png") {
    pipeline = pipeline.png({ quality: PNG_Q, compressionLevel: 9, palette: true });
  } else if (ext === ".webp") {
    pipeline = pipeline.webp({ quality: WEBP_Q });
  } else {
    pipeline = pipeline.jpeg({ quality: JPEG_Q, mozjpeg: true, progressive: true });
  }

  const out = await pipeline.toBuffer();
  // Guard: never write a *bigger* file (some already-optimized assets re-encode larger).
  if (out.length >= before && longest <= MAX_EDGE) {
    return { rel, skipped: "no-gain", before, after: before };
  }

  if (!DRY) {
    fs.mkdirSync(path.dirname(backupPath), { recursive: true });
    if (!fs.existsSync(backupPath)) fs.copyFileSync(file, backupPath);
    fs.writeFileSync(file, out);
  }
  return { rel, before, after: out.length };
}

async function main() {
  const files = SCAN_ROOTS.flatMap((r) =>
    fs.statSync(r).isDirectory() ? walk(r) : [r],
  );
  console.log(`${DRY ? "[DRY] " : ""}Scanning ${files.length} image(s)…\n`);

  let totalBefore = 0;
  let totalAfter = 0;
  let changed = 0;

  for (const file of files) {
    try {
      const r = await optimize(file);
      totalBefore += r.before;
      totalAfter += r.after;
      if (r.skipped) {
        if (r.skipped !== "done") console.log(`  skip (${r.skipped}): ${r.rel}`);
      } else {
        changed++;
        const pct = (100 * (1 - r.after / r.before)).toFixed(0);
        console.log(`  ✓ ${r.rel}  ${mb(r.before)} → ${mb(r.after)}  (-${pct}%)`);
      }
    } catch (e) {
      console.error(`  ✗ ${file}: ${(e as Error).message}`);
    }
  }

  console.log(
    `\n${DRY ? "[DRY] " : ""}Done. ${changed} file(s) re-encoded. ` +
      `Total ${mb(totalBefore)} → ${mb(totalAfter)} ` +
      `(-${(100 * (1 - totalAfter / totalBefore)).toFixed(0)}%). ` +
      `Originals backed up under public/_originals/.`,
  );
}

main();
