import bcrypt from "bcryptjs";

const SALT_ROUNDS = 10;

export const hashSecret = (raw: string): Promise<string> =>
  bcrypt.hash(raw, SALT_ROUNDS);

export const verifySecret = (raw: string, hash: string): Promise<boolean> =>
  bcrypt.compare(raw, hash);
