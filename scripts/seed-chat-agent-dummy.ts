/**
 * One-off, local-only dummy data for the exercise chat agent MCP tool smoke test
 * (monarch/.llm/phases.md Phase 0/1). NOT committed — synthetic test members only,
 * no real customer data. Point DATABASE_URL/STUDIO_DATABASE_URL at the monarch
 * docker-compose Postgres before running:
 *
 *   DATABASE_URL="postgresql://copper:copper_dev@127.0.0.1:5433/copperandcloves?schema=public" \
 *   STUDIO_DATABASE_URL="postgresql://copper:copper_dev@127.0.0.1:5433/copperandcloves?schema=public" \
 *   npx tsx scripts/seed-chat-agent-dummy.ts
 *
 * Idempotent-ish: upserts by email / natural key, safe to re-run.
 */
import { config } from "dotenv";
import { resolve } from "node:path";
import { normalizeLoginEmail } from "../src/lib/loginEmail";
import { attachStudioCredential } from "../src/lib/auth/studioIdentity";

config({ path: resolve(process.cwd(), ".env") });
config({ path: resolve(process.cwd(), ".env.local"), override: true });

const TEST_PASSWORD = "ChatAgentTest@123";
const TEST3_PASSWORD = "CoachDemo@456";

const TEST_MEMBERS: { email: string; full_name: string; password?: string }[] = [
  { email: "chat.agent.test1@example.com", full_name: "Test Member One" },
  { email: "chat.agent.test2@example.com", full_name: "Test Member Two" },
  { email: "chat.agent.test3@example.com", full_name: "Test Member Three", password: TEST3_PASSWORD },
];

function atHour(daysFromNow: number, hour: number, minute = 0): Date {
  const d = new Date();
  d.setDate(d.getDate() + daysFromNow);
  d.setHours(hour, minute, 0, 0);
  return d;
}

