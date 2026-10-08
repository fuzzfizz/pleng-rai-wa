// ==========================================
// เพลงไรวะ (Pleng-Rai-Wa) - Player Session Storage
// Client-side localStorage persistence for reconnects & player identity
// ==========================================

export interface PlayerSession {
  roomCode: string;
  playerId: string;
  sessionToken: string;
  displayName: string;
  avatar?: string;
  isHost?: boolean;
  savedAt: string;
}

export const STORAGE_KEY_PREFIX = "pleng_session_";
export const STORAGE_KEY_LAST_ROOM = "pleng_last_room_code";

function getCleanCode(roomCode: string): string {
  if (!roomCode || typeof roomCode !== "string") return "";
  return roomCode.trim().toUpperCase();
}

function isStorageAvailable(): boolean {
  if (typeof window === "undefined") return false;
  try {
    const testKey = "__pleng_storage_test__";
    window.localStorage.setItem(testKey, "1");
    window.localStorage.removeItem(testKey);
    return true;
  } catch {
    return false;
  }
}

/**
 * Saves player session for a given room into localStorage.
 * Also persists the room code as the last active room.
 */
export function savePlayerSession(
  roomCode: string,
  session: Omit<PlayerSession, "roomCode" | "savedAt">
): void {
  const cleanCode = getCleanCode(roomCode);
  if (!cleanCode || !isStorageAvailable()) return;

  try {
    const fullSession: PlayerSession = {
      ...session,
      roomCode: cleanCode,
      savedAt: new Date().toISOString(),
    };

    window.localStorage.setItem(
      `${STORAGE_KEY_PREFIX}${cleanCode}`,
      JSON.stringify(fullSession)
    );
    window.localStorage.setItem(STORAGE_KEY_LAST_ROOM, cleanCode);
  } catch (err) {
    console.warn("[session-storage] Failed to save player session:", err);
  }
}

/**
 * Loads stored player session for a given room code.
 * Returns null if not found, malformed, or missing required fields.
 */
export function loadPlayerSession(roomCode: string): PlayerSession | null {
  const cleanCode = getCleanCode(roomCode);
  if (!cleanCode || !isStorageAvailable()) return null;

  try {
    const raw = window.localStorage.getItem(`${STORAGE_KEY_PREFIX}${cleanCode}`);
    if (!raw) return null;

    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return null;

    if (
      typeof parsed.playerId === "string" &&
      parsed.playerId.length > 0 &&
      typeof parsed.sessionToken === "string" &&
      parsed.sessionToken.length > 0 &&
      typeof parsed.displayName === "string" &&
      parsed.displayName.length > 0
    ) {
      return {
        roomCode: cleanCode,
        playerId: parsed.playerId,
        sessionToken: parsed.sessionToken,
        displayName: parsed.displayName,
        avatar: typeof parsed.avatar === "string" ? parsed.avatar : undefined,
        isHost: Boolean(parsed.isHost),
        savedAt: typeof parsed.savedAt === "string" ? parsed.savedAt : new Date().toISOString(),
      };
    }

    return null;
  } catch {
    return null;
  }
}

/**
 * Clears player session for a given room code.
 * Also removes last active room if it matches this room.
 */
export function clearPlayerSession(roomCode: string): void {
  const cleanCode = getCleanCode(roomCode);
  if (!cleanCode || !isStorageAvailable()) return;

  try {
    window.localStorage.removeItem(`${STORAGE_KEY_PREFIX}${cleanCode}`);
    const lastRoom = window.localStorage.getItem(STORAGE_KEY_LAST_ROOM);
    if (lastRoom === cleanCode) {
      window.localStorage.removeItem(STORAGE_KEY_LAST_ROOM);
    }
    if (typeof window !== "undefined" && window.sessionStorage) {
      window.sessionStorage.removeItem(`${STORAGE_KEY_PREFIX}${cleanCode}`);
      window.sessionStorage.removeItem(`pleng_host_${cleanCode}`);
    }
  } catch (err) {
    console.warn("[session-storage] Failed to clear player session:", err);
  }
}

/**
 * Gets the last room code the user visited.
 */
export function getLastRoomCode(): string | null {
  if (!isStorageAvailable()) return null;

  try {
    const code = window.localStorage.getItem(STORAGE_KEY_LAST_ROOM);
    return code ? code.trim().toUpperCase() : null;
  } catch {
    return null;
  }
}
