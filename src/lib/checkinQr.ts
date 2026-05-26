import QRCode from "qrcode";
import prisma from "@/lib/prisma";
import { mintCheckinToken, type CheckinKind } from "@/lib/checkinToken";
import { checkinTokenExp } from "@/lib/checkinWindow";
import { putObject, isS3Configured } from "@/lib/s3";

const KINDS: CheckinKind[] = ["instructor", "member"];

export interface ScheduleQr {
  kind: CheckinKind;
  token: string;
  imageUrl: string | null;
}

function deepLink(token: string): string {
  const origin = (process.env.NEXTAUTH_URL?.trim() || "").replace(/\/$/, "");
  return `${origin}/checkin?t=${encodeURIComponent(token)}`;
}

function pngToDataUrl(png: Buffer): string {
  return `data:image/png;base64,${png.toString("base64")}`;
}

async function buildQr(
  scheduleId: string,
  kind: CheckinKind,
  expMs: number,
): Promise<{ token: string; imageUrl: string | null; fileId: string | null }> {
  const token = mintCheckinToken(scheduleId, kind, expMs);
  const png = await QRCode.toBuffer(deepLink(token), { type: "png", width: 512, margin: 1 });
  const dataUrl = pngToDataUrl(png);

  if (!isS3Configured()) {
    return { token, imageUrl: dataUrl, fileId: null };
  }

  try {
    const key = `qr-codes/${scheduleId}/${kind}-${expMs}.png`;
    const up = await putObject({ key, body: png, contentType: "image/png" });
    const file = await prisma.file.create({
      data: {
        bucket: up.bucket,
        s3_key: up.key,
        url: up.url,
        content_type: "image/png",
        size_bytes: png.length,
        purpose: "qr_code",
      },
    });
    return { token, imageUrl: file.url, fileId: file.id };
  } catch (err) {
    console.error("[checkinQr] S3 upload failed, falling back to inline data URL", err);
    return { token, imageUrl: dataUrl, fileId: null };
  }
}

/**
 * Ensures both QR codes (instructor + member) exist for a schedule, generating the
 * PNG and uploading to S3 once per window. Idempotent: reuses the stored row while
 * its `exp` matches the current window.
 */
export async function ensureScheduleQrCodes(
  scheduleId: string,
  opts: { force?: boolean } = {},
): Promise<Record<CheckinKind, ScheduleQr>> {
  const schedule = await prisma.classSchedule.findUnique({
    where: { id: scheduleId },
    select: { id: true, start_time: true },
  });
  if (!schedule) throw new Error("Schedule not found");

  const expMs = checkinTokenExp(schedule.start_time);
  const exp = new Date(expMs);
  const out = {} as Record<CheckinKind, ScheduleQr>;

  for (const kind of KINDS) {
    const existing = await prisma.qrCode.findUnique({
      where: { class_schedule_id_kind: { class_schedule_id: scheduleId, kind } },
      include: { file: true },
    });

    const hasUsableImage = !!existing?.file?.url;
    if (
      !opts.force &&
      existing &&
      existing.is_active &&
      existing.exp.getTime() === expMs &&
      hasUsableImage
    ) {
      out[kind] = { kind, token: existing.token, imageUrl: existing.file?.url ?? null };
      continue;
    }

    const built = await buildQr(scheduleId, kind, expMs);
    await prisma.qrCode.upsert({
      where: { class_schedule_id_kind: { class_schedule_id: scheduleId, kind } },
      create: {
        class_schedule_id: scheduleId,
        kind,
        token: built.token,
        exp,
        file_id: built.fileId,
        is_active: true,
      },
      update: { token: built.token, exp, file_id: built.fileId, is_active: true },
    });
    out[kind] = { kind, token: built.token, imageUrl: built.imageUrl };
  }

  return out;
}
