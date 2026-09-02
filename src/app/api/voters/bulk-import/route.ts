import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/auth-guards";
import { requireSameOrigin } from "@/lib/csrf";
import { audit, requestMeta } from "@/lib/audit";
import { hashPII } from "@/lib/pii";
import { hashSecret } from "@/lib/password";
import { encryptVoter } from "@/lib/voter-pii";
import { generateVoterId, generatePassword } from "@/lib/voter-codegen";
import { getRevokedIds, isRevoked, unrevoke } from "@/lib/revocation";
import { sendVoterCredentials, sendVoterCredentialsEmail } from "@/lib/messaging";
import { Prisma } from "@prisma/client";
import { getBrandingByOrgId } from "@/lib/branding";

interface ImportedVoter {
  name: string;
  email: string;
  voterId: string;
  password: string;
  phone?: string;
}

interface SkippedRow {
  row: number;
  name: string;
  email: string;
  reason: string;
}

/** Header aliases accepted for the voter-identifier column, in addition to
 * whatever the organisation has named it in settings. Kept broad so existing
 * spreadsheets keep importing after a rebrand. */
const VOTER_ID_ALIASES = [
  "voterid",
  "nsenumber",
  "nsenum",
  "nseno",
  "nseid",
  "nse",
  "memberid",
  "memberno",
  "membernumber",
  "id",
];

/** Normalise a header cell the same way the CSV header row is normalised. */
function normalizeHeader(value: string): string {
  return value.toLowerCase().trim().replace(/^"|"$/g, "").replace(/[\s_]/g, "");
}

function parseCSV(
  text: string,
  voterIdLabel: string,
): { name: string; email: string; voterId: string; phone: string }[] {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

  if (lines.length < 2) return [];

  const header = lines[0]!
    .toLowerCase()
    .split(",")
    .map((h) => h.trim().replace(/^"|"$/g, "").replace(/[\s_]/g, ""));
  const nameIdx = header.indexOf("name");
  const emailIdx = header.indexOf("email");
  // The configured label wins, so an organisation can use its own column name.
  const voterIdIdx = [normalizeHeader(voterIdLabel), ...VOTER_ID_ALIASES].reduce<number>(
    (found, key) => (found === -1 ? header.indexOf(key) : found),
    -1,
  );
  const phoneIdx = ["phone", "phonenumber", "mobile", "whatsapp"].reduce<number>(
    (found, key) => (found === -1 ? header.indexOf(key) : found),
    -1,
  );
  if (nameIdx === -1 || emailIdx === -1) return [];

  const rows: { name: string; email: string; voterId: string; phone: string }[] = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = splitCSVLine(lines[i]!);
    const name = (cols[nameIdx] ?? "").trim();
    const email = (cols[emailIdx] ?? "").trim().toLowerCase();
    const voterId = voterIdIdx !== -1 ? (cols[voterIdIdx] ?? "").trim().toUpperCase() : "";
    const phone = phoneIdx !== -1 ? (cols[phoneIdx] ?? "").trim() : "";
    if (name || email) rows.push({ name, email, voterId, phone });
  }
  return rows;
}

function splitCSVLine(line: string): string[] {
  const cols: string[] = [];
  let current = "";
  let inQuotes = false;
  for (const ch of line) {
    if (ch === '"') {
      inQuotes = !inQuotes;
    } else if (ch === "," && !inQuotes) {
      cols.push(current);
      current = "";
    } else {
      current += ch;
    }
  }
  cols.push(current);
  return cols;
}

async function makeUniqueVoterId(
  existingHashes: Set<string>,
  prefix: string,
  organizationId: string,
): Promise<string | null> {
  for (let i = 0; i < 50; i++) {
    const id = generateVoterId(prefix);
    const hash = hashPII(id);
    if (existingHashes.has(hash)) continue;
    const inDb = await db.voter.findUnique({
      where: { organizationId_voterIdHash: { organizationId, voterIdHash: hash } },
      select: { id: true },
    });
    if (!inDb) {
      existingHashes.add(hash);
      return id;
    }
  }
  return null;
}

