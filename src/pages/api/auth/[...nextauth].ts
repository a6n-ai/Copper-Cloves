import type { NextApiRequest, NextApiResponse } from "next";
import NextAuth from "next-auth";
import { authOptions } from "@/lib/nextAuthOptions";
import { ensureNextAuthUrlFromRequest } from "@/lib/ensureNextAuthUrlFromRequest";

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  ensureNextAuthUrlFromRequest(req);
  return NextAuth(req, res, authOptions);
}
