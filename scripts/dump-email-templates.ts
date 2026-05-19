import {
  bookingConfirmationEmail,
  individualClassBookingEmail,
  accountReadyEmail,
  cancellationEmail,
} from "../src/lib/notifications/emailTemplates";
import { writeFileSync, mkdirSync } from "fs";
import { join } from "path";

const outDir = join(__dirname, "../src/lib/notifications/system-templates");
mkdirSync(outDir, { recursive: true });

function ph(name: string) {
  // sentinel that survives html-escape (no special chars). Replaced post-render.
  return `XX${name}XX`;
}

function postProcess(html: string): string {
  // Convert sentinels XXfooXX → {{foo}}
  return html.replace(/XX([A-Za-z0-9_]+)XX/g, "{{$1}}");
}

const templates: Record<string, string> = {
  booking_confirmation: bookingConfirmationEmail({
    memberName: ph("memberName"),
    className: ph("className"),
    instructorName: ph("instructorName"),
    dateStr: ph("dateStr"),
    startTime: ph("startTime"),
    endTime: ph("endTime"),
    portalUrl: ph("portalUrl"),
  }),
  individual_class_booking: individualClassBookingEmail({
    memberName: ph("memberName"),
    className: ph("className"),
    instructorName: ph("instructorName"),
    dateStr: ph("dateStr"),
    startTime: ph("startTime"),
    endTime: ph("endTime"),
    transactionId: ph("transactionId"),
    paymentDate: ph("paymentDate"),
    amountPaid: ph("amountPaid"),
    portalUrl: ph("portalUrl"),
  }),
  account_ready: accountReadyEmail({
    memberName: ph("memberName"),
    email: ph("email"),
    password: ph("password"),
    loginUrl: ph("loginUrl"),
  }),
  cancellation_credit_returned: cancellationEmail({
    memberName: ph("memberName"),
    className: ph("className"),
    instructorName: ph("instructorName"),
    dateStr: ph("dateStr"),
    startTime: ph("startTime"),
    creditsReturned: true,
    creditsCount: 1,
    portalUrl: ph("portalUrl"),
  }).replace(/1 class credit has/g, "{{creditsCount}} class credit has"),
  cancellation_no_credit: cancellationEmail({
    memberName: ph("memberName"),
    className: ph("className"),
    instructorName: ph("instructorName"),
    dateStr: ph("dateStr"),
    startTime: ph("startTime"),
    creditsReturned: false,
    portalUrl: ph("portalUrl"),
  }),
};

for (const [key, html] of Object.entries(templates)) {
  writeFileSync(join(outDir, `${key}.html`), postProcess(html));
}
console.log("Wrote", Object.keys(templates).length, "templates to", outDir);
