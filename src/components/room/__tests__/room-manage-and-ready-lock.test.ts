import { describe, it, expect } from "vitest";
import { CREATE_MAX_PLAYERS_OPTIONS } from "@/app/page";
import { MAX_PLAYERS_OPTIONS as MODAL_MAX_PLAYERS_OPTIONS } from "../room-manage-modal";
import {
  MAX_PLAYERS_OPTIONS as HOST_SETTINGS_MAX_PLAYERS_OPTIONS,
  prepareSettingsPayload,
} from "../host-settings-modal";
import type { Player, RoomSettings } from "@/types";

describe("Item 1: Pre-creation Max Players & Room Settings Separation", () => {
  describe("Create Room Modal Max Players Options", () => {
    it("provides the standard presets: 4, 8, 12 with 8 as default/recommended", () => {
      expect(CREATE_MAX_PLAYERS_OPTIONS.map((o) => o.value)).toEqual([4, 8, 12]);
      const defaultOpt = CREATE_MAX_PLAYERS_OPTIONS.find((o) => o.value === 8);
      expect(defaultOpt?.label).toContain("8 คน (แนะนำ)");
    });

    it("matches presets between create room page and room manage modal", () => {
      expect(MODAL_MAX_PLAYERS_OPTIONS.map((o) => o.value)).toEqual(
        CREATE_MAX_PLAYERS_OPTIONS.map((o) => o.value)
      );
      expect(HOST_SETTINGS_MAX_PLAYERS_OPTIONS.map((o) => o.value)).toEqual(
        MODAL_MAX_PLAYERS_OPTIONS.map((o) => o.value)
      );
    });

    it("validates and normalizes maxPlayers in prepareSettingsPayload", () => {
      expect(prepareSettingsPayload({ maxPlayers: 4 }).maxPlayers).toBe(4);
      expect(prepareSettingsPayload({ maxPlayers: 12 }).maxPlayers).toBe(12);
      expect(prepareSettingsPayload({ maxPlayers: 1 }).maxPlayers).toBe(8);
      expect(prepareSettingsPayload({ maxPlayers: -1 }).maxPlayers).toBe(8);
      expect(prepareSettingsPayload({ maxPlayers: 50 }).maxPlayers).toBe(20);
    });
  });

  describe("Room Manage Modal Target Players Filtering", () => {
    const mockPlayers: Player[] = [
      { id: "host-1", displayName: "ดีเจเจ้าห้อง", isHost: true, isReady: true, score: 100, sessionToken: "t1", lastSeenAt: "" },
      { id: "p-2", displayName: "ผู้เล่น 2", isHost: false, isReady: false, score: 50, sessionToken: "t2", lastSeenAt: "" },
      { id: "p-3", displayName: "ผู้เล่น 3", isHost: false, isReady: true, score: 70, sessionToken: "t3", lastSeenAt: "" },
    ];

    it("filters out the current host from eligible transfer targets", () => {
      const currentHostId = "host-1";
      const otherPlayers = mockPlayers.filter((p) => p.id !== currentHostId);
      expect(otherPlayers).toHaveLength(2);
      expect(otherPlayers.map((p) => p.id)).toEqual(["p-2", "p-3"]);
      expect(otherPlayers.find((p) => p.id === currentHostId)).toBeUndefined();
    });

    it("detects when room player count exceeds selected capacity", () => {
      const currentCount = mockPlayers.length; // 3 players
      const selectedMaxPlayers = 4;
      const isExceeded = selectedMaxPlayers < currentCount;
      expect(isExceeded).toBe(false);

      const reducedMaxPlayers = 2;
      const isNowExceeded = reducedMaxPlayers < currentCount;
      expect(isNowExceeded).toBe(true);
    });
  });
});

