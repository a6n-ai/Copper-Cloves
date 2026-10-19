-- Partner webhook outbox trigger. `prisma db push` does not manage triggers, so
-- scripts/ci-db-push.mjs applies this file after every push. Idempotent.
--
-- Writes one partner_webhook_events row per event, in the SAME transaction as the
-- booking change, for every code path that touches class_bookings (portal, Razorpay,
-- admin, instructor, cron, scripts). Only for classes owned by a partner whose
-- active webhook subscribes to that event type.
--
-- Event rules:
--   booking.created              row inserted
--   booking.pending_confirmation confirmation_status becomes 'pending'
--   booking.confirmed            row enters (status = 'confirmed' AND confirmation_status <> 'pending'),
--                                i.e. paid AND not awaiting the partner
--   booking.cancelled            status becomes 'cancelled' or 'expired' (unpaid hold released)
--   booking.checked_in           checked_in false -> true
--   booking.no_show              check_in_outcome becomes 'no_show'

CREATE OR REPLACE FUNCTION cc_enqueue_partner_webhook() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE
  pid    text;
  types  text[] := '{}';
  is_ok  boolean;
  was_ok boolean := false;
BEGIN
  IF NEW.class_schedule_id IS NULL THEN RETURN NULL; END IF;

  SELECT ct.partner_id INTO pid
  FROM class_schedules cs JOIN class_types ct ON ct.id = cs.class_id
  WHERE cs.id = NEW.class_schedule_id;
  IF pid IS NULL THEN RETURN NULL; END IF;

  is_ok := NEW.status = 'confirmed' AND NEW.confirmation_status IS DISTINCT FROM 'pending';

  IF TG_OP = 'INSERT' THEN
    types := types || 'booking.created'::text;
    IF NEW.confirmation_status = 'pending' THEN types := types || 'booking.pending_confirmation'::text; END IF;
  ELSE
    was_ok := OLD.status = 'confirmed' AND OLD.confirmation_status IS DISTINCT FROM 'pending';
    IF NEW.confirmation_status = 'pending' AND OLD.confirmation_status IS DISTINCT FROM 'pending' THEN
      types := types || 'booking.pending_confirmation'::text;
    END IF;
    IF NEW.status IN ('cancelled', 'expired') AND OLD.status IS DISTINCT FROM NEW.status THEN
      types := types || 'booking.cancelled'::text;
    END IF;
    IF NEW.checked_in AND NOT COALESCE(OLD.checked_in, false) THEN
      types := types || 'booking.checked_in'::text;
    END IF;
    IF NEW.check_in_outcome = 'no_show' AND OLD.check_in_outcome IS DISTINCT FROM 'no_show' THEN
      types := types || 'booking.no_show'::text;
    END IF;
  END IF;
  IF is_ok AND NOT was_ok THEN types := types || 'booking.confirmed'::text; END IF;

  IF cardinality(types) = 0 THEN RETURN NULL; END IF;

  INSERT INTO partner_webhook_events (id, partner_id, type, booking_id, data, created_at, next_attempt_at)
  SELECT gen_random_uuid()::text, pid, t, NEW.id,
         jsonb_build_object(
           'bookingId', NEW.id,
           'classScheduleId', NEW.class_schedule_id,
           'userId', NEW.user_id,
           'status', NEW.status,
           'confirmationStatus', NEW.confirmation_status,
           'checkedIn', NEW.checked_in,
           'checkInOutcome', NEW.check_in_outcome,
           'extraGuests', COALESCE(NEW.extra_guest_count, 0)
         ),
         now(), now()
  FROM unnest(types) AS t
  WHERE EXISTS (
    SELECT 1 FROM partner_webhooks w JOIN partners p ON p.id = w.partner_id
    WHERE w.partner_id = pid AND w.is_active AND p.is_active AND t = ANY (w.events)
  );
  RETURN NULL;
EXCEPTION WHEN OTHERS THEN
  -- A webhook problem must never block or roll back a booking.
  RAISE WARNING 'cc_enqueue_partner_webhook failed for booking %: %', NEW.id, SQLERRM;
  RETURN NULL;
END;
$$;

CREATE OR REPLACE TRIGGER cc_partner_webhook
AFTER INSERT OR UPDATE OF status, confirmation_status, checked_in, check_in_outcome
ON class_bookings
FOR EACH ROW EXECUTE FUNCTION cc_enqueue_partner_webhook();
