import { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { decode } from "next-auth/jwt";
import bcrypt from "bcryptjs";
import type { Profile } from "@/generated/prisma/client";
import prisma from "./prisma";
import { normalizeLoginEmail } from "./loginEmail";
import { startSession, endSession, SESSION_MAX_AGE_SECONDS } from "./sessionGuard";
import logger from "@/lib/logger";
import { logActivity } from "@/lib/activityLog";

type Headers = Record<string, string | string[] | undefined>;

// Roles a signed-in user may seamlessly switch between (no password) when the
// same email owns multiple profiles. Deliberately excludes admin/partner so a
// member/instructor session can never silently escalate.
const SWITCHABLE_ROLES = new Set(["user", "instructor"]);

function parseCookieHeader(header?: string | null): Record<string, string> {
  const out: Record<string, string> = {};
  if (!header) return out;
  for (const part of header.split(";")) {
    const eq = part.indexOf("=");
    if (eq > -1) out[part.slice(0, eq).trim()] = decodeURIComponent(part.slice(eq + 1).trim());
  }
  return out;
}

// Seamless role switch: no password. Requires a valid existing session for the
// SAME email, and only user <-> instructor. Returns the built user (+sid) or null.
async function authorizeRoleSwitch(
  email: string,
  wantRole: string | undefined,
  req: { headers?: unknown } | undefined
) {
  if (!wantRole || !SWITCHABLE_ROLES.has(wantRole)) return null;

  const cookies = parseCookieHeader(
    (req?.headers as Record<string, string | undefined> | undefined)?.cookie
  );
  const sessionToken =
    cookies["__Secure-next-auth.session-token"] ?? cookies["next-auth.session-token"];
  if (!sessionToken) return null;

  const existing = await decode({ token: sessionToken, secret: process.env.NEXTAUTH_SECRET });
  const currentEmail = existing?.email ? normalizeLoginEmail(String(existing.email)) : null;
  const currentRole = String((existing as { role?: string } | null)?.role ?? "");
  if (!currentEmail || currentEmail !== email) return null;
  if (!SWITCHABLE_ROLES.has(currentRole)) return null;

  const target = await prisma.profile.findFirst({ where: { email, role: wantRole } });
  if (!target) return null;
  const switched = await buildUserFromProfile(target);
  const { sid: switchSid } = await startSession(target.id, (req?.headers ?? {}) as Headers);
  return { ...switched, sid: switchSid };
}

// Password sign-in: find the role-scoped profile, bcrypt-compare, build user (+sid).
async function authorizePassword(
  email: string,
  password: string | undefined,
  wantRole: string | undefined,
  req: { headers?: unknown } | undefined
) {
  if (!password) {
    logger.warn("[next-auth] credentials sign-in rejected: missing password");
    return null;
  }

  // Email is unique per role now — pick the row for the chosen portal.
  const profile = wantRole
    ? await prisma.profile.findFirst({ where: { email, role: wantRole } })
    : await prisma.profile.findFirst({ where: { email } });

  if (!profile) {
    logger.warn({ email }, "[next-auth] CredentialsSignin: no profile row (run bootstrap-admin or ensure-admin for this email)");
    return null;
  }

  if (!profile.hashedPassword) {
    logger.warn({ email }, "[next-auth] CredentialsSignin: profile has no hashedPassword");
    return null;
  }

  const isValid = await bcrypt.compare(password, profile.hashedPassword);
  if (!isValid) {
    logger.warn({ email }, "[next-auth] CredentialsSignin: password does not match stored hash");
    return null;
  }

  await logActivity({
    action: "auth.login",
    actor: { id: profile.id, role: profile.role, name: profile.full_name },
  });

  const built = await buildUserFromProfile(profile);
  const { sid } = await startSession(profile.id, (req?.headers ?? {}) as Headers);
  return { ...built, sid };
}

// Build the NextAuth user object for a profile, including scope ids and the set
// of roles this email can sign in as (powers the in-app role switcher).
async function buildUserFromProfile(profile: Profile) {
  const [membership, instructorLink, roleRows] = await Promise.all([
    profile.role === "partner"
      ? prisma.partnerMember.findFirst({ where: { profile_id: profile.id }, select: { partner_id: true } })
      : Promise.resolve(null),
    profile.role === "instructor"
      ? prisma.instructor.findFirst({ where: { profile_id: profile.id }, select: { id: true } })
      : Promise.resolve(null),
    prisma.profile.findMany({ where: { email: profile.email }, select: { role: true } }),
  ]);

  return {
    id: profile.id,
    email: profile.email,
    name: profile.full_name,
    role: profile.role,
    partner_id: membership?.partner_id ?? null,
    instructor_id: instructorLink?.id ?? null,
    onboarding_completed: profile.onboarding_completed,
    available_roles: Array.from(new Set(roleRows.map((r) => r.role))),
  };
}

export const authOptions: NextAuthOptions = {
  session: {
    strategy: "jwt",
    maxAge: SESSION_MAX_AGE_SECONDS,
  },
  jwt: {
    maxAge: SESSION_MAX_AGE_SECONDS,
  },
  providers: [
    CredentialsProvider({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
        role: { label: "Role", type: "text" },
        mode: { label: "Mode", type: "text" },
      },
      async authorize(credentials, req) {
        if (!credentials?.email) return null;

        const email = normalizeLoginEmail(credentials.email);
        const wantRole = credentials.role?.trim() || undefined;
        const isSwitch = credentials.mode === "switch";

        try {
          if (isSwitch) {
            return await authorizeRoleSwitch(email, wantRole, req);
          }

          return await authorizePassword(email, credentials.password, wantRole, req);
        } catch (e) {
          logger.error({ err: e }, "[next-auth] authorize error (DB or unexpected)");
          return null;
        }
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user, trigger, session }) {
      if (user) {
        token.id = user.id;
        token.sid = (user as { sid?: string }).sid ?? null;
        token.role = (user as { role?: string }).role ?? "user";
        token.partner_id = (user as { partner_id?: string | null }).partner_id ?? null;
        token.instructor_id = (user as { instructor_id?: string | null }).instructor_id ?? null;
        token.onboarding_completed = (user as { onboarding_completed?: boolean }).onboarding_completed ?? false;
        token.available_roles = (user as { available_roles?: string[] }).available_roles ?? [token.role as string];
      }
      if (trigger === "update" && session?.onboarding_completed !== undefined) {
        token.onboarding_completed = session.onboarding_completed;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        (session.user as { id?: string }).id = token.id as string;
        (session.user as { role?: string }).role = token.role as string;
        (session.user as { partner_id?: string | null }).partner_id = (token.partner_id as string | null) ?? null;
        (session.user as { instructor_id?: string | null }).instructor_id = (token.instructor_id as string | null) ?? null;
        (session.user as { onboarding_completed?: boolean }).onboarding_completed = token.onboarding_completed as boolean;
        (session.user as { available_roles?: string[] }).available_roles = (token.available_roles as string[] | undefined) ?? [];
      }
      return session;
    },
  },
  events: {
    async signOut({ token }) {
      await endSession((token as { sid?: string } | null)?.sid);
    },
  },
  pages: {
    signIn: "/login",
  },
  secret: process.env.NEXTAUTH_SECRET,
};
