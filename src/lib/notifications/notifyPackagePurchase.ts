import prisma from "@/lib/prisma";
import { normalizePhoneDigitsForWhatsApp } from "@/lib/phone/normalizeForWhatsApp";
import { sendHtmlEmail } from "@/lib/notifications/sendEmail";
import { sendWhatsAppTemplateMessage } from "@/lib/notifications/whatsappCloud";

function moneyInr(amount: unknown): string {
  const n = typeof amount === "number" ? amount : Number(amount);
  if (!Number.isFinite(n)) return "—";
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR" }).format(n);
}

function packageSummary(pt: {
  is_unlimited: boolean;
  class_count?: number | null;
  duration_months?: number | null;
}): string {
  if (pt.is_unlimited) return "Unlimited classes";
  const c = pt.class_count;
  const mo = pt.duration_months;
  const parts: string[] = [];
  if (c != null) parts.push(`${c} classes`);
  if (mo != null) parts.push(`${mo} mo validity`);
  return parts.join(" · ") || "Package";
}

type SendOutcome = { status: string; err: string | null };

// Classify a send result (email or whatsapp) into a CRM status + error string.
// `reasonSlice` controls whether the skipped `reason` is truncated (whatsapp) or not (email).
function classifySendResult(
  result:
    | { ok: true }
    | { ok: false; skipped?: boolean; reason?: string; error?: string },
  unknownLabel: string,
  reasonSlice: boolean
): SendOutcome {
  if (result.ok) return { status: "sent", err: null };
  if ("skipped" in result && result.skipped) {
    const reason = result.reason ?? "";
    return { status: "skipped", err: reasonSlice ? reason.slice(0, 500) : reason };
  }
  if ("error" in result && result.error != null) {
    return { status: "failed", err: result.error.slice(0, 500) };
  }
  return { status: "failed", err: unknownLabel };
}

// Resolve the WhatsApp body parameter count from env (clamped 0..10, default 4).
function resolveWhatsAppParamCount(): number {
  const raw = Number(process.env.WHATSAPP_TEMPLATE_BODY_VARIABLES ?? "4");
  return Number.isFinite(raw) && raw >= 0 && raw <= 10 ? Math.floor(raw) : 4;
}

/**
 * Sends purchase confirmation via email (Resend) and WhatsApp (Cloud API template).
 * Loads profile + logs each attempt on `crm_messages`. Does not throw — callers should fire-and-forget.
 */
export async function notifyPackagePurchase(args: {
  userId: string;
  packageType: {
    name: string;
    price: unknown;
    is_unlimited: boolean;
    class_count?: number | null;
    duration_months?: number | null;
    description?: string | null;
  };
  expirationDate: Date;
}): Promise<void> {
  const profile = await prisma.profile.findUnique({
    where: { id: args.userId },
    select: { id: true, email: true, full_name: true, phone: true },
  });
  if (!profile) return;

  const memberName = profile.full_name?.trim() || profile.email.split("@")[0];
  const summary = packageSummary(args.packageType);
  const expiryStr = args.expirationDate.toLocaleDateString("en-IN", {
    dateStyle: "medium",
  });
  const priceStr = moneyInr(args.packageType.price);

  const emailHtml = `
    <p>Hi ${escapeHtml(memberName)},</p>
    <p>Thanks for your purchase at Copper & Cloves.</p>
    <p><strong>${escapeHtml(args.packageType.name)}</strong><br/>
    ${escapeHtml(summary)}<br/>
    Amount: ${escapeHtml(priceStr)}<br/>
    Valid until: ${escapeHtml(expiryStr)}
    </p>
    <p>See you in the studio.</p>
  `;

  const emailResult = await sendHtmlEmail({
    to: profile.email,
    subject: `Purchase confirmed — ${args.packageType.name}`,
    html: emailHtml,
    context: { type: "package_purchase", targetProfileId: profile.id },
  });

  const { status: emailStatus, err: emailErr } = classifySendResult(
    emailResult,
    "unknown email error",
    false
  );

  await prisma.crmMessage.create({
    data: {
      user_id: profile.id,
      channel: "email",
      subject: `Purchase confirmed — ${args.packageType.name}`,
      message_body: `Package: ${args.packageType.name} | ${summary} | ${priceStr} | Expires ${expiryStr}`,
      status: emailStatus,
      sent_at: emailStatus === "sent" ? new Date() : null,
      error_message: emailErr,
    },
  });

  const template = process.env.WHATSAPP_PACKAGE_TEMPLATE_NAME?.trim();
  const lang = process.env.WHATSAPP_TEMPLATE_LANGUAGE?.trim() || "en_US";
  const toDigits =
    normalizePhoneDigitsForWhatsApp(
      profile.phone,
      process.env.WHATSAPP_DEFAULT_COUNTRY_CODE?.replace(/\D/g, "") || "91"
    ) ?? null;

  let waStatus: string;
  let waError: string | null = null;
  let waBody = "";

  if (!template) {
    waStatus = "skipped";
    waError = "WHATSAPP_PACKAGE_TEMPLATE_NAME unset";
  } else if (!toDigits) {
    waStatus = "skipped";
    waError = "No normalizable phone on profile";
  } else {
    const paramCount = resolveWhatsAppParamCount();

    const allParams = [
      memberName,
      args.packageType.name,
      `${summary}. ${priceStr}`,
      expiryStr,
      profile.email,
    ];
    const bodyParameters = allParams.slice(0, paramCount);

    waBody = bodyParameters.join(" | ");
    const wa = await sendWhatsAppTemplateMessage({
      toDigits,
      templateName: template,
      languageCode: lang,
      bodyParameters,
    });

    const outcome = classifySendResult(wa, "unknown whatsapp error", true);
    waStatus = outcome.status;
    waError = outcome.err;
  }

  await prisma.crmMessage.create({
    data: {
      user_id: profile.id,
      channel: "whatsapp",
      subject: null,
      message_body: waBody || `Template: ${template ?? "—"} to ${toDigits ?? "—"}`,
      status: waStatus,
      sent_at: waStatus === "sent" ? new Date() : null,
      error_message: waError,
    },
  });
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
