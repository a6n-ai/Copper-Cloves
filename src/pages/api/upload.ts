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

const MAX_DATA_URL_IMAGE_BYTES = 600 * 1024;

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
            error: `Image too large for hosted upload (max ${MAX_DATA_URL_IMAGE_BYTES / 1024}KB). Use a smaller or compressed image.`,
          });
        }
        const mime = file.mimetype || "image/jpeg";
        if (!mime.startsWith("image/")) {
          return res.status(400).json({ error: "File must be an image" });
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
