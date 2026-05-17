import { config } from "dotenv";
import { resolve } from "node:path";

config({ path: resolve(process.cwd(), ".env") });
config({ path: resolve(process.cwd(), ".env.local"), override: true });

async function main() {
  const prisma = (await import("../src/lib/prisma")).default;

  const schedules = await prisma.classSchedule.findMany({
    orderBy: { start_time: "desc" },
    take: 10,
    include: {
      class_model: { select: { name: true } },
      instructor: { select: { name: true, email: true } },
    },
  });

  console.log(`\nTotal recent schedules: ${schedules.length}\n`);
  for (const s of schedules) {
    console.log({
      id: s.id.slice(0, 8),
      class: s.class_model?.name ?? "(no class)",
      start_time: s.start_time,
      status: s.status,
      instructor: s.instructor?.name ?? "NONE",
      instructor_id: s.instructor_id ?? "NULL",
      capacity: s.capacity,
      available_spots: s.available_spots,
      current_bookings: s.current_bookings,
    });
  }

  // Also check today's schedules specifically
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const todayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);

  const todaySchedules = await prisma.classSchedule.findMany({
    where: { start_time: { gte: todayStart, lt: todayEnd } },
    include: { class_model: { select: { name: true } }, instructor: { select: { name: true } } },
  });
  console.log(`\nToday's schedules (${todayStart.toDateString()}): ${todaySchedules.length}`);
  for (const s of todaySchedules) {
    console.log(` - ${s.class_model?.name} at ${s.start_time.toTimeString().slice(0,5)} | instructor: ${s.instructor?.name ?? "NONE"} | status: ${s.status}`);
  }

  await prisma.$disconnect();
}

main().catch((e) => { console.error(e); process.exit(1); });
