/** System trigger_type values stored on `crm_triggers` and matched by the dispatcher. */
export const CrmTriggerType = {
  ClassBookingConfirmed: "class_booking_confirmed",
  ClassBookingCancelled: "class_booking_cancelled",
  AccountCreated: "account_created",
  IndividualClassPaid: "individual_class_paid",
  LateCancellation: "late_cancellation",
  /** Time-based: ~1h before class, to the member. Dispatched by the cron scheduler. */
  ClassReminder: "class_reminder",
  /** Time-based: ~6h before class, to the instructor (roster). Dispatched by the cron scheduler. */
  InstructorRoster: "instructor_roster",
} as const;

export type CrmTriggerTypeId = (typeof CrmTriggerType)[keyof typeof CrmTriggerType];
