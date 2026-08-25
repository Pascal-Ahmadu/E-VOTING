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

async function main() {
  const existing = await db.admin.count();
  if (existing > 0) {
    console.log(`[seed] ${existing} admin(s) already exist — skipping seed`);
    return;
  }

  const { email, name, passcode } = requireSeedEnv();
  const passcodeHash = await bcrypt.hash(passcode, 10);
  await db.admin.create({
    data: { name, email: email.toLowerCase(), passcodeHash },
  });
  console.log(`[seed] created initial admin ${email}`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
