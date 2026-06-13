/**
 * Seeds class types, instructors, and bookable sessions for Sat 16 & Sun 17 May 2026 (IST).
 * Idempotent: safe to re-run on deploy.
 */
import { config } from "dotenv";
import { resolve } from "node:path";
import type { PrismaClient, Prisma } from "../src/generated/prisma/client";
import { normalizeInstructorKey } from "../src/lib/instructorIdentity";

config({ path: resolve(process.cwd(), ".env") });
config({ path: resolve(process.cwd(), ".env.local"), override: true });

const STUDIO_OFFSET = "+05:30";
const DEFAULT_CAPACITY = 15;

function studioDate(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
): Date {
  const pad = (n: number) => String(n).padStart(2, "0");
  return new Date(
    `${year}-${pad(month)}-${pad(day)}T${pad(hour)}:${pad(minute)}:00${STUDIO_OFFSET}`,
  );
}

const CLASS_TYPES = [
  {
    name: "Muay Thai Circuit Training",
    category: "High",
    duration: 55,
    image_url: "/muaythaicircuittraining.jpg",
    benefits: ["Power", "speed", "and conditioning"],
  },
  {
    name: "Mat Pilates by Physique 57",
    category: "Moderate",
    duration: 57,
    image_url: "/matpilates57.jpg",
    benefits: ["Signature sculpting techniques"],
  },
  {
    name: "WARRIOR Rhythm",
    category: "High",
    duration: 70,
    image_url: "/warriorrythm.jpg",
    benefits: ["Cardio meets mindful movement"],
  },
  {
    name: "Animal Flow",
    category: "Moderate",
    duration: 55,
    image_url: "/animalflow.jpg",
    benefits: ["Ground-based mobility"],
  },
  {
    name: "Sunset Yin",
    category: "Gentle",
    duration: 60,
    image_url: "/hathayoga.jpg",
    benefits: ["Evening relaxation and deep stretch"],
  },
  {
    name: "Mat Pilates",
    category: "Moderate",
    duration: 55,
    image_url: "/matpilates.jpg",
    benefits: ["Core-focused classical Pilates"],
  },
  {
    name: "Barre by Physique 57",
    category: "Moderate",
    duration: 57,
    image_url: "/Barre57.jpg",
    benefits: ["Interval overload sculpting"],
  },
  {
    name: "Fit by Physique 57",
    category: "High",
    duration: 57,
    image_url: "/fit57.jpg",
    benefits: ["Functional strength with heavy weights"],
  },
] as const;

/** Extra instructors referenced on the weekend schedule but not in seed-instructors.ts */
const EXTRA_INSTRUCTORS = [
  {
    name: "Chaitanya",
    title: "Mat Pilates Instructor",
    image_url: "/uploads/Instructor-Chaitanya.jpg",
  },
  {
    name: "Soundarya",
    title: "Yin Yoga Instructor",
    image_url: "/hathayoga.jpg",
  },
  {
    name: "Siddhartha",
    title: "Barre & FIT Instructor",
    image_url: "/uploads/Instructor-Siddarth.jpg",
  },
] as const;

type SessionSeed = {
  year: number;
  month: number;
  day: number;
  startHour: number;
  startMinute: number;
  endHour: number;
  endMinute: number;
  className: string;
  instructorKeys: string[];
};

const SESSIONS: SessionSeed[] = [
  // Saturday 16 May 2026
  {
    year: 2026,
    month: 5,
    day: 16,
    startHour: 7,
    startMinute: 45,
    endHour: 8,
    endMinute: 40,
    className: "Muay Thai Circuit Training",
    instructorKeys: ["vivek"],
  },
  {
    year: 2026,
    month: 5,
    day: 16,
    startHour: 9,
    startMinute: 0,
    endHour: 9,
    endMinute: 57,
    className: "Mat Pilates by Physique 57",
    instructorKeys: ["chaitanya"],
  },
  {
    year: 2026,
    month: 5,
    day: 16,
    startHour: 10,
    startMinute: 20,
    endHour: 11,
    endMinute: 30,
    className: "WARRIOR Rhythm",
    instructorKeys: ["usha"],
  },
  {
    year: 2026,
    month: 5,
    day: 16,
    startHour: 11,
    startMinute: 30,
    endHour: 12,
    endMinute: 25,
    className: "Animal Flow",
    instructorKeys: ["sheral"],
  },
  {
    year: 2026,
    month: 5,
    day: 16,
    startHour: 18,
    startMinute: 0,
    endHour: 19,
    endMinute: 0,
    className: "Sunset Yin",
    instructorKeys: ["soundarya"],
  },
  // Sunday 17 May 2026
  {
    year: 2026,
    month: 5,
    day: 17,
    startHour: 8,
    startMinute: 0,
    endHour: 8,
    endMinute: 55,
    className: "Mat Pilates",
    instructorKeys: ["akshata"],
  },
  {
    year: 2026,
    month: 5,
    day: 17,
    startHour: 9,
    startMinute: 30,
    endHour: 10,
    endMinute: 27,
    className: "Barre by Physique 57",
    instructorKeys: ["siddhartha", "siddarth"],
  },
  {
    year: 2026,
    month: 5,
    day: 17,
    startHour: 11,
    startMinute: 0,
    endHour: 11,
    endMinute: 57,
    className: "Fit by Physique 57",
    instructorKeys: ["siddhartha", "siddarth"],
  },
];

