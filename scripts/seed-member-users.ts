/**
 * Seeds studio member accounts with packages (idempotent by email).
 * Default password: Qwerty@123 (override with MEMBER_SEED_PASSWORD).
 */
import { config } from "dotenv";
import { resolve } from "node:path";
import bcrypt from "bcryptjs";
import type { PrismaClient } from "../src/generated/prisma/client";
import { normalizeLoginEmail } from "../src/lib/loginEmail";

config({ path: resolve(process.cwd(), ".env") });
config({ path: resolve(process.cwd(), ".env.local"), override: true });

const DEFAULT_PASSWORD = process.env.MEMBER_SEED_PASSWORD || "Qwerty@123";

type MemberRow = {
  full_name: string;
  email: string;
  phone: string | null;
  membership: "Studio Class Pass" | "Premium Studio Class Pass";
  sessionsLeft: number | "unlimited";
  startDate: string;
  endDate: string;
};

const MEMBERS: MemberRow[] = [
  {
    full_name: "AMRIT SAHU",
    email: "amritsahu.iitkgp@gmail.com",
    phone: null,
    membership: "Studio Class Pass",
    sessionsLeft: 11,
    startDate: "11 May 2026",
    endDate: "10 Jul 2026",
  },
  {
    full_name: "Aarohi Sarma",
    email: "aarohisarma@gmail.com",
    phone: "918884211499",
    membership: "Premium Studio Class Pass",
    sessionsLeft: "unlimited",
    startDate: "31 Mar 2026",
    endDate: "29 Jun 2026",
  },
  {
    full_name: "Banerjee Banerjee",
    email: "banerjeeronita9@gmail.com",
    phone: null,
    membership: "Premium Studio Class Pass",
    sessionsLeft: "unlimited",
    startDate: "16 Apr 2026",
    endDate: "13 Oct 2026",
  },
  {
    full_name: "Malaika K",
    email: "malaikak19@gmail.com",
    phone: "917483551342",
    membership: "Studio Class Pass",
    sessionsLeft: 7,
    startDate: "02 May 2026",
    endDate: "1 Jul 2026",
  },
  {
    full_name: "Meghana Santosh",
    email: "meghanasantosh1998@gmail.com",
    phone: null,
    membership: "Premium Studio Class Pass",
    sessionsLeft: 6,
    startDate: "01 May 2026",
    endDate: "15 Jun 2026",
  },
  {
    full_name: "Samyukta Ranganathan",
    email: "samyukta.ranganathan@gmail.com",
    phone: null,
    membership: "Premium Studio Class Pass",
    sessionsLeft: 10,
    startDate: "22 Apr 2026",
    endDate: "21 Jun 2026",
  },
];

function parseDate(value: string): Date {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) {
    throw new Error(`Invalid date: ${value}`);
  }
  d.setHours(23, 59, 59, 999);
  return d;
}

function parseStartDate(value: string): Date {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) {
    throw new Error(`Invalid date: ${value}`);
  }
  d.setHours(0, 0, 0, 0);
  return d;
}

function normalizePhone(phone: string | null): string | null {
  if (!phone?.trim()) return null;
  const digits = phone.replace(/\D/g, "");
  if (!digits) return null;
  if (digits.length === 12 && digits.startsWith("91")) return `+${digits}`;
  if (digits.length === 10) return `+91${digits}`;
  return phone.trim();
}

async function ensurePackageTypes(prisma: PrismaClient) {
  const defs = [
    {
      name: "Studio Class Pass",
      type: "class_pass",
      is_unlimited: false,
      class_count: 12,
      duration_months: 2,
      price: "12000",
    },
    {
      name: "Premium Studio Class Pass",
      type: "class_pass",
      is_unlimited: false,
      class_count: 12,
      duration_months: 3,
      price: "18000",
    },
    {
      name: "Premium Studio Class Pass (Unlimited)",
      type: "studio_pass",
      is_unlimited: true,
      class_count: null as number | null,
      duration_months: 3,
      price: "25000",
    },
  ];

  const map = new Map<string, string>();

  for (const def of defs) {
    let row = await prisma.packageType.findFirst({
      where: { name: { equals: def.name, mode: "insensitive" } },
    });
    if (!row) {
      row = await prisma.packageType.create({
        data: {
          name: def.name,
          type: def.type,
          is_unlimited: def.is_unlimited,
          class_count: def.class_count,
          duration_months: def.duration_months,
          price: def.price,
          description: def.name,
        },
      });
      console.log(`Created package type: ${def.name}`);
    } else {
      row = await prisma.packageType.update({
        where: { id: row.id },
        data: {
          type: def.type,
          is_unlimited: def.is_unlimited,
          class_count: def.class_count,
          duration_months: def.duration_months,
        },
      });
    }
    map.set(def.name.toLowerCase(), row.id);
  }

  return map;
}

