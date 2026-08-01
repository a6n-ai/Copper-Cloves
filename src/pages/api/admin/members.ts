import type { NextApiRequest, NextApiResponse } from "next";
import crypto from "crypto";
import bcrypt from "bcryptjs";
import prisma from "@/lib/prisma";
import { isStudioAdminProfileRole } from "@/lib/isStudioAdminProfile";
import { getStudioServerSession } from "@/lib/getStudioServerSession";
import { getDynamicStats, getDynamicStatsForUsers } from "@/lib/attendanceStats";
import { logActivity } from "@/lib/activityLog";
import { HISTORY_STATUSES } from "@/lib/bookingStatus";
import { getStudioSettings } from "@/lib/studioSettings";
import { validateCreditAdjust } from "@/lib/passAdjust";
import { moneyRefundStatusByBooking } from "@/lib/reconcileStatus";
import { recordManualPayment, RECORDABLE_METHODS } from "@/lib/payments";
import { normalizeLoginEmail } from "@/lib/loginEmail";
import { passCategoryForPackageType } from "@/lib/couponHelpers";
import { sendHtmlEmail } from "@/lib/notifications/sendEmail";
import { welcomeSetPasswordEmail } from "@/lib/notifications/emailTemplates";
import logger from "@/lib/logger";

const WELCOME_TOKEN_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days
const DEFAULT_PAGE_SIZE = 10;

// Member Management lists real members only — never staff/partner/instructor logins.
function isNonMemberRole(role?: string | null): boolean {
  const r = String(role ?? "").trim().toLowerCase();
  return isStudioAdminProfileRole(role) || r === "partner" || r === "instructor";
}

// Lean field set for the list — no hashedPassword/questionnaire/dob/gender, only
// what the table + filters/sort need. Detail uses memberDetailInclude separately.
const memberListSelect = {
  id: true,
  full_name: true,
  email: true,
  phone: true,
  avatar_url: true,
  role: true,
  start_date: true,
  user_packages: {
    select: {
      id: true,
      is_active: true,
      expiration_date: true,
      credits_remaining: true,
      package_type: { select: { id: true, name: true, type: true, is_unlimited: true } },
    },
    orderBy: { purchase_date: "desc" as const },
    take: 8,
  },
} as const;

// --- list row shape + server-side derivation (mirrors the old client mapping so
// filter/sort/pagination can run in SQL-adjacent server code instead of the browser) ---
type MemberRow = {
  id: string;
  userPackageId: string | null;
  name: string;
  email: string;
  phone: string;
  avatarUrl: string | null;
  package: string;
  credits: number;
  unlimited: boolean;
  expiryDate: string;
  totalClasses: number;
  lastVisit: string;
  lastVisitTs: number | null;
  status: "active" | "expiring" | "expired";
  passCategory: "studio_pass" | "class_pass" | "none";
  accountFilter: "active" | "inactive" | "grace";
  startDate: string | null;
};

function formatRelativeDay(date: Date | null, now: number): string {
  if (!date) return "—";
  const t = date.getTime();
  if (Number.isNaN(t)) return "—";
  const diff = (now - t) / 86_400_000;
  if (diff >= 0 && diff < 1) return "Today";
  if (diff >= 1 && diff < 2) return "Yesterday";
  if (diff < 0) return "Soon";
  return `${Math.floor(diff)} days ago`;
}

function deriveMemberStatus(expiry: Date, credits: number, unlimited: boolean, now: number): MemberRow["status"] {
  if (expiry.getTime() < now) return "expired";
  const days = (expiry.getTime() - now) / 86_400_000;
  if (days <= 14 || (!unlimited && credits <= 2)) return "expiring";
  return "active";
}

const STATUS_RANK = { active: 0, expiring: 1, expired: 2 } as const;
const PASS_RANK = { studio_pass: 0, class_pass: 1, none: 2 } as const;
const ACCOUNT_RANK = { active: 0, grace: 1, inactive: 2 } as const;

