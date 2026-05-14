import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { ensureAdmin } from "@/lib/requireAdmin";
import formidable from "formidable";
import fs from "fs";
import os from "os";
import path from "path";

export const config = {
  api: { bodyParser: false },
};

/** Amplify / Lambda: no durable disk for `public/uploads`; embed small images as data URLs in the DB. */
function isServerlessUploadRuntime(): boolean {
  return Boolean(process.env.AWS_LAMBDA_FUNCTION_NAME || process.env.AWS_EXECUTION_ENV);
}

function inferImageMimeFromName(name: string | null | undefined): string | null {
  if (!name) return null;
  const lower = name.toLowerCase();
  if (lower.endsWith(".png")) return "image/png";
  if (lower.endsWith(".webp")) return "image/webp";
  if (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) return "image/jpeg";
  return null;
}

function resolveImageMime(
  file: {
    mimetype?: string | null;
    originalFilename?: string | null;
    filepath?: string;
    newFilename?: string | null;
  },
): string {
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

/** Hosted/serverless: embed as data URL; allow typical phone photos (PNG/JPEG) without silent failures. */
const MAX_DATA_URL_IMAGE_BYTES = 4 * 1024 * 1024;

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") return res.status(405).end();

  const session = await getServerSession(req, res, authOptions);
  if (!ensureAdmin(session, res)) return;

  const serverless = isServerlessUploadRuntime();
  const uploadDir = serverless ? os.tmpdir() : path.join(process.cwd(), "public", "uploads");
  if (!serverless && !fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

  const form = formidable({
    uploadDir,
    keepExtensions: true,
    maxFileSize: serverless ? MAX_DATA_URL_IMAGE_BYTES : 10 * 1024 * 1024,
  });

  form.parse(req, (err, _fields, files) => {
    if (err) return res.status(500).json({ error: "Upload failed" });

    const fileArray = Array.isArray(files.file) ? files.file : [files.file];
    const file = fileArray[0];
    if (!file) return res.status(400).json({ error: "No file provided" });

    if (serverless) {
      try {
        const buf = fs.readFileSync(file.filepath);
        try {
          fs.unlinkSync(file.filepath);
        } catch {
          /* temp file cleanup */
        }
        if (buf.length > MAX_DATA_URL_IMAGE_BYTES) {
          return res.status(413).json({
            error: `Image too large for hosted upload (max ${MAX_DATA_URL_IMAGE_BYTES / (1024 * 1024)}MB). Use a smaller or compressed image, or configure S3.`,
          });
        }
        const mime = resolveImageMime(file);
        if (!mime.startsWith("image/")) {
          return res.status(400).json({ error: "File must be an image (JPEG, PNG, or WebP)." });
        }
        const b64 = buf.toString("base64");
        return res.json({ url: `data:${mime};base64,${b64}` });
      } catch (e) {
        console.error("upload (serverless) failed", e);
        return res.status(500).json({ error: "Upload failed" });
      }
    }

    const filename = path.basename(file.filepath);
    const publicUrl = `/uploads/${filename}`;

    return res.json({ url: publicUrl });
  });
}
