import type { NextApiRequest, NextApiResponse } from "next";
import { ensureAdmin } from "@/lib/requireAdmin";
import formidable from "formidable";
import fs from "fs";
import os from "os";
import path from "path";
import { getStudioServerSession } from "@/lib/getStudioServerSession";

export const config = {
  api: { bodyParser: false },
};

function isS3Configured(): boolean {
  return Boolean(
    process.env.S3_BUCKET &&
    process.env.S3_ACCESS_KEY_ID &&
    process.env.S3_SECRET_ACCESS_KEY &&
    process.env.S3_REGION,
  );
}

function isServerlessUploadRuntime(): boolean {
  return Boolean(process.env.AWS_LAMBDA_FUNCTION_NAME || process.env.AWS_EXECUTION_ENV);
}

function inferImageMimeFromName(name: string | null | undefined): string | null {
  if (!name) return null;
  const ext = name.toLowerCase().split(".").pop() ?? "";
  const map: Record<string, string> = {
    jpg: "image/jpeg", jpeg: "image/jpeg",
    png: "image/png", webp: "image/webp",
    gif: "image/gif", avif: "image/avif",
    heic: "image/heic", heif: "image/heif",
    bmp: "image/bmp", tiff: "image/tiff", tif: "image/tiff",
    svg: "image/svg+xml",
  };
  return map[ext] ?? null;
}

function resolveImageMime(file: {
  mimetype?: string | null;
  originalFilename?: string | null;
  filepath?: string;
  newFilename?: string | null;
}): string {
  const fromMime = (file.mimetype || "").trim().toLowerCase();
  if (fromMime.startsWith("image/") && fromMime !== "image/jpg") return fromMime;
  if (fromMime === "image/jpg") return "image/jpeg";
  const fromName =
    inferImageMimeFromName(file.originalFilename ?? undefined) ??
    inferImageMimeFromName(file.filepath ? path.basename(file.filepath) : undefined) ??
    inferImageMimeFromName(file.newFilename ?? undefined);
  if (fromName) return fromName;
  return "image/jpeg";
}

const MAX_DATA_URL_IMAGE_BYTES = 4 * 1024 * 1024;

async function uploadToS3(buf: Buffer, mime: string, originalName: string): Promise<string> {
  const { S3Client, PutObjectCommand } = await import("@aws-sdk/client-s3");
  const bucket = process.env.S3_BUCKET!;
  const region = process.env.S3_REGION!;
  const ext = mime === "image/jpeg" ? "jpg" : (mime.split("/")[1] ?? "jpg");
  const key = `uploads/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
  const client = new S3Client({
    region,
    credentials: {
      accessKeyId: process.env.S3_ACCESS_KEY_ID!,
      secretAccessKey: process.env.S3_SECRET_ACCESS_KEY!,
    },
  });
  await client.send(new PutObjectCommand({
    Bucket: bucket,
    Key: key,
    Body: buf,
    ContentType: mime,
  }));
  const publicUrl = process.env.S3_PUBLIC_URL
    ? `${process.env.S3_PUBLIC_URL.replace(/\/$/, "")}/${key}`
    : `https://${bucket}.s3.${region}.amazonaws.com/${key}`;
  return publicUrl;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") return res.status(405).end();

  const session = await getStudioServerSession(req, res);
  if (!ensureAdmin(session, res)) return;

  const serverless = isServerlessUploadRuntime();
  const s3 = isS3Configured();
  const uploadDir = os.tmpdir();

  const form = formidable({
    uploadDir,
    keepExtensions: true,
    maxFileSize: 10 * 1024 * 1024,
  });

  form.parse(req, async (err, _fields, files) => {
    if (err) return res.status(500).json({ error: "Upload failed" });

    const fileArray = Array.isArray(files.file) ? files.file : [files.file];
    const file = fileArray[0];
    if (!file) return res.status(400).json({ error: "No file provided" });

    const mime = resolveImageMime(file);
    if (!mime.startsWith("image/")) {
      return res.status(400).json({ error: "File must be an image." });
    }

    try {
      const buf = fs.readFileSync(file.filepath);
      try { fs.unlinkSync(file.filepath); } catch { /* ignore */ }

      // S3 — preferred when configured (works on all environments)
      if (s3) {
        try {
          const url = await uploadToS3(buf, mime, file.originalFilename ?? "image");
          return res.json({ url });
        } catch (e) {
          console.error("S3 upload failed", e);
          return res.status(500).json({ error: "S3 upload failed. Check AWS credentials and bucket policy." });
        }
      }

      // Serverless fallback — data URL (no S3 configured)
      if (serverless) {
        if (buf.length > MAX_DATA_URL_IMAGE_BYTES) {
          return res.status(413).json({
            error: `Image too large (max ${MAX_DATA_URL_IMAGE_BYTES / (1024 * 1024)}MB). Configure S3 for larger uploads.`,
          });
        }
        return res.json({ url: `data:${mime};base64,${buf.toString("base64")}` });
      }

      // Local dev — save to public/uploads/
      const localDir = path.join(process.cwd(), "public", "uploads");
      if (!fs.existsSync(localDir)) fs.mkdirSync(localDir, { recursive: true });
      const ext = mime === "image/jpeg" ? "jpg" : (mime.split("/")[1] ?? "jpg");
      const filename = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
      fs.writeFileSync(path.join(localDir, filename), buf);
      return res.json({ url: `/uploads/${filename}` });
    } catch (e) {
      console.error("upload failed", e);
      return res.status(500).json({ error: "Upload failed" });
    }
  });
}
