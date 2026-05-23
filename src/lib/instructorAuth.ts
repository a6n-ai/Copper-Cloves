import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";

export interface InstructorSession {
  instructorId: string;
  profileId: string;
  name: string | null;
  email: string | null;
}

/**
 * Resolve the signed-in instructor from the unified NextAuth session.
 * Returns null unless the session has role "instructor" and a linked
 * Instructor record (session.user.instructor_id).
 */
export async function getInstructorSession(
  req: NextApiRequest,
  res: NextApiResponse,
): Promise<InstructorSession | null> {
  const session = await getServerSession(req, res, authOptions);
  const user = session?.user as
    | { id?: string; name?: string | null; email?: string | null; role?: string; instructor_id?: string | null }
    | undefined;

  if (!user || user.role !== "instructor" || !user.instructor_id) return null;

  return {
    instructorId: user.instructor_id,
    profileId: user.id ?? "",
    name: user.name ?? null,
    email: user.email ?? null,
  };
}
