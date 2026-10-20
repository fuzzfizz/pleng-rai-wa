import { describe, it, expect } from "vitest";
import {
  createInitialRoomRealtimeState,
  reduceRoomRealtimeEvent,
} from "@/hooks/use-room-realtime";
import type { Player } from "@/types";

describe("Ready State & Presence Stability Test Suite", () => {
  const initialPlayer: Player = {
    id: "p1",
    displayName: "Player One",
    isHost: false,
    isReady: false,
    score: 0,
    sessionToken: "tok-p1",
    lastSeenAt: new Date().toISOString(),
  };

  const remotePlayer1: Player = {
    id: "p2",
    displayName: "Player Two",
    isHost: false,
    isReady: false,
    score: 0,
    sessionToken: "tok-p2",
    lastSeenAt: new Date().toISOString(),
  };

  const remotePlayer2: Player = {
    id: "p3",
    displayName: "Player Three (Host)",
    isHost: true,
    isReady: true,
    score: 100,
    sessionToken: "tok-p3",
    lastSeenAt: new Date().toISOString(),
  };

  it("1. handles 'set_remote_player_ready' action and updates matching player", () => {
    let state = createInitialRoomRealtimeState("TEST1", initialPlayer);
    state.players = [initialPlayer, remotePlayer1, remotePlayer2];

    state = reduceRoomRealtimeEvent(state, {
      type: "set_remote_player_ready",
      playerId: "p2",
      isReady: true,
    });

    const p2 = state.players.find((p) => p.id === "p2");
    expect(p2?.isReady).toBe(true);

    // Other players remain unaffected
    const p1 = state.players.find((p) => p.id === "p1");
    expect(p1?.isReady).toBe(false);
  });

  it("2. handles 'player_ready' broadcast event in reduceRoomRealtimeEvent", () => {
    let state = createInitialRoomRealtimeState("TEST1", initialPlayer);
    state.players = [initialPlayer, remotePlayer1, remotePlayer2];

    state = reduceRoomRealtimeEvent(state, {
      type: "broadcast",
      event: "player_ready",
      payload: {
        playerId: "p2",
        isReady: true,
      },
    });

    const p2 = state.players.find((p) => p.id === "p2");
    expect(p2?.isReady).toBe(true);
  });

  it("3. presence_sync preserves recently active remote players during transient presence drops", () => {
    let state = createInitialRoomRealtimeState("TEST1", initialPlayer);
    const recentTime = new Date(Date.now() - 2000).toISOString(); // 2s ago (within 10s grace period)
    const activeRemote: Player = {
      ...remotePlayer1,
      lastSeenAt: recentTime,
    };
    state.players = [initialPlayer, activeRemote];

    // Simulate transient presence diff where remote player p2 is momentarily omitted
    const momentaryPresenceWithoutP2: Player[] = [
      {
        id: "p1",
        displayName: "Player One",
        isHost: false,
        isReady: false,
        score: 0,
        sessionToken: "tok-p1",
        lastSeenAt: new Date().toISOString(),
      },
    ];

    state = reduceRoomRealtimeEvent(state, {
      type: "presence_sync",
      players: momentaryPresenceWithoutP2,
    });

    // Remote player p2 should still be soft-retained due to grace period
    const p2 = state.players.find((p) => p.id === "p2");
    expect(p2).toBeDefined();
    expect(p2?.displayName).toBe("Player Two");
  });

  it("4. presence_sync prunes remote players whose lastSeenAt exceeds grace period", () => {
    let state = createInitialRoomRealtimeState("TEST1", initialPlayer);
    const staleTime = new Date(Date.now() - 15000).toISOString(); // 15s ago (> 10s grace period)
    const staleRemote: Player = {
      ...remotePlayer1,
      lastSeenAt: staleTime,
    };
    state.players = [initialPlayer, staleRemote];

    // Simulate presence sync where stale player p2 is omitted
    const presenceWithoutP2: Player[] = [
      {
        id: "p1",
        displayName: "Player One",
        isHost: false,
        isReady: false,
        score: 0,
        sessionToken: "tok-p1",
        lastSeenAt: new Date().toISOString(),
      },
    ];

    state = reduceRoomRealtimeEvent(state, {
      type: "presence_sync",
      players: presenceWithoutP2,
    });

    // Stale player p2 should be pruned
    const p2 = state.players.find((p) => p.id === "p2");
    expect(p2).toBeUndefined();
  });

  it("5. presence_sync updates metadata of existing players and retains myPlayer", () => {
    let state = createInitialRoomRealtimeState("TEST1", initialPlayer);
    state.players = [initialPlayer, remotePlayer1];

    const updatedPresence: Player[] = [
      {
        ...initialPlayer,
        score: 150,
      },
      {
        ...remotePlayer1,
        isReady: true,
        score: 200,
      },
    ];

    state = reduceRoomRealtimeEvent(state, {
      type: "presence_sync",
      players: updatedPresence,
    });

    expect(state.myPlayer?.score).toBe(150);
    const p2 = state.players.find((p) => p.id === "p2");
    expect(p2?.isReady).toBe(true);
    expect(p2?.score).toBe(200);
  });
});