const memberDetailInclude = {
  user_badges: { orderBy: { earned_at: "desc" as const }, take: 50 },
  bookings: {
    // Class history shows every booked class regardless of payment — confirmed,
    // unpaid holds (payment_pending), expired, cancelled. Payment is a pill in the
    // UI, not a visibility gate. Fixes members with captured payments but an empty
    // class-history list (paid-but-unconfirmed bookings).
    where: { status: { in: [...HISTORY_STATUSES] as string[] } },
    orderBy: { booking_date: "desc" as const },
    take: 100,
    include: {
      class_schedule: { include: { class_model: true } },
    },
  },
  user_packages: {
    include: { package_type: true },
    orderBy: { purchase_date: "desc" as const },
    take: 50,
  },
  cafe_orders: {
    include: { cafe_item: true },
    orderBy: { order_date: "desc" as const },
    take: 50,
  },
  payments: {
    orderBy: { created_at: "desc" as const },
    take: 100,
    include: {
      recorded_by_admin: { select: { full_name: true, email: true } },
    },
  },
  member_tickets: {
    orderBy: { created_at: "desc" as const },
    take: 50,
  },
} as const;

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getStudioServerSession(req, res);
  if (!session?.user) return res.status(401).json({ error: "Unauthorized" });
  const role = (session.user as { role?: string }).role;
  if (role !== "admin") return res.status(403).json({ error: "Forbidden" });

  if (req.method === "GET") {
    const id = typeof req.query.id === "string" ? req.query.id.trim() : "";
    if (id) {
      const profile = await prisma.profile.findFirst({
        where: { id },
        omit: { hashedPassword: true, questionnaire: true },
        include: memberDetailInclude,
      });
      if (!profile || isNonMemberRole(profile.role)) {
        return res.status(404).json({ error: "Member not found" });
      }
      const stats = await getDynamicStats(profile.id);
      // Payments aren't nested per-booking in this include, so match by booking_id
      // to flag which class-history rows have a completed payment behind them.
      const paidBookingIds = new Set(
        (profile.payments ?? [])
          .filter((p) => p.status === "succeeded" && p.direction === "credit" && p.booking_id)
          .map((p) => p.booking_id as string),
      );
      // Money-refund state (drop-in cancels get cash back, not a credit) — keyed
      // on the gateway payment, so it can't be derived from the booking row alone.
      const moneyRefundByBooking = await moneyRefundStatusByBooking(profile.bookings.map((b) => b.id));
      const bookingsWithInvoice = profile.bookings.map((b) => ({
        ...b,
        invoiceAvailable: paidBookingIds.has(b.id),
        paid: paidBookingIds.has(b.id),
        moneyRefundStatus: moneyRefundByBooking.get(b.id) ?? null,
      }));
      return res.json({ ...profile, bookings: bookingsWithInvoice, user_stats: stats });
    }

    const monthStart = new Date();
    monthStart.setDate(1);
    monthStart.setHours(0, 0, 0, 0);

    // Server-side search / filter / sort / pagination params.
    const qp = req.query;
    const str = (v: unknown) => (typeof v === "string" ? v.trim() : "");
    const search = str(qp.search).toLowerCase();
    const pkg = str(qp.pkg) || "all"; // all | studio | class | none
    const account = str(qp.account) || "all"; // all | active | inactive
    const sort = str(qp.sort); // "" | name | pass | account | classes | lastVisit | status
    const dir = str(qp.dir) === "asc" ? 1 : -1;
    const page = Math.max(1, parseInt(str(qp.page) || "1", 10) || 1);
    const pageSize = Math.min(100, Math.max(1, parseInt(str(qp.pageSize) || String(DEFAULT_PAGE_SIZE), 10) || DEFAULT_PAGE_SIZE));

    // The month check-in count is independent of the member list, so fetch
    // both in one round trip instead of as a trailing serial query.
    const [rows, checkInsThisMonth] = await Promise.all([
      prisma.profile.findMany({
        select: memberListSelect,
        orderBy: { created_at: "desc" },
      }),
      prisma.booking.count({
        where: { checked_in: true, check_in_time: { gte: monthStart } },
      }),
    ]);
    // Exclude staff/partner/instructor logins — only real members.
    const memberProfiles = rows.filter((p) => !isNonMemberRole(p.role));
    const statsByUser = await getDynamicStatsForUsers(memberProfiles.map((m) => m.id));

    const now = Date.now();
    const fourteenAgo = now - 14 * 86_400_000;
    // Derive the same row shape the client used to build, but server-side so we can
    // filter/sort/paginate over the full population before slicing one page.
    const enriched: MemberRow[] = memberProfiles.map((p) => {
      const pkgs = p.user_packages ?? [];
      const activePkg = pkgs.find((up) => up.is_active && new Date(up.expiration_date).getTime() > now);
      const lastPkg = pkgs[0];
      const current = activePkg ?? lastPkg;
      const expiryRaw = current?.expiration_date ? new Date(current.expiration_date) : new Date();

      const holdingPackage = Boolean(activePkg);
      const lastExp = lastPkg ? new Date(lastPkg.expiration_date).getTime() : null;
      let accountFilter: MemberRow["accountFilter"] = "grace";
      if (holdingPackage) accountFilter = "active";
      else if (!lastExp || lastExp < fourteenAgo) accountFilter = "inactive";

      let passCategory: MemberRow["passCategory"] = "none";
      if (current?.package_type) passCategory = passCategoryForPackageType(current.package_type);

      const unlimited = Boolean(current?.package_type?.is_unlimited || passCategory === "studio_pass");
      const credits = current?.credits_remaining ?? 0;
      const stats = statsByUser.get(p.id) ?? null;
      const lastClass = stats?.last_class_date ? new Date(stats.last_class_date) : null;

      return {
        id: p.id,
        userPackageId: activePkg?.id ?? lastPkg?.id ?? null,
        name: p.full_name || p.email || "Member",
        email: p.email,
        phone: p.phone || "—",
        avatarUrl: p.avatar_url ?? null,
        package: activePkg?.package_type?.name ?? lastPkg?.package_type?.name ?? "No active package",
        credits,
        unlimited,
        expiryDate: expiryRaw.toISOString().slice(0, 10),
        totalClasses: stats?.total_classes_attended ?? 0,
        lastVisit: formatRelativeDay(lastClass, now),
        lastVisitTs: lastClass ? lastClass.getTime() : null,
        status: deriveMemberStatus(expiryRaw, credits, unlimited, now),
        passCategory,
        accountFilter,
        startDate: p.start_date ? new Date(p.start_date).toISOString().slice(0, 10) : null,
      };
    });

    // Stat cards count the full population, not the current filter.
    const counts = {
      totalMembers: enriched.length,
      activeMembers: enriched.filter((m) => m.accountFilter === "active").length,
      expiringMembers: enriched.filter((m) => m.status === "expiring").length,
      inactiveLong: enriched.filter((m) => m.accountFilter === "inactive").length,
      studioPass: enriched.filter((m) => m.passCategory === "studio_pass").length,
      classPass: enriched.filter((m) => m.passCategory === "class_pass").length,
    };

    let filtered = enriched.filter((m) => {
      if (
        search &&
        !m.name.toLowerCase().includes(search) &&
        !m.email.toLowerCase().includes(search) &&
        !m.phone.toLowerCase().includes(search)
      )
        return false;
      if (pkg === "studio" && m.passCategory !== "studio_pass") return false;
      if (pkg === "class" && m.passCategory !== "class_pass") return false;
      if (pkg === "none" && m.passCategory !== "none") return false;
      if (account === "active" && m.accountFilter !== "active") return false;
      if (account === "inactive" && m.accountFilter !== "inactive") return false;
      return true;
    });

    if (sort) {
      filtered = [...filtered].sort((a, b) => {
        let cmp = 0;
        switch (sort) {
          case "name": cmp = a.name.localeCompare(b.name); break;
          case "pass": cmp = PASS_RANK[a.passCategory] - PASS_RANK[b.passCategory]; break;
          case "account": cmp = ACCOUNT_RANK[a.accountFilter] - ACCOUNT_RANK[b.accountFilter]; break;
          case "classes": cmp = a.totalClasses - b.totalClasses; break;
          case "lastVisit": cmp = (a.lastVisitTs ?? -Infinity) - (b.lastVisitTs ?? -Infinity); break;
          case "status": cmp = STATUS_RANK[a.status] - STATUS_RANK[b.status]; break;
        }
        return cmp * dir;
      });
    }

    const total = filtered.length;
    const start = (page - 1) * pageSize;
    const pageItems = filtered.slice(start, start + pageSize);

    return res.json({ members: pageItems, total, counts, checkInsThisMonth, page, pageSize });
  }

  // Create a real member (role "user"): random password + welcome email carrying
  // a set-password link (reuses the password-reset token mechanism). Powers the
  // walk-in registration wizard's "create new member" step.
  if (req.method === "POST") {
    const body = req.body ?? {};
    const email = typeof body.email === "string" ? normalizeLoginEmail(body.email) : "";
    const full_name = typeof body.full_name === "string" ? body.full_name.trim() : "";
    const phone = body.phone == null || body.phone === "" ? null : String(body.phone).trim() || null;

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({ error: "Valid email is required." });
    }
    if (!full_name) return res.status(400).json({ error: "Name is required." });

    const existing = await prisma.profile.findFirst({ where: { email, role: "user" } });
    if (existing) return res.status(409).json({ error: "A member with this email already exists." });

    // Member never knows this password — they set their own via the welcome link.
    const randomPassword = crypto.randomBytes(24).toString("hex");
    const hashedPassword = await bcrypt.hash(randomPassword, 12);
    const token = crypto.randomBytes(32).toString("hex");

    // Profile + welcome token land together or neither does — no orphan account
    // with no way to set a password.
    let created;
    try {
      created = await prisma.$transaction(async (tx) => {
        const profile = await tx.profile.create({
          data: { email, full_name, phone, hashedPassword, role: "user" },
        });
        await tx.passwordResetToken.create({
          data: { email, role: "user", token, expires_at: new Date(Date.now() + WELCOME_TOKEN_TTL_MS) },
        });
        return profile;
      });
    } catch (e) {
      // Lost the read-then-write race against @@unique([email, role]).
      if ((e as { code?: string }).code === "P2002") {
        return res.status(409).json({ error: "A member with this email already exists." });
      }
      logger.error({ err: e }, "[admin/members POST] member create failed");
      return res.status(500).json({ error: "Could not create member." });
    }

    logActivity({
      req,
      action: "auth.signup",
      actor: { id: created.id, role: created.role, name: created.full_name },
    }).catch((err) => logger.error({ err }, "[admin/members POST] activity log threw"));

    // Security-sensitive set-password link must come from a trusted origin only —
    // never the client-controlled Host header. If NEXTAUTH_URL is unset, the
    // account still exists; we just skip the welcome email.
    const baseUrl = (process.env.NEXTAUTH_URL ?? "").replace(/\/$/, "");
    if (!baseUrl) {
      logger.warn("[admin/members POST] NEXTAUTH_URL unset — welcome email skipped (no set-password link sent)");
    } else {
      const setPasswordUrl = `${baseUrl}/portal/reset-password?token=${token}`;
      sendHtmlEmail({
        to: email,
        subject: "welcome to The Studio by Copper + Cloves — set your password",
        html: welcomeSetPasswordEmail({ memberName: full_name, setPasswordUrl, portalUrl: baseUrl }),
      })
        .then((result) => {
          if (!result.ok) logger.error({ result }, "[admin/members POST] welcome email failed");
        })
        .catch((err) => logger.error({ err }, "[admin/members POST] welcome email threw"));
    }

    return res.status(201).json({ id: created.id, email: created.email, full_name: created.full_name });
  }

  if (req.method === "PATCH") {
    const { profile_id, user_package_id, package_type_id, class_count, expiration_date, pass_type, start_date, action, profile_fields, is_comp, grant_note, force_new_package } = req.body ?? {};
    if (!profile_id || typeof profile_id !== "string") {
      return res.status(400).json({ error: "profile_id required" });
    }

    const compGrant = is_comp === true;
    // Assigning a NEW paid pass must never reuse/overwrite an existing active
    // package — force the auto-create path so a brand-new UserPackage is created.
    const forceNewPackage = force_new_package === true;
    const grantNote = typeof grant_note === "string" && grant_note.trim() ? grant_note.trim() : null;
    const hasClassCount = typeof class_count === "number" && class_count > 0;
    const chosenPackageTypeId = typeof package_type_id === "string" && package_type_id ? package_type_id : null;

    const profile = await prisma.profile.findFirst({
      where: { id: profile_id },
    });
    if (!profile || isNonMemberRole(profile.role)) {
      return res.status(404).json({ error: "Member not found" });
    }

    // A studio (unlimited) pass already covers unlimited classes — block adding a
    // class pass on top of an active, unexpired studio pass.
    if (pass_type === "class_pass") {
      const activeStudio = await prisma.userPackage.findFirst({
        where: {
          user_id: profile_id,
          is_active: true,
          expiration_date: { gt: new Date() },
          OR: [{ pass_type: "studio_pass" }, { package_type: { is_unlimited: true } }],
        },
      });
      if (activeStudio) {
        return res.status(409).json({
          error: "Member has an active studio (unlimited) pass — a class pass can't be added until it expires.",
        });
      }
    }

    let pkgId: string | undefined = typeof user_package_id === "string" ? user_package_id : undefined;
    let createdUserPackageId: string | null = null;
    // A comp grant (and an explicit force_new_package assign) always creates a
    // fresh UserPackage — never reuse an existing pass row, so its credits/origin
    // are left intact.
    if (!pkgId && !compGrant && !forceNewPackage) {
      const latest = await prisma.userPackage.findFirst({
        where: { user_id: profile_id, is_active: true },
        orderBy: { purchase_date: "desc" },
      });
      pkgId = latest?.id;
    }

    // Pause / resume a pass. Resuming extends the expiry by the days it was paused.
    if (action === "pause" || action === "resume") {
      if (!pkgId) return res.status(400).json({ error: "No package to pause/resume" });
      const pkg = await prisma.userPackage.findUnique({ where: { id: pkgId } });
      if (!pkg || pkg.user_id !== profile_id) return res.status(400).json({ error: "Invalid package" });

      if (action === "pause") {
        if (!pkg.is_paused) {
          await prisma.userPackage.update({
            where: { id: pkgId },
            data: { is_paused: true, pause_start_date: new Date(), pause_end_date: null },
          });
        }
        return res.json({ ok: true, paused: true });
      }
      // resume
      if (pkg.is_paused) {
        const start = pkg.pause_start_date ?? new Date();
        const daysPaused = Math.max(0, Math.ceil((Date.now() - new Date(start).getTime()) / 86_400_000));
        const newExpiry = new Date(pkg.expiration_date);
        newExpiry.setDate(newExpiry.getDate() + daysPaused);
        await prisma.userPackage.update({
          where: { id: pkgId },
          data: { is_paused: false, pause_start_date: null, pause_end_date: new Date(), expiration_date: newExpiry },
        });
        return res.json({ ok: true, paused: false, daysPaused });
      }
      return res.json({ ok: true, paused: false, daysPaused: 0 });
    }

    // Adjust/remove/upgrade an existing pass — all three require an admin-entered
    // reason for the audit trail.
    const ADJUST_ACTIONS = ["adjust_credits", "remove_pass", "upgrade_pass"];
    if (ADJUST_ACTIONS.includes(action)) {
      const reasonRaw = typeof req.body?.reason === "string" ? req.body.reason.trim() : "";
      if (!reasonRaw) return res.status(400).json({ error: "Reason required" });

      if (action === "adjust_credits") {
        const upkgId = typeof user_package_id === "string" ? user_package_id : "";
        if (!upkgId) return res.status(400).json({ error: "user_package_id required" });
        const pkg = await prisma.userPackage.findUnique({ where: { id: upkgId } });
        if (!pkg || pkg.user_id !== profile_id) return res.status(400).json({ error: "Invalid package" });

        const credits = Number(req.body?.credits);
        const check = validateCreditAdjust({ credits, isUnlimited: pkg.credits_remaining === null });
        // strictNullChecks is off, which breaks discriminated-union narrowing on `ok`
        // (see .llm/known-issues.md #6) — assert the error-branch shape explicitly.
        if (!check.ok) return res.status(400).json({ error: (check as { ok: false; error: string }).error });

        const before = pkg.credits_remaining;
        await prisma.userPackage.update({ where: { id: upkgId }, data: { credits_remaining: credits } });
        await logActivity({
          req,
          action: "admin.pass_credits_adjusted",
          targetProfileId: profile_id,
          entity: { type: "user_package", id: upkgId },
          metadata: { from: before, to: credits, reason: reasonRaw },
        });
        return res.status(200).json({ ok: true });
      }

      if (action === "remove_pass") {
        const upkgId = typeof user_package_id === "string" ? user_package_id : "";
        if (!upkgId) return res.status(400).json({ error: "user_package_id required" });
        const pkg = await prisma.userPackage.findUnique({ where: { id: upkgId } });
        if (!pkg || pkg.user_id !== profile_id) return res.status(400).json({ error: "Invalid package" });

        const refundKind = req.body?.refund_kind;
        if (!["none", "comp", "money"].includes(refundKind)) {
          return res.status(400).json({ error: "Invalid refund_kind" });
        }
        const refund = (req.body?.refund ?? {}) as { classes?: number; amount_paise?: number; method?: string; proof_url?: string };

        if (refundKind === "comp") {
          const classes = Number(refund.classes);
          if (!Number.isInteger(classes) || classes <= 0) {
            return res.status(400).json({ error: "Enter a valid number of comp classes" });
          }
        }
        if (refundKind === "money") {
          const amt = Number(refund.amount_paise);
          if (!Number.isInteger(amt) || amt < 0) {
            return res.status(400).json({ error: "Enter a valid refund amount" });
          }
          if (!refund.method || !RECORDABLE_METHODS.includes(refund.method as (typeof RECORDABLE_METHODS)[number])) {
            return res.status(400).json({ error: "Select a refund method" });
          }
        }

        await prisma.$transaction(async (tx) => {
          await tx.userPackage.update({
            where: { id: upkgId },
            data: { is_active: false, credits_remaining: 0 },
          });
          if (refundKind === "comp") {
            const settings = await getStudioSettings();
            const expiry = new Date();
            expiry.setDate(expiry.getDate() + settings.default_package_validity_days);
            await tx.userPackage.create({
              data: {
                user_id: profile_id,
                package_type_id: pkg.package_type_id,
                credits_remaining: Number(refund.classes),
                credits_total: Number(refund.classes),
                expiration_date: pkg.expiration_date ?? expiry,
                is_active: true,
                is_comp: true,
                grant_note: reasonRaw,
                origin: "cancellation",
              },
            });
          }
        });

        await logActivity({
          req,
          action: "admin.pass_removed",
          targetProfileId: profile_id,
          entity: { type: "user_package", id: upkgId },
          metadata: {
            reason: reasonRaw,
            refund_kind: refundKind,
            ...(refundKind === "comp" ? { comp_classes: Number(refund.classes) } : {}),
            ...(refundKind === "money"
              ? { refund_amount_paise: Math.round(Number(refund.amount_paise)), refund_method: refund.method, proof_url: refund.proof_url ?? null }
              : {}),
          },
        });
        return res.status(200).json({ ok: true });
      }

      if (action === "upgrade_pass") {
        const upkgId = typeof user_package_id === "string" ? user_package_id : "";
        const targetTypeId = typeof req.body?.target_package_type_id === "string" ? req.body.target_package_type_id : "";
        if (!upkgId || !targetTypeId) return res.status(400).json({ error: "user_package_id and target_package_type_id required" });

        const oldPkg = await prisma.userPackage.findUnique({ where: { id: upkgId } });
        if (!oldPkg || oldPkg.user_id !== profile_id) return res.status(400).json({ error: "Invalid package" });
        const targetType = await prisma.packageType.findUnique({ where: { id: targetTypeId } });
        if (!targetType) return res.status(400).json({ error: "Target package not found" });

        const amountPaise = Number(req.body?.amount_paise);
        if (!Number.isInteger(amountPaise) || amountPaise < 0) {
          return res.status(400).json({ error: "Enter a valid amount" });
        }
        const method = req.body?.method;
        if (!method || !RECORDABLE_METHODS.includes(method)) {
          return res.status(400).json({ error: "Select a payment method" });
        }
        const proofUrl = typeof req.body?.proof_url === "string" ? req.body.proof_url : null;

        let expiryForCreate: Date;
        if (targetType.duration_months && targetType.duration_months > 0) {
          expiryForCreate = new Date();
          expiryForCreate.setMonth(expiryForCreate.getMonth() + targetType.duration_months);
        } else {
          const settings = await getStudioSettings();
          expiryForCreate = new Date();
          expiryForCreate.setDate(expiryForCreate.getDate() + settings.default_package_validity_days);
        }

        let newPkgId: string;
        try {
          newPkgId = await prisma.$transaction(async (tx) => {
            // Re-check inside the transaction so a retried/duplicate submit aborts
            // cleanly instead of creating a second upgraded pass + payment — the
            // first successful attempt already flipped is_active false, and
            // recordManualPayment's idempotency guard can't catch this because the
            // new pass gets a fresh id every attempt.
            const fresh = await tx.userPackage.findUnique({ where: { id: upkgId } });
            if (!fresh || !fresh.is_active) {
              throw new Error("This pass has already been upgraded or is no longer active");
            }
            await tx.userPackage.update({ where: { id: upkgId }, data: { is_active: false } });
            const created = await tx.userPackage.create({
              data: {
                user_id: profile_id,
                package_type_id: targetType.id,
                credits_remaining: targetType.class_count,
                credits_total: targetType.class_count,
                expiration_date: expiryForCreate,
                is_active: true,
                origin: "admin",
                grant_note: reasonRaw,
              },
            });
            if (amountPaise > 0) {
              const result = await recordManualPayment(
                {
                  user_id: profile_id,
                  user_package_id: created.id,
                  method,
                  amount_paise: Math.round(amountPaise),
                  proof_url: proofUrl,
                  notes: "pass upgrade",
                  recorded_by: (session.user as { id?: string }).id ?? null,
                },
                tx,
              );
              if (!result.ok) throw new Error(result.error ?? "Could not record payment");
            }
            return created.id;
          });
        } catch (e) {
          logger.error({ err: e }, "[admin/members PATCH] upgrade_pass transaction failed");
          return res.status(409).json({ error: e instanceof Error ? e.message : "Could not upgrade pass" });
        }

        await logActivity({
          req,
          action: "admin.pass_upgraded",
          targetProfileId: profile_id,
          entity: { type: "user_package", id: newPkgId },
          metadata: {
            from_package_type_id: oldPkg.package_type_id,
            target_package_type_id: targetType.id,
            new_user_package_id: newPkgId,
            amount_paise: Math.round(amountPaise),
            method,
            reason: reasonRaw,
          },
        });
        return res.status(200).json({ ok: true, new_user_package_id: newPkgId });
      }
    }

    // Auto-create a UserPackage when admin is assigning a new pass to a member with no
    // active package (or for any comp grant). Picks a PackageType matching the intended
    // pass_type so the auto-created row has sensible defaults.
    const needsAutoCreate = !pkgId && (
      chosenPackageTypeId !== null ||
      hasClassCount ||
      (expiration_date && typeof expiration_date === "string") ||
      compGrant ||
      forceNewPackage
    );
    if (needsAutoCreate) {
      const desiredType = pass_type === "studio_pass" ? "studio_pass" : "class_pass";
      // Bind the EXACT package the admin chose (so price/validity are authoritative);
      // fall back to first-of-type only when no id was passed (legacy callers).
      const pt =
        (chosenPackageTypeId ? await prisma.packageType.findUnique({ where: { id: chosenPackageTypeId } }) : null) ??
        (await prisma.packageType.findFirst({ where: { type: desiredType }, orderBy: { created_at: "asc" } })) ??
        (await prisma.packageType.findFirst({ orderBy: { created_at: "asc" } }));
      if (!pt) return res.status(400).json({ error: "No PackageType available to auto-create package" });

      // Expiry: a fixed-duration (studio/month) package always derives its own
      // expiry — the admin can't override it. A class pass takes the admin
      // override, else the global default validity.
      let expiryForCreate: Date;
      if (pt.duration_months && pt.duration_months > 0) {
        expiryForCreate = new Date();
        expiryForCreate.setMonth(expiryForCreate.getMonth() + pt.duration_months);
      } else if (expiration_date && typeof expiration_date === "string") {
        expiryForCreate = new Date(expiration_date);
      } else {
        const settings = await getStudioSettings();
        expiryForCreate = new Date();
        expiryForCreate.setDate(expiryForCreate.getDate() + settings.default_package_validity_days);
      }
      if (Number.isNaN(expiryForCreate.getTime())) return res.status(400).json({ error: "Invalid expiration date" });

      const created = await prisma.userPackage.create({
        data: {
          user_id: profile_id,
          package_type_id: pt.id,
          credits_remaining: hasClassCount ? class_count : null,
          // Provision the grant total alongside remaining — omitting it left the pass
          // with credits_total=null (an empty, unauditable pass). Mirror the other create sites.
          credits_total: hasClassCount ? class_count : null,
          expiration_date: expiryForCreate,
          is_active: true,
          pass_type: desiredType,
          is_comp: compGrant,
          grant_note: grantNote,
          origin: compGrant ? "comp" : "admin",
        },
      });
      pkgId = created.id;
      createdUserPackageId = created.id;
      await logActivity({ req, action: "admin.package_assigned", targetProfileId: profile_id, metadata: { package_name: pt.name, is_comp: compGrant } });
    }

    // Set (not increment) the class balance when editing an existing pass.
    if (hasClassCount && !needsAutoCreate) {
      if (!pkgId) return res.status(400).json({ error: "No active package to set classes" });
      const pkg = await prisma.userPackage.findUnique({ where: { id: pkgId } });
      if (!pkg || pkg.user_id !== profile_id) return res.status(400).json({ error: "Invalid package" });
      await prisma.userPackage.update({
        where: { id: pkgId },
        data: { credits_remaining: class_count },
      });
    }

    if (expiration_date && typeof expiration_date === "string") {
      if (!pkgId) return res.status(400).json({ error: "No active package for expiry update" });
      const pkg = await prisma.userPackage.findUnique({ where: { id: pkgId } });
      if (!pkg || pkg.user_id !== profile_id) return res.status(400).json({ error: "Invalid package" });
      const d = new Date(expiration_date);
      if (Number.isNaN(d.getTime())) return res.status(400).json({ error: "Invalid date" });
      if (!needsAutoCreate) {
        await prisma.userPackage.update({
          where: { id: pkgId },
          data: { expiration_date: d },
        });
      }
    }

    if (pass_type === "studio_pass" || pass_type === "class_pass") {
      await prisma.profile.update({
        where: { id: profile_id },
        data: { pass_type },
      });
    }

    if (start_date && typeof start_date === "string") {
      const d = new Date(start_date);
      if (Number.isNaN(d.getTime())) return res.status(400).json({ error: "Invalid start_date" });
      await prisma.profile.update({
        where: { id: profile_id },
        data: { start_date: d },
      });
    }

    // Admin edit of core member profile fields (name, phone, whatsapp, dob, gender).
    if (profile_fields && typeof profile_fields === "object") {
      const pf = profile_fields as Record<string, unknown>;
      const data: Record<string, unknown> = {};

      if ("full_name" in pf) {
        const v = typeof pf.full_name === "string" ? pf.full_name.trim() : "";
        if (!v) return res.status(400).json({ error: "Name cannot be empty" });
        data.full_name = v;
      }
      if ("phone" in pf) {
        const v = typeof pf.phone === "string" ? pf.phone.trim() : "";
        data.phone = v || null;
      }
      if ("whatsapp_phone" in pf) {
        const v = typeof pf.whatsapp_phone === "string" ? pf.whatsapp_phone.trim() : "";
        data.whatsapp_phone = v || null;
      }
      if ("gender" in pf) {
        const v = typeof pf.gender === "string" ? pf.gender.trim() : "";
        data.gender = v || null;
      }
      if ("dob" in pf) {
        const raw = typeof pf.dob === "string" ? pf.dob.trim() : "";
        if (!raw) {
          data.dob = null;
        } else {
          const d = new Date(raw);
          if (Number.isNaN(d.getTime())) return res.status(400).json({ error: "Invalid date of birth" });
          data.dob = d;
        }
      }

      if (Object.keys(data).length > 0) {
        await prisma.profile.update({ where: { id: profile_id }, data });
      }
    }

    return res.json({ ok: true, created_user_package_id: createdUserPackageId });
  }

  res.status(405).end();
}
