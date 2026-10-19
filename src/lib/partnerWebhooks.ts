import { createHmac, randomBytes, randomUUID } from "crypto";
import dns from "dns";
import https from "https";
import net from "net";
import prisma from "@/lib/prisma";
import logger from "@/lib/logger";

/** Event types a partner can subscribe to. Emitted by prisma/sql/partner-webhooks.sql. */
export const PARTNER_WEBHOOK_EVENTS = [
  "booking.created",
  "booking.pending_confirmation",
  "booking.confirmed",
  "booking.cancelled",
  "booking.checked_in",
  "booking.no_show",
] as const;

const TIMEOUT_MS = 5_000;
/** Wait after attempt N fails; after the last one the event is marked failed (~14.6h total). */
const RETRY_DELAYS_S = [60, 300, 1_800, 7_200, 43_200];
const BATCH = 100;
/** Per run: at most this many sends per partner, and stop starting new sends after the deadline.
 *  10 x 5s hard timeout = 50s per partner, well inside the 5-minute claim lease, so a run can
 *  never outlive its lease and let the next run re-send the same events. */
const PER_PARTNER = 10;
const RUN_DEADLINE_MS = 120_000;

export function generateWebhookSecret(): string {
  return "whsec_" + randomBytes(32).toString("base64url");
}

/** `X-CC-Signature: t=<unix seconds>,v1=<hex HMAC-SHA256 of "<t>.<raw body>">` */
export function signWebhook(secret: string, body: string, t = Math.floor(Date.now() / 1000)): string {
  const v1 = createHmac("sha256", secret).update(`${t}.${body}`).digest("hex");
  return `t=${t},v1=${v1}`;
}

// --- SSRF guard: a partner-supplied URL must never reach our own network. ---

const blocked = new net.BlockList();
for (const [ip, prefix] of [
  ["0.0.0.0", 8], ["10.0.0.0", 8], ["100.64.0.0", 10], ["127.0.0.0", 8], ["169.254.0.0", 16],
  ["172.16.0.0", 12], ["192.0.0.0", 24], ["192.168.0.0", 16], ["198.18.0.0", 15], ["224.0.0.0", 3],
] as const) blocked.addSubnet(ip, prefix, "ipv4");
for (const [ip, prefix] of [
  ["::", 128], ["::1", 128], ["64:ff9b::", 96], ["fc00::", 7], ["fe80::", 10], ["ff00::", 8],
] as const) blocked.addSubnet(ip, prefix, "ipv6");

export function isPublicAddress(ip: string): boolean {
  const mapped = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/i.exec(ip);
  if (mapped) return isPublicAddress(mapped[1]);
  const family = net.isIP(ip);
  if (family === 4) return !blocked.check(ip, "ipv4");
  if (family === 6) return !blocked.check(ip, "ipv6");
  return false;
}

/** Shape check only; the address check happens at connect time (see guardedLookup). */
export function webhookUrlProblem(raw: unknown): string | null {
  if (typeof raw !== "string" || raw.length > 2048) return "url must be a string under 2048 characters";
  let u: URL;
  try {
    u = new URL(raw);
  } catch {
    return "url is not a valid URL";
  }
  if (u.protocol !== "https:") return "url must use https";
  if (u.username || u.password) return "url must not contain credentials";
  const host = u.hostname.replace(/^\[|\]$/g, "");
  if (net.isIP(host) && !isPublicAddress(host)) return "url must point to a public address";
  if (host === "localhost" || host.endsWith(".localhost") || host.endsWith(".internal")) {
    return "url must point to a public address";
  }
  return null;
}

