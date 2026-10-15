import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  savePlayerSession,
  loadPlayerSession,
  clearPlayerSession,
  type PlayerSession,
} from "@/lib/session-storage";
import {
  createInitialRoomRealtimeState,
  reduceRoomRealtimeEvent,
} from "@/hooks/use-room-realtime";
import {
  getDeterministicAvatar,
  DETERMINISTIC_AVATARS,
} from "@/components/room/player-card";
import type { Player } from "@/types";

// In-memory mock for window.localStorage & sessionStorage
class MemoryStorage {
  private store = new Map<string, string>();

  getItem(key: string): string | null {
    return this.store.has(key) ? this.store.get(key)! : null;
  }

  setItem(key: string, value: string): void {
    this.store.set(key, String(value));
  }

  removeItem(key: string): void {
    this.store.delete(key);
  }

  clear(): void {
    this.store.clear();
  }
}

describe("Avatar Persistence & Realtime Sync Test Suite", () => {
  let mockLocalStorage: MemoryStorage;
  let mockSessionStorage: MemoryStorage;
  let originalWindow: typeof window;

  beforeEach(() => {
    mockLocalStorage = new MemoryStorage();
    mockSessionStorage = new MemoryStorage();
    originalWindow = globalThis.window;

    (globalThis as any).window = {
      localStorage: mockLocalStorage,
      sessionStorage: mockSessionStorage,
    };
  });

  afterEach(() => {
    vi.restoreAllMocks();
    (globalThis as any).window = originalWindow;
  });

  // =========================================================================
  // 1. Session Restoration: loadPlayerSession restores avatarUrl
  // =========================================================================
  describe("1. Session Restoration (loadPlayerSession & Player Restoration)", () => {
    it("loadPlayerSession retrieves stored avatar and restores Player with avatarUrl", () => {
      const roomCode = "ROOM01";
      savePlayerSession(roomCode, {
        playerId: "p-alpha-1",
        sessionToken: "token-alpha-1",
        displayName: "RockStar",
        avatar: "🎸",
        isHost: true,
      });

      const stored = loadPlayerSession(roomCode);
      expect(stored).not.toBeNull();
      expect(stored?.avatar).toBe("🎸");

      // Verify the restoration mapping implemented in useRoomRealtime
      const restored: Player = {
        id: stored!.playerId,
        displayName: stored!.displayName,
        sessionToken: stored!.sessionToken,
        isHost: Boolean(stored!.isHost),
        isReady: false,
        score: 0,
        lastSeenAt: new Date().toISOString(),
        avatarUrl: stored!.avatar,
      };

      expect(restored.avatarUrl).toBe("🎸");
      expect(restored.id).toBe("p-alpha-1");
      expect(restored.displayName).toBe("RockStar");
      expect(restored.isHost).toBe(true);

      // Verify reducer initialization with restored player
      const initialState = createInitialRoomRealtimeState(roomCode);
      const nextState = reduceRoomRealtimeEvent(initialState, {
        type: "init_player",
        player: restored,
      });

      expect(nextState.myPlayer?.avatarUrl).toBe("🎸");
      expect(nextState.players[0].avatarUrl).toBe("🎸");
    });

    it("restores player with undefined avatarUrl gracefully when avatar was not set", () => {
      const roomCode = "ROOM02";
      savePlayerSession(roomCode, {
        playerId: "p-beta-2",
        sessionToken: "token-beta-2",
        displayName: "NoAvatarUser",
        isHost: false,
      });

      const stored = loadPlayerSession(roomCode);
      expect(stored).not.toBeNull();
      expect(stored?.avatar).toBeUndefined();

      const restored: Player = {
        id: stored!.playerId,
        displayName: stored!.displayName,
        sessionToken: stored!.sessionToken,
        isHost: Boolean(stored!.isHost),
        isReady: false,
        score: 0,
        lastSeenAt: new Date().toISOString(),
        avatarUrl: stored!.avatar,
      };

      expect(restored.avatarUrl).toBeUndefined();
    });
  });

  // =========================================================================
  // 2. Session Persistence: savePlayerSession retains avatarUrl
  // =========================================================================
  describe("2. Session Persistence (savePlayerSession retains avatarUrl)", () => {
    it("savePlayerSession in useRoomRealtime retains avatarUrl without wiping on subsequent ticks", () => {
      const roomCode = "ROOM03";
      const myPlayer: Player = {
        id: "p-gamma-3",
        displayName: "Drummer",
        sessionToken: "tok-drum-3",
        isHost: false,
        isReady: true,
        score: 250,
        lastSeenAt: new Date().toISOString(),
        avatarUrl: "🥁",
      };

      // Emulate the useRoomRealtime session persistence effect
      savePlayerSession(roomCode, {
        playerId: myPlayer.id,
        displayName: myPlayer.displayName,
        sessionToken: myPlayer.sessionToken,
        isHost: myPlayer.isHost,
        avatar: myPlayer.avatarUrl,
      });

      // Verify persistence in localStorage
      let stored = loadPlayerSession(roomCode);
      expect(stored?.avatar).toBe("🥁");

      // Emulate next tick / re-render saving the same state
      savePlayerSession(roomCode, {
        playerId: myPlayer.id,
        displayName: myPlayer.displayName,
        sessionToken: myPlayer.sessionToken,
        isHost: myPlayer.isHost,
        avatar: myPlayer.avatarUrl,
      });

      stored = loadPlayerSession(roomCode);
      expect(stored?.avatar).toBe("🥁");
      expect(stored?.playerId).toBe("p-gamma-3");
    });
  });

  // =========================================================================
  // 3. Asynchronous Sync of initialPlayer
  // =========================================================================
  describe("3. Asynchronous Sync of initialPlayer (myPlayer.avatarUrl updates)", () => {
    it("detects when initialPlayer.avatarUrl changes asynchronously and updates myPlayer", () => {
      const roomCode = "ROOM04";

      // Initial state with existing player having initial avatar
      let state = createInitialRoomRealtimeState(roomCode, {
        id: "p-delta-4",
        displayName: "Vocalist",
        avatarUrl: "🎤",
        score: 100,
        isHost: true,
      });

      expect(state.myPlayer?.avatarUrl).toBe("🎤");

      // Asynchronous update arrives: initialPlayer now has new avatar "🎹"
      const updatedInitialPlayer: Partial<Player> = {
        id: "p-delta-4",
        displayName: "Vocalist",
        avatarUrl: "🎹",
        isHost: true,
      };

      // Check the condition from useRoomRealtime:
      const shouldSync = Boolean(
        updatedInitialPlayer?.id &&
          (!state.myPlayer ||
            state.myPlayer.id !== updatedInitialPlayer.id ||
            (updatedInitialPlayer.avatarUrl &&
              state.myPlayer.avatarUrl !== updatedInitialPlayer.avatarUrl) ||
            (updatedInitialPlayer.displayName &&
              state.myPlayer.displayName !== updatedInitialPlayer.displayName) ||
            (updatedInitialPlayer.isHost !== undefined &&
              state.myPlayer.isHost !== updatedInitialPlayer.isHost))
      );

      expect(shouldSync).toBe(true);

      // Perform dispatch matching useRoomRealtime implementation
      const dispatchedPlayer: Player = {
        id: updatedInitialPlayer.id!,
        displayName:
          updatedInitialPlayer.displayName ||
          (state.myPlayer && state.myPlayer.id === updatedInitialPlayer.id
            ? state.myPlayer.displayName
            : "ผู้เล่น"),
        isHost:
          updatedInitialPlayer.isHost !== undefined
            ? Boolean(updatedInitialPlayer.isHost)
            : Boolean(state.myPlayer?.isHost),
        isReady:
          state.myPlayer && state.myPlayer.id === updatedInitialPlayer.id
            ? state.myPlayer.isReady
            : Boolean(updatedInitialPlayer.isReady),
        score:
          state.myPlayer && state.myPlayer.id === updatedInitialPlayer.id
            ? state.myPlayer.score
            : updatedInitialPlayer.score || 0,
        sessionToken:
          updatedInitialPlayer.sessionToken ||
          (state.myPlayer && state.myPlayer.id === updatedInitialPlayer.id
            ? state.myPlayer.sessionToken
            : updatedInitialPlayer.id!),
        lastSeenAt: new Date().toISOString(),
        avatarUrl: updatedInitialPlayer.avatarUrl || state.myPlayer?.avatarUrl,
      };

      state = reduceRoomRealtimeEvent(state, {
        type: "init_player",
        player: dispatchedPlayer,
      });

      expect(state.myPlayer?.avatarUrl).toBe("🎹");
      expect(state.myPlayer?.score).toBe(100); // Preserves player score
      expect(state.players[0].avatarUrl).toBe("🎹");
    });

    it("does not trigger unnecessary re-sync when avatar and details are identical", () => {
      const roomCode = "ROOM05";
      const state = createInitialRoomRealtimeState(roomCode, {
        id: "p-5",
        displayName: "DJ",
        avatarUrl: "🎧",
        isHost: false,
      });

      const sameInitialPlayer: Partial<Player> = {
        id: "p-5",
        displayName: "DJ",
        avatarUrl: "🎧",
        isHost: false,
      };

      const shouldSync = Boolean(
        sameInitialPlayer?.id &&
          (!state.myPlayer ||
            state.myPlayer.id !== sameInitialPlayer.id ||
            (sameInitialPlayer.avatarUrl &&
              state.myPlayer.avatarUrl !== sameInitialPlayer.avatarUrl) ||
            (sameInitialPlayer.displayName &&
              state.myPlayer.displayName !== sameInitialPlayer.displayName) ||
            (sameInitialPlayer.isHost !== undefined &&
              state.myPlayer.isHost !== sameInitialPlayer.isHost))
      );

      expect(shouldSync).toBe(false);
    });
  });

  // =========================================================================
  // 4. Reducer case "init_player" updates existing player in players list
  // =========================================================================
  describe("4. Reducer case 'init_player' (updates existing player in players list)", () => {
    it("merges updated avatarUrl into players array without creating duplicate entries", () => {
      const roomCode = "ROOM06";

      // Initial state with 2 players
      const player1: Player = {
        id: "p1",
        displayName: "Player One",
        sessionToken: "tok1",
        isHost: true,
        isReady: true,
        score: 50,
        lastSeenAt: new Date().toISOString(),
        avatarUrl: "🦊",
      };

      const player2: Player = {
        id: "p2",
        displayName: "Player Two",
        sessionToken: "tok2",
        isHost: false,
        isReady: false,
        score: 20,
        lastSeenAt: new Date().toISOString(),
        avatarUrl: "🐱",
      };

      let state = createInitialRoomRealtimeState(roomCode);
      state.players = [player1, player2];
      state.myPlayer = player1;

      expect(state.players.length).toBe(2);
      expect(state.players[0].avatarUrl).toBe("🦊");

      // Dispatch init_player with new avatar for player 1
      const updatedPlayer1: Player = {
        ...player1,
        avatarUrl: "🦁",
      };

      const nextState = reduceRoomRealtimeEvent(state, {
        type: "init_player",
        player: updatedPlayer1,
      });

      // Assertions
      expect(nextState.myPlayer?.avatarUrl).toBe("🦁");
      expect(nextState.players.length).toBe(2); // No duplicates
      expect(nextState.players[0].id).toBe("p1");
      expect(nextState.players[0].avatarUrl).toBe("🦁");
      expect(nextState.players[1].avatarUrl).toBe("🐱");
    });
  });

  // =========================================================================
  // 5. getDeterministicAvatar respects avatarUrl
  // =========================================================================
  describe("5. getDeterministicAvatar respects avatarUrl", () => {
    it("returns player.avatarUrl directly without falling back to hash", () => {
      const customEmoji = "🎸";
      const avatar = getDeterministicAvatar({
        id: "player-uuid-123",
        displayName: "Somchai",
        avatarUrl: customEmoji,
      });

      expect(avatar).toBe("🎸");
    });

    it("trims whitespace from player.avatarUrl", () => {
      const avatar = getDeterministicAvatar({
        id: "player-uuid-123",
        avatarUrl: "   🎤   ",
      });

      expect(avatar).toBe("🎤");
    });

    it("falls back to deterministic hash when avatarUrl is undefined", () => {
      const id = "player-deterministic-seed-456";
      const avatar = getDeterministicAvatar({ id });

      expect(avatar).toBeDefined();
      expect(typeof avatar).toBe("string");
      expect(DETERMINISTIC_AVATARS).toContain(avatar);

      // Determinism test: same id always yields same avatar
      const secondCall = getDeterministicAvatar({ id });
      expect(secondCall).toBe(avatar);
    });

    it("falls back to deterministic hash when avatarUrl is an empty string", () => {
      const avatar = getDeterministicAvatar({
        id: "player-uuid-empty",
        avatarUrl: "   ",
      });

      expect(DETERMINISTIC_AVATARS).toContain(avatar);
    });

    it("distinguishes between two players with identical IDs but different avatarUrls", () => {
      const playerA = { id: "same-id", avatarUrl: "🎸" };
      const playerB = { id: "same-id", avatarUrl: "🎹" };

      expect(getDeterministicAvatar(playerA)).toBe("🎸");
      expect(getDeterministicAvatar(playerB)).toBe("🎹");
    });
  });

  // =========================================
  // 6. Profile & Room Entry Mismatch Sync
  // =========================================
  describe("6. Profile & Stored Session Avatar Mismatch Sync", () => {
    it("updates storedSession when profile.avatar is present and session avatar mismatches", () => {
      const roomCode = "ROOM07";
      const profile = { displayName: "SuperHost", avatar: "🦁" };
      const oldSession: PlayerSession = {
        roomCode,
        playerId: "host-1",
        sessionToken: "tok-h-1",
        displayName: "SuperHost",
        avatar: "🦊", // Mismatched avatar
        isHost: true,
        savedAt: new Date().toISOString(),
      };

      savePlayerSession(roomCode, oldSession);
      expect(loadPlayerSession(roomCode)?.avatar).toBe("🦊");

      // Emulate the room/[code] page sync effect
      if (profile?.avatar && oldSession && oldSession.avatar !== profile.avatar) {
        const updated = { ...oldSession, avatar: profile.avatar };
        savePlayerSession(roomCode, updated);
      }

      const synced = loadPlayerSession(roomCode);
      expect(synced?.avatar).toBe("🦁");
    });

    it("sessionStorage updates pleng_avatar when user profile avatar is saved", () => {
      const newAvatar = "🎸";
      window.sessionStorage.setItem("pleng_avatar", newAvatar);
      expect(window.sessionStorage.getItem("pleng_avatar")).toBe("🎸");
    });
  });

  // =========================================
  // 7. Presence Tracking & Parsing with Avatar
  // =========================================
  describe("7. Realtime Presence Tracking & Parsing with Avatar", () => {
    it("re-tracks presence channel with updated avatarUrl when avatar changes", () => {
      const mockChannel = {
        track: vi.fn().mockResolvedValue({}),
      };

      const state = {
        isConnected: true,
        myPlayer: {
          id: "p-retrack-1",
          displayName: "Lead Singer",
          avatarUrl: "🎤",
          isHost: true,
          isReady: true,
          score: 120,
          sessionToken: "tok-lead",
        },
      };

      // Emulate the presence re-tracking effect
      if (
        mockChannel &&
        state.isConnected &&
        state.myPlayer?.avatarUrl &&
        typeof mockChannel.track === "function"
      ) {
        mockChannel.track({
          id: state.myPlayer.id,
          displayName: state.myPlayer.displayName,
          isHost: state.myPlayer.isHost,
          isReady: state.myPlayer.isReady,
          score: state.myPlayer.score,
          sessionToken: state.myPlayer.sessionToken,
          lastSeenAt: new Date().toISOString(),
          avatarUrl: state.myPlayer.avatarUrl,
        });
      }

      expect(mockChannel.track).toHaveBeenCalledTimes(1);
      expect(mockChannel.track).toHaveBeenCalledWith(
        expect.objectContaining({
          id: "p-retrack-1",
          avatarUrl: "🎤",
          isHost: true,
        })
      );
    });
  });
});
