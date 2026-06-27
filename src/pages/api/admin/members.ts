import type { NextApiRequest, NextApiResponse } from "next";
import prisma from "@/lib/prisma";
import { isStudioAdminProfileRole } from "@/lib/isStudioAdminProfile";
import { getStudioServerSession } from "@/lib/getStudioServerSession";
import { getDynamicStats, getDynamicStatsForUsers } from "@/lib/attendanceStats";
import { logActivity } from "@/lib/activityLog";
import { HISTORY_STATUSES } from "@/lib/bookingStatus";
import { getStudioSettings } from "@/lib/studioSettings";

// Member Management lists real members only — never staff/partner/instructor logins.
function isNonMemberRole(role?: string | null): boolean {
  const r = String(role ?? "").trim().toLowerCase();
  return isStudioAdminProfileRole(role) || r === "partner" || r === "instructor";
}

const memberInclude = {
  user_packages: {
    include: { package_type: true },
    orderBy: { purchase_date: "desc" as const },
    take: 8,
  },
} as const;

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
        include: memberDetailInclude,
      });
      if (!profile || isNonMemberRole(profile.role)) {
        return res.status(404).json({ error: "Member not found" });
      }
      const stats = await getDynamicStats(profile.id);
      return res.json({ ...profile, user_stats: stats });
    }

    const monthStart = new Date();
    monthStart.setDate(1);
    monthStart.setHours(0, 0, 0, 0);

    // The month check-in count is independent of the member list, so fetch
    // both in one round trip instead of as a trailing serial query.
    const [rows, checkInsThisMonth] = await Promise.all([
      prisma.profile.findMany({
        include: memberInclude,
        orderBy: { created_at: "desc" },
      }),
      prisma.booking.count({
        where: { checked_in: true, check_in_time: { gte: monthStart } },
      }),
    ]);
    // Exclude staff/partner/instructor logins — only real members.
    const members = rows.filter((p) => !isNonMemberRole(p.role));
    const statsByUser = await getDynamicStatsForUsers(members.map((m) => m.id));
    const withStats = members.map((m) => {
      const stats = statsByUser.get(m.id) ?? null;
      return {
        ...m,
        user_stats: stats,
        _count: { bookings: stats?.total_classes_attended ?? 0 },
      };
    });

    return res.json({ members: withStats, checkInsThisMonth });
  }

  if (req.method === "PATCH") {
    const { profile_id, user_package_id, class_count, expiration_date, pass_type, start_date, action, profile_fields, is_comp, grant_note } = req.body ?? {};
    if (!profile_id || typeof profile_id !== "string") {
      return res.status(400).json({ error: "profile_id required" });
    }

    const compGrant = is_comp === true;
    const grantNote = typeof grant_note === "string" && grant_note.trim() ? grant_note.trim() : null;
    const hasClassCount = typeof class_count === "number" && class_count > 0;
    if (compGrant && !grantNote) {
      return res.status(400).json({ error: "A grant note is required for a comp pass" });
    }

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
    // A comp grant always creates a fresh UserPackage (origin=comp) — never reuse
    // an existing pass row, so its purchase origin/credits are left intact.
    if (!pkgId && !compGrant) {
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

    // Auto-create a UserPackage when admin is assigning a new pass to a member with no
    // active package (or for any comp grant). Picks a PackageType matching the intended
    // pass_type so the auto-created row has sensible defaults.
    const needsAutoCreate = !pkgId && (
      hasClassCount ||
      (expiration_date && typeof expiration_date === "string") ||
      compGrant
    );
    if (needsAutoCreate) {
      const desiredType = pass_type === "studio_pass" ? "studio_pass" : "class_pass";
      const pt =
        (await prisma.packageType.findFirst({ where: { type: desiredType }, orderBy: { created_at: "asc" } })) ??
        (await prisma.packageType.findFirst({ orderBy: { created_at: "asc" } }));
      if (!pt) return res.status(400).json({ error: "No PackageType available to auto-create package" });

      // Expiry: admin override → package's own validity (duration_months) →
      // global default_package_validity_days fallback.
      let expiryForCreate: Date;
      if (expiration_date && typeof expiration_date === "string") {
        expiryForCreate = new Date(expiration_date);
      } else if (pt.duration_months && pt.duration_months > 0) {
        expiryForCreate = new Date();
        expiryForCreate.setMonth(expiryForCreate.getMonth() + pt.duration_months);
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
          expiration_date: expiryForCreate,
          is_active: true,
          pass_type: desiredType,
          is_comp: compGrant,
          grant_note: grantNote,
          origin: compGrant ? "comp" : "admin",
        },
      });
      pkgId = created.id;
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

    return res.json({ ok: true });
  }

  res.status(405).end();
}
