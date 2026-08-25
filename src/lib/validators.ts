const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const VOTER_ID_RE = /^[A-Za-z0-9-]{4,32}$/;

export function validateEmail(raw: string): string | null {
  const value = raw.trim().toLowerCase();
  if (!value) return "Email is required";
  if (value.length > 254) return "Email is too long";
  if (!EMAIL_RE.test(value)) return "Enter a valid email address";
  return null;
}

export function validateVoterId(raw: string): string | null {
  const value = raw.trim().toUpperCase();
  if (!value) return "Voter ID is required";
  if (!VOTER_ID_RE.test(value)) {
    return "Voter ID must be 4–32 letters, numbers or dashes";
  }
  return null;
}

export function validatePassword(raw: string): string | null {
  if (!raw) return "Password is required";
  if (raw.length < 4) return "Password must be at least 4 characters";
  if (raw.length > 64) return "Password is too long";
  return null;
}
