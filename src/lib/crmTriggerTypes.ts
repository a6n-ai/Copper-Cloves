/** System trigger_type values stored on `crm_triggers` and matched by the dispatcher. */
export const CrmTriggerType = {
  ClassBookingConfirmed: "class_booking_confirmed",
  ClassBookingCancelled: "class_booking_cancelled",
} as const;

export type CrmTriggerTypeId = (typeof CrmTriggerType)[keyof typeof CrmTriggerType];
