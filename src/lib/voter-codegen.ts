const CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

/**
 * Build a voter ID as `PREFIX-XXXX`. The prefix comes from the configured
 * organisation short name (see `voterIdPrefix`) so generated IDs carry the
 * deploying organisation's initials rather than a hardcoded one.
 */
export function generateVoterId(prefix: string): string {
  let suffix = "";
  for (let i = 0; i < 4; i++) {
    suffix += CHARS[Math.floor(Math.random() * CHARS.length)];
  }
  return `${prefix}-${suffix}`;
}

export function generatePassword(): string {
  let pwd = "";
  for (let i = 0; i < 6; i++) {
    pwd += CHARS[Math.floor(Math.random() * CHARS.length)];
  }
  return pwd;
}
