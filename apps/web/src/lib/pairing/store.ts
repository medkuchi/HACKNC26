// in-memory for now — swap these three functions for Supabase queries later,
// nothing calling them needs to change

interface PairingEntry {
  userId: string;
  expiresAt: number;
}

const codes = new Map<string, PairingEntry>();

const CODE_TTL_MS = 10 * 60 * 1000;

export function createPairingCode(userId: string): { code: string; expiresAt: number } {
  const code = Math.floor(100000 + Math.random() * 900000).toString();
  const expiresAt = Date.now() + CODE_TTL_MS;
  codes.set(code, { userId, expiresAt });
  return { code, expiresAt };
}

export function verifyPairingCode(code: string): { userId: string } | null {
  const entry = codes.get(code);
  if (!entry) return null;

  codes.delete(code);
  if (Date.now() > entry.expiresAt) return null;

  return { userId: entry.userId };
}
