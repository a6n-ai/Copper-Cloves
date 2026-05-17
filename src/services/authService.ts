import { signIn, signOut, getSession } from "next-auth/react";
import { errorMessageFromResponse } from "@/lib/parse-fetch-json";
import { normalizeLoginEmail } from "@/lib/loginEmail";

export interface AuthUser {
  id: string;
  email: string;
  name?: string | null;
  role?: string;
}

export interface AuthError {
  message: string;
}

export const authService = {
  async getCurrentUser(): Promise<AuthUser | null> {
    const session = await getSession();
    if (!session?.user) return null;
    const user = session.user as AuthUser & { id?: string };
    return {
      id: user.id ?? "",
      email: user.email ?? "",
      name: user.name,
      role: user.role,
    };
  },

  async getCurrentSession() {
    return getSession();
  },

  async signIn(
    email: string,
    password: string
  ): Promise<{ user: AuthUser | null; error: AuthError | null }> {
    const result = await signIn("credentials", {
      email: normalizeLoginEmail(email),
      password,
      redirect: false,
    });

    if (result?.error) {
      const message =
        result.error === "CredentialsSignin"
          ? "Invalid email or password. Please try again."
          : result.error;
      return { user: null, error: { message } };
    }

    const session = await getSession();
    const user = session?.user as (AuthUser & { id?: string }) | undefined;
    if (!user) return { user: null, error: { message: "Sign in failed." } };

    return {
      user: { id: user.id ?? "", email: user.email ?? "", name: user.name, role: user.role },
      error: null,
    };
  },

  async signOut(): Promise<void> {
    await signOut({ redirect: false });
  },

  async signUp(
    email: string,
    password: string,
    fullName?: string,
    phone?: string
  ): Promise<{ error: AuthError | null }> {
    const res = await fetch("/api/auth/signup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password, full_name: fullName, phone }),
    });
    if (!res.ok) {
      const message = await errorMessageFromResponse(res);
      return { error: { message } };
    }
    return { error: null };
  },

  onAuthStateChange(callback: (event: string, session: unknown) => void) {
    // NextAuth does not have a real-time auth state listener.
    // Sessions are checked via getSession() or useSession().
    void callback;
    return { data: { subscription: { unsubscribe: () => {} } } };
  },
};

export async function signUp(
  email: string,
  password: string,
  fullName?: string,
  phone?: string
) {
  return authService.signUp(email, password, fullName, phone);
}
