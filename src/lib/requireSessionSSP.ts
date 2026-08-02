import type { GetServerSidePropsContext, GetServerSidePropsResult } from "next";
import type { StudioSession as Session } from "@/lib/getStudioServerSession";
import { getStudioServerSession } from "@/lib/getStudioServerSession";
import { hasRole, type Role } from "@/lib/auth/roles";

interface Options {
  /** Required role(s). If empty, any authenticated session passes. */
  roles?: Role[];
  /** Where to send unauthenticated callers. Defaults to `/login`. */
  loginPath?: string;
}

/**
 * Server-side gate for Pages-Router pages that previously redirected via a
 * client-side `useSession()` + `useEffect`. Eliminates the flash-of-unauth on
 * first paint: the redirect happens in the SSR response, so the browser never
 * loads the protected page's JS.
 *
 * Usage:
 *
 *   export const getServerSideProps = requireSessionSSP({ roles: ["admin"] });
 *
 * The page receives no extra props by default. If you want to pass through
 * `session` or your own props, wrap this in a higher-order gSSP.
 */
export function requireSessionSSP(options: Options = {}) {
  const { roles, loginPath = "/login" } = options;
  return async function getServerSideProps(
    ctx: GetServerSidePropsContext,
  ): Promise<GetServerSidePropsResult<{ session: Session }>> {
    // NextApi types overlap enough with the SSR req/res for getServerSession.
    const session = await getStudioServerSession(
      ctx.req as Parameters<typeof getStudioServerSession>[0],
      ctx.res as Parameters<typeof getStudioServerSession>[1],
    );

    if (!session?.user) {
      const dest = `${loginPath}?redirect=${encodeURIComponent(ctx.resolvedUrl)}`;
      return { redirect: { destination: dest, permanent: false } };
    }

    if (roles && roles.length > 0) {
      const raw = (session.user as { role?: string }).role;
      if (!roles.some((r) => hasRole(raw, r))) {
        return { redirect: { destination: loginPath, permanent: false } };
      }
    }

    // NextAuth sessions carry `user.image: undefined`, which Next refuses to
    // serialize into page props. Round-trip through JSON to drop undefined keys.
    return { props: { session: JSON.parse(JSON.stringify(session)) as Session } };
  };
}
