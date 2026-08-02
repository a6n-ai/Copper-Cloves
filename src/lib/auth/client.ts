import { createAuthClient } from "better-auth/react";
import { adminClient } from "better-auth/client/plugins";
import { customSessionClient } from "better-auth/client/plugins";
import type { auth } from "@/lib/auth";

export const authClient = createAuthClient({
  plugins: [adminClient(), customSessionClient<typeof auth>()],
});

export const { signIn, signOut, useSession, getSession } = authClient;
