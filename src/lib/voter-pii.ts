import { encryptPII, hashPII, tryDecrypt } from "./pii";

/**
 * Voter-record helpers around the generic PII utilities. Centralising these
 * keeps the encrypt/hash pairing consistent at every write site and the
 * decrypt-with-fallback consistent at every read site.
 */

export interface VoterPlaintext {
  name: string;
  email: string;
  voterId: string;
  phone?: string;
}

export interface VoterEncryptedColumns {
  name: string;
  email: string;
  voterId: string;
  emailHash: string;
  voterIdHash: string;
  phone?: string;
}

/** Produce ciphertext + hash columns for a voter insert. */
export function encryptVoter(input: VoterPlaintext): VoterEncryptedColumns {
  return {
    name: encryptPII(input.name),
    email: encryptPII(input.email),
    voterId: encryptPII(input.voterId),
    emailHash: hashPII(input.email),
    voterIdHash: hashPII(input.voterId),
    ...(input.phone ? { phone: encryptPII(input.phone) } : {}),
  };
}

/**
 * Decrypt a voter row's PII columns back to plaintext. Falls back to the
 * stored value for any field that was written before encryption shipped
 * (legacy plaintext rows).
 */
export function decryptVoterFields<
  T extends { name: string; email: string; voterId: string; phone?: string | null },
>(row: T): T {
  return {
    ...row,
    name: tryDecrypt(row.name),
    email: tryDecrypt(row.email),
    voterId: tryDecrypt(row.voterId),
    phone: row.phone ? tryDecrypt(row.phone) : row.phone,
  };
}