/** Resolve-then-verify inside the socket connect, so DNS rebinding cannot slip a private IP past validation. */
const guardedLookup: net.LookupFunction = (hostname, options, callback) => {
  dns.lookup(hostname, { all: true }, (err, addresses) => {
    if (err) return callback(err, "", 4);
    const list = addresses as dns.LookupAddress[];
    if (!list.length || list.some((a) => !isPublicAddress(a.address))) {
      return callback(new Error("webhook host resolves to a non-public address"), "", 4);
    }
    if ((options as dns.LookupOptions).all) {
      return (callback as unknown as (e: null, a: dns.LookupAddress[]) => void)(null, list);
    }
    callback(null, list[0].address, list[0].family);
  });
};

export interface DeliveryResult {
  ok: boolean;
  status: number | null;
  error: string | null;
  durationMs: number;
}

/** One POST. No redirects, 5s budget, response body discarded. */
export function postWebhook(url: string, secret: string, payload: { id: string; type: string }): Promise<DeliveryResult> {
  const started = Date.now();
  const problem = webhookUrlProblem(url);
  if (problem) return Promise.resolve({ ok: false, status: null, error: problem, durationMs: 0 });

  const body = JSON.stringify(payload);
  const u = new URL(url);
  const host = u.hostname.replace(/^\[|\]$/g, "");
  return new Promise((resolve) => {
    let settled = false;
    const done = (status: number | null, error: string | null) => {
      if (settled) return;
      settled = true;
      clearTimeout(hard);
      resolve({ ok: status !== null && status >= 200 && status < 300, status, error, durationMs: Date.now() - started });
    };

    const req = https.request(
      {
        method: "POST",
        hostname: host,
        port: u.port || 443,
        path: u.pathname + u.search,
        lookup: net.isIP(host) ? undefined : guardedLookup,
        timeout: TIMEOUT_MS,
        headers: {
          "Content-Type": "application/json",
          "Content-Length": Buffer.byteLength(body),
          "User-Agent": "CopperCloves-Webhooks/1",
          "X-CC-Event": payload.type,
          "X-CC-Delivery": payload.id,
          "X-CC-Signature": signWebhook(secret, body),
        },
      },
      (res) => {
        const status = res.statusCode ?? null;
        done(status, status !== null && status >= 200 && status < 300 ? null : `HTTP ${status}`);
        // Status is all we need; don't let a slow body keep the socket open.
        res.destroy();
      },
    );
    // `timeout` above only fires on an IDLE socket; a server trickling bytes defeats it.
    // This is the wall-clock cap.
    const hard = setTimeout(() => {
      req.destroy();
      done(null, `timed out after ${TIMEOUT_MS}ms`);
    }, TIMEOUT_MS);
    req.on("timeout", () => req.destroy(new Error(`timed out after ${TIMEOUT_MS}ms`)));
    req.on("error", (e) => done(null, e.message.slice(0, 300)));
    req.end(body);
  });
}

export function pingPayload() {
  return { id: randomUUID(), type: "ping", createdAt: new Date().toISOString(), data: {} };
}

// --- Outbox worker (cron) ---

interface ClaimedEvent {
  id: string;
  partner_id: string;
  type: string;
  booking_id: string | null;
  data: Record<string, unknown>;
  attempts: number;
  created_at: Date;
}

async function buildPayload(e: ClaimedEvent) {
  const booking = e.booking_id
    ? await prisma.booking.findUnique({
        where: { id: e.booking_id },
        select: {
          profile: { select: { full_name: true, email: true, phone: true } },
          class_schedule: {
            select: { id: true, start_time: true, end_time: true, class_model: { select: { name: true } } },
          },
        },
      })
    : null;
  const cs = booking?.class_schedule;
  return {
    id: e.id,
    type: e.type,
    createdAt: e.created_at.toISOString(),
    data: {
      // Snapshot at the moment of the change (from the trigger) + current member/class details.
      booking: {
        ...e.data,
        member: booking?.profile
          ? { name: booking.profile.full_name ?? null, email: booking.profile.email, phone: booking.profile.phone ?? null }
          : null,
      },
      class: cs
        ? { id: cs.id, name: cs.class_model?.name ?? null, startTime: cs.start_time.toISOString(), endTime: cs.end_time.toISOString() }
        : null,
    },
  };
}

