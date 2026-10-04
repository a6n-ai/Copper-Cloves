import { createAuthClient } from "better-auth/react";
import { adminClient, emailOTPClient, usernameClient } from "better-auth/client/plugins";
import { customSessionClient } from "better-auth/client/plugins";
import type { auth } from "@/lib/auth";

export const authClient = createAuthClient({
  plugins: [adminClient(), emailOTPClient(), usernameClient(), customSessionClient<typeof auth>()],
});

export const { signIn, signOut, useSession, getSession } = authClient;
