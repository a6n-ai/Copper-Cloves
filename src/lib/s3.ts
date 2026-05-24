import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

const bucket = process.env.S3_BUCKET?.trim();
const region = process.env.S3_REGION?.trim() || "ap-south-1";
const publicBase =
  process.env.S3_PUBLIC_URL?.trim() ||
  (bucket ? `https://${bucket}.s3.${region}.amazonaws.com` : "");

export function isS3Configured(): boolean {
  return Boolean(
    bucket &&
      process.env.S3_ACCESS_KEY_ID?.trim() &&
      process.env.S3_SECRET_ACCESS_KEY?.trim()
  );
}

export async function presignAvatarUpload(params: {
  key: string;
  contentType: string;
}): Promise<{ uploadUrl: string; publicUrl: string }> {
  if (!isS3Configured() || !bucket) {
    throw new Error("S3_NOT_CONFIGURED");
  }

  const client = new S3Client({
    region,
    credentials: {
      accessKeyId: process.env.S3_ACCESS_KEY_ID!,
      secretAccessKey: process.env.S3_SECRET_ACCESS_KEY!,
    },
  });

  const cmd = new PutObjectCommand({
    Bucket: bucket,
    Key: params.key,
    ContentType: params.contentType,
  });

  const uploadUrl = await getSignedUrl(client, cmd, { expiresIn: 60 });
  const publicUrl = `${publicBase.replace(/\/$/, "")}/${params.key}`;

  return { uploadUrl, publicUrl };
}

/** Server-side direct upload of a buffer (e.g. generated QR PNG). Returns the public URL + key. */
export async function putObject(params: {
  key: string;
  body: Buffer;
  contentType: string;
}): Promise<{ url: string; key: string; bucket: string }> {
  if (!isS3Configured() || !bucket) {
    throw new Error("S3_NOT_CONFIGURED");
  }

  const client = new S3Client({
    region,
    credentials: {
      accessKeyId: process.env.S3_ACCESS_KEY_ID!,
      secretAccessKey: process.env.S3_SECRET_ACCESS_KEY!,
    },
  });

  await client.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: params.key,
      Body: params.body,
      ContentType: params.contentType,
    }),
  );

  return { url: `${publicBase.replace(/\/$/, "")}/${params.key}`, key: params.key, bucket };
}
