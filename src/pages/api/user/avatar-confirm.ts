import type { NextApiRequest, NextApiResponse } from "next";
import prisma from "@/lib/prisma";
import { getStudioServerSession } from "@/lib/getStudioServerSession";
import { s3Bucket, buildPublicUrl } from "@/lib/s3";

/**
 * Finalises a member avatar after the browser PUTs the file to the presigned
 * S3 URL: registers a `files` row and links it via `profiles.avatar_file_id`,
 * also updating `avatar_url`. Scoped to the signed-in member's own profile.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") return res.status(405).end();

  const session = await getStudioServerSession(req, res);
  if (!session?.user) return res.status(401).json({ error: "Unauthorized" });
  const userId = (session.user as { id: string }).id;

  const body = req.body ?? {};
  const key = typeof body.key === "string" ? body.key.trim() : "";
  const contentType = typeof body.contentType === "string" ? body.contentType : "image/jpeg";
  const sizeBytes = Number.isFinite(body.sizeBytes) ? Number(body.sizeBytes) : null;
  if (!key) return res.status(400).json({ error: "key required" });

  try {
    const url = buildPublicUrl(key);
    const result = await prisma.$transaction(async (tx) => {
      const file = await tx.file.create({
        data: {
          bucket: s3Bucket(),
          s3_key: key,
          url,
          content_type: contentType,
          size_bytes: sizeBytes,
          purpose: "member_avatar",
          created_by: userId,
        },
      });
      await tx.profile.update({
        where: { id: userId },
        data: { avatar_url: url, avatar_file_id: file.id },
      });
      return file;
    });
    return res.json({ url, fileId: result.id });
  } catch (e) {
    console.error("[avatar-confirm]", e);
    return res.status(500).json({ error: "Could not finalise avatar" });
  }
}
