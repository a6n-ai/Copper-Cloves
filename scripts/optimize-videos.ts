/**
 * One-shot video optimizer for `public/` (requires ffmpeg + ffprobe on PATH).
 *
 * Per video:
 *  - backs up the original to `public/_originals/<relpath>` (gitignored),
 *  - re-encodes H.264 (CRF 23, preset slow), caps height at MAX_HEIGHT,
 *    yuv420p, `+faststart` so playback starts before full download,
 *  - keeps audio by default (AAC 128k); pass --drop-audio for muted decorative
 *    loops (hero/cafe) to shave the audio track entirely,
 *  - writes a poster still as `<name>.poster.webp` (frame at POSTER_AT seconds)
 *    so <video poster=…> shows something instead of a blank box while loading.
 *
 * Idempotent: skips a video whose backup already exists unless --force.
 * Never keeps a re-encode that came out larger than the original.
 *
 * Usage:
 *   npx tsx scripts/optimize-videos.ts                 # optimize public/, keep audio
 *   npx tsx scripts/optimize-videos.ts --drop-audio    # also strip audio tracks
 *   npx tsx scripts/optimize-videos.ts --dry           # report only
 *   npx tsx scripts/optimize-videos.ts --force         # re-encode even if backed up
 *   npx tsx scripts/optimize-videos.ts --posters-only  # only (re)generate posters
 */
import fs from "fs";
import path from "path";
import { execFileSync } from "child_process";

const MAX_HEIGHT = 1080;
const CRF = 23;
const PRESET = "slow";
const POSTER_AT = 0.5; // seconds into the clip
const POSTER_MAX_WIDTH = 1280;
const POSTER_QUALITY = 80;

const args = process.argv.slice(2);
const DRY = args.includes("--dry");
const FORCE = args.includes("--force");
const DROP_AUDIO = args.includes("--drop-audio");
const POSTERS_ONLY = args.includes("--posters-only");
const roots = args.filter((a) => !a.startsWith("--"));

const PUBLIC_DIR = path.join(process.cwd(), "public");
const BACKUP_DIR = path.join(PUBLIC_DIR, "_originals");
const SCAN_ROOTS = roots.length ? roots.map((r) => path.resolve(r)) : [PUBLIC_DIR];
const EXTS = new Set([".mp4", ".mov", ".webm", ".m4v"]);