function resolvePackageTypeId(
  member: MemberRow,
  packageIds: Map<string, string>,
): { packageTypeId: string; pass_type: "studio_pass" | "class_pass"; isUnlimited: boolean } {
  if (member.sessionsLeft === "unlimited") {
    const id = packageIds.get("premium studio class pass (unlimited)");
    if (!id) throw new Error("Missing Premium Studio Class Pass (Unlimited) package type");
    return { packageTypeId: id, pass_type: "studio_pass", isUnlimited: true };
  }
  if (member.membership === "Studio Class Pass") {
    const id = packageIds.get("studio class pass");
    if (!id) throw new Error("Missing Studio Class Pass package type");
    return { packageTypeId: id, pass_type: "class_pass", isUnlimited: false };
  }
  const id = packageIds.get("premium studio class pass");
  if (!id) throw new Error("Missing Premium Studio Class Pass package type");
  return { packageTypeId: id, pass_type: "class_pass", isUnlimited: false };
}

async function upsertMember(
  prisma: PrismaClient,
  member: MemberRow,
  packageIds: Map<string, string>,
  passwordHash: string,
) {
  const email = normalizeLoginEmail(member.email);
  const phone = normalizePhone(member.phone);
  const startDate = parseStartDate(member.startDate);
  const expirationDate = parseDate(member.endDate);
  const { packageTypeId: actualPackageTypeId, pass_type, isUnlimited } =
    resolvePackageTypeId(member, packageIds);

  const credits =
    member.sessionsLeft === "unlimited"
      ? null
      : Math.max(0, Math.floor(member.sessionsLeft));

  let profile = await prisma.profile.findFirst({ where: { email, role: "user" } });

  if (profile) {
    profile = await prisma.profile.update({
      where: { id: profile.id },
      data: {
        full_name: member.full_name,
        phone,
        hashedPassword: passwordHash,
        role: "user",
        pass_type,
      },
    });
    console.log(`Updated profile: ${email}`);
  } else {
    profile = await prisma.profile.create({
      data: {
        email,
        full_name: member.full_name,
        phone,
        hashedPassword: passwordHash,
        role: "user",
        pass_type,
      },
    });
    console.log(`Created profile: ${email}`);
  }

  await prisma.userPackage.updateMany({
    where: { user_id: profile.id, is_active: true },
    data: { is_active: false },
  });

  const existingActive = await prisma.userPackage.findFirst({
    where: {
      user_id: profile.id,
      package_type_id: actualPackageTypeId,
      expiration_date: expirationDate,
    },
    orderBy: { created_at: "desc" },
  });

  const pkgData = {
    user_id: profile.id,
    package_type_id: actualPackageTypeId,
    credits_remaining: isUnlimited ? null : credits,
    credits_total: isUnlimited ? null : credits,
    expiration_date: expirationDate,
    purchase_date: startDate,
    is_active: true,
    is_paused: false,
    pass_type,
  };

  if (existingActive) {
    await prisma.userPackage.update({
      where: { id: existingActive.id },
      data: pkgData,
    });
    console.log(`  ↳ Updated package (${member.membership}, ${member.sessionsLeft} sessions)`);
  } else {
    await prisma.userPackage.create({ data: pkgData });
    console.log(`  ↳ Created package (${member.membership}, ${member.sessionsLeft} sessions)`);
  }
}

async function main() {
  const prisma = (await import("../src/lib/prisma")).default;
  const passwordHash = await bcrypt.hash(DEFAULT_PASSWORD, 12);
  const packageIds = await ensurePackageTypes(prisma);

  for (const member of MEMBERS) {
    await upsertMember(prisma, member, packageIds, passwordHash);
  }

  await prisma.$disconnect();

  console.log("");
  console.log("Member accounts ready (portal login at /portal/login):");
  console.log(`  Password for all: ${DEFAULT_PASSWORD}`);
  for (const m of MEMBERS) {
    console.log(`  • ${m.email}`);
  }
  console.log("");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
