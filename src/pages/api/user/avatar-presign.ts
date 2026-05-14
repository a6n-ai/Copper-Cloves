import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { presignAvatarUpload, isS3Configured } from "@/lib/s3";

const ALLOWED = new Set(["image/jpeg", "image/png", "image/webp"]);

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getServerSession(req, res, authOptions);
  if (!session?.user) return res.status(401).json({ error: "Unauthorized" });

  if (req.method !== "POST") return res.status(405).end();

  if (!isS3Configured()) {
    return res.status(503).json({
      error:
        "Photo upload is not configured. Set AWS_S3_BUCKET, AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, and AWS_REGION (optional: AWS_S3_PUBLIC_URL for CloudFront).",
    });
  }

  const userId = (session.user as { id: string }).id;
  const body = req.body ?? {};
  const contentType = typeof body.contentType === "string" ? body.contentType.toLowerCase() : "";

  if (!ALLOWED.has(contentType)) {
    return res.status(400).json({ error: "Use JPEG, PNG, or WebP images only." });
  }

  const ext = contentType === "image/png" ? "png" : contentType === "image/webp" ? "webp" : "jpg";
  const key = `avatars/${userId}/${Date.now()}-${Math.random().toString(36).slice(2, 10)}.${ext}`;

  try {
    const { uploadUrl, publicUrl } = await presignAvatarUpload({ key, contentType });
    return res.json({ uploadUrl, publicUrl });
  } catch (e) {
    console.error("[avatar-presign]", e);
    return res.status(500).json({ error: "Could not prepare upload" });
  }
}