export async function POST(req: Request) {
  const csrf = requireSameOrigin(req);
  if (csrf) return csrf;

  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;

  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return NextResponse.json({ error: "Expected multipart form data" }, { status: 400 });
  }

  const file = formData.get("file");
  if (!file || typeof file === "string") {
    return NextResponse.json({ error: "No file uploaded" }, { status: 400 });
  }

  const text = await (file as File).text();
  const { organizationId } = guard.value;
  const { voterIdLabel } = await getBrandingByOrgId(organizationId);
  const rows = parseCSV(text, voterIdLabel);

  if (rows.length === 0) {
    return NextResponse.json(
      { error: 'CSV must have a header row with "name" and "email" columns, plus at least one data row.' },
      { status: 400 },
    );
  }
  if (rows.length > 200) {
    return NextResponse.json(
      { error: "Maximum 200 voters per import batch." },
      { status: 400 },
    );
  }

  const created: ImportedVoter[] = [];
  const skipped: SkippedRow[] = [];
  const sendPromises: Promise<boolean>[] = [];

  // Exclude revoked (soft-deleted) voters from all duplicate checks so they can be re-registered.
  const revokedIds = await getRevokedIds("voter", guard.value.organizationId);
  const notRevoked = revokedIds.length > 0 ? { id: { notIn: revokedIds } } : {};

  // Track voter ID hashes assigned in this batch to avoid duplicates within the batch
  const batchVoterIdHashes = new Set<string>();

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i]!;
    const rowNum = i + 2; // 1-indexed, skipping header

    if (!row.name) {
      skipped.push({ row: rowNum, name: row.name, email: row.email, reason: "Name is required" });
      continue;
    }
    if (!row.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(row.email)) {
      skipped.push({ row: rowNum, name: row.name, email: row.email, reason: "Invalid email" });
      continue;
    }

    if (!row.voterId) {
      skipped.push({ row: rowNum, name: row.name, email: row.email, reason: `${voterIdLabel} is required` });
      continue;
    }
    if (!/^[A-Z0-9-]{4,32}$/.test(row.voterId)) {
      skipped.push({ row: rowNum, name: row.name, email: row.email, reason: `Invalid ${voterIdLabel} format (4–32 letters, numbers or dashes)` });
      continue;
    }

    const emailHash = hashPII(row.email);
    const voterIdHashCheck = hashPII(row.voterId);

    if (batchVoterIdHashes.has(voterIdHashCheck)) {
      skipped.push({ row: rowNum, name: row.name, email: row.email, reason: `Duplicate ${voterIdLabel} in this file` });
      continue;
    }

    // Check for an existing voter by email or voter ID (including revoked ones for restore)
    const existingByEmail = await db.voter.findFirst({
      where: { organizationId, emailHash },
      select: { id: true },
    });
    const existingByVoterId = await db.voter.findFirst({
      where: { organizationId, voterIdHash: voterIdHashCheck },
      select: { id: true },
    });
    const existingMatch = existingByEmail ?? existingByVoterId;

    if (existingMatch) {
      if (!(await isRevoked("voter", existingMatch.id))) {
        skipped.push({ row: rowNum, name: row.name, email: row.email, reason: "Already registered (active)" });
        continue;
      }
      // Revoked — restore with updated details
      const password = generatePassword();
      const encrypted = encryptVoter({ name: row.name, email: row.email, voterId: row.voterId, phone: row.phone || undefined });
      await db.voter.update({
        where: { id: existingMatch.id },
        data: { ...encrypted, passwordHash: await hashSecret(password), registeredAt: new Date() },
      });
      await unrevoke("voter", existingMatch.id);
      sendPromises.push(sendVoterCredentialsEmail({ organizationId, email: row.email, name: row.name, voterId: row.voterId, password }));
      if (row.phone) sendPromises.push(sendVoterCredentials({ phone: row.phone, password }));
      batchVoterIdHashes.add(voterIdHashCheck);
      created.push({ name: row.name, email: row.email, voterId: row.voterId, password, phone: row.phone || undefined });
      continue;
    }

    batchVoterIdHashes.add(voterIdHashCheck);
    const voterId = row.voterId;
    const password = generatePassword();
    const voterIdHash = hashPII(voterId);
    const encrypted = encryptVoter({ name: row.name, email: row.email, voterId, phone: row.phone || undefined });

    try {
      await db.voter.create({
        data: {
          organizationId,
          ...encrypted,
          passwordHash: await hashSecret(password),
        },
      });
      sendPromises.push(sendVoterCredentialsEmail({ organizationId, email: row.email, name: row.name, voterId, password }));
      if (row.phone) sendPromises.push(sendVoterCredentials({ phone: row.phone, password }));
      created.push({ name: row.name, email: row.email, voterId, password, phone: row.phone || undefined });
    } catch (err) {
      if (
        err instanceof Prisma.PrismaClientKnownRequestError &&
        err.code === "P2002"
      ) {
        const fields = (err.meta?.target as string[] | undefined) ?? [];
        const reason = fields.includes("emailHash")
          ? "Email already registered"
          : fields.includes("voterIdHash")
            ? "Voter ID collision — retry the import"
            : "Duplicate record";
        skipped.push({ row: rowNum, name: row.name, email: row.email, reason });
        batchVoterIdHashes.delete(voterIdHash);
      } else {
        throw err;
      }
    }
  }

  await Promise.allSettled(sendPromises);

  if (created.length > 0) {
    const admin = await db.admin.findUnique({
      where: { id: guard.value.adminId },
      select: { email: true },
    });
    const meta = requestMeta(req);
    await audit({
      actorType: "admin",
      actorId: guard.value.adminId,
      actorLabel: admin?.email ?? null,
      action: "voter.bulk_import",
      targetType: "voter",
      targetId: null,
      details: { count: created.length, skipped: skipped.length },
      meta,
    });
  }

  return NextResponse.json({ created, skipped }, { status: 201 });
}
