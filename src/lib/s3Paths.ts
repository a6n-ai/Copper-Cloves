/**
 * Centralised S3 key conventions. All new uploads should derive their key via
 * `buildS3Key` so the bucket stays organised by owner type. Legacy keys under
 * `uploads/...` and `avatars/...` are migrated via scripts/migrate-images-to-s3-paths.ts.
 */

export const S3_PURPOSE = {
  member_avatar: "member_avatar",
  instructor_photo: "instructor_photo",
  class_image: "class_image",
  cafe_item_image: "cafe_item_image",
  retail_product_image: "retail_product_image",
  payment_proof: "payment_proof",
  qr_code: "qr_code",
  generic_upload: "generic_upload",
} as const;

export type S3Purpose = (typeof S3_PURPOSE)[keyof typeof S3_PURPOSE];

const PREFIX: Record<S3Purpose, string> = {
  member_avatar: "members",
  instructor_photo: "instructors",
  class_image: "classes",
  cafe_item_image: "cafe-items",
  retail_product_image: "retail-products",
  payment_proof: "payment-proofs",
  qr_code: "qr-codes",
  generic_upload: "uploads",
};

const SUBPATH: Partial<Record<S3Purpose, string>> = {
  member_avatar: "avatars",
};

export function extFromContentType(contentType: string): string {
  const ct = contentType.trim().toLowerCase();
  if (ct === "image/jpeg" || ct === "image/jpg") return "jpg";
  if (ct === "image/png") return "png";
  if (ct === "image/webp") return "webp";
  if (ct === "image/gif") return "gif";
  if (ct === "image/avif") return "avif";
  if (ct === "image/heic") return "heic";
  if (ct === "image/heif") return "heif";
  if (ct === "image/svg+xml") return "svg";
  const tail = ct.split("/")[1];
  return tail ? tail.replace(/[^a-z0-9]/g, "") || "bin" : "bin";
}

export interface BuildKeyArgs {
  purpose: S3Purpose;
  /** Owner id (instructor id, member id, class id, etc.). Optional for generic uploads. */
  ownerId?: string | null;
  /** Extension without dot. If omitted, inferred from `contentType`. */
  ext?: string;
  contentType?: string;
  /** Override the auto-generated filename portion (`{ts}-{rand}`). */
  filename?: string;
}

/**
 * Build a deterministic, role-scoped S3 key. Layout:
 *
 *   instructors/{ownerId}/{filename}.{ext}
 *   members/{ownerId}/avatars/{filename}.{ext}
 *   classes/{ownerId}/{filename}.{ext}
 *   payment-proofs/{ownerId}/{filename}.{ext}
 *   uploads/{filename}.{ext}                       (no owner)
 */
export function buildS3Key(args: BuildKeyArgs): string {
  const prefix = PREFIX[args.purpose];
  const sub = SUBPATH[args.purpose];
  const ext = args.ext?.replace(/^\./, "") ?? (args.contentType ? extFromContentType(args.contentType) : "bin");
  const name = args.filename ?? `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  const parts: string[] = [prefix];
  if (args.ownerId) parts.push(args.ownerId);
  if (sub) parts.push(sub);
  parts.push(`${name}.${ext}`);
  return parts.join("/");
}
