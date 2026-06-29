import prisma from "@/lib/prisma";
import { sendStudioEmail } from "@/lib/notifications/email";
import { CrmTriggerType } from "@/lib/crmTriggerTypes";
import { ROSTER_STATUSES } from "@/lib/bookingStatus";
import { HIDDEN_SCHEDULE_STATUSES } from "@/lib/scheduleStatus";

const TZ = "Asia/Kolkata";
const HOUR_MS = 60 * 60 * 1000;

function toRawString(s: unknown): string {
  if (s == null) return "";
  if (typeof s === "object") return JSON.stringify(s);
  return String(s as string | number | boolean);
}

function esc(s: unknown): string {
  return toRawString(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function fmtTime(d: Date): string {
  return d
    .toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit", timeZone: TZ })
    .toLowerCase();
}
function fmtDate(d: Date): string {
  return d.toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short", timeZone: TZ });
}
function durationLabel(start: Date, end: Date): string {
  const mins = Math.max(0, Math.round((end.getTime() - start.getTime()) / 60000));
  return `${mins} minutes`;
}
const ROMAN = ["i", "ii", "iii", "iv", "v", "vi", "vii", "viii", "ix", "x", "xi", "xii", "xiii", "xiv", "xv", "xvi", "xvii", "xviii", "xix", "xx"];

/** Active email trigger + its template for a trigger type, or null if disabled/missing. */
async function activeTriggerTemplate(triggerType: string) {
  const trigger = await prisma.crmTrigger.findFirst({
    where: { trigger_type: triggerType, is_active: true, channel_email: true },
    include: { template: true },
  });
  if (!trigger?.template?.channel_email || !trigger.template.message_body) return null;
  return trigger.template;
}

function siteBase(): string {
  return (process.env.NEXTAUTH_URL?.trim() || process.env.NEXT_PUBLIC_SITE_URL?.trim() || "").replace(/\/$/, "");
}

/** Send the ~1h pre-class reminder to each booked member. Idempotent via reminder_sent_at. */
export async function sendDueClassReminders(): Promise<{ sent: number; skipped: number }> {
  const template = await activeTriggerTemplate(CrmTriggerType.ClassReminder);
  if (!template) return { sent: 0, skipped: 0 };

  const now = new Date();
  const horizon = new Date(now.getTime() + HOUR_MS);

  const bookings = await prisma.booking.findMany({
    where: {
      status: "confirmed",
      reminder_sent_at: null,
      class_schedule: { is: { start_time: { gt: now, lte: horizon }, status: { notIn: [...HIDDEN_SCHEDULE_STATUSES] } } },
    },
    include: {
      profile: { select: { email: true, full_name: true } },
      class_schedule: { include: { class_model: true, instructor: true } },
    },
  });

  let sent = 0;
  let skipped = 0;
  for (const b of bookings) {
    const email = b.profile?.email?.trim();
    const sch = b.class_schedule;
    if (!email || !sch) {
      skipped++;
      continue;
    }
    const start = sch.start_time;
    const end = sch.end_time;
    const doorsOpen = new Date(start.getTime() - 10 * 60000);
    const minsLeft = Math.round((start.getTime() - now.getTime()) / 60000);
    const isHour = minsLeft >= 50;

    const vars: Record<string, string> = {
      Member_Name: esc(b.profile?.full_name?.trim() || email.split("@")[0]),
      Class_Name: esc(b.class_name?.trim() || sch.class_model?.name || "your class"),
      Instructor_Name: esc(sch.instructor?.name?.trim() || "your instructor"),
      Start_Time: esc(fmtTime(start)),
      End_Time: esc(fmtTime(end)),
      Time_Range: esc(`${fmtTime(start)} – ${fmtTime(end)}`),
      Doors_Open: esc(fmtTime(doorsOpen)),
      Duration: esc(durationLabel(start, end)),
      Countdown: isHour ? "1" : String(Math.max(1, minsLeft)),
      Countdown_Unit: isHour ? "hour" : "minutes",
      Studio_Link: siteBase(),
    };

    // Route through the unified service: it renders the active CRM body (the same
    // `class_reminder` template the gate above checked) or the code fallback,
    // validates the palette, sends, and writes the email audit row.
    await sendStudioEmail("class_reminder", {
      userId: b.user_id,
      data: vars,
    });
    await prisma.booking.update({ where: { id: b.id }, data: { reminder_sent_at: new Date() } });
    sent++;
  }
  return { sent, skipped };
}

type RosterBooking = {
  user_id: string;
  extra_guest_count?: number | null;
  profile?: { id?: string; full_name?: string | null; email?: string | null; phone?: string | null } | null;
};

function displayName(b: RosterBooking): string {
  return b.profile?.full_name?.trim() || b.profile?.email?.split("@")[0] || "";
}

/** First-timers: members whose earliest confirmed class is this schedule. */
async function computeFirstTimers(bookings: RosterBooking[], start: Date): Promise<string[]> {
  const firstTimers: string[] = [];
  for (const b of bookings) {
    const prior = await prisma.booking.count({
      where: { user_id: b.user_id, status: "confirmed", class_schedule: { is: { start_time: { lt: start } } } },
    });
    if (prior === 0) firstTimers.push(displayName(b) || "A new student");
  }
  return firstTimers;
}

function guestTag(count: number): string {
  if (count <= 0) return "";
  const plural = count > 1 ? "s" : "";
  return ` <span class="roster-tag">+${count} guest${plural}</span>`;
}

function buildRosterRow(
  b: RosterBooking,
  idx: number,
  total: number,
  firstTimers: string[]
): string {
  const name = esc(displayName(b) || "Member");
  const isNew = firstTimers.includes(displayName(b));
  const tag = isNew ? ' <span class="roster-tag">new</span>' : "";
  const email = esc(b.profile?.email || "");
  const phone = b.profile?.phone ? esc(b.profile.phone) : "";
  const guests = guestTag(b.extra_guest_count ?? 0);
  const contact = [
    email ? `<span class="roster-contact">${email}</span>` : "",
    email && phone ? '<span class="roster-contact" style="color:#a8a497;">&nbsp;·&nbsp;</span>' : "",
    phone ? `<span class="roster-contact roster-phone">${phone}</span>` : "",
  ].join("");
  const last = idx === total - 1;
  const roman = ROMAN[idx] ?? idx + 1;
  return `<tr class="roster-row"><td valign="top" style="padding: 16px 0;${last ? "" : " border-bottom: 1px solid #e5dfd2;"}"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td valign="top" width="30" style="padding-right: 12px;"><p class="roster-num" style="margin: 0;">${roman}.</p></td><td valign="top"><p class="roster-name" style="margin: 0;">${name}${tag}${guests}</p><p class="roster-email" style="margin: 4px 0 0 0;">${contact}</p></td></tr></table></td></tr>`;
}

function buildRosterRows(bookings: RosterBooking[], firstTimers: string[]): string {
  if (!bookings.length) {
    return `<tr><td style="padding: 16px 0;"><p class="roster-name" style="margin:0; color:#8e8a7e; font-style:italic;">No bookings yet — anyone who books will be added automatically.</p></td></tr>`;
  }
  return bookings
    .map((b, idx) => buildRosterRow(b, idx, bookings.length, firstTimers))
    .join("");
}

function buildFirstTimerNote(firstTimers: string[]): string {
  if (!firstTimers.length) return "";
  const names = firstTimers
    .map((n) => `<em style="font-family:'Cormorant Garamond',serif; font-style:italic; color:#4a5d3a;">${esc(n)}</em>`)
    .join(", ");
  const verb = firstTimers.length > 1 ? "are" : "is";
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom: 18px;"><tr><td style="border-left: 2px solid #b87333; padding: 4px 0 4px 18px;"><p class="note-name" style="margin: 0 0 6px 0;">first-timers</p><p class="note-text" style="margin: 0;">${names} ${verb} joining their first class with us — a quick welcome and intro to the studio flow would be lovely.</p></td></tr></table>`;
}

/** Send the ~6h pre-class roster to each instructor. Idempotent via roster_sent_at. */
export async function sendDueInstructorRosters(): Promise<{ sent: number; skipped: number }> {
  const template = await activeTriggerTemplate(CrmTriggerType.InstructorRoster);
  if (!template) return { sent: 0, skipped: 0 };

  const now = new Date();
  const horizon = new Date(now.getTime() + 6 * HOUR_MS);

  const schedules = await prisma.classSchedule.findMany({
    where: {
      start_time: { gt: now, lte: horizon },
      status: { notIn: [...HIDDEN_SCHEDULE_STATUSES] },
      roster_sent_at: null,
    },
    include: {
      class_model: true,
      instructor: { select: { name: true, email: true } },
      bookings: {
        // Match every live roster surface (confirmed + payment_pending holds) so
        // the emailed roster headcount agrees with the portal roster.
        where: { status: { in: [...ROSTER_STATUSES] } },
        include: { profile: { select: { id: true, full_name: true, email: true, phone: true } } },
        orderBy: { booking_date: "asc" },
      },
    },
  });

  const dashboardLink = siteBase() ? `${siteBase()}/instructor/dashboard` : "/instructor/dashboard";
  let sent = 0;
  let skipped = 0;

  for (const sch of schedules) {
    const instructorEmail = sch.instructor?.email?.trim();
    if (!instructorEmail) {
      // No instructor email — mark sent so we don't rescan forever.
      await prisma.classSchedule.update({ where: { id: sch.id }, data: { roster_sent_at: new Date() } });
      skipped++;
      continue;
    }

    const start = sch.start_time;
    const headcount = sch.bookings.reduce((n, b) => n + 1 + (b.extra_guest_count ?? 0), 0);
    const capacity = sch.capacity ?? sch.available_spots + sch.current_bookings;

    // First-timers: members whose earliest confirmed class is this one.
    const firstTimers = await computeFirstTimers(sch.bookings, start);
    const rosterRows = buildRosterRows(sch.bookings, firstTimers);
    const firstTimerNote = buildFirstTimerNote(firstTimers);

    const vars: Record<string, string> = {
      Instructor_Name: esc(sch.instructor?.name?.trim() || "there"),
      Class_Name: esc(sch.class_model?.name || "your class"),
      Class_Date: esc(fmtDate(start)),
      Start_Time: esc(fmtTime(start)),
      Time_Range: esc(`${fmtTime(start)} – ${fmtTime(sch.end_time)}`),
      Duration: esc(durationLabel(start, sch.end_time)),
      Headcount: String(headcount),
      Capacity: String(capacity),
      Spots_Left: String(Math.max(0, capacity - headcount)),
      Roster_Rows: rosterRows,
      First_Timer_Note: firstTimerNote,
      Dashboard_Link: dashboardLink,
    };

    // Route through the unified service (renders the active `instructor_roster`
    // CRM body or the code fallback, validates, sends, audits).
    await sendStudioEmail("instructor_roster", {
      to: instructorEmail,
      data: vars,
    });
    await prisma.classSchedule.update({ where: { id: sch.id }, data: { roster_sent_at: new Date() } });
    sent++;
  }
  return { sent, skipped };
}
