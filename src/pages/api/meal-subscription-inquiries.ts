import type { NextApiRequest, NextApiResponse } from "next";
import prisma from "@/lib/prisma";
import { apiError } from "@/lib/apiError";

const MAX_NAME = 200;
const MAX_EMAIL = 320;
const MAX_PHONE = 50;
const MAX_MESSAGE = 8000;

function isValidEmail(s: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    res.status(405).end();
    return;
  }

  const body = req.body ?? {};
  const full_name = String(body.full_name ?? body.fullName ?? "").trim();
  const email = String(body.email ?? "").trim().toLowerCase();
  const phone = String(body.phone ?? "").trim();
  const message =
    body.message != null && String(body.message).trim() !== ""
      ? String(body.message).trim().slice(0, MAX_MESSAGE)
      : null;

  if (!full_name || full_name.length > MAX_NAME) {
    res.status(400).json({ error: "Please enter your full name." });
    return;
  }
  if (!email || email.length > MAX_EMAIL || !isValidEmail(email)) {
    res.status(400).json({ error: "Please enter a valid email address." });
    return;
  }
  if (!phone || phone.length > MAX_PHONE) {
    res.status(400).json({ error: "Please enter your phone number." });
    return;
  }

  try {
    const row = await prisma.mealSubscriptionInquiry.create({
      data: {
        full_name,
        email,
        phone,
        message,
        status: "new",
        source: "meal_subscription_waitlist",
      },
    });
    res.status(201).json({ id: row.id, ok: true });
  } catch (e) {
    return apiError(res, e, "[meal-subscription-inquiries]", 500, "Could not save your request. Try again later.");
  }
}
