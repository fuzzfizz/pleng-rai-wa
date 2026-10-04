// ==========================================
// เพลงไรวะ (Pleng-Rai-Wa) - Room Code Utility
// ==========================================

export const SAFE_CHARS = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

/**
 * Generates a 6-character uppercase alphanumeric code using SAFE_CHARS.
 * Excludes ambiguous characters (0, O, 1, I, L) to prevent confusion on screens.
 */
export function generateRoomCode(): string {
  let result = "";
  for (let i = 0; i < 6; i++) {
    const randomIndex = Math.floor(Math.random() * SAFE_CHARS.length);
    result += SAFE_CHARS[randomIndex];
  }
  return result;
}

/**
 * Validates if the given code is a 6-character alphanumeric string.
 * Automatically trims and converts to uppercase before checking.
 */
export function isValidRoomCode(code: string): boolean {
  if (!code || typeof code !== "string") return false;
  const clean = code.trim().toUpperCase();
  return /^[A-Z0-9]{6}$/.test(clean);
}
