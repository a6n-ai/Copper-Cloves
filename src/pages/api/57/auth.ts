import type { NextApiRequest, NextApiResponse } from "next";
import {
  checkP57Credentials,
  clearP57Cookie,
  createP57Token,
  getP57Session,
  setP57Cookie,
} from "@/lib/p57Auth";

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method === "POST") {
    const { username, password } = req.body ?? {};
    if (!checkP57Credentials(username, password)) {
      return res.status(401).json({ error: "Invalid username or password" });
    }
    setP57Cookie(res, createP57Token());
    return res.json({ ok: true });
  }

  if (req.method === "GET") {
    const session = getP57Session(req);
    if (!session) return res.status(401).json({ error: "Not authenticated" });
    return res.json({ user: session.user });
  }

  if (req.method === "DELETE") {
    clearP57Cookie(res);
    return res.json({ ok: true });
  }

  return res.status(405).end();
}
