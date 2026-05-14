import type { NextApiRequest, NextApiResponse } from "next";
import prisma from "@/lib/prisma";

const MAX = 2000;

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") return res.status(405).end();

  const body = req.body ?? {};
  const name = String(body.name ?? "").trim();
  const email = String(body.email ?? "").trim().toLowerCase();
  const phone = String(body.phone ?? "").trim();
  const eventType = body.eventType != null ? String(body.eventType).trim().slice(0, MAX) : null;
  const eventDate = body.eventDate != null ? String(body.eventDate).trim().slice(0, 80) : null;
  const guestCount = body.guestCount != null ? String(body.guestCount).trim().slice(0, 50) : null;
  const duration = body.duration != null ? String(body.duration).trim().slice(0, 80) : null;
  const message =
    body.message != null && String(body.message).trim() !== ""
      ? String(body.message).trim().slice(0, MAX)
      : null;

  if (!name || !email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({ error: "Please enter your name and a valid email." });
  }
  if (!phone) {
    return res.status(400).json({ error: "Please enter your phone number." });
  }

  try {
    const row = await prisma.rentalInquiry.create({
      data: {
        name,
        email,
        phone,
        event_type: eventType,
        event_date: eventDate,
        guest_count: guestCount,
        duration,
        message,
        status: "new",
      },
    });
    return res.status(201).json({ id: row.id, ok: true });
  } catch (e) {
    console.error("[rental-inquiries]", e);
    return res.status(500).json({ error: "Could not save your request. Try again later." });
  }
}