describe("Item 2: Lobby Ready Check Lock Before Game Start", () => {
  function getLobbyStartState({
    players,
    isStarting = false,
  }: {
    players: Player[];
    isStarting?: boolean;
  }) {
    const nonHostPlayers = players.filter((p) => !p.isHost);
    const readyNonHostCount = nonHostPlayers.filter((p) => p.isReady).length;
    const allNonHostReady =
      nonHostPlayers.length > 0 && readyNonHostCount === nonHostPlayers.length;
    const hasOtherPlayers = nonHostPlayers.length > 0;
    const isStartDisabled = !hasOtherPlayers || !allNonHostReady || isStarting;

    let statusText = "";
    if (!hasOtherPlayers) {
      statusText = "ต้องการผู้เล่นอย่างน้อย 2 คนเพื่อเริ่มเกม (แชร์รหัสห้องหรือ QR Code ให้เพื่อน)";
    } else if (!allNonHostReady) {
      statusText = `⏳ รอผู้เล่นทุกคนกดพร้อมก่อนเริ่มเกม (${readyNonHostCount}/${nonHostPlayers.length} คนพร้อมแล้ว)`;
    } else {
      statusText = "✓ ผู้เล่นทุกคนพร้อมแล้ว! Host สามารถกดเริ่มเกมได้ทันที";
    }

    const buttonStyle =
      !hasOtherPlayers || !allNonHostReady
        ? "bg-stone-200 dark:bg-stone-800 text-stone-400 dark:text-stone-500 cursor-not-allowed shadow-none"
        : "bg-amber-500 hover:bg-amber-400 text-stone-950 shadow-lg shadow-amber-500/30 ring-2 ring-amber-500/50 active:scale-[0.98] cursor-pointer";

    return {
      nonHostPlayers,
      readyNonHostCount,
      allNonHostReady,
      hasOtherPlayers,
      isStartDisabled,
      statusText,
      buttonStyle,
    };
  }

  it("disables start game when host is alone in the room", () => {
    const players: Player[] = [
      { id: "h1", displayName: "Host", isHost: true, isReady: true, score: 0, sessionToken: "t1", lastSeenAt: "" },
    ];

    const state = getLobbyStartState({ players });
    expect(state.hasOtherPlayers).toBe(false);
    expect(state.allNonHostReady).toBe(false);
    expect(state.isStartDisabled).toBe(true);
    expect(state.statusText).toContain("ต้องการผู้เล่นอย่างน้อย 2 คน");
    expect(state.buttonStyle).toContain("cursor-not-allowed");
  });

  it("disables start game when other players exist but not all are ready", () => {
    const players: Player[] = [
      { id: "h1", displayName: "Host", isHost: true, isReady: true, score: 0, sessionToken: "t1", lastSeenAt: "" },
      { id: "p1", displayName: "Alice", isHost: false, isReady: true, score: 0, sessionToken: "t2", lastSeenAt: "" },
      { id: "p2", displayName: "Bob", isHost: false, isReady: false, score: 0, sessionToken: "t3", lastSeenAt: "" },
    ];

    const state = getLobbyStartState({ players });
    expect(state.hasOtherPlayers).toBe(true);
    expect(state.readyNonHostCount).toBe(1);
    expect(state.nonHostPlayers.length).toBe(2);
    expect(state.allNonHostReady).toBe(false);
    expect(state.isStartDisabled).toBe(true);
    expect(state.statusText).toBe("⏳ รอผู้เล่นทุกคนกดพร้อมก่อนเริ่มเกม (1/2 คนพร้อมแล้ว)");
    expect(state.buttonStyle).toContain("cursor-not-allowed");
  });

  it("enables start game with glowing amber styling when all non-host players are ready", () => {
    const players: Player[] = [
      { id: "h1", displayName: "Host", isHost: true, isReady: true, score: 0, sessionToken: "t1", lastSeenAt: "" },
      { id: "p1", displayName: "Alice", isHost: false, isReady: true, score: 0, sessionToken: "t2", lastSeenAt: "" },
      { id: "p2", displayName: "Bob", isHost: false, isReady: true, score: 0, sessionToken: "t3", lastSeenAt: "" },
    ];

    const state = getLobbyStartState({ players });
    expect(state.hasOtherPlayers).toBe(true);
    expect(state.readyNonHostCount).toBe(2);
    expect(state.nonHostPlayers.length).toBe(2);
    expect(state.allNonHostReady).toBe(true);
    expect(state.isStartDisabled).toBe(false);
    expect(state.statusText).toBe("✓ ผู้เล่นทุกคนพร้อมแล้ว! Host สามารถกดเริ่มเกมได้ทันที");
    expect(state.buttonStyle).toContain("bg-amber-500");
    expect(state.buttonStyle).toContain("cursor-pointer");
  });

  it("keeps start game disabled while isStarting is true even if everyone is ready", () => {
    const players: Player[] = [
      { id: "h1", displayName: "Host", isHost: true, isReady: true, score: 0, sessionToken: "t1", lastSeenAt: "" },
      { id: "p1", displayName: "Alice", isHost: false, isReady: true, score: 0, sessionToken: "t2", lastSeenAt: "" },
    ];

    const state = getLobbyStartState({ players, isStarting: true });
    expect(state.allNonHostReady).toBe(true);
    expect(state.isStartDisabled).toBe(true);
  });
});
