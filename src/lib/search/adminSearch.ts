// src/lib/search/adminSearch.ts
import prisma from "@/lib/prisma";
import type { Prisma } from "@/generated/prisma/client";
import { PaymentMethod } from "@/generated/prisma/client";
import { SEARCH_TAKE, type SearchGroup, type SearchItem } from "./types";

const ALL_PAYMENT_METHODS = Object.values(PaymentMethod);

const ci = (q: string): Prisma.StringFilter => ({ contains: q, mode: "insensitive" });
const rupees = (paise: number) => `₹${(paise / 100).toLocaleString("en-IN")}`;
const fmtDate = (d: Date) =>
  d.toLocaleString("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });

async function members(q: string): Promise<SearchItem[]> {
  const rows = await prisma.profile.findMany({
    where: {
      role: "user",
      OR: [{ full_name: ci(q) }, { email: ci(q) }, { phone: ci(q) }],
    },
    select: { id: true, full_name: true, email: true, phone: true },
    take: SEARCH_TAKE,
    orderBy: { full_name: "asc" },
  });
  return rows.map((r) => ({
    id: r.id,
    type: "member",
    title: r.full_name || r.email,
    subtitle: [r.email, r.phone].filter(Boolean).join(" · "),
    href: `/admin/members/${r.id}`,
  }));
}

async function schedules(q: string): Promise<SearchItem[]> {
  const rows = await prisma.classSchedule.findMany({
    where: { class_model: { name: ci(q) } },
    select: {
      id: true,
      start_time: true,
      current_bookings: true,
      capacity: true,
      class_model: { select: { name: true } },
    },
    take: SEARCH_TAKE,
    orderBy: { start_time: "desc" },
  });
  return rows.map((r) => ({
    id: r.id,
    type: "schedule",
    title: r.class_model?.name ?? "Class",
    subtitle: `${fmtDate(r.start_time)} · ${r.current_bookings}/${r.capacity ?? "—"} booked`,
    href: `/admin/schedule/${r.id}`,
  }));
}

async function payments(q: string): Promise<SearchItem[]> {
  const amount = Number(q.replace(/[^0-9]/g, ""));
  const ql = q.toLowerCase();
  const matchedMethods = ALL_PAYMENT_METHODS.filter((m) => m.includes(ql));
  const or: Prisma.PaymentWhereInput[] = [
    { payee: ci(q) },
    { reference: ci(q) },
    { razorpay_payment_id: ci(q) },
  ];
  if (matchedMethods.length > 0) or.push({ method: { in: matchedMethods } });
  if (!Number.isNaN(amount) && amount > 0) or.push({ amount_paise: amount * 100 });
  const rows = await prisma.payment.findMany({
    where: { OR: or },
    select: { id: true, amount_paise: true, payee: true, method: true, created_at: true },
    take: SEARCH_TAKE,
    orderBy: { created_at: "desc" },
  });
  return rows.map((r) => ({
    id: r.id,
    type: "payment",
    title: `${rupees(r.amount_paise)}${r.payee ? ` · ${r.payee}` : ""}`,
    subtitle: `${r.method} · ${fmtDate(r.created_at)}`,
    href: `/admin/finances`,
  }));
}

async function products(q: string): Promise<SearchItem[]> {
  const rows = await prisma.retailProduct.findMany({
    where: { OR: [{ name: ci(q) }, { category: ci(q) }] },
    select: { id: true, name: true, category: true },
    take: SEARCH_TAKE,
  });
  return rows.map((r) => ({
    id: r.id, type: "product", title: r.name, subtitle: r.category, href: `/admin/products`,
  }));
}

async function cafe(q: string): Promise<SearchItem[]> {
  const rows = await prisma.cafeItem.findMany({
    where: { OR: [{ name: ci(q) }, { category: ci(q) }] },
    select: { id: true, name: true, category: true },
    take: SEARCH_TAKE,
  });
  return rows.map((r) => ({
    id: r.id, type: "cafe", title: r.name, subtitle: r.category, href: `/admin/cafe`,
  }));
}

async function partners(q: string): Promise<SearchItem[]> {
  const rows = await prisma.partner.findMany({
    where: { name: ci(q) },
    select: { id: true, name: true, description: true },
    take: SEARCH_TAKE,
  });
  return rows.map((r) => ({
    id: r.id, type: "partner", title: r.name, subtitle: r.description ?? "Partner", href: `/admin/partners`,
  }));
}

async function instructors(q: string): Promise<SearchItem[]> {
  const rows = await prisma.instructor.findMany({
    where: { OR: [{ name: ci(q) }, { email: ci(q) }, { title: ci(q) }] },
    select: { id: true, name: true, title: true },
    take: SEARCH_TAKE,
  });
  return rows.map((r) => ({
    id: r.id, type: "instructor", title: r.name, subtitle: r.title ?? "Instructor", href: `/admin/control`,
  }));
}

async function bookings(q: string): Promise<SearchItem[]> {
  const rows = await prisma.booking.findMany({
    where: { OR: [{ class_name: ci(q) }, { email: ci(q) }] },
    select: { id: true, class_name: true, status: true, booking_date: true, class_schedule_id: true, email: true },
    take: SEARCH_TAKE,
    orderBy: { booking_date: "desc" },
  });
  return rows.map((r) => ({
    id: r.id,
    type: "booking",
    title: r.class_name || "Booking",
    subtitle: `${r.email ?? ""} · ${r.status}`.trim(),
    href: r.class_schedule_id ? `/admin/schedule/${r.class_schedule_id}` : `/admin/schedule`,
  }));
}

const GROUP_LABELS: Record<string, string> = {
  member: "Members",
  schedule: "Classes & Schedules",
  payment: "Payments",
  product: "Products",
  cafe: "Café",
  partner: "Partners",
  instructor: "Instructors",
  booking: "Bookings",
};

export async function adminSearch(q: string): Promise<SearchGroup[]> {
  const [mem, sch, pay, prod, caf, part, inst, book] = await Promise.all([
    members(q), schedules(q), payments(q), products(q), cafe(q), partners(q), instructors(q), bookings(q),
  ]);
  const byType: Array<[string, SearchItem[]]> = [
    ["member", mem], ["schedule", sch], ["payment", pay], ["product", prod],
    ["cafe", caf], ["partner", part], ["instructor", inst], ["booking", book],
  ];
  return byType
    .filter(([, items]) => items.length > 0)
    .map(([type, items]) => ({ type, label: GROUP_LABELS[type], items }));
}
