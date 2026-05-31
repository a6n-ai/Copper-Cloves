import { S3Client, PutObjectCommand, ListObjectsV2Command } from "@aws-sdk/client-s3";
import { readFileSync, statSync } from "node:fs";
import { readdir } from "node:fs/promises";
import { join, relative, extname } from "node:path";
import { config } from "dotenv";
import { createHash } from "node:crypto";

config({ path: ".env" });
config({ path: ".env.local", override: true });

const BUCKET = process.env.S3_BUCKET!;
const REGION = process.env.S3_REGION || "ap-south-1";
const KEY_PREFIX = process.env.S3_PUBLIC_PREFIX || "public";
const PUBLIC_DIR = join(process.cwd(), "public");

if (!BUCKET) {
  console.error("Missing S3_BUCKET");
  process.exit(1);
}

const client = new S3Client({
  region: REGION,
  credentials: {
    accessKeyId: process.env.S3_ACCESS_KEY_ID!,
    secretAccessKey: process.env.S3_SECRET_ACCESS_KEY!,
  },
});

const CONTENT_TYPES: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
  ".avif": "image/avif",
  ".svg": "image/svg+xml",
  ".gif": "image/gif",
  ".ico": "image/x-icon",
  ".mp4": "video/mp4",
  ".webm": "video/webm",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".pdf": "application/pdf",
};

async function* walk(dir: string): AsyncGenerator<string> {
  const entries = await readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      yield* walk(full);
    } else if (entry.isFile()) {
      yield full;
    }
  }
}

async function existingObjects(): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  let token: string | undefined;
  do {
    const out = await client.send(
      new ListObjectsV2Command({ Bucket: BUCKET, Prefix: `${KEY_PREFIX}/`, ContinuationToken: token })
    );
    for (const obj of out.Contents ?? []) {
      if (obj.Key && obj.ETag) map.set(obj.Key, obj.ETag.replace(/"/g, ""));
    }
    token = out.NextContinuationToken;
  } while (token);
  return map;
}

function md5(buf: Buffer): string {
  return createHash("md5").update(buf).digest("hex");
}

async function main() {
  console.log(`Syncing public/ → s3://${BUCKET}/${KEY_PREFIX}/`);
  const existing = await existingObjects();
  console.log(`Found ${existing.size} existing objects under prefix.`);

  let uploaded = 0;
  let skipped = 0;
  let totalBytes = 0;

  for await (const filePath of walk(PUBLIC_DIR)) {
    const rel = relative(PUBLIC_DIR, filePath).split(/[/\\]/).join("/");
    // Skip stray local-dev upload artifacts (we keep these in repo per user pref but never CDN them).
    if (rel.startsWith("uploads/")) continue;
    // Never CDN the optimizer's full-res originals backup (gitignored, large).
    if (rel.startsWith("_originals/")) continue;

    const key = `${KEY_PREFIX}/${rel}`;
    const buf = readFileSync(filePath);
    const size = statSync(filePath).size;
    const localHash = md5(buf);

    const remoteEtag = existing.get(key);
    if (remoteEtag === localHash) {
      skipped++;
      continue;
    }

    const ext = extname(rel).toLowerCase();
    const contentType = CONTENT_TYPES[ext] || "application/octet-stream";

    await client.send(
      new PutObjectCommand({
        Bucket: BUCKET,
        Key: key,
        Body: buf,
        ContentType: contentType,
        // 1 year, immutable. Bust by changing filename (logo2.png → logo3.png).
        CacheControl: "public, max-age=31536000, immutable",
      })
    );
    uploaded++;
    totalBytes += size;
    console.log(`  ↑ ${key}  (${(size / 1024).toFixed(0)} KB)`);
  }

  console.log(`\nDone. Uploaded: ${uploaded}, Skipped (unchanged): ${skipped}, ${(totalBytes / 1024 / 1024).toFixed(1)} MB transferred.`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
