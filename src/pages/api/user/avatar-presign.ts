import type { NextApiRequest, NextApiResponse } from "next";
import { presignAvatarUpload, isS3Configured } from "@/lib/s3";
import { getStudioServerSession } from "@/lib/getStudioServerSession";
import { buildS3Key, extFromContentType, S3_PURPOSE } from "@/lib/s3Paths";

const ALLOWED = new Set(["image/jpeg", "image/png", "image/webp"]);

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getStudioServerSession(req, res);
  if (!session?.user) return res.status(401).json({ error: "Unauthorized" });

  if (req.method !== "POST") return res.status(405).end();

  if (!isS3Configured()) {
    return res.status(503).json({
      error:
        "Photo upload is not configured. Set S3_BUCKET, S3_ACCESS_KEY_ID, S3_SECRET_ACCESS_KEY, and S3_REGION (optional: S3_PUBLIC_URL for CloudFront).",
    });
  }

  const userId = (session.user as { id: string }).id;
  const body = req.body ?? {};
  const contentType = typeof body.contentType === "string" ? body.contentType.toLowerCase() : "";
  // "avatar" (default) → members/{id}/avatars/...   |   "doc" → uploads/...
  const isDoc = body.purpose === "doc";

  if (!isDoc && !ALLOWED.has(contentType)) {
    return res.status(400).json({ error: "Use JPEG, PNG, or WebP images only." });
  }

  const key = isDoc
    ? buildS3Key({ purpose: S3_PURPOSE.generic_upload, ext: extFromContentType(contentType || "application/octet-stream") })
    : buildS3Key({ purpose: S3_PURPOSE.member_avatar, ownerId: userId, ext: extFromContentType(contentType) });

  try {
    const { uploadUrl, publicUrl } = await presignAvatarUpload({ key, contentType });
    return res.json({ uploadUrl, publicUrl, key });
  } catch (e) {
    console.error("[avatar-presign]", e);
    return res.status(500).json({ error: "Could not prepare upload" });
  }
}