function which(bin: string): boolean {
  try {
    execFileSync(bin, ["-version"], { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (full === BACKUP_DIR) continue;
      walk(full, out);
    } else if (EXTS.has(path.extname(entry.name).toLowerCase())) {
      out.push(full);
    }
  }
  return out;
}

function mb(b: number): string {
  return `${(b / 1048576).toFixed(2)}MB`;
}

function hasAudio(file: string): boolean {
  try {
    const out = execFileSync(
      "ffprobe",
      ["-v", "error", "-select_streams", "a", "-show_entries", "stream=codec_type", "-of", "csv=p=0", file],
      { encoding: "utf8" },
    );
    return out.trim().length > 0;
  } catch {
    return false;
  }
}

function makePoster(file: string) {
  const dir = path.dirname(file);
  const base = path.basename(file, path.extname(file));
  const poster = path.join(dir, `${base}.poster.jpg`);
  if (DRY) {
    console.log(`  [dry] poster → ${path.relative(PUBLIC_DIR, poster)}`);
    return;
  }
  // Minimal, canonical single-frame grab. No scale filter (source clips are
  // already ≤1280px) and plain mjpeg — avoids libwebp/filtergraph quoting
  // pitfalls. `-q:v 3` ≈ high quality. stderr surfaces in the thrown message.
  try {
    execFileSync("ffmpeg", [
      "-y", "-ss", String(POSTER_AT), "-i", file,
      "-frames:v", "1", "-q:v", "3",
      poster,
    ], { stdio: ["ignore", "ignore", "pipe"] });
    console.log(`  ▣ poster ${path.relative(PUBLIC_DIR, poster)}`);
  } catch (e) {
    const msg = (e as { stderr?: Buffer }).stderr?.toString().trim().split("\n").pop() ?? (e as Error).message;
    console.error(`  ✗ poster ${path.relative(PUBLIC_DIR, poster)}: ${msg}`);
  }
}

function reencode(file: string) {
  const rel = path.relative(PUBLIC_DIR, file);
  const backupPath = path.join(BACKUP_DIR, rel);
  const before = fs.statSync(file).size;

  if (fs.existsSync(backupPath) && !FORCE) {
    return { rel, skipped: "done", before, after: before };
  }

  const keepAudio = !DROP_AUDIO && hasAudio(file);
  const tmp = `${file}.opt.mp4`;
  const vf = `scale=-2:'min(${MAX_HEIGHT},ih)'`;

  if (DRY) {
    console.log(`  [dry] re-encode ${rel} (audio=${keepAudio ? "keep" : "drop"})`);
    return { rel, before, after: before, dry: true };
  }

  const ffArgs = [
    "-y", "-i", file,
    "-vf", vf,
    "-c:v", "libx264", "-preset", PRESET, "-crf", String(CRF),
    "-pix_fmt", "yuv420p", "-movflags", "+faststart",
    ...(keepAudio ? ["-c:a", "aac", "-b:a", "128k"] : ["-an"]),
    tmp,
  ];
  execFileSync("ffmpeg", ffArgs, { stdio: "ignore" });

  const after = fs.statSync(tmp).size;
  if (after >= before) {
    fs.unlinkSync(tmp);
    return { rel, skipped: "no-gain", before, after: before };
  }

  fs.mkdirSync(path.dirname(backupPath), { recursive: true });
  if (!fs.existsSync(backupPath)) fs.copyFileSync(file, backupPath);
  // Re-encode keeps the SAME .mp4 name (mov/webm sources become .mp4 alongside;
  // update refs if you had .mov/.webm — this repo's videos are all .mp4).
  const outPath = file.toLowerCase().endsWith(".mp4") ? file : file.replace(/\.[^.]+$/, ".mp4");
  fs.renameSync(tmp, outPath);
  if (outPath !== file) fs.unlinkSync(file);
  return { rel, before, after, audio: keepAudio };
}

function main() {
  if (!which("ffmpeg") || !which("ffprobe")) {
    console.error("ffmpeg/ffprobe not found on PATH. Install ffmpeg first.");
    process.exit(1);
  }

  const files = SCAN_ROOTS.flatMap((r) => (fs.statSync(r).isDirectory() ? walk(r) : [r]));
  console.log(`${DRY ? "[DRY] " : ""}Found ${files.length} video(s). audio=${DROP_AUDIO ? "DROP" : "keep"}\n`);

  let tBefore = 0, tAfter = 0, changed = 0;
  for (const file of files) {
    try {
      if (!POSTERS_ONLY) {
        const r = reencode(file);
        tBefore += r.before;
        tAfter += r.after;
        if (r.skipped) {
          if (r.skipped !== "done") console.log(`  skip (${r.skipped}): ${r.rel}`);
        } else if (!r.dry) {
          changed++;
          const pct = (100 * (1 - r.after / r.before)).toFixed(0);
          console.log(`  ✓ ${r.rel}  ${mb(r.before)} → ${mb(r.after)}  (-${pct}%)`);
        }
      }
      makePoster(file);
    } catch (e) {
      console.error(`  ✗ ${file}: ${(e as Error).message}`);
    }
  }

  if (!POSTERS_ONLY) {
    console.log(
      `\n${DRY ? "[DRY] " : ""}Done. ${changed} re-encoded. ` +
        `Total ${mb(tBefore)} → ${mb(tAfter)} (-${tBefore ? (100 * (1 - tAfter / tBefore)).toFixed(0) : 0}%). ` +
        `Originals in public/_originals/.`,
    );
  }
}

main();
