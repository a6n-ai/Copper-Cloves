import prisma from "@/lib/prisma";
import { sendHtmlEmailViaResend } from "@/lib/notifications/resendEmail";

/**
 * Replace `{{Variable_Name}}` placeholders (CRM Template Architect style).
 */
export function interpolateCrmTemplate(template: string, variables: Record<string, string>): string {
  if (!template) return "";
  return template.replace(/\{\{\s*([^}]+?)\s*\}\}/g, (_match, key: string) => {
    const k = key.trim();
    return variables[k] ?? "";
  });
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Admin HTML or plain text → safe-ish HTML for email. */
export function crmBodyToEmailHtml(body: string): string {
  const trimmed = body.trim();
  if (!trimmed) return "<p></p>";
  if (/<[a-z][\s\S]*>/i.test(trimmed)) {
    return trimmed;
  }
  const escaped = escapeHtml(trimmed).replace(/\r\n|\r|\n/g, "<br/>");
  return `<p style="margin:0 0 12px;">${escaped}</p>`;
}

function mapSendResult(result: Awaited<ReturnType<typeof sendHtmlEmailViaResend>>): {
  status: string;
  err: string | null;
} {
  if (result.ok) return { status: "sent", err: null };
  if ("skipped" in result && result.skipped) return { status: "skipped", err: result.reason };
  if ("error" in result && result.error) return { status: "failed", err: result.error.slice(0, 500) };
  return { status: "failed", err: "unknown" };
}

function siteBaseUrl(): string {
  const fromEnv =
    process.env.NEXTAUTH_URL?.trim() ||
    process.env.NEXT_PUBLIC_SITE_URL?.trim() ||
    "";
  return fromEnv.replace(/\/$/, "");
}

/**
 * Send all **active** CRM triggers for `triggerType` that have email enabled and a template with email on.
 * Logs one `crm_messages` row per send attempt. Does not throw.
 */
export async function dispatchCrmEmailTriggers(options: {
  triggerType: string;
  userId: string;
  variables: Record<string, string>;
}): Promise<void> {
  const profile = await prisma.profile.findUnique({
    where: { id: options.userId },
    select: { id: true, email: true, full_name: true },
  });
  if (!profile?.email?.trim()) return;

  const triggers = await prisma.crmTrigger.findMany({
    where: {
      trigger_type: options.triggerType,
      is_active: true,
      channel_email: true,
    },
    include: { template: true },
  });

  const base = siteBaseUrl();
  const merged: Record<string, string> = {
    Member_Name: profile.full_name?.trim() || profile.email.split("@")[0] || "Member",
    Studio_Link: base,
    Portal_Link: base ? `${base}/portal/dashboard` : "/portal/dashboard",
    ...options.variables,
  };

  for (const trigger of triggers) {
    const tmpl = trigger.template;
    if (!tmpl?.channel_email) continue;

    const subjectRaw = tmpl.subject?.trim() || "Message from The Studio";
    const bodyRaw = tmpl.message_body ?? "";

    const subject = interpolateCrmTemplate(subjectRaw, merged);
    const bodyInterpolated = interpolateCrmTemplate(bodyRaw, merged);
    const html = crmBodyToEmailHtml(bodyInterpolated);

    const result = await sendHtmlEmailViaResend({
      to: profile.email,
      subject,
      html,
    });

    const { status, err } = mapSendResult(result);

    const preview =
      bodyInterpolated.length > 4000 ? `${bodyInterpolated.slice(0, 4000)}…` : bodyInterpolated;

    await prisma.crmMessage.create({
      data: {
        user_id: profile.id,
        template_id: tmpl.id,
        channel: "email",
        subject,
        message_body: preview,
        status,
        sent_at: status === "sent" ? new Date() : null,
        error_message: err,
      },
    });
  }
}

export async function buildBookingCrmVariables(bookingId: string): Promise<Record<string, string>> {
  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    include: {
      class_schedule: { include: { class_model: true, instructor: true } },
    },
  });
  if (!booking) {
    return { Class_Name: "Class", Class_Time: "", Class_Date: "", Instructor_Name: "" };
  }

  const sch = booking.class_schedule;
  const cm = sch?.class_model;
  const inst = sch?.instructor;

  const className = booking.class_name?.trim() || cm?.name?.trim() || "Class";

  let classTime = booking.class_time?.trim() || "";
  if (!classTime && sch) {
    classTime = `${sch.start_time.toLocaleString("en-IN", {
      weekday: "short",
      dateStyle: "medium",
      timeStyle: "short",
    })} – ${sch.end_time.toLocaleTimeString("en-IN", { timeStyle: "short" })}`;
  }

  const classDate = booking.booking_date.toLocaleString("en-IN", {
    dateStyle: "full",
    timeStyle: "short",
  });

  return {
    Class_Name: className,
    Class_Time: classTime,
    Class_Date: classDate,
    Instructor_Name: inst?.name?.trim() || "",
  };
}
