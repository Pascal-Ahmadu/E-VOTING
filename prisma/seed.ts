import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const db = new PrismaClient();

function requireSeedEnv(): {
  email: string;
  name: string;
  passcode: string;
} {
  const isProd = process.env.NODE_ENV === "production";

  const email = process.env.SEED_ADMIN_EMAIL;
  const name = process.env.SEED_ADMIN_NAME;
  const passcode = process.env.SEED_ADMIN_PASSCODE;

  if (isProd) {
    if (!email || !name || !passcode || passcode.length < 8) {
      throw new Error(
        "Refusing to seed: in production SEED_ADMIN_EMAIL, SEED_ADMIN_NAME, " +
          "and SEED_ADMIN_PASSCODE (>=8 chars) must all be set.",
      );
    }
    return { email, name, passcode };
  }

  // Dev only: fall back to obvious placeholders the user is expected to rotate.
  return {
    email: email ?? "admin@example.com",
    name: name ?? "Default Admin",
    passcode: passcode ?? "ChangeMe123",
  };
}

/**
 * The platform operator, who creates organisations. Separate credentials from
 * any tenant admin; falls back to the same SEED_ADMIN_* values in development
 * so a local install has one fewer thing to configure.
 */
async function seedPlatformAdmin(seed: {
  email: string;
  name: string;
  passcode: string;
}): Promise<void> {
  if ((await db.platformAdmin.count()) > 0) {
    console.log("[seed] platform admin already exists — skipping");
    return;
  }

  const email = (process.env.SEED_PLATFORM_EMAIL ?? seed.email).toLowerCase();
  const name = process.env.SEED_PLATFORM_NAME ?? seed.name;
  const passcode = process.env.SEED_PLATFORM_PASSCODE ?? seed.passcode;

  await db.platformAdmin.create({
    data: { name, email, passcodeHash: await bcrypt.hash(passcode, 10) },
  });
  console.log(`[seed] created platform admin ${email}`);
}

/** The first organisation, plus its first admin. */
async function seedFirstOrganization(seed: {
  email: string;
  name: string;
  passcode: string;
}): Promise<void> {
  if ((await db.organization.count()) > 0) {
    console.log("[seed] organisation already exists — skipping");
    return;
  }

  const slug = process.env.SEED_ORG_SLUG ?? "default";
  const org = await db.organization.create({
    data: {
      slug,
      orgName: process.env.SEED_ORG_NAME ?? "Default Organisation",
      orgShortName: process.env.SEED_ORG_SHORT_NAME ?? "Default",
    },
  });
  console.log(`[seed] created organisation "${org.orgName}" at /o/${org.slug}`);

  if ((await db.admin.count({ where: { organizationId: org.id } })) > 0) return;

  await db.admin.create({
    data: {
      organizationId: org.id,
      name: seed.name,
      email: seed.email.toLowerCase(),
      passcodeHash: await bcrypt.hash(seed.passcode, 10),
    },
  });
  console.log(`[seed] created initial admin ${seed.email}`);
}

async function main() {
  const seed = requireSeedEnv();
  await seedPlatformAdmin(seed);
  await seedFirstOrganization(seed);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
