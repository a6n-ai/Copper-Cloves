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
    memberName: ph("Member_Name"),
    className: ph("Class_Name"),
    instructorName: ph("Instructor_Name"),
    dateStr: ph("Class_Date"),
    startTime: ph("Start_Time"),
    endTime: ph("End_Time"),
    portalUrl: ph("Studio_Link"),
  }),
  individual_class_booking: individualClassBookingEmail({
    memberName: ph("Member_Name"),
    className: ph("Class_Name"),
    instructorName: ph("Instructor_Name"),
    dateStr: ph("Class_Date"),
    startTime: ph("Start_Time"),
    endTime: ph("End_Time"),
    transactionId: ph("Transaction_Id"),
    paymentDate: ph("Payment_Date"),
    amountPaid: ph("Amount_Paid"),
    portalUrl: ph("Studio_Link"),
  }),
  account_ready: accountReadyEmail({
    memberName: ph("Member_Name"),
    email: ph("Email"),
    password: ph("Password"),
    loginUrl: ph("Login_Link"),
  }),
  // CRM cancellation templates use the Snake_Case variable set (matches
  // buildBookingCrmVariables + the dispatcher) plus {{Refund_Roster}} (the
  // group "who got what" card) and {{Credits_Count}}.
  cancellation_credit_returned: cancellationEmail({
    memberName: ph("Member_Name"),
    className: ph("Class_Name"),
    instructorName: ph("Instructor_Name"),
    dateStr: ph("Class_Date"),
    startTime: ph("Class_Time"),
    creditsReturned: true,
    creditsCount: 1,
    portalUrl: ph("Studio_Link"),
    refundRosterHtml: ph("Refund_Roster"),
  }).replace(/1 class credit has/g, "{{Credits_Count}} class credit has"),
  cancellation_no_credit: cancellationEmail({
    memberName: ph("Member_Name"),
    className: ph("Class_Name"),
    instructorName: ph("Instructor_Name"),
    dateStr: ph("Class_Date"),
    startTime: ph("Class_Time"),
    creditsReturned: false,
    portalUrl: ph("Studio_Link"),
    refundRosterHtml: ph("Refund_Roster"),
  }),
};

for (const [key, html] of Object.entries(templates)) {
  writeFileSync(join(outDir, `${key}.html`), postProcess(html));
}
console.log("Wrote", Object.keys(templates).length, "templates to", outDir);
