import { authClient } from "@/lib/auth/client";
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
    const { data } = await authClient.getSession();
    if (!data?.user) return null;
    return {
      id: data.user.id,
      email: data.user.email ?? "",
      name: data.user.name,
      role: (data.user as { role?: string }).role,
    };
  },

  async getCurrentSession() {
    const { data } = await authClient.getSession();
    return data ?? null;
  },

  async signIn(
    email: string,
    password: string
  ): Promise<{ user: AuthUser | null; error: AuthError | null }> {
    const { data, error } = await authClient.signIn.email({
      email: normalizeLoginEmail(email),
      password,
    });
    if (error || !data?.user) {
      return { user: null, error: { message: "Invalid email or password. Please try again." } };
    }
    return {
      user: {
        id: data.user.id,
        email: data.user.email ?? "",
        name: data.user.name,
        role: (data.user as { role?: string }).role,
      },
      error: null,
    };
  },

  async signOut(): Promise<void> {
    await authClient.signOut();
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

  onAuthStateChange(_callback: (event: string, session: unknown) => void) {
    // Better Auth does not have a real-time auth state listener.
    // Sessions are checked via getSession() or useSession().
    // `_callback` is accepted for Supabase API compatibility but never invoked.
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
