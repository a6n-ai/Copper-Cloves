# Payments

All online payments go through Razorpay in INR. Amounts are stored in **paise** (`Int`). Every payment, online or offline, lands in the unified `Payment` table.

## Online checkout (booking-first)

1. Member picks a class. The app creates the `Booking` up front with status `payment_pending`, holding the seat for 60 minutes.
2. `POST /api/payments/razorpay/create-order` creates the Razorpay order and a `RazorpayOrder` row linked to that booking.
3. Razorpay Checkout opens in the browser.
4. On success the client calls `POST /api/payments/razorpay/verify-payment`. The server checks the HMAC and writes `RazorpayPayment` + `Payment`.
5. `POST /api/payments/razorpay/finish-checkout` confirms the booking (or provisions the package), then sends the confirmation email.

Package purchases follow the same order/verify/finish path, ending in a `UserPackage`.

## Making sure paid means fulfilled

Members on phones often close the tab mid-payment, and webhooks can be missed. Several layers cover that, all idempotent:

| Layer | Trigger | Effect |
|---|---|---|
| Browser verify | Checkout success | Normal path |
| Webhook `/api/payments/razorpay/webhook` | Razorpay `payment.authorized` / `captured` / `failed` | Same persist + fulfil, out-of-order safe |
| `reconcile-razorpay` cron | Hourly | Asks Razorpay for payments on unfulfilled orders (last 72h), captures and fulfils; also heals paid orders whose booking is still pending |
| `lifecycle-bookings` cron | Every 15 min | ~30 min recovery email; at 60 min releases the seat, only after Razorpay confirms nothing was captured |
| Admin reconcile | Manual | Import missing payments, fulfil unfulfilled orders, look up by payment ID |

## Offline payments

For walk-ins, the admin opens a member's Manage dialog, configures the pass, then records the payment:

- `POST /api/admin/payments` writes a `Payment` with method `cash`, `pine_lab_card`, `pine_lab_upi` or `direct_upi`, amount in paise, optional `proof_url`, and `recorded_by`.
- `PATCH /api/admin/members` applies the pass.

These are two calls, not one transaction. If the second fails, the payment row stays.

## Coupons and offers

- `Coupon.applies_to`: `food`, `ecommerce`, `class_pass`, `studio_pass`. Some coupons can stack with offers.
- Packages can carry a time-bound `offer_price`, which is what checkout charges while the offer is active.
- Pass holders get a café discount applied automatically at checkout.

## Refunds and cancellations

Members see a cancellation preview before cancelling and can request a refund. Admins track refund status on the booking timeline. Drop-in passes refund as credit, not cash.

## Adding a payment method

Add a value to the `PaymentMethod` enum in `prisma/schema.prisma` and run `db:push`. No new table.
