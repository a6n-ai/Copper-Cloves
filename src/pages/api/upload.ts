import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { ensureAdmin } from "@/lib/requireAdmin";
import formidable from "formidable";
import fs from "fs";
import path from "path";

export const config = {
  api: { bodyParser: false },
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") return res.status(405).end();

  const session = await getServerSession(req, res, authOptions);
  if (!ensureAdmin(session, res)) return;

  const uploadDir = path.join(process.cwd(), "public", "uploads");
  if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

  const form = formidable({
    uploadDir,
    keepExtensions: true,
    maxFileSize: 10 * 1024 * 1024,
  });

  form.parse(req, (err, _fields, files) => {
    if (err) return res.status(500).json({ error: "Upload failed" });

    const fileArray = Array.isArray(files.file) ? files.file : [files.file];
    const file = fileArray[0];
    if (!file) return res.status(400).json({ error: "No file provided" });

    const filename = path.basename(file.filepath);
    const publicUrl = `/uploads/${filename}`;

    return res.json({ url: publicUrl });
  });
}
