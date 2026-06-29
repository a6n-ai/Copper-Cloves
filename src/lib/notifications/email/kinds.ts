import {
  bookingConfirmationEmail,
  cancellationEmail,
  individualClassBookingEmail,
  accountReadyEmail,
  instructorWelcomeEmail,
  classRescheduledEmail,
} from "@/lib/notifications/emailTemplates";
import { buildBookingVars } from "./variables";

export type EmailKindName =
  | "booking_confirmed"
  | "booking_cancelled"
  | "booking_cancelled_no_credit"
  | "class_reminder"
  | "instructor_roster"
  | "account_ready"
  | "individual_class_paid"
  | "class_rescheduled"
  | "instructor_welcome";

/** Loosely-typed per-send payload; each kind's buildVars narrows the fields it needs. */
export type EmailData = Record<string, unknown>;

export interface EmailKind {
  /** CRM template_key whose admin-editable body wins when active. "" = code-only. */
  templateKey: string;
  /** Fixed Snake_Case variable palette this kind always supplies. Code-owned. */
  variables: readonly string[];
  subject: string;
  buildVars: (data: EmailData) => Promise<Record<string, string>> | Record<string, string>;
  codeBuilder: (vars: Record<string, string>) => string;
}

// ── Shared palettes ─────────────────────────────────────────────────────────

const BOOKING_VARS = [
  "Member_Name",
  "Class_Name",
  "Instructor_Name",
  "Class_Date",
  "Class_Time",
  "Start_Time",
  "End_Time",
  "Studio_Link",
] as const;

const CANCEL_VARS = [
  "Member_Name",
  "Class_Name",
  "Instructor_Name",
  "Class_Date",
  "Class_Time",
  "Refund_Roster",
  "Refund_Detail",
  "Studio_Link",
] as const;

const REMINDER_VARS = [
  "Member_Name",
  "Class_Name",
  "Instructor_Name",
  "Start_Time",
  "End_Time",
  "Time_Range",
  "Doors_Open",
  "Duration",
  "Countdown",
  "Countdown_Unit",
  "Studio_Link",
] as const;

const ROSTER_VARS = [
  "Instructor_Name",
  "Class_Name",
  "Class_Date",
  "Start_Time",
  "Time_Range",
  "Duration",
  "Headcount",
  "Capacity",
  "Spots_Left",
  "Roster_Rows",
  "First_Timer_Note",
  "Dashboard_Link",
] as const;

// ── Code-only fallback bodies for the CRM-driven cron kinds ─────────────────
// These kinds normally render an active admin template; the service prefers the
// CRM body. The fallbacks below keep each kind self-contained (the test renders
// them with stub vars and asserts zero leftover {{tokens}}).

function reminderFallback(v: Record<string, string>): string {
  return `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"></head>
<body style="margin:0;padding:24px;background:#F5F0E8;font-family:Georgia,serif">
  <div style="max-width:600px;margin:0 auto;background:#fff;border-radius:16px;padding:32px">
    <p style="font-size:17px;color:#2C2C2C;margin:0 0 12px">hi ${v.Member_Name},</p>
    <p style="font-size:15px;color:#2C2C2C;line-height:1.6;margin:0 0 8px">Your class <strong>${v.Class_Name}</strong> with ${v.Instructor_Name} starts in ${v.Countdown} ${v.Countdown_Unit}.</p>
    <p style="font-size:15px;color:#2C2C2C;line-height:1.6;margin:0 0 8px">Time: <strong>${v.Time_Range}</strong> · doors open ${v.Doors_Open} · ${v.Duration}.</p>
    <p style="font-size:14px;color:#888;margin:16px 0 0">See you on the mat! <a href="${v.Studio_Link}" style="color:#7C9070">open the studio</a></p>
  </div>
</body></html>`;
}

function rosterFallback(v: Record<string, string>): string {
  return `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"></head>
<body style="margin:0;padding:24px;background:#F5F0E8;font-family:Georgia,serif">
  <div style="max-width:600px;margin:0 auto;background:#fff;border-radius:16px;padding:32px">
    <p style="font-size:17px;color:#2C2C2C;margin:0 0 12px">hi ${v.Instructor_Name},</p>
    <p style="font-size:15px;color:#2C2C2C;line-height:1.6;margin:0 0 8px">Here's your roster for <strong>${v.Class_Name}</strong> on ${v.Class_Date}, ${v.Time_Range} (${v.Duration}).</p>
    <p style="font-size:14px;color:#888;margin:0 0 16px">Headcount ${v.Headcount} / ${v.Capacity} · ${v.Spots_Left} spots left</p>
    ${v.First_Timer_Note}
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">${v.Roster_Rows}</table>
    <p style="font-size:14px;color:#888;margin:16px 0 0"><a href="${v.Dashboard_Link}" style="color:#7C9070">open instructor dashboard</a></p>
  </div>
</body></html>`;
}

// ── Registry ────────────────────────────────────────────────────────────────

