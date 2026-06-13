/**
 * Ensures all studio instructors exist with profile content and photos.
 * Merges duplicates (e.g. "Usha" + "Usha Rao") so each person appears once.
 */
import { config } from "dotenv";
import { resolve } from "node:path";
import type { PrismaClient } from "../src/generated/prisma/client";
import { normalizeInstructorKey } from "../src/lib/instructorIdentity";

config({ path: resolve(process.cwd(), ".env") });
config({ path: resolve(process.cwd(), ".env.local"), override: true });

const INSTRUCTORS = [
  {
    name: "Vivek",
    title: "Muay Thai Instructor",
    years_of_experience: "10",
    image_url: "/uploads/Instructor-vivek.jpg",
    philosophy:
      "Movement is meditation. Every strike, every breath is a journey inward.",
    about:
      "Vivek Prabhu brings a decade of Muay Thai expertise, honed in Thailand, and three years of Hatha Yoga practice from Sivananda Yoga Ashram.",
    specialties: ["Muay Thai", "Hatha Yoga", "Combat Conditioning"],
    certifications: [
      "Muay Thai Master Trainer (Thailand)",
      "Sivananda Yoga (200hr)",
    ],
  },
  {
    name: "Usha Rao",
    title: "WARRIOR Strength & Rhythm Instructor",
    years_of_experience: "10",
    image_url: "/uploads/Instructor-Usha.jpg",
    philosophy:
      "Fitness is not a destination, it's a lifestyle. I help you build habits that last.",
    about:
      "Usha Rao, an AFAA-certified instructor and India's only WARRIOR Master Trainer, helping people achieve sustainable fitness.",
    specialties: ["WARRIOR Strength", "WARRIOR Rhythm", "Group Fitness"],
    certifications: ["AFAA Certified", "WARRIOR Master Trainer"],
  },
  {
    name: "Akshata",
    title: "Pilates Instructor",
    years_of_experience: "5",
    image_url: "/uploads/Instructor-akshata.jpg",
    philosophy:
      "The body is a canvas. Pilates is the art of mindful movement and alignment.",
    about:
      "Akshata is India's first qualified Fletcher Pilates teacher and only Fletcher Faculty member from the country, blending dance with anatomy.",
    specialties: ["Fletcher Pilates", "Dance Conditioning", "Core Strength"],
    certifications: ["Fletcher Pilates Faculty", "Dance & Anatomy Specialist"],
  },
  {
    name: "Prachi",
    title: "Yoga Instructor",
    years_of_experience: "5",
    image_url: "/uploads/Instructor-prachi.jpg",
    philosophy:
      "Yoga is the journey of reconnecting with your true self and nature.",
    about:
      "Prachi is a certified instructor in Hatha Yoga, Aerial Yoga, Reiki, and Sound Healing, reconnecting you with nature.",
    specialties: ["Hatha Yoga", "Aerial Yoga", "Sound Healing", "Reiki"],
    certifications: ["RYT 500", "Reiki Master", "Sound Healing Practitioner"],
  },
  {
    name: "Katana",
    title: "Yoga Instructor",
    years_of_experience: "10",
    image_url: "/uploads/Instructor-Katana.jpg",
    philosophy:
      "Yoga is where precision meets artistry. Every pose tells a story.",
    about:
      "Katana is a yoga teacher, dancer, actor, and model, blending anatomical precision with creative expression.",
    specialties: ["Vinyasa Flow", "Dance Yoga", "Creative Sequencing"],
    certifications: ["E-RYT 500", "Dance & Movement Therapy"],
  },
  {
    name: "Sheral",
    title: "Fitness Instructor",
    years_of_experience: "3",
    image_url: "/uploads/Instructor-Sheral.jpg",
    philosophy: "Movement should be playful, primal, and powerful.",
    about:
      "Sheral is a Certified Animal Flow Instructor and ACE Certified Personal Trainer, encouraging playfulness and precision.",
    specialties: ["Animal Flow", "Functional Strength", "Mobility Training"],
    certifications: ["Animal Flow Level 2", "ACE Certified Personal Trainer"],
  },
  {
    name: "Gayatri",
    title: "Mat Pilates Instructor",
    years_of_experience: "4",
    image_url: "/uploads/Instructor-gayathri.jpg",
    philosophy: "Precision in movement creates transformation in the body.",
    about:
      "Gayatri is a dedicated Mat Pilates instructor focusing on precise movements and proper alignment.",
    specialties: ["Mat Pilates", "Alignment Therapy", "Core Conditioning"],
    certifications: ["STOTT Pilates Certified", "Anatomy & Biomechanics"],
  },
];

