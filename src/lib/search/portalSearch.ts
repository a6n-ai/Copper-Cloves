// src/lib/search/portalSearch.ts
import prisma from "@/lib/prisma";
import type { Prisma } from "@/generated/prisma/client";
import { SEARCH_TAKE, type SearchGroup, type SearchItem, type SearchScope } from "./types";

const ci = (q: string): Prisma.StringFilter => ({ contains: q, mode: "insensitive" });
const fmtDate = (d: Date) =>
  d.toLocaleString("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });

function group(type: string, label: string, items: SearchItem[]): SearchGroup[] {
  return items.length ? [{ type, label, items }] : [];
}

export async function memberSearch(q: string, scope: SearchScope): Promise<SearchGroup[]> {
  const now = new Date();
  const [schedules, packages, cafe, bookings] = await Promise.all([
    prisma.classSchedule.findMany({
      where: { class_model: { name: ci(q) }, start_time: { gte: now } },
      select: { id: true, start_time: true, class_model: { select: { name: true } } },
      take: SEARCH_TAKE, orderBy: { start_time: "asc" },
    }),
    prisma.packageType.findMany({
      where: { name: ci(q) },
      select: { id: true, name: true, type: true }, take: SEARCH_TAKE,
    }),
    prisma.cafeItem.findMany({
      where: { is_available: true, OR: [{ name: ci(q) }, { category: ci(q) }] },
      select: { id: true, name: true, category: true }, take: SEARCH_TAKE,
    }),
    prisma.booking.findMany({
      where: { user_id: scope.userId, class_name: ci(q) },
      select: { id: true, class_name: true, status: true, booking_date: true },
      take: SEARCH_TAKE, orderBy: { booking_date: "desc" },
    }),
  ]);
  return [
    ...group("schedule", "Classes", schedules.map((r) => ({
      id: r.id, type: "schedule", title: r.class_model?.name ?? "Class",
      subtitle: fmtDate(r.start_time), href: "/portal/book",
    }))),
    ...group("package", "Packages", packages.map((r) => ({
      id: r.id, type: "package", title: r.name, subtitle: r.type ?? "Pass", href: "/portal/packages",
    }))),
    ...group("cafe", "Café", cafe.map((r) => ({
      id: r.id, type: "cafe", title: r.name, subtitle: r.category, href: "/portal/menu",
    }))),
    ...group("booking", "My Bookings", bookings.map((r) => ({
      id: r.id, type: "booking", title: r.class_name ?? "Booking", subtitle: r.status, href: "/portal/bookings",
    }))),
  ];
}

export async function instructorSearch(q: string, scope: SearchScope): Promise<SearchGroup[]> {
  if (!scope.instructorId) return [];
  const schedules = await prisma.classSchedule.findMany({
    where: { class_model: { name: ci(q) }, instructor_id: scope.instructorId },
    select: { id: true, start_time: true, class_model: { select: { name: true } } },
    take: SEARCH_TAKE, orderBy: { start_time: "desc" },
  });
  return group("schedule", "My Classes", schedules.map((r) => ({
    id: r.id, type: "schedule", title: r.class_model?.name ?? "Class",
    subtitle: fmtDate(r.start_time), href: "/instructor/dashboard",
  })));
}

export async function partnerSearch(q: string, scope: SearchScope): Promise<SearchGroup[]> {
  if (!scope.partnerId) return [];
  const schedules = await prisma.classSchedule.findMany({
    where: { class_model: { name: ci(q), partner_id: scope.partnerId } },
    select: { id: true, start_time: true, class_model: { select: { name: true } } },
    take: SEARCH_TAKE, orderBy: { start_time: "desc" },
  });
  return group("schedule", "Classes", schedules.map((r) => ({
    id: r.id, type: "schedule", title: r.class_model?.name ?? "Class",
    subtitle: fmtDate(r.start_time), href: "/partner/classes",
  })));
}
