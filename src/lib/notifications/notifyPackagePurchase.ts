import prisma from "@/lib/prisma";
import { normalizePhoneDigitsForWhatsApp } from "@/lib/phone/normalizeForWhatsApp";
import { sendHtmlEmailViaResend } from "@/lib/notifications/resendEmail";
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

  const emailResult = await sendHtmlEmailViaResend({
    to: profile.email,
    subject: `Purchase confirmed — ${args.packageType.name}`,
    html: emailHtml,
  });

  let emailStatus: string;
  let emailErr: string | null = null;
  if (emailResult.ok) emailStatus = "sent";
  else if ("skipped" in emailResult && emailResult.skipped) {
    emailStatus = "skipped";
    emailErr = emailResult.reason;
  } else if ("error" in emailResult) {
    emailStatus = "failed";
    emailErr = emailResult.error.slice(0, 500);
  } else {
    emailStatus = "failed";
    emailErr = "unknown email error";
  }

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
    const paramCountRaw = Number(process.env.WHATSAPP_TEMPLATE_BODY_VARIABLES ?? "4");
    const paramCount =
      Number.isFinite(paramCountRaw) && paramCountRaw >= 0 && paramCountRaw <= 10
        ? Math.floor(paramCountRaw)
        : 4;

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

    if (wa.ok) waStatus = "sent";
    else if ("skipped" in wa && wa.skipped) {
      waStatus = "skipped";
      waError = wa.reason.slice(0, 500);
    } else if ("error" in wa) {
      waStatus = "failed";
      waError = wa.error.slice(0, 500);
    } else {
      waStatus = "failed";
      waError = "unknown whatsapp error";
    }
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
