import prisma from "@/lib/prisma";

const TZ = "Asia/Kolkata";

export function formatRupeesFromPaise(paise: number): string {
  return `₹${Math.round((paise ?? 0) / 100).toLocaleString("en-IN")}`;
}

export function studioLinks(base?: string): Record<string, string> {
  const b = (base ?? process.env.BETTER_AUTH_URL ?? process.env.NEXT_PUBLIC_SITE_URL ?? "").replace(/\/$/, "");
  return { Studio_Link: b, Portal_Link: b ? `${b}/portal/dashboard` : "/portal/dashboard" };
}

export function baseVars(profile: { full_name?: string | null; email: string }): Record<string, string> {
  return {
    Member_Name: profile.full_name?.trim() || profile.email.split("@")[0] || "Member",
    ...studioLinks(),
  };
}

export async function buildBookingVars(bookingId: string): Promise<Record<string, string>> {
  const b = await prisma.booking.findUnique({
    where: { id: bookingId },
    include: {
      class_schedule: { include: { class_model: true, instructor: true } },
      user_package: { select: { package_type: { select: { is_unlimited: true } } } },
    },
  });
  if (!b) {
    return {
      Class_Name: "Class",
      Instructor_Name: "",
      Class_Date: "",
      Class_Time: "",
      Start_Time: "",
      End_Time: "",
      Refund_Detail: "",
    };
  }
  const sch = b.class_schedule;
  const className = b.class_name?.trim() || sch?.class_model?.name?.trim() || "Class";
  const start = sch ? sch.start_time.toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short", timeZone: TZ }) : "";
  const end = sch ? sch.end_time.toLocaleTimeString("en-IN", { timeStyle: "short", timeZone: TZ }) : "";
  const classDate = (sch ? sch.start_time : b.booking_date).toLocaleString("en-IN", { dateStyle: "full", timeZone: TZ });

  // Human-readable refund outcome for THIS seat — mirrors buildBookingCrmVariables.
  let refundDetail: string;
  switch (b.refund_status) {
    case "auto_pass":
    case "approved_pass":
      refundDetail = "A 1 Class Pass refund has been added to your account.";
      break;
    case "approved_amount":
      refundDetail = `A refund of ${formatRupeesFromPaise(b.refund_amount_paise ?? 0)} has been approved.`;
      break;
    case "requested":
      refundDetail = "Your refund request is under review by the studio.";
      break;
    case "denied":
      refundDetail = "No refund was issued for this cancellation.";
      break;
    default: {
      const unlimited = b.user_package?.package_type?.is_unlimited ?? false;
      refundDetail = unlimited
        ? "No refund is due — your unlimited pass was not charged for this class."
        : b.user_package_id && !b.checked_in
          ? "A 1 Class Pass refund has been added to your account."
          : "No refund is due for this booking.";
    }
  }

  return {
    Class_Name: className,
    Instructor_Name: sch?.instructor?.name?.trim() || "",
    Class_Date: classDate,
    Class_Time: start && end ? `${start} – ${end}` : start,
    Start_Time: start,
    End_Time: end,
    Refund_Detail: refundDetail,
  };
}
