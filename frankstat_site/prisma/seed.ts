/**
 * prisma/seed.ts
 * Seeds the admin account + existing rex staff account.
 * Run: npx prisma db seed
 *
 * package.json → "prisma": { "seed": "tsx prisma/seed.ts" }
 */
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function upsertUser(data: {
  email: string; password: string; fullName: string;
  role: "ADMIN" | "STAFF"; phone?: string;
}) {
  const passwordHash = await bcrypt.hash(data.password, 12);
  const user = await prisma.user.upsert({
    where:  { email: data.email },
    update: { passwordHash, role: data.role, isVerified: true, isActive: true, fullName: data.fullName },
    create: { fullName: data.fullName, email: data.email, phone: data.phone ?? null, passwordHash, role: data.role, isVerified: true, isActive: true },
  });
  console.log(`✅  ${data.role}: ${user.email}  (id: ${user.id})`);
  return user;
}

function requireEnv(name: string): string {
  const val = process.env[name];
  if (!val) throw new Error(`Missing required env var for seed: ${name}`);
  return val;
}

async function main() {
  console.log("🌱  Seeding privileged accounts…\n");
  await upsertUser({
    email:    requireEnv("SEED_ADMIN_EMAIL"),
    password: requireEnv("SEED_ADMIN_PASSWORD"),
    fullName: process.env.SEED_ADMIN_NAME ?? "Admin",
    role:     "ADMIN",
  });
  await upsertUser({
    email:    requireEnv("SEED_STAFF_EMAIL"),
    password: requireEnv("SEED_STAFF_PASSWORD"),
    fullName: process.env.SEED_STAFF_NAME ?? "Staff",
    role:     "STAFF",
  });
  console.log("\n✅  Seed complete.");
}

main()
  .catch(e => { console.error("❌  Seed failed:", e); process.exit(1); })
  .finally(() => prisma.$disconnect());
