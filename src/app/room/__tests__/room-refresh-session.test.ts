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

describe("Room Refresh Session & Unmount Behavior Suite", () => {
  let mockLocalStorage: MemoryStorage;
  let mockSessionStorage: MemoryStorage;
  let originalWindow: typeof window;
  let eventListeners: Map<string, Set<EventListenerOrEventListenerObject>>;

  beforeEach(() => {
    mockLocalStorage = new MemoryStorage();
    mockSessionStorage = new MemoryStorage();
    eventListeners = new Map();
    originalWindow = globalThis.window;

    const mockWindow = {
      localStorage: mockLocalStorage,
      sessionStorage: mockSessionStorage,
      addEventListener: vi.fn((event: string, listener: EventListenerOrEventListenerObject) => {
        if (!eventListeners.has(event)) {
          eventListeners.set(event, new Set());
        }
        eventListeners.get(event)!.add(listener);
      }),
      removeEventListener: vi.fn((event: string, listener: EventListenerOrEventListenerObject) => {
        if (eventListeners.has(event)) {
          eventListeners.get(event)!.delete(listener);
        }
      }),
      dispatchEvent: vi.fn((event: { type: string }) => {
        const set = eventListeners.get(event.type);
        if (set) {
          set.forEach((listener) => {
            if (typeof listener === "function") {
              listener(event as any);
            } else if (listener && typeof listener.handleEvent === "function") {
              listener.handleEvent(event as any);
            }
          });
          return true;
        }
        return false;
      }),
    };

    (globalThis as any).window = mockWindow;
  });

  afterEach(() => {
    vi.restoreAllMocks();
    (globalThis as any).window = originalWindow;
  });

  // =========================================================================
  // 1. Session Restoration & Host Status for initialPlayer
  // =========================================================================
  describe("1. loadPlayerSession restores initialPlayer & host status on reload", () => {
    it("accurately restores session and host status for host initialPlayer on reload", () => {
      const roomCode = "ROOM01";
      const hostSession: Omit<PlayerSession, "roomCode" | "savedAt"> = {
        playerId: "p-host-01",
        sessionToken: "token-host-01",
        displayName: "GameHost",
        avatar: "👑",
        isHost: true,
      };

      // 1. Host creates room and saves session to localStorage
      savePlayerSession(roomCode, hostSession);

      // 2. Browser reloads: loadPlayerSession runs on mount
      const loaded = loadPlayerSession(roomCode);
      expect(loaded).not.toBeNull();
      expect(loaded?.playerId).toBe("p-host-01");
      expect(loaded?.displayName).toBe("GameHost");
      expect(loaded?.avatar).toBe("👑");
      expect(loaded?.isHost).toBe(true);

      // 3. Emulate initialPlayer memo in src/app/room/[code]/page.tsx
      const initialPlayer: Partial<Player> | undefined = loaded
        ? {
            id: loaded.playerId,
            displayName: loaded.displayName,
            isHost: Boolean(loaded.isHost),
            sessionToken: loaded.sessionToken,
            avatarUrl: loaded.avatar,
          }
        : undefined;

      expect(initialPlayer).toBeDefined();
      expect(initialPlayer?.id).toBe("p-host-01");
      expect(initialPlayer?.displayName).toBe("GameHost");
      expect(initialPlayer?.isHost).toBe(true);
      expect(initialPlayer?.avatarUrl).toBe("👑");

      // 4. Verify initial room realtime state inherits host player without prompting guest nickname modal
      const state = createInitialRoomRealtimeState(roomCode, initialPlayer);
      expect(state.isHost).toBe(true);
      expect(state.myPlayer?.id).toBe("p-host-01");
      expect(state.myPlayer?.isHost).toBe(true);
      expect(state.players[0].id).toBe("p-host-01");
      expect(state.players[0].isHost).toBe(true);
    });

    it("accurately restores session for guest initialPlayer (isHost: false) on reload", () => {
      const roomCode = "ROOM02";
      const guestSession: Omit<PlayerSession, "roomCode" | "savedAt"> = {
        playerId: "p-guest-02",
        sessionToken: "token-guest-02",
        displayName: "GuestPlayer",
        avatar: "🎸",
        isHost: false,
      };

      // 1. Guest joins and saves session
      savePlayerSession(roomCode, guestSession);

      // 2. Reload: loadPlayerSession restores guest
      const loaded = loadPlayerSession(roomCode);
      expect(loaded).not.toBeNull();
      expect(loaded?.playerId).toBe("p-guest-02");
      expect(loaded?.isHost).toBe(false);

      // 3. initialPlayer mapping
      const initialPlayer: Partial<Player> | undefined = loaded
        ? {
            id: loaded.playerId,
            displayName: loaded.displayName,
            isHost: Boolean(loaded.isHost),
            sessionToken: loaded.sessionToken,
            avatarUrl: loaded.avatar,
          }
        : undefined;

      expect(initialPlayer).toBeDefined();
      expect(initialPlayer?.isHost).toBe(false);

      // 4. Verify initial room state recognizes guest without host privileges
      const state = createInitialRoomRealtimeState(roomCode, initialPlayer);
      expect(state.isHost).toBe(false);
      expect(state.myPlayer?.id).toBe("p-guest-02");
      expect(state.myPlayer?.isHost).toBe(false);
    });

    it("returns null and undefined initialPlayer when no session exists for the room", () => {
      const loaded = loadPlayerSession("NONEXISTENT");
      expect(loaded).toBeNull();

      const initialPlayer = loaded
        ? {
            id: (loaded as PlayerSession).playerId,
            displayName: (loaded as PlayerSession).displayName,
            isHost: Boolean((loaded as PlayerSession).isHost),
            sessionToken: (loaded as PlayerSession).sessionToken,
            avatarUrl: (loaded as PlayerSession).avatar,
          }
        : undefined;

      expect(initialPlayer).toBeUndefined();
    });

    it("preserves updated host status across reloads when promoted via host migration", () => {
      const roomCode = "ROOM03";
      // Initially joined as non-host guest
      const session: Omit<PlayerSession, "roomCode" | "savedAt"> = {
        playerId: "p-promoted-03",
        sessionToken: "token-promoted-03",
        displayName: "NewHostPlayer",
        avatar: "🎹",
        isHost: false,
      };
      savePlayerSession(roomCode, session);

      // Promoted to host by room migration effect
      const loadedBefore = loadPlayerSession(roomCode)!;
      const updatedSession: PlayerSession = {
        ...loadedBefore,
        isHost: true,
      };
      savePlayerSession(roomCode, updatedSession);

      // Reloading after promotion
      const loadedAfter = loadPlayerSession(roomCode);
      expect(loadedAfter?.isHost).toBe(true);

      const initialPlayer: Partial<Player> = {
        id: loadedAfter!.playerId,
        displayName: loadedAfter!.displayName,
        isHost: Boolean(loadedAfter!.isHost),
        sessionToken: loadedAfter!.sessionToken,
        avatarUrl: loadedAfter!.avatar,
      };
      const state = createInitialRoomRealtimeState(roomCode, initialPlayer);
      expect(state.isHost).toBe(true);
      expect(state.myPlayer?.isHost).toBe(true);
    });
  });

  // =========================================================================
  // 2. Unmounting and Page Lifecycle Effect Behavior
  // =========================================================================
  describe("2. Navigation & Unmount lifecycle: sendLeaveSignal handling", () => {
    /**
     * Emulates the useEffect in src/app/room/[code]/page.tsx:
     *
     * useEffect(() => {
     *   const handlePopState = () => {
     *     sendLeaveSignal();
     *   };
     *   window.addEventListener("popstate", handlePopState);
     *   return () => {
     *     window.removeEventListener("popstate", handlePopState);
     *   };
     * }, [sendLeaveSignal]);
     */
    function setupRoomNavigationEffect(sendLeaveSignal: () => void) {
      const handlePopState = () => {
        sendLeaveSignal();
      };

      window.addEventListener("popstate", handlePopState);

      return () => {
        window.removeEventListener("popstate", handlePopState);
      };
    }

    it("does not attach pagehide or beforeunload event listeners", () => {
      const sendLeaveSignal = vi.fn();
      const unmount = setupRoomNavigationEffect(sendLeaveSignal);

      expect(window.addEventListener).toHaveBeenCalledWith("popstate", expect.any(Function));
      expect(window.addEventListener).not.toHaveBeenCalledWith("pagehide", expect.any(Function));
      expect(window.addEventListener).not.toHaveBeenCalledWith("beforeunload", expect.any(Function));

      unmount();
    });

    it("does NOT trigger sendLeaveSignal when component unmounts (e.g. browser refresh / re-render)", () => {
      const sendLeaveSignal = vi.fn();
      const unmount = setupRoomNavigationEffect(sendLeaveSignal);

      // Simulate component unmount (as happens during page refresh or route teardown)
      unmount();

      expect(sendLeaveSignal).not.toHaveBeenCalled();
      expect(window.removeEventListener).toHaveBeenCalledWith("popstate", expect.any(Function));
      expect(window.removeEventListener).not.toHaveBeenCalledWith("pagehide", expect.any(Function));
    });

    it("preserves player session in localStorage through simulated browser refresh", () => {
      const roomCode = "ROOM04";
      savePlayerSession(roomCode, {
        playerId: "p-stay-04",
        sessionToken: "token-04",
        displayName: "StaysAcrossRefresh",
        isHost: true,
      });

      const sendLeaveSignal = vi.fn(() => {
        clearPlayerSession(roomCode);
      });

      // Mount component effect
      const cleanup = setupRoomNavigationEffect(sendLeaveSignal);

      // Refreshing the browser triggers unmount of the current React tree
      cleanup();

      // sendLeaveSignal must NOT have been called
      expect(sendLeaveSignal).not.toHaveBeenCalled();

      // Session must remain intact in localStorage
      const sessionAfterRefresh = loadPlayerSession(roomCode);
      expect(sessionAfterRefresh).not.toBeNull();
      expect(sessionAfterRefresh?.playerId).toBe("p-stay-04");
      expect(sessionAfterRefresh?.isHost).toBe(true);
    });

    it("triggers sendLeaveSignal when popstate (browser back button) is pressed", () => {
      const sendLeaveSignal = vi.fn();
      const unmount = setupRoomNavigationEffect(sendLeaveSignal);

      // Simulate user clicking browser back navigation button
      window.dispatchEvent({ type: "popstate" } as any);

      expect(sendLeaveSignal).toHaveBeenCalledTimes(1);

      unmount();
    });

    it("explicit handleLeave properly triggers sendLeaveSignal and clears session", () => {
      const roomCode = "ROOM05";
      savePlayerSession(roomCode, {
        playerId: "p-leave-05",
        sessionToken: "tok-05",
        displayName: "LeavingUser",
        isHost: true,
      });

      const sendLeaveSignal = vi.fn(() => {
        clearPlayerSession(roomCode);
      });

      const mockRouterPush = vi.fn();
      const handleLeave = () => {
        sendLeaveSignal();
        mockRouterPush("/");
      };

      // User explicitly clicks 'ออกจากห้อง'
      handleLeave();

      expect(sendLeaveSignal).toHaveBeenCalledTimes(1);
      expect(mockRouterPush).toHaveBeenCalledWith("/");

      // Player session is cleared as expected on explicit exit
      const session = loadPlayerSession(roomCode);
      expect(session).toBeNull();
    });
  });
});
