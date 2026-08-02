import { createAuthClient } from "better-auth/react";
import { adminClient } from "better-auth/client/plugins";
import { customSessionClient } from "better-auth/client/plugins";
import type { auth } from "@/lib/auth";

export const authClient = createAuthClient({
  // TEMPORARY: matches the server's basePath in @/lib/auth — revert together
  // with it in Task 13 once /api/auth/[...nextauth].ts is deleted.
  basePath: "/api/betterauth",
  plugins: [adminClient(), customSessionClient<typeof auth>()],
});

export const { signIn, signOut, useSession, getSession } = authClient;