export const EMAIL_KINDS: Record<EmailKindName, EmailKind> = {
  booking_confirmed: {
    templateKey: "booking_confirmation",
    variables: BOOKING_VARS,
    subject: "Your booking is confirmed — {{Class_Name}}",
    buildVars: (d: { bookingId: string }) => buildBookingVars(d.bookingId),
    codeBuilder: (v) =>
      bookingConfirmationEmail({
        memberName: v.Member_Name,
        className: v.Class_Name,
        instructorName: v.Instructor_Name,
        dateStr: v.Class_Date,
        startTime: v.Start_Time,
        endTime: v.End_Time,
        portalUrl: v.Studio_Link,
      }),
  },

  booking_cancelled: {
    templateKey: "cancellation_credit_returned",
    variables: [...CANCEL_VARS, "Credits_Count"],
    subject: "Your booking has been cancelled — {{Class_Name}}",
    buildVars: async (d: { bookingId: string; refundRosterHtml?: string; creditsCount?: string }) => ({
      ...(await buildBookingVars(d.bookingId)),
      Refund_Roster: d.refundRosterHtml ?? "",
      Credits_Count: d.creditsCount ?? "",
    }),
    codeBuilder: (v) =>
      cancellationEmail({
        memberName: v.Member_Name,
        className: v.Class_Name,
        instructorName: v.Instructor_Name,
        dateStr: v.Class_Date,
        startTime: v.Class_Time,
        creditsReturned: true,
        creditsCount: v.Credits_Count ? Number(v.Credits_Count) : undefined,
        refundRosterHtml: v.Refund_Roster,
        portalUrl: v.Studio_Link,
      }),
  },

  booking_cancelled_no_credit: {
    templateKey: "cancellation_no_credit",
    variables: CANCEL_VARS,
    subject: "Your booking has been cancelled — {{Class_Name}}",
    buildVars: async (d: { bookingId: string; refundRosterHtml?: string }) => ({
      ...(await buildBookingVars(d.bookingId)),
      Refund_Roster: d.refundRosterHtml ?? "",
    }),
    codeBuilder: (v) =>
      cancellationEmail({
        memberName: v.Member_Name,
        className: v.Class_Name,
        instructorName: v.Instructor_Name,
        dateStr: v.Class_Date,
        startTime: v.Class_Time,
        creditsReturned: false,
        refundRosterHtml: v.Refund_Roster,
        portalUrl: v.Studio_Link,
      }),
  },

  class_reminder: {
    templateKey: "class_reminder",
    variables: REMINDER_VARS,
    subject: "Your class is coming up — {{Class_Name}} at {{Start_Time}}",
    buildVars: (d: Record<string, string>) => ({ ...d }),
    codeBuilder: reminderFallback,
  },

  instructor_roster: {
    templateKey: "instructor_roster",
    variables: ROSTER_VARS,
    subject: "Your roster for {{Class_Name}} — {{Class_Date}}",
    buildVars: (d: Record<string, string>) => ({ ...d }),
    codeBuilder: rosterFallback,
  },

  account_ready: {
    templateKey: "account_ready",
    variables: ["Member_Name", "Email", "Password", "Login_Link"],
    subject: "Your account is ready, {{Member_Name}}",
    buildVars: (d: Record<string, string>) => ({ ...d }),
    codeBuilder: (v) =>
      accountReadyEmail({
        memberName: v.Member_Name,
        email: v.Email,
        password: v.Password,
        loginUrl: v.Login_Link,
      }),
  },

  individual_class_paid: {
    templateKey: "individual_class_booking",
    variables: [...BOOKING_VARS, "Transaction_Id", "Amount_Paid", "Payment_Date"],
    subject: "Class booked & payment confirmed — {{Class_Name}}",
    buildVars: async (d: {
      bookingId: string;
      transactionId?: string;
      amountPaid?: string;
      paymentDate?: string;
    }) => ({
      ...(await buildBookingVars(d.bookingId)),
      Transaction_Id: d.transactionId ?? "",
      Amount_Paid: d.amountPaid ?? "",
      Payment_Date: d.paymentDate ?? "",
    }),
    codeBuilder: (v) =>
      individualClassBookingEmail({
        memberName: v.Member_Name,
        className: v.Class_Name,
        instructorName: v.Instructor_Name,
        dateStr: v.Class_Date,
        startTime: v.Start_Time,
        endTime: v.End_Time,
        portalUrl: v.Studio_Link,
        transactionId: v.Transaction_Id,
        amountPaid: v.Amount_Paid,
        paymentDate: v.Payment_Date,
      }),
  },

  class_rescheduled: {
    templateKey: "",
    variables: [
      "Member_Name",
      "Class_Name",
      "Instructor_Name",
      "Old_Class_Date",
      "Old_Start_Time",
      "New_Class_Date",
      "New_Start_Time",
      "New_End_Time",
      "Studio_Link",
    ],
    subject: "Your class time has changed — {{Class_Name}}",
    buildVars: (d: Record<string, string>) => ({ ...d }),
    codeBuilder: (v) =>
      classRescheduledEmail({
        memberName: v.Member_Name,
        className: v.Class_Name,
        instructorName: v.Instructor_Name,
        oldDateStr: v.Old_Class_Date,
        oldStartTime: v.Old_Start_Time,
        newDateStr: v.New_Class_Date,
        newStartTime: v.New_Start_Time,
        newEndTime: v.New_End_Time,
        portalUrl: v.Studio_Link,
      }),
  },

  instructor_welcome: {
    templateKey: "",
    variables: ["Instructor_Name", "Email", "Temp_Password", "Login_Link"],
    subject: "Welcome to the instructor portal, {{Instructor_Name}}",
    buildVars: (d: Record<string, string>) => ({ ...d }),
    codeBuilder: (v) =>
      instructorWelcomeEmail({
        instructorName: v.Instructor_Name,
        email: v.Email,
        tempPassword: v.Temp_Password,
        loginUrl: v.Login_Link,
      }),
  },
};
