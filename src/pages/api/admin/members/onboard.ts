import type { NextApiRequest, NextApiResponse } from "next";
import { Prisma, PaymentMethod, PaymentStatus } from "@/generated/prisma/client";
import prisma from "@/lib/prisma";
import { getStudioServerSession } from "@/lib/getStudioServerSession";
import { getStudioSettings } from "@/lib/studioSettings";
import { RECORDABLE_METHODS } from "@/lib/payments";
import { sendHtmlEmail } from "@/lib/notifications/sendEmail";
import { welcomeEmail } from "@/lib/notifications/emailTemplates";
import { logActivity } from "@/lib/activityLog";
import logger from "@/lib/logger";
import { apiError } from "@/lib/apiError";
import { hasRole } from "@/lib/auth/roles";
import {
  createStudioProfile,
  rollbackStudioProfile,
  LoginEmailTakenError,
  type CreatedStudioProfile,
} from "@/lib/auth/studioIdentity";

/**
 * Atomic member onboarding: create the account and (optionally) assign a pass +
 * record its payment in a SINGLE transaction. If any step fails the whole thing
 * rolls back, so an admin can never end up with an orphaned account that has no
 * pass / a payment with no pass (the two-call hazard of known-issue #9).
 *
 * Used only by the Members "Add Member" flow. Existing-member edits keep using
 * PATCH /api/admin/members + POST /api/admin/payments. The request body mirrors
 * the shared `managePass` engine so the UI stays a single source of truth.
 */

