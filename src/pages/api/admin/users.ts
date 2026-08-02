import type { NextApiRequest, NextApiResponse } from "next";
import { Prisma } from "@/generated/prisma/client";
import prisma from "@/lib/prisma";
import { getStudioServerSession } from "@/lib/getStudioServerSession";
import { apiError } from "@/lib/apiError";
import { hasRole } from "@/lib/auth/roles";
import {
  createStudioProfile,
  rollbackStudioProfile,
  LoginEmailTakenError,
  type CreatedStudioProfile,
} from "@/lib/auth/studioIdentity";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getStudioServerSession(req, res);
  if (!session?.user) return res.status(401).json({ error: "Unauthorized" });
  const role = (session.user as { role?: string }).role;
  if (!hasRole(role, "admin")) return res.status(403).json({ error: "Forbidden" });

  if (req.method === "DELETE") {
    const id = typeof req.query.id === "string" ? req.query.id.trim() : "";
    if (!id) return res.status(400).json({ error: "User id is required." });
    const target = await prisma.profile.findUnique({ where: { id }, select: { role: true } });
    if (!target) return res.status(404).json({ error: "User not found." });
    if (hasRole(target.role, "admin")) return res.status(403).json({ error: "Cannot delete admin accounts." });
    await prisma.profile.delete({ where: { id } });
    return res.status(200).json({ ok: true });
  }

  if (req.method !== "POST") return res.status(405).end();

  const body = req.body ?? {};
  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  const password = typeof body.password === "string" ? body.password : "";
  const full_name = typeof body.full_name === "string" ? body.full_name.trim() : "";
  const phone =
    body.phone == null || body.phone === ""
      ? null
      : String(body.phone).trim() || null;
  const pass_type = body.pass_type === "studio_pass" ? "studio_pass" : "class_pass";
  const package_type_id =
    typeof body.package_type_id === "string" && body.package_type_id.trim()
      ? body.package_type_id.trim()
      : null;
  const class_or_days_count = Number(body.class_or_days_count ?? body.amount ?? NaN);
  const expiry_raw = typeof body.expiry_date === "string" ? body.expiry_date.trim() : "";
  const start_date_raw = typeof body.start_date === "string" ? body.start_date.trim() : "";

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({ error: "Valid email is required." });
  }
  if (!password || password.length < 8) {
    return res.status(400).json({ error: "Password must be at least 8 characters." });
  }
  if (password.length > 72) {
    return res.status(400).json({ error: "Password is too long (max 72 characters)." });
  }

  const existing = await prisma.profile.findFirst({ where: { email, role: "user" } });
  if (existing) return res.status(409).json({ error: "An account with this email already exists." });

  // better-auth owns the credential (User + `credential` Account); the Profile
  // owns studio membership. createStudioProfile throws LoginEmailTakenError ->
  // 409 if the email already has a login in another role (one email, one role).
  // It cannot run inside the transaction below
  // (auth.api / multiple statements), so it runs first and is rolled back by
  // hand if the package half fails, preserving the all-or-nothing behaviour the
  // single transaction used to give.
  let created: CreatedStudioProfile | undefined;
  try {
    created = await createStudioProfile({
      email,
      password,
      name: full_name || email,
      role: "user",
      profile: {
        full_name: full_name || null,
        phone,
        pass_type,
        start_date: start_date_raw ? new Date(start_date_raw) : undefined,
      },
    });
    const memberProfile = created.profile;

    const profile = await prisma.$transaction(async (tx) => {
      let pkgTypeId = package_type_id;
      if (!pkgTypeId) {
        const types = await tx.packageType.findMany({ orderBy: { price: "asc" }, take: 40 });
        if (types.length === 0) throw new Error("NO_PACKAGE_TYPES");
        if (pass_type === "studio_pass") {
          const pick = types.find(
            (p) => p.is_unlimited || (p.type || "").toLowerCase().includes("studio")
          );
          if (!pick) throw new Error("NO_STUDIO_PACKAGE_TEMPLATE");
          pkgTypeId = pick.id;
        } else {
          const pick =
            types.find(
              (p) =>
                !p.is_unlimited &&
                (p.class_count != null || (p.type || "").toLowerCase().includes("class"))
            ) ??
            types.find((p) => !p.is_unlimited) ??
            types[0];
          pkgTypeId = pick.id;
        }
      }

      const pt = await tx.packageType.findUnique({ where: { id: pkgTypeId } });
      if (!pt) throw new Error("BAD_PACKAGE");

      const ptType = (pt.type || "").toLowerCase();
      const looksStudio = Boolean(pt.is_unlimited || ptType.includes("studio"));
      if (pass_type === "studio_pass" && !looksStudio) {
        throw new Error("PACKAGE_MISMATCH_STUDIO");
      }
      if (pass_type === "class_pass" && pt.is_unlimited && looksStudio) {
        throw new Error("PACKAGE_MISMATCH_CLASS");
      }

      let expirationDate: Date;
      if (expiry_raw) {
        expirationDate = new Date(expiry_raw);
        if (Number.isNaN(expirationDate.getTime())) throw new Error("BAD_EXPIRY");
      } else if (pass_type === "studio_pass") {
        const days =
          Number.isFinite(class_or_days_count) && class_or_days_count > 0
            ? Math.floor(class_or_days_count)
            : Math.max(30, (pt.duration_months ?? 1) * 30);
        expirationDate = new Date();
        expirationDate.setDate(expirationDate.getDate() + days);
      } else {
        expirationDate = new Date();
        expirationDate.setMonth(expirationDate.getMonth() + (pt.duration_months ?? 1));
      }

      let creditsForClass: number | null = null;
      if (pass_type === "class_pass") {
        creditsForClass =
          Number.isFinite(class_or_days_count) && class_or_days_count > 0
            ? Math.floor(class_or_days_count)
            : pt.class_count ?? 10;
      }

      await tx.userPackage.create({
        data: {
          user_id: memberProfile.id,
          package_type_id: pkgTypeId,
          credits_remaining: pass_type === "class_pass" ? creditsForClass : null,
          credits_total: pass_type === "class_pass" ? creditsForClass : null,
          expiration_date: expirationDate,
          is_active: true,
          pass_type,
        },
      });

      return memberProfile;
    });

    return res.status(201).json({
      id: profile.id,
      email: profile.email,
      // False = this email already had a Studio login and keeps its own
      // password; the one the admin typed was not applied.
      password_applied: created.passwordApplied,
    });
  } catch (e) {
    // Deletes the User only if this request minted it (cascading Account +
    // Profile); an ADOPTED identity loses just the Profile it gained here.
    await rollbackStudioProfile(created);
    // One email, one role: the email already has a login in another portal.
    // Nothing was written — `created` is undefined, so the rollback is a no-op.
    if (e instanceof LoginEmailTakenError) return res.status(409).json({ error: e.message });
    const msg = e instanceof Error ? e.message : String(e);
    if (msg === "NO_PACKAGE_TYPES") {
      return res.status(400).json({
        error: "No package types in the database. Add package types under Pricing/Packages first.",
      });
    }
    if (msg === "NO_STUDIO_PACKAGE_TEMPLATE") {
      return res.status(400).json({
        error:
          "No studio/unlimited package template found. Add one under Pricing, or pick a specific studio package from the list.",
      });
    }
    if (msg === "BAD_PACKAGE") return res.status(400).json({ error: "Invalid package type." });
    if (msg === "BAD_EXPIRY") return res.status(400).json({ error: "Invalid expiry date." });
    if (msg === "PACKAGE_MISMATCH_STUDIO") {
      return res.status(400).json({
        error:
          "This package template is not a studio pass. Choose a studio/unlimited template, or pick “Auto (match pass type)”.",
      });
    }
    if (msg === "PACKAGE_MISMATCH_CLASS") {
      return res.status(400).json({
        error:
          "This package looks like a studio/unlimited pass. Switch to Studio Pass or pick a class-credit package.",
      });
    }
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      return res.status(409).json({ error: "An account with this email already exists." });
    }
    return apiError(res, e, "[admin/users]", 500, "Could not create user.");
  }
}
