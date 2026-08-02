import type { NextApiRequest, NextApiResponse } from "next";
import prisma from "@/lib/prisma";
import { getStudioServerSession } from "@/lib/getStudioServerSession";
import { hasRole } from "@/lib/auth/roles";
import { createStudioLogin, LoginEmailTakenError } from "@/lib/auth/createStudioLogin";

function slugify(s: string): string {
  return s.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(?:^-+)|(?:-+$)/g, "");
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getStudioServerSession(req, res);
  if (!session?.user) return res.status(401).json({ error: "Unauthorized" });
  if (!hasRole((session.user as { role?: string }).role, "admin")) return res.status(403).json({ error: "Forbidden" });

  if (req.method === "GET") {
    const partners = await prisma.partner.findMany({
      orderBy: { created_at: "desc" },
      include: {
        classes: { select: { id: true, name: true } },
        members: { include: { profile: { select: { id: true, email: true, full_name: true } } } },
      },
    });
    // Flatten members → managers for the UI.
    return res.json(
      partners.map((p) => ({
        ...p,
        managers: p.members.map((m) => m.profile),
      })),
    );
  }

  if (req.method === "POST") {
    const { name, slug, managerEmail, managerPassword } = req.body ?? {};
    if (typeof name !== "string" || !name.trim()) return res.status(400).json({ error: "name required" });
    if (typeof managerEmail !== "string" || !managerEmail.includes("@")) {
      return res.status(400).json({ error: "valid managerEmail required" });
    }
    // 8, not 6 — better-auth's minPasswordLength rejects anything shorter and
    // the login creation would fail after the Partner row already exists.
    if (typeof managerPassword !== "string" || managerPassword.length < 8) {
      return res.status(400).json({ error: "managerPassword must be at least 8 characters" });
    }
    const finalSlug = slugify(typeof slug === "string" && slug.trim() ? slug : name);
    const email = managerEmail.trim().toLowerCase();

    const [slugTaken, emailTaken] = await Promise.all([
      prisma.partner.findUnique({ where: { slug: finalSlug } }),
      // Identity is keyed on email alone now, not on (email, role).
      prisma.user.findUnique({ where: { email }, select: { id: true } }),
    ]);
    if (slugTaken) {
      return res.status(400).json({ error: "A partner with this slug already exists" });
    }
    if (emailTaken) {
      return res.status(400).json({ error: "A login with this email already exists" });
    }

    const partner = await prisma.partner.create({ data: { name: name.trim(), slug: finalSlug } });
    let profile;
    try {
      profile = await createStudioLogin({
        email,
        password: managerPassword,
        name: `${name.trim()} Manager`,
        role: "partner",
        profile: { full_name: `${name.trim()} Manager`, onboarding_completed: true },
      });
      await prisma.partnerMember.create({
        data: { partner_id: partner.id, profile_id: profile.id, role: "manager" },
      });
    } catch (e) {
      // Both halves roll back. A partner login with no PartnerMember still passes
      // the session gate (it has a Profile) and lands on partner_id: null —
      // signed in and locked out of every partner page — while the taken email
      // blocks a retry. The half-made partner would also squat the slug.
      if (profile?.user_id) {
        await prisma.user.delete({ where: { id: profile.user_id } }).catch(() => {});
      }
      await prisma.partner.delete({ where: { id: partner.id } }).catch(() => {});
      if (e instanceof LoginEmailTakenError) return res.status(400).json({ error: e.message });
      throw e;
    }
    return res.status(201).json({ ok: true, partnerId: partner.id });
  }

  if (req.method === "PATCH") {
    const { id, action } = req.body ?? {};
    if (typeof id !== "string" || !id) return res.status(400).json({ error: "id required" });
    const partner = await prisma.partner.findUnique({ where: { id } });
    if (!partner) return res.status(404).json({ error: "Partner not found" });

    if (action === "assign_class" || action === "unassign_class") {
      const classId = String(req.body?.classId ?? "");
      if (!classId) return res.status(400).json({ error: "classId required" });
      await prisma.classModel.update({
        where: { id: classId },
        data: { partner_id: action === "assign_class" ? id : null },
      });
      return res.json({ ok: true });
    }

    if (action === "add_manager") {
      const email = String(req.body?.email ?? "").trim().toLowerCase();
      const password = String(req.body?.password ?? "");
      if (!email.includes("@")) return res.status(400).json({ error: "valid email required" });
      if (password.length < 8) return res.status(400).json({ error: "password must be at least 8 characters" });
      let profile;
      try {
        profile = await createStudioLogin({
          email,
          password,
          name: `${partner.name} Manager`,
          role: "partner",
          profile: { full_name: `${partner.name} Manager`, onboarding_completed: true },
        });
        await prisma.partnerMember.create({
          data: { partner_id: id, profile_id: profile.id, role: "manager" },
        });
      } catch (e) {
        // See the POST path: a login with no PartnerMember signs in to nothing
        // and cannot be recreated, so it rolls back with the membership.
        if (profile?.user_id) {
          await prisma.user.delete({ where: { id: profile.user_id } }).catch(() => {});
        }
        if (e instanceof LoginEmailTakenError) return res.status(400).json({ error: e.message });
        throw e;
      }
      return res.json({ ok: true });
    }

    // default: update partner fields
    const data: Record<string, unknown> = {};
    if (typeof req.body?.name === "string" && req.body.name.trim()) data.name = req.body.name.trim();
    if (typeof req.body?.is_active === "boolean") data.is_active = req.body.is_active;
    if (Object.keys(data).length === 0) return res.status(400).json({ error: "Nothing to update" });
    await prisma.partner.update({ where: { id }, data });
    return res.json({ ok: true });
  }

  return res.status(405).end();
}