async function main() {
  const prisma = (await import("../src/lib/prisma")).default;

  // --- Package type ---
  let packageType = await prisma.packageType.findFirst({
    where: { name: "Chat Agent Test Pass" },
  });
  if (!packageType) {
    packageType = await prisma.packageType.create({
      data: {
        name: "Chat Agent Test Pass",
        type: "class_pass",
        class_count: 12,
        duration_months: 2,
        price: "12000",
        description: "Synthetic package for local chat-agent smoke testing.",
        is_published: false,
      },
    });
  }
  console.log(`Package type: ${packageType.id}`);

  // --- Instructor (reuse seeded roster) ---
  const yogaInstructor = await prisma.instructor.findFirst({ where: { name: "Prachi" } });
  const meditationInstructor = await prisma.instructor.findFirst({ where: { name: "Katana" } });
  if (!yogaInstructor || !meditationInstructor) {
    throw new Error("Run scripts/seed-instructors.ts first — expected Prachi + Katana.");
  }

  // --- Class types ---
  async function ensureClassModel(name: string, category: string, duration: number, instructorId: string) {
    let row = await prisma.classModel.findFirst({ where: { name } });
    if (!row) {
      row = await prisma.classModel.create({
        data: { name, category, duration, instructor_id: instructorId, max_capacity: 15 },
      });
      console.log(`Created class type: ${name} (${row.id})`);
    }
    return row;
  }

  const yogaClass = await ensureClassModel("Morning Vinyasa Flow", "Gentle", 60, yogaInstructor.id);
  const meditationClass = await ensureClassModel("Evening Meditation", "Gentle", 45, meditationInstructor.id);

  // --- Class schedules: 4 past (for streak/attendance history) + 4 upcoming ---
  async function ensureSchedule(classId: string, instructorId: string, start: Date, durationMin: number, status: "completed" | "available") {
    const end = new Date(start.getTime() + durationMin * 60_000);
    let row = await prisma.classSchedule.findFirst({ where: { class_id: classId, start_time: start } });
    if (!row) {
      row = await prisma.classSchedule.create({
        data: {
          class_id: classId,
          instructor_id: instructorId,
          start_time: start,
          end_time: end,
          capacity: 15,
          available_spots: status === "completed" ? 14 : 12,
          current_bookings: status === "completed" ? 1 : 3,
          status,
        },
      });
      console.log(`Created schedule: ${start.toISOString()} (${row.id}) [${status}]`);
    }
    return row;
  }

  const pastSchedules = [
    await ensureSchedule(yogaClass.id, yogaInstructor.id, atHour(-14, 7, 0), 60, "completed"),
    await ensureSchedule(meditationClass.id, meditationInstructor.id, atHour(-10, 18, 30), 45, "completed"),
    await ensureSchedule(yogaClass.id, yogaInstructor.id, atHour(-7, 7, 0), 60, "completed"),
    await ensureSchedule(meditationClass.id, meditationInstructor.id, atHour(-3, 18, 30), 45, "completed"),
  ];

  const upcomingSchedules = [
    await ensureSchedule(yogaClass.id, yogaInstructor.id, atHour(1, 7, 0), 60, "available"),
    await ensureSchedule(meditationClass.id, meditationInstructor.id, atHour(2, 18, 30), 45, "available"),
    await ensureSchedule(yogaClass.id, yogaInstructor.id, atHour(4, 7, 0), 60, "available"),
    await ensureSchedule(meditationClass.id, meditationInstructor.id, atHour(6, 18, 30), 45, "available"),
  ];

  // --- Badge template ---
  let badgeTemplate = await prisma.badgeTemplate.findFirst({ where: { name: "First Steps" } });
  if (!badgeTemplate) {
    badgeTemplate = await prisma.badgeTemplate.create({
      data: {
        name: "First Steps",
        description: "Attended your first 3 classes.",
        badge_type: "path_to_mastery",
        icon: "🌱",
        color: "#7C9070",
        threshold_classes: 3,
      },
    });
    console.log(`Created badge template: ${badgeTemplate.id}`);
  }

  // --- Members ---
  for (const [i, member] of TEST_MEMBERS.entries()) {
    const email = normalizeLoginEmail(member.email);

    let profile = await prisma.profile.findFirst({ where: { email, role: "user" } });
    if (!profile) {
      profile = await prisma.profile.create({
        data: { email, full_name: member.full_name, role: "user", pass_type: "class_pass" },
      });
      console.log(`Created profile: ${email} (${profile.id})`);
    }
    await attachStudioCredential({ profileId: profile.id, password: member.password ?? TEST_PASSWORD, overwrite: true });

    // Active package
    const existingPkg = await prisma.userPackage.findFirst({
      where: { user_id: profile.id, package_type_id: packageType.id, is_active: true },
    });
    if (!existingPkg) {
      await prisma.userPackage.create({
        data: {
          user_id: profile.id,
          package_type_id: packageType.id,
          credits_remaining: 8,
          credits_total: 12,
          expiration_date: atHour(60, 23, 59),
          purchase_date: atHour(-30, 9, 0),
          is_active: true,
          pass_type: "class_pass",
        },
      });
      console.log(`  Created active package for ${email}`);
    }

    // Past bookings (attended) — only for member 1, member 2 stays a fresh/no-history case
    if (i === 0) {
      for (const sched of pastSchedules) {
        const existing = await prisma.booking.findFirst({
          where: { user_id: profile.id, class_schedule_id: sched.id },
        });
        if (!existing) {
          await prisma.booking.create({
            data: {
              user_id: profile.id,
              class_schedule_id: sched.id,
              status: "confirmed",
              booking_date: new Date(sched.start_time.getTime() - 2 * 24 * 60 * 60_000),
            },
          });
        }
      }

      await prisma.userStats.upsert({
        where: { user_id: profile.id },
        create: {
          user_id: profile.id,
          total_classes_attended: pastSchedules.length,
          current_streak: 4,
          longest_streak: 4,
          last_class_date: pastSchedules[pastSchedules.length - 1].start_time,
        },
        update: {
          total_classes_attended: pastSchedules.length,
          current_streak: 4,
          longest_streak: 4,
          last_class_date: pastSchedules[pastSchedules.length - 1].start_time,
        },
      });
      await prisma.userStreak.upsert({
        where: { user_id: profile.id },
        create: {
          user_id: profile.id,
          current_streak: 4,
          longest_streak: 4,
          last_class_date: pastSchedules[pastSchedules.length - 1].start_time,
          last_attendance_date: pastSchedules[pastSchedules.length - 1].start_time,
        },
        update: {
          current_streak: 4,
          longest_streak: 4,
          last_class_date: pastSchedules[pastSchedules.length - 1].start_time,
          last_attendance_date: pastSchedules[pastSchedules.length - 1].start_time,
        },
      });

      const existingBadge = await prisma.userBadge.findFirst({
        where: { user_id: profile.id, badge_template_id: badgeTemplate.id },
      });
      if (!existingBadge) {
        await prisma.userBadge.create({
          data: {
            user_id: profile.id,
            badge_name: badgeTemplate.name,
            badge_description: badgeTemplate.description,
            badge_template_id: badgeTemplate.id,
            badge_type: "path_to_mastery",
            icon: badgeTemplate.icon,
            color: badgeTemplate.color,
            total_classes: pastSchedules.length,
          },
        });
        console.log(`  Awarded badge to ${email}`);
      }

      for (const sched of pastSchedules.slice(-2)) {
        await prisma.userActivityEvent.create({
          data: {
            visitor_id: profile.id,
            profile_id: profile.id,
            event_name: "class_attended",
            event_category: "engagement",
            entity_type: "class_schedule",
            entity_id: sched.id,
          },
        });
      }
    }

    // Upcoming booking for both members (one class each)
    const upcoming = upcomingSchedules[i % upcomingSchedules.length];
    const existingUpcoming = await prisma.booking.findFirst({
      where: { user_id: profile.id, class_schedule_id: upcoming.id },
    });
    if (!existingUpcoming) {
      await prisma.booking.create({
        data: {
          user_id: profile.id,
          class_schedule_id: upcoming.id,
          status: "confirmed",
        },
      });
      console.log(`  Booked upcoming class for ${email}: ${upcoming.start_time.toISOString()}`);
    }
  }

  await prisma.$disconnect();
  console.log("");
  console.log("Chat-agent dummy data ready. Test logins (portal /login):");
  for (const m of TEST_MEMBERS) console.log(`  • ${m.email} / ${m.password ?? TEST_PASSWORD}`);
  console.log("");
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
