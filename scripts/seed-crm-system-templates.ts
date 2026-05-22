import prisma from "../src/lib/prisma";
import { readFileSync } from "fs";
import { join } from "path";

interface SystemTemplateDef {
  template_key: string;
  name: string;
  template_type: string;
  subject: string;
  variables: string[];
  channel_email: boolean;
  channel_whatsapp: boolean;
}

const TEMPLATES_DIR = join(__dirname, "../src/lib/notifications/system-templates");

const SYSTEM_TEMPLATES: SystemTemplateDef[] = [
  {
    template_key: "booking_confirmation",
    name: "Class Booking Confirmation",
    template_type: "booking",
    subject: "Your booking is confirmed — {{className}} on {{dateStr}}",
    variables: [
      "memberName",
      "className",
      "instructorName",
      "dateStr",
      "startTime",
      "endTime",
      "portalUrl",
    ],
    channel_email: true,
    channel_whatsapp: false,
  },
  {
    template_key: "individual_class_booking",
    name: "Individual Class Purchase + Booking",
    template_type: "booking",
    subject: "Class booked & payment confirmed — {{className}}",
    variables: [
      "memberName",
      "className",
      "instructorName",
      "dateStr",
      "startTime",
      "endTime",
      "transactionId",
      "paymentDate",
      "amountPaid",
      "portalUrl",
    ],
    channel_email: true,
    channel_whatsapp: false,
  },
  {
    template_key: "account_ready",
    name: "Welcome — Account Ready",
    template_type: "onboarding",
    subject: "Your account is ready, {{memberName}}",
    variables: ["memberName", "email", "password", "loginUrl"],
    channel_email: true,
    channel_whatsapp: false,
  },
  {
    template_key: "cancellation_credit_returned",
    name: "Booking Cancellation (credit returned)",
    template_type: "booking",
    subject: "Your booking has been cancelled",
    variables: [
      "memberName",
      "className",
      "instructorName",
      "dateStr",
      "startTime",
      "creditsCount",
      "portalUrl",
    ],
    channel_email: true,
    channel_whatsapp: false,
  },
  {
    template_key: "cancellation_no_credit",
    name: "Booking Cancellation (within 12h, no credit)",
    template_type: "booking",
    subject: "Your booking has been cancelled",
    variables: [
      "memberName",
      "className",
      "instructorName",
      "dateStr",
      "startTime",
      "portalUrl",
    ],
    channel_email: true,
    channel_whatsapp: false,
  },
  {
    template_key: "class_reminder",
    name: "Class Reminder (≈1h before)",
    template_type: "reminder",
    subject: "Your class is coming up — {{Class_Name}} at {{Start_Time}}",
    variables: [
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
    ],
    channel_email: true,
    channel_whatsapp: false,
  },
  {
    template_key: "instructor_roster",
    name: "Instructor Roster (≈6h before)",
    template_type: "roster",
    subject: "Your roster for {{Class_Name}} — {{Class_Date}}",
    variables: [
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
    ],
    channel_email: true,
    channel_whatsapp: false,
  },
];

async function main() {
  for (const def of SYSTEM_TEMPLATES) {
    const body = readFileSync(join(TEMPLATES_DIR, `${def.template_key}.html`), "utf8");

    const existing = await prisma.crmTemplate.findUnique({
      where: { template_key: def.template_key },
    });

    if (existing) {
      // Preserve admin edits to message_body/subject; only refresh metadata.
      await prisma.crmTemplate.update({
        where: { template_key: def.template_key },
        data: {
          name: def.name,
          template_type: def.template_type,
          is_system: true,
          variables: def.variables,
          channel_email: def.channel_email,
          channel_whatsapp: def.channel_whatsapp,
        },
      });
      console.log(`Updated metadata: ${def.template_key} (body preserved)`);
    } else {
      await prisma.crmTemplate.create({
        data: {
          template_key: def.template_key,
          name: def.name,
          template_type: def.template_type,
          is_system: true,
          subject: def.subject,
          message_body: body,
          variables: def.variables,
          channel_email: def.channel_email,
          channel_whatsapp: def.channel_whatsapp,
        },
      });
      console.log(`Created: ${def.template_key}`);
    }
  }
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