async function reassignInstructorRefs(
  prisma: PrismaClient,
  fromId: string,
  toId: string,
) {
  await prisma.classModel.updateMany({
    where: { instructor_id: fromId },
    data: { instructor_id: toId },
  });
  await prisma.classSchedule.updateMany({
    where: { instructor_id: fromId },
    data: { instructor_id: toId },
  });
}

async function removeDuplicateInstructor(
  prisma: PrismaClient,
  fromId: string,
  toId: string,
) {
  if (fromId === toId) return;
  await reassignInstructorRefs(prisma, fromId, toId);
  await prisma.instructor.delete({ where: { id: fromId } });
  console.log(`Removed duplicate instructor ${fromId} (merged into ${toId})`);
}

async function findNameMatches(prisma: PrismaClient, canonicalName: string) {
  const key = normalizeInstructorKey(canonicalName);
  return prisma.instructor.findMany({
    where: {
      OR: [
        { name: { equals: canonicalName, mode: "insensitive" } },
        { name: { startsWith: key, mode: "insensitive" } },
      ],
    },
    orderBy: { created_at: "asc" },
  });
}

async function dedupeAllInstructors(prisma: PrismaClient) {
  const all = await prisma.instructor.findMany({ orderBy: { created_at: "asc" } });
  const groups = new Map<string, typeof all>();

  for (const row of all) {
    const key = normalizeInstructorKey(row.name);
    if (!key) continue;
    const group = groups.get(key) ?? [];
    group.push(row);
    groups.set(key, group);
  }

  for (const [key, group] of groups) {
    if (group.length <= 1) continue;

    const seedRow = INSTRUCTORS.find((i) => normalizeInstructorKey(i.name) === key);
    const keeper =
      (seedRow && group.find((g) => g.name === seedRow.name)) ??
      group.find((g) => g.name.length >= Math.max(...group.map((x) => x.name.length))) ??
      group[0];

    for (const dup of group) {
      if (dup.id !== keeper.id) {
        await removeDuplicateInstructor(prisma, dup.id, keeper.id);
      }
    }
  }
}

async function main() {
  const prisma = (await import("../src/lib/prisma")).default;

  let displayOrder =
    (
      await prisma.instructor.aggregate({ _max: { display_order: true } })
    )._max.display_order ?? -1;

  for (const data of INSTRUCTORS) {
    const matches = await findNameMatches(prisma, data.name);
    const keeper =
      matches.find((m) => m.name === data.name) ?? matches[0] ?? null;

    if (keeper) {
      await prisma.instructor.update({
        where: { id: keeper.id },
        data: { ...data, display_order: keeper.display_order ?? displayOrder },
      });
      for (const dup of matches) {
        if (dup.id !== keeper.id) {
          await removeDuplicateInstructor(prisma, dup.id, keeper.id);
        }
      }
      console.log(`Updated instructor: ${data.name} (${keeper.id})`);
    } else {
      displayOrder += 1;
      const instructor = await prisma.instructor.create({
        data: { ...data, display_order: displayOrder },
      });
      console.log(`Created instructor: ${data.name} (${instructor.id})`);
    }
  }

  await dedupeAllInstructors(prisma);
  await prisma.$disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