async function findInstructorId(
  prisma: PrismaClient,
  keys: string[],
): Promise<string | null> {
  const instructors = await prisma.instructor.findMany();
  for (const key of keys) {
    const match = instructors.find(
      (i) => normalizeInstructorKey(i.name) === key,
    );
    if (match) return match.id;
  }
  return null;
}

async function ensureClassTypes(prisma: PrismaClient) {
  const map = new Map<string, string>();

  for (const def of CLASS_TYPES) {
    let row = await prisma.classModel.findFirst({
      where: { name: { equals: def.name, mode: "insensitive" } },
    });
    if (!row) {
      row = await prisma.classModel.create({
        data: {
          name: def.name,
          category: def.category,
          duration: def.duration,
          max_capacity: DEFAULT_CAPACITY,
          image_url: def.image_url,
          benefits: [...def.benefits],
        },
      });
      console.log(`Created class type: ${def.name}`);
    } else {
      row = await prisma.classModel.update({
        where: { id: row.id },
        data: {
          category: def.category,
          duration: def.duration,
          image_url: def.image_url,
          benefits: [...def.benefits],
        },
      });
    }
    map.set(def.name.toLowerCase(), row.id);
  }

  return map;
}

async function ensureExtraInstructors(prisma: PrismaClient) {
  for (const def of EXTRA_INSTRUCTORS) {
    const existing = await prisma.instructor.findFirst({
      where: { name: { equals: def.name, mode: "insensitive" } },
    });
    if (existing) {
      await prisma.instructor.update({
        where: { id: existing.id },
        data: {
          title: def.title,
          image_url: def.image_url,
        },
      });
      console.log(`Updated instructor: ${def.name}`);
    } else {
      await prisma.instructor.create({
        data: {
          name: def.name,
          title: def.title,
          image_url: def.image_url,
          specialties: [],
          certifications: [],
        },
      });
      console.log(`Created instructor: ${def.name}`);
    }
  }
}

async function ensureSessions(
  prisma: PrismaClient,
  classIds: Map<string, string>,
) {
  for (const session of SESSIONS) {
    const classId = classIds.get(session.className.toLowerCase());
    if (!classId) {
      console.warn(`Skipping session — class not found: ${session.className}`);
      continue;
    }

    const startTime = studioDate(
      session.year,
      session.month,
      session.day,
      session.startHour,
      session.startMinute,
    );
    const endTime = studioDate(
      session.year,
      session.month,
      session.day,
      session.endHour,
      session.endMinute,
    );

    const instructorId = await findInstructorId(prisma, session.instructorKeys);

    const existing = await prisma.classSchedule.findFirst({
      where: { class_id: classId, start_time: startTime },
    });

    const payload = {
      class_id: classId,
      instructor_id: instructorId,
      start_time: startTime,
      end_time: endTime,
      capacity: DEFAULT_CAPACITY,
      available_spots: DEFAULT_CAPACITY,
      current_bookings: 0,
      status: "available" as const,
    } satisfies Prisma.ClassScheduleUncheckedCreateInput;

    if (existing) {
      await prisma.classSchedule.update({
        where: { id: existing.id },
        data: payload,
      });
      console.log(
        `Updated session: ${session.className} ${startTime.toISOString()}`,
      );
    } else {
      await prisma.classSchedule.create({ data: payload });
      console.log(
        `Created session: ${session.className} ${startTime.toISOString()}`,
      );
    }
  }
}

async function main() {
  const prisma = (await import("../src/lib/prisma")).default;
  const classIds = await ensureClassTypes(prisma);
  await ensureExtraInstructors(prisma);
  await ensureSessions(prisma, classIds);
  await prisma.$disconnect();
  console.log("\nWeekend schedule (16–17 May 2026) is ready for booking.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
