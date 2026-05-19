import prisma from "../src/lib/prisma";
import { CrmTriggerType } from "../src/lib/crmTriggerTypes";

interface TriggerDef {
  name: string;
  template_key: string;
  trigger_type: string;
}

const TRIGGERS: TriggerDef[] = [
  {
    name: "System — Class Booking Confirmation",
    template_key: "booking_confirmation",
    trigger_type: CrmTriggerType.ClassBookingConfirmed,
  },
  {
    name: "System — Individual Class Purchase",
    template_key: "individual_class_booking",
    trigger_type: CrmTriggerType.IndividualClassPaid,
  },
  {
    name: "System — Account Ready Welcome",
    template_key: "account_ready",
    trigger_type: CrmTriggerType.AccountCreated,
  },
  {
    name: "System — Cancellation (credit returned)",
    template_key: "cancellation_credit_returned",
    trigger_type: CrmTriggerType.ClassBookingCancelled,
  },
  {
    name: "System — Cancellation (late, no credit)",
    template_key: "cancellation_no_credit",
    trigger_type: CrmTriggerType.LateCancellation,
  },
];

async function main() {
  for (const def of TRIGGERS) {
    const template = await prisma.crmTemplate.findUnique({
      where: { template_key: def.template_key },
    });
    if (!template) {
      console.warn(`Skipped ${def.name}: template ${def.template_key} not found. Run db:seed:crm-system first.`);
      continue;
    }

    const existing = await prisma.crmTrigger.findFirst({
      where: { template_id: template.id, trigger_type: def.trigger_type },
    });

    if (existing) {
      await prisma.crmTrigger.update({
        where: { id: existing.id },
        data: {
          name: def.name,
          channel_email: true,
          channel_whatsapp: false,
        },
      });
      console.log(`Updated trigger: ${def.name}`);
    } else {
      await prisma.crmTrigger.create({
        data: {
          name: def.name,
          template_id: template.id,
          trigger_type: def.trigger_type,
          is_active: true,
          channel_email: true,
          channel_whatsapp: false,
        },
      });
      console.log(`Created trigger: ${def.name}`);
    }
  }
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