export async function countDueWebhookEvents(): Promise<number> {
  return prisma.partnerWebhookEvent.count({
    where: { delivered_at: null, failed_at: null, next_attempt_at: { lte: new Date() } },
  });
}

/** Claim a batch (SKIP LOCKED + 5-minute lease so overlapping runs never double-send), deliver, record. */
export async function processDueWebhookEvents() {
  const claimed = await prisma.$queryRaw<ClaimedEvent[]>`
    UPDATE partner_webhook_events SET next_attempt_at = now() + interval '5 minutes'
    WHERE id IN (
      SELECT id FROM partner_webhook_events
      WHERE delivered_at IS NULL AND failed_at IS NULL AND next_attempt_at <= now()
      ORDER BY created_at
      LIMIT ${BATCH}
      FOR UPDATE SKIP LOCKED
    )
    RETURNING id, partner_id, type, booking_id, data, attempts, created_at`;

  const runStarted = Date.now();
  const hooks = await prisma.partnerWebhook.findMany({
    // A deactivated partner gets nothing, even for events queued before the switch-off.
    where: { partner_id: { in: [...new Set(claimed.map((e) => e.partner_id))] }, is_active: true, partner: { is_active: true } },
    select: { partner_id: true, url: true, secret: true, events: true },
  });
  const hookFor = new Map(hooks.map((h) => [h.partner_id, h]));

  const byPartner = new Map<string, ClaimedEvent[]>();
  for (const e of claimed.sort((a, b) => a.created_at.getTime() - b.created_at.getTime())) {
    byPartner.set(e.partner_id, [...(byPartner.get(e.partner_id) ?? []), e]);
  }

  let delivered = 0;
  let retrying = 0;
  let failed = 0;
  const released: string[] = [];
  // Partners in parallel; each partner's events in order.
  await Promise.all(
    [...byPartner.entries()].map(async ([partnerId, all]) => {
      const hook = hookFor.get(partnerId);
      released.push(...all.slice(PER_PARTNER).map((e) => e.id));
      const events = all.slice(0, PER_PARTNER);
      for (const [i, e] of events.entries()) {
        if (Date.now() - runStarted > RUN_DEADLINE_MS) {
          released.push(...events.slice(i).map((x) => x.id));
          break;
        }
        if (!hook || !hook.events.includes(e.type)) {
          await prisma.partnerWebhookEvent.update({
            where: { id: e.id },
            data: { failed_at: new Date(), last_error: "webhook removed or unsubscribed" },
          });
          failed++;
          continue;
        }
        const r = await postWebhook(hook.url, hook.secret, await buildPayload(e));
        const attempts = e.attempts + 1;
        if (r.ok) {
          delivered++;
          await prisma.partnerWebhookEvent.update({
            where: { id: e.id },
            data: { attempts, delivered_at: new Date(), last_status: r.status, last_error: null },
          });
        } else {
          const delay = RETRY_DELAYS_S[attempts - 1];
          if (delay === undefined) failed++;
          else retrying++;
          await prisma.partnerWebhookEvent.update({
            where: { id: e.id },
            data: {
              attempts,
              last_status: r.status,
              last_error: r.error,
              ...(delay === undefined
                ? { failed_at: new Date() }
                : { next_attempt_at: new Date(Date.now() + delay * 1000) }),
            },
          });
          logger.warn({ eventId: e.id, partnerId, attempts, status: r.status, error: r.error }, "[partner-webhook] delivery failed");
        }
      }
    }),
  );

  // Unsent claims go straight back to the queue instead of waiting out the lease.
  if (released.length) {
    await prisma.partnerWebhookEvent.updateMany({ where: { id: { in: released } }, data: { next_attempt_at: new Date() } });
  }

  return { claimed: claimed.length, delivered, retrying, failed, deferred: released.length };
}
