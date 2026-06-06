import { S3Client, PutObjectCommand, CopyObjectCommand, HeadObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

const bucket = process.env.S3_BUCKET?.trim();
const region = process.env.S3_REGION?.trim() || "ap-south-1";
const publicBase =
  process.env.S3_PUBLIC_URL?.trim() ||
  (bucket ? `https://${bucket}.s3.${region}.amazonaws.com` : "");

export function s3Bucket(): string | undefined {
  return bucket;
}

export function s3PublicBase(): string {
  return publicBase;
}

export function buildPublicUrl(key: string): string {
  return `${publicBase.replace(/\/$/, "")}/${key.replace(/^\//, "")}`;
}

/**
 * Best-effort: extract the S3 object key from a URL we previously stored.
 * Handles both the default `https://{bucket}.s3.{region}.amazonaws.com/{key}`
 * shape and any `S3_PUBLIC_URL`-prefixed CloudFront/CDN URL.
 * Returns null if the URL doesn't look like an S3-hosted asset.
 */
export function extractS3Key(url: string | null | undefined): string | null {
  if (!url) return null;
  const trimmed = url.trim();
  if (!trimmed || trimmed.startsWith("data:") || trimmed.startsWith("/")) return null;

  const bases: string[] = [];
  if (publicBase) bases.push(publicBase.replace(/\/$/, ""));
  if (bucket) {
    bases.push(`https://${bucket}.s3.${region}.amazonaws.com`);
    bases.push(`https://s3.${region}.amazonaws.com/${bucket}`);
    bases.push(`https://${bucket}.s3.amazonaws.com`);
  }

  for (const base of bases) {
    if (trimmed.startsWith(`${base}/`)) {
      return decodeURIComponent(trimmed.slice(base.length + 1));
    }
  }
  return null;
}

function buildClient(): S3Client {
  if (!isS3Configured() || !bucket) throw new Error("S3_NOT_CONFIGURED");
  return new S3Client({
    region,
    credentials: {
      accessKeyId: process.env.S3_ACCESS_KEY_ID ?? "",
      secretAccessKey: process.env.S3_SECRET_ACCESS_KEY ?? "",
    },
  });
}

/** Server-side copy of an existing object to a new key (no download needed). */
export async function copyObject(params: {
  sourceKey: string;
  destKey: string;
  contentType?: string;
}): Promise<{ url: string; key: string; bucket: string }> {
  if (!bucket) throw new Error("S3_NOT_CONFIGURED");
  const client = buildClient();
  await client.send(
    new CopyObjectCommand({
      Bucket: bucket,
      CopySource: `/${bucket}/${encodeURI(params.sourceKey)}`,
      Key: params.destKey,
      ContentType: params.contentType,
      MetadataDirective: params.contentType ? "REPLACE" : "COPY",
    }),
  );
  return { url: buildPublicUrl(params.destKey), key: params.destKey, bucket };
}

/** HEAD probe — returns content-type and size if the key exists, null otherwise. */
export async function headObject(
  key: string,
): Promise<{ contentType?: string; size?: number } | null> {
  if (!bucket) return null;
  try {
    const client = buildClient();
    const r = await client.send(new HeadObjectCommand({ Bucket: bucket, Key: key }));
    return { contentType: r.ContentType ?? undefined, size: r.ContentLength ?? undefined };
  } catch {
    return null;
  }
}

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

  const client = buildClient();

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

  const client = buildClient();

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