type PassInput = {
  package_type_id?: string;
  pass_type?: string;
  class_count?: number;
  expiration_date?: string;
  is_comp?: boolean;
  grant_note?: string;
  start_date?: string;
};
type PaymentInput = {
  method?: string;
  amount_paise?: number;
  reference?: string;
  proof_url?: string;
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getStudioServerSession(req, res);
  if (!session?.user) return res.status(401).json({ error: "Unauthorized" });
  const role = (session.user as { role?: string }).role;
  if (!hasRole(role, "admin")) return res.status(403).json({ error: "Forbidden" });
  const adminId = (session.user as { id?: string }).id ?? null;

  if (req.method !== "POST") return res.status(405).end();

  const body = req.body ?? {};
  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  const password = typeof body.password === "string" ? body.password : "";
  const full_name = typeof body.full_name === "string" ? body.full_name.trim() : "";
  const phone = body.phone == null || body.phone === "" ? null : String(body.phone).trim() || null;
  const assignPass = body.assign_pass === true;
  const pass = (body.pass ?? {}) as PassInput;
  const payment = (body.payment ?? {}) as PaymentInput;

  /* — account validation — */
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({ error: "Valid email is required." });
  }
  if (!password || password.length < 8) {
    return res.status(400).json({ error: "Password must be at least 8 characters." });
  }
  if (password.length > 72) {
    return res.status(400).json({ error: "Password is too long (max 72 characters)." });
  }

  /* — pass + payment validation (mirrors the shared engine's validators) — */
  const isComp = assignPass && pass.is_comp === true;
  const passType: "class_pass" | "studio_pass" = pass.pass_type === "studio_pass" ? "studio_pass" : "class_pass";
  const recordPaymentRow = assignPass && !isComp;
  const grantNote = typeof pass.grant_note === "string" ? pass.grant_note.trim() : "";

  if (assignPass) {
    const hasClassCount = typeof pass.class_count === "number" && pass.class_count > 0;
    if (passType === "class_pass" && !hasClassCount) {
      return res.status(400).json({ error: "Select number of classes first" });
    }
  }
  if (recordPaymentRow) {
    if (!RECORDABLE_METHODS.includes(payment.method as PaymentMethod)) {
      return res.status(400).json({ error: "Select a payment method" });
    }
    const amt = Number(payment.amount_paise);
    if (!Number.isFinite(amt) || amt <= 0) {
      return res.status(400).json({ error: "Enter a valid amount in INR" });
    }
    if (!payment.proof_url) {
      return res.status(400).json({ error: "Proof of payment is required" });
    }
  }

  const existing = await prisma.profile.findFirst({ where: { email, role: "user" } });
  if (existing) return res.status(409).json({ error: "An account with this email already exists." });

  let created: CreatedStudioProfile | undefined;
  try {
    // Resolve the PackageType + expiry (reads) before opening the transaction.
    let pkgTypeId: string | null = null;
    let expiry: Date | null = null;
    let creditsRemaining: number | null = null;
    if (assignPass) {
      const chosenId = typeof pass.package_type_id === "string" && pass.package_type_id ? pass.package_type_id : null;
      const pt =
        (chosenId ? await prisma.packageType.findUnique({ where: { id: chosenId } }) : null) ??
        (await prisma.packageType.findFirst({ where: { type: passType }, orderBy: { created_at: "asc" } })) ??
        (await prisma.packageType.findFirst({ orderBy: { created_at: "asc" } }));
      if (!pt) return res.status(400).json({ error: "No PackageType available to assign a pass." });
      pkgTypeId = pt.id;

      // Fixed-duration packages derive their own expiry (no override); class
      // passes take the admin override, else the global default validity.
      if (pt.duration_months && pt.duration_months > 0) {
        expiry = new Date();
        expiry.setMonth(expiry.getMonth() + pt.duration_months);
      } else if (pass.expiration_date) {
        expiry = new Date(pass.expiration_date);
      } else {
        const settings = await getStudioSettings();
        expiry = new Date();
        expiry.setDate(expiry.getDate() + settings.default_package_validity_days);
      }
      if (Number.isNaN(expiry.getTime())) return res.status(400).json({ error: "Invalid expiration date" });
      creditsRemaining =
        passType === "class_pass" ? Math.floor(Number(pass.class_count ?? pt.class_count ?? 0)) || null : null;
    }

    let startDate: Date | null = null;
    if (assignPass && pass.start_date) {
      startDate = new Date(pass.start_date);
      if (Number.isNaN(startDate.getTime())) return res.status(400).json({ error: "Invalid start date" });
    }

    // createStudioProfile throws LoginEmailTakenError -> 409 if the email
    // already has a login in another role (one email, one role). It spans
    // several statements and so cannot join the transaction below; it is rolled
    // back by hand in the catch instead, keeping the all-or-nothing guarantee
    // this route exists for (known-issue #9).
    created = await createStudioProfile({
      email,
      password,
      name: full_name || email,
      role: "user",
      profile: {
        full_name: full_name || null,
        phone,
        ...(assignPass ? { pass_type: passType } : {}),
        ...(startDate ? { start_date: startDate } : {}),
      },
    });
    const profile = created.profile;

    // Pass + payment commit together or not at all.
    const member = await prisma.$transaction(async (tx) => {
      let userPackageId: string | null = null;
      if (assignPass && pkgTypeId && expiry) {
        const up = await tx.userPackage.create({
          data: {
            user_id: profile.id,
            package_type_id: pkgTypeId,
            credits_remaining: creditsRemaining,
            // Provision grant total alongside remaining (see members.ts) — omitting it
            // produced credits_total=null empty passes. Mirror the other create sites.
            credits_total: creditsRemaining,
            expiration_date: expiry,
            is_active: true,
            pass_type: passType,
            is_comp: isComp,
            grant_note: isComp ? grantNote : null,
            origin: isComp ? "comp" : "admin",
          },
        });
        userPackageId = up.id;
      }

      if (recordPaymentRow) {
        await tx.payment.create({
          data: {
            direction: "credit",
            user_id: profile.id,
            user_package_id: userPackageId,
            method: payment.method as PaymentMethod,
            status: PaymentStatus.succeeded,
            amount_paise: Math.round(Number(payment.amount_paise)),
            currency: "INR",
            reference: typeof payment.reference === "string" && payment.reference.trim() ? payment.reference.trim() : null,
            proof_url: typeof payment.proof_url === "string" ? payment.proof_url : null,
            recorded_by: adminId,
          },
        });
      }

      return profile;
    });

    /* — post-commit side effects (must not roll back a created account) — */
    await logActivity({
      req,
      action: "auth.signup",
      actor: { id: member.id, role: member.role, name: member.full_name },
    });
    if (assignPass) {
      await logActivity({
        req,
        action: "admin.package_assigned",
        targetProfileId: member.id,
        metadata: { pass_type: passType, is_comp: isComp },
      });
    }

    const portalUrl = process.env.BETTER_AUTH_URL?.replace(/\/$/, "") ?? "";
    await sendHtmlEmail({
      to: email,
      subject: "welcome to The Studio by Copper + Cloves",
      html: welcomeEmail({ memberName: full_name || email, portalUrl }),
    })
      .then((result) => {
        if (!result.ok) logger.error({ result }, "[members/onboard] welcome email failed");
      })
      .catch((err) => logger.error({ err }, "[members/onboard] welcome email threw"));

    return res.status(201).json({
      id: member.id,
      email: member.email,
      passAssigned: assignPass,
      // False = this email already had a Studio login and keeps its own
      // password; the one the admin typed was not applied.
      password_applied: created.passwordApplied,
    });
  } catch (e) {
    // Deletes the User only if this request minted it; an ADOPTED identity
    // loses just the Profile it gained here.
    await rollbackStudioProfile(created);
    // The email already has a login in another role. Nothing was written.
    if (e instanceof LoginEmailTakenError) return res.status(409).json({ error: e.message });
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      return res.status(409).json({ error: "An account with this email already exists." });
    }
    return apiError(res, e, "[admin/members/onboard]", 500, "Could not create member.");
  }
}
