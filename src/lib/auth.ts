import { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import prisma from "./prisma";
import { normalizeLoginEmail } from "./loginEmail";

export const authOptions: NextAuthOptions = {
  session: {
    strategy: "jwt",
  },
  providers: [
    CredentialsProvider({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          console.warn("[next-auth] credentials sign-in rejected: missing email or password");
          return null;
        }

        const email = normalizeLoginEmail(credentials.email);

        try {
          const profile = await prisma.profile.findUnique({
            where: { email },
          });

          if (!profile) {
            console.warn(
              "[next-auth] CredentialsSignin: no profile row (run bootstrap-admin or ensure-admin for this email)",
              { email }
            );
            return null;
          }

          if (!profile.hashedPassword) {
            console.warn("[next-auth] CredentialsSignin: profile has no hashedPassword", {
              email,
            });
            return null;
          }

          const isValid = await bcrypt.compare(
            credentials.password,
            profile.hashedPassword
          );
          if (!isValid) {
            console.warn(
              "[next-auth] CredentialsSignin: password does not match stored hash",
              { email }
            );
            return null;
          }

          return {
            id: profile.id,
            email: profile.email,
            name: profile.full_name,
            role: profile.role,
          };
        } catch (e) {
          console.error("[next-auth] authorize error (DB or unexpected)", e);
          return null;
        }
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.role = (user as { role?: string }).role ?? "user";
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        (session.user as { id?: string }).id = token.id as string;
        (session.user as { role?: string }).role = token.role as string;
      }
      return session;
    },
  },
  pages: {
    signIn: "/portal/login",
  },
  secret: process.env.NEXTAUTH_SECRET,
};
