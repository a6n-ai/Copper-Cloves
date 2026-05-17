/**
 * Syncs instructor roster from the reference image (.llm/photos/img.png).
 * - Updates emails for 8 existing instructors
 * - Creates 13 missing instructors with name + email
 */
import { config } from "dotenv";
import { resolve } from "node:path";

config({ path: resolve(process.cwd(), ".env") });
config({ path: resolve(process.cwd(), ".env.local"), override: true });

const EMAIL_UPDATES: Record<string, string> = {
  Akshata: "Pilateswithakshata@gmail.com",
  Vivek: "vivek.86167@gmail.com",
  "Usha Rao": "urevibemath@gmail.com",
  Prachi: "Prachig411@gmail.com",
  Katana: "Rayikatana@gmail.com",
  Sheral: "Sheralpereira@gmail.com",
  Gayatri: "Gayatrishetts0910@gmail.com",
  Soundarya: "soundarya9905@gmail.com",
};

const NEW_INSTRUCTORS: { name: string; email?: string }[] = [
  { name: "Aditi", email: "aditi86@gmail.com" },
  { name: "Iris", email: "iris.socher@gmail.com" },
  { name: "Julie", email: "julianitto@gmail.com" },
  { name: "Lauren", email: "laurenjopes1911@gmail.com" },
  { name: "Sanchika", email: "arora.sanchika@gmail.com" },
  { name: "Shaleena", email: "S.shaleena@gmail.com" },
  { name: "Sukriti" },
  { name: "Sneha", email: "sneha@arvindabysneha.com" },
  { name: "Tensley", email: "Tinsleynulph@gmail.com" },
  { name: "Megha", email: "Meghahothari05@gmail.com" },
  { name: "Priya", email: "priya06ag@gmail.com" },
  { name: "Sandhya", email: "sandhya.deangelis@gmail.com" },
  { name: "Pooja", email: "poojarajpurohitofficial2@gmail.com" },
];

async function main() {
  const prisma = (await import("../src/lib/prisma")).default;

  // --- Update existing instructor emails ---
  for (const [name, email] of Object.entries(EMAIL_UPDATES)) {
    const existing = await prisma.instructor.findFirst({
      where: { name: { equals: name, mode: "insensitive" } },
    });
    if (!existing) {
      console.warn(`WARN: Could not find existing instructor "${name}" to update email`);
      continue;
    }
    if (existing.email?.toLowerCase() === email.toLowerCase()) {
      console.log(`SKIP (email unchanged): ${name}`);
      continue;
    }
    await prisma.instructor.update({ where: { id: existing.id }, data: { email } });
    console.log(`Updated email: ${name} → ${email}`);
  }

  // --- Create missing instructors ---
  const maxOrder = (
    await prisma.instructor.aggregate({ _max: { display_order: true } })
  )._max.display_order ?? 0;
  let order = maxOrder;

  for (const { name, email } of NEW_INSTRUCTORS) {
    const exists = await prisma.instructor.findFirst({
      where: { name: { equals: name, mode: "insensitive" } },
    });
    if (exists) {
      console.log(`SKIP (already exists): ${name}`);
      // Still update email if provided and different
      if (email && exists.email?.toLowerCase() !== email.toLowerCase()) {
        await prisma.instructor.update({ where: { id: exists.id }, data: { email } });
        console.log(`  → Updated email: ${email}`);
      }
      continue;
    }
    order += 1;
    const created = await prisma.instructor.create({
      data: { name, ...(email ? { email } : {}), display_order: order },
    });
    console.log(`Created: ${name} (${created.id})${email ? ` — ${email}` : ""}`);
  }

  await prisma.$disconnect();
  console.log("\nDone.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
