import { createHash } from "crypto";
import { betterAuth } from "better-auth";
import type { BetterAuthOptions } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { admin, customSession } from "better-auth/plugins";
import { APIError } from "better-auth/api";
import prisma from "@/lib/prisma";
import logger from "@/lib/logger";
import { studioPassword } from "./password";
import { primaryRole, parseRoles } from "./roles";

/** Absolute session lifetime. Matches the old SESSION_MAX_AGE_SECONDS. */
const SESSION_MAX_AGE_S = 2 * 24 * 60 * 60;

/**
 * Stable per-device hash. User-Agent ONLY — including the client IP would sign
 * mobile users out on every WiFi<->cellular switch. Salted with the auth secret
 * so it cannot be forged offline from a known UA string.
 * Preserved verbatim from the retired src/lib/sessionGuard.ts.
 */
export function computeFingerprint(userAgent: string): string {
  const secret = process.env.BETTER_AUTH_SECRET ?? "";
  return createHash("sha256").update(`${userAgent.toLowerCase()}|${secret}`).digest("hex");
}

/**
 * Split out from the betterAuth() call so it can be handed to customSession as
 * its second argument — without it the callback cannot infer `user.role` (admin
 * plugin) or the session additionalFields, and every read needs a cast.
 */
const options = {
  baseURL: process.env.BETTER_AUTH_URL,
  secret: process.env.BETTER_AUTH_SECRET,

  database: prismaAdapter(prisma, { provider: "postgresql" }),

  // /get-session runs on every authenticated request; joins cut it to one query.
  experimental: { joins: true },

  advanced: {
    // Trust ONLY x-real-ip. better-auth defaults to x-forwarded-for and takes its
    // leftmost token verbatim; under Caddy's DEFAULT (appending) behaviour a client
    // could prepend any value and pick its own rate-limit bucket. Our Caddyfile
    // overwrites both headers, so this is defence in depth — but it must stay
    // aligned if a CDN is ever placed in front of Caddy.
    // Ref: deployment/prod/proxy/conf/Caddyfile
    ipAddress: { ipAddressHeaders: ["x-real-ip"] },
  },

  session: {
    expiresIn: SESSION_MAX_AGE_S,
    // Refresh throttle: an in-use session's expiry only slides once this old.
    // Equal to expiresIn, so sessions hard-expire 2 days after creation — the
    // behaviour the absolute SESSION_MAX_AGE_SECONDS cap already had.
    updateAge: 2 * 24 * 60 * 60,
    // Sensitive endpoints (change-email, delete-user) require a recently
    // authenticated session. Default 24h is most of a working day.
    freshAge: 60 * 60,
    additionalFields: {
      // UA hash binding the session to its issuing device — the 2026-06-30
      // session-bleed defence. better-auth has no native equivalent; it is
      // written here and ENFORCED in getStudioServerSession (Task 8).
      fingerprint: { type: "string", required: false, input: false },
      // Migrated off the deleted user_sessions table.
      latitude: { type: "number", required: false, input: false },
      longitude: { type: "number", required: false, input: false },
      accuracy: { type: "number", required: false, input: false },
      geoCapturedAt: { type: "date", required: false, input: false },
    },
  },

  emailAndPassword: {
    enabled: true,
    password: studioPassword,
    // Enforced on sign-up / change / reset only — never on sign-in, so raising
    // this can never lock out an existing account with a shorter password.
    minPasswordLength: 8,
    maxPasswordLength: 256,
  },

  user: {
    additionalFields: {
      // Written by the admin plugin and the backfill, never by user input.
      role: { type: "string", required: false, input: false, defaultValue: "user" },
    },
  },

  databaseHooks: {
    session: {
      create: {
        // Every sign-in method funnels through session creation, including
        // plugin routes that bypass emailAndPassword's own checks — so the
        // account-status gate lives here rather than on /sign-in/email.
        before: async (session, ctx) => {
          const ua = ctx?.headers?.get("user-agent") ?? "";
          const user = await prisma.user.findUnique({
            where: { id: session.userId },
            select: { banned: true, role: true },
          });
          if (user?.banned) {
            throw new APIError("FORBIDDEN", { message: "This account is not active. Contact support." });
          }
          if (!parseRoles(user?.role).length) {
            logger.error({ userId: session.userId }, "[auth] refusing session: user has no valid role");
            throw new APIError("FORBIDDEN", { message: "This account is not configured. Contact support." });
          }
          return { data: { ...session, fingerprint: computeFingerprint(ua) } };
        },
      },
    },
  },

  plugins: [admin({ defaultRole: "user", adminRoles: ["admin"] })],
} satisfies BetterAuthOptions;

export const auth = betterAuth({
  ...options,
  plugins: [
    ...options.plugins,
    // Attaches studio scope to every session response so BOTH the server wrapper
    // and the React client see profile_id / instructor_id / partner_id without a
    // second round trip. NOTE: this callback is never cached — it runs on every
    // authenticated request, so keep the query count minimal.
    customSession(async ({ user, session }) => {
      const role = primaryRole(user.role);
      const profile = await prisma.profile.findFirst({
        where: { user_id: user.id, ...(role ? { role } : {}) },
        select: { id: true, onboarding_completed: true },
      });
      const [instructor, membership] = await Promise.all([
        role === "instructor" && profile
          ? prisma.instructor.findFirst({ where: { profile_id: profile.id }, select: { id: true } })
          : Promise.resolve(null),
        role === "partner" && profile
          ? prisma.partnerMember.findFirst({ where: { profile_id: profile.id }, select: { partner_id: true } })
          : Promise.resolve(null),
      ]);
      return {
        user,
        session,
        profile_id: profile?.id ?? null,
        instructor_id: instructor?.id ?? null,
        partner_id: membership?.partner_id ?? null,
        onboarding_completed: profile?.onboarding_completed ?? false,
      };
    }, options),
  ],
});
