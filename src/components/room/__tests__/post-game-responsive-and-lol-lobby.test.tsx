import React from "react";
import { describe, it, expect, vi } from "vitest";
import { renderToString } from "react-dom/server";
import {
  PodiumView,
  getSortedPodiumPlayers,
  getPodiumMedal,
} from "@/components/room/podium-view";
import { LobbyView, formatSettingsSummary } from "@/components/room/lobby-view";
import {
  getPlayerStatusBadge,
  PlayerCard,
  getDeterministicAvatar,
} from "@/components/room/player-card";
import {
  reduceRoomRealtimeEvent,
  parsePresencePlayers,
  createInitialRoomRealtimeState,
} from "@/hooks/use-room-realtime";
import type { Player, RoomSettings } from "@/types";

// Mock canvas-confetti
vi.mock("canvas-confetti", () => ({
  default: vi.fn(),
}));

// Mock next/navigation
vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    refresh: vi.fn(),
  }),
  useSearchParams: () => new URLSearchParams(),
}));

// Mock SettingsMenu to avoid ThemeProvider requirement in unit tests
vi.mock("@/components/common/settings-menu", () => ({
  SettingsMenu: () => React.createElement("div", { "data-testid": "settings-menu" }),
}));

// Mock sound effects
vi.mock("@/lib/sound-effects", () => ({
  soundEffects: {
    victoryFanfare: vi.fn(),
    click: vi.fn(),
    countdownTick: vi.fn(),
    buzzer: vi.fn(),
    wrong: vi.fn(),
    correct: vi.fn(),
  },
}));

describe("Task 4: Post-Game Mobile Responsive & LoL-style Individual Lobby Return", () => {
  const mockPlayers: Player[] = [
    {
      id: "player-1",
      displayName: "Alice Champion",
      isHost: true,
      isReady: true,
      isLobbyReady: false,
      score: 500,
      sessionToken: "token-1",
      lastSeenAt: new Date().toISOString(),
    },
    {
      id: "player-2",
      displayName: "Bob Second",
      isHost: false,
      isReady: true,
      isLobbyReady: true,
      score: 300,
      sessionToken: "token-2",
      lastSeenAt: new Date().toISOString(),
    },
    {
      id: "player-3",
      displayName: "Charlie Third",
      isHost: false,
      isReady: false,
      isLobbyReady: false,
      score: 200,
      sessionToken: "token-3",
      lastSeenAt: new Date().toISOString(),
    },
    {
      id: "player-4",
      displayName: "Dave Fourth",
      isHost: false,
      isReady: true,
      isLobbyReady: true,
      score: 100,
      sessionToken: "token-4",
      lastSeenAt: new Date().toISOString(),
    },
  ];

  const defaultSettings: RoomSettings = {
    gameMode: "buzzer",
    answerInputMode: "autocomplete",
    answerResolutionMode: "race",
    lyricsType: "intro",
    voiceGender: "female",
    sliceDurationSec: 2.0,
    roundTimeoutSec: 15,
    totalRounds: 10,
    targetScore: 0,
  };

  // Helper to search React virtual tree for strings or sub-elements
  function stringifyVNode(vnode: any): string {
    if (!vnode) return "";
    if (typeof vnode === "string" || typeof vnode === "number") return String(vnode);
    if (Array.isArray(vnode)) return vnode.map(stringifyVNode).join(" ");
    if (vnode.props) {
      const children = vnode.props.children ? stringifyVNode(vnode.props.children) : "";
      const className = vnode.props.className ? String(vnode.props.className) : "";
      return `${className} ${children}`;
    }
    return "";
  }

  describe("Item 7: PodiumView Mobile Responsiveness & Layout", () => {
    it("sorts players descending by score with stable tie-breaking", () => {
      const sorted = getSortedPodiumPlayers(mockPlayers);
      expect(sorted[0].id).toBe("player-1");
      expect(sorted[1].id).toBe("player-2");
      expect(sorted[2].id).toBe("player-3");
      expect(sorted[3].id).toBe("player-4");
    });

    it("ties are broken by displayName alphabetically", () => {
      const tiedPlayers: Player[] = [
        { ...mockPlayers[0], id: "z", displayName: "Zara", score: 100 },
        { ...mockPlayers[1], id: "a", displayName: "Adam", score: 100 },
      ];
      const sorted = getSortedPodiumPlayers(tiedPlayers);
      expect(sorted[0].displayName).toBe("Adam");
      expect(sorted[1].displayName).toBe("Zara");
    });

    it("getPodiumMedal returns correct metadata for ranks 1, 2, 3 and runners-up", () => {
      const m1 = getPodiumMedal(1);
      expect(m1.medal).toBe("👑");
      expect(m1.label).toContain("Champion");

      const m2 = getPodiumMedal(2);
      expect(m2.medal).toBe("🥈");

      const m3 = getPodiumMedal(3);
      expect(m3.medal).toBe("🥉");

      const m4 = getPodiumMedal(4);
      expect(m4.medal).toBe("#4");
    });

    it("renders PodiumView component as a valid React element with overflow-x-hidden and max-w-full", () => {
      const renderedStr = renderToString(
        <PodiumView
          players={mockPlayers}
          isHost={false}
          onBackToLobby={vi.fn()}
        />
      );

      expect(renderedStr).toContain("overflow-x-hidden");
      expect(renderedStr).toContain("max-w-full");
      expect(renderedStr).toContain("แท่นรับรางวัล (Podium)");
    });
  });

  describe("Item 8: LoL-style Individual Lobby Return & Status Badges", () => {
    it("renders '⏳ รอกลับห้องแล้ว' in podium tree for player with isLobbyReady: true", () => {
      const renderedStr = renderToString(
        <PodiumView
          players={mockPlayers}
          isHost={false}
          onBackToLobby={vi.fn()}
        />
      );

      expect(renderedStr).toContain("⏳ รอกลับห้องแล้ว");
    });

    it("renders '⏳ อยู่ในล็อบบี้' in runners-up list for player with isLobbyReady: true", () => {
      const renderedStr = renderToString(
        <PodiumView
          players={mockPlayers}
          isHost={false}
          onBackToLobby={vi.fn()}
        />
      );

      expect(renderedStr).toContain("⏳ อยู่ในล็อบบี้");
    });

    it("renders 'กลับสู่ห้องล็อบบี้ (Back to Lobby)' button for all players", () => {
      const renderedStr = renderToString(
        <PodiumView
          players={mockPlayers}
          isHost={false}
          onBackToLobby={vi.fn()}
        />
      );

      expect(renderedStr).toContain("กลับสู่ห้องล็อบบี้ (Back to Lobby)");
    });

    it("renders host actions ('เริ่มเกมใหม่' and 'พาทุกคนกลับล็อบบี้') when isHost is true", () => {
      const hostStr = renderToString(
        <PodiumView
          players={mockPlayers}
          isHost={true}
          onPlayAgain={vi.fn()}
          onResetAllToLobby={vi.fn()}
          onBackToLobby={vi.fn()}
        />
      );

      expect(hostStr).toContain("เริ่มเกมใหม่ (Play Again)");
      expect(hostStr).toContain("พาทุกคนกลับล็อบบี้");

      const playerStr = renderToString(
        <PodiumView
          players={mockPlayers}
          isHost={false}
          onPlayAgain={vi.fn()}
          onResetAllToLobby={vi.fn()}
          onBackToLobby={vi.fn()}
        />
      );

      expect(playerStr).not.toContain("เริ่มเกมใหม่ (Play Again)");
      expect(playerStr).not.toContain("พาทุกคนกลับล็อบบี้");
    });
  });

  describe("PlayerCard & getPlayerStatusBadge in GameOver Pending Mode", () => {
    it("returns standard status ('✓ พร้อมแล้ว') when isGameOverPendingHost is true and isLobbyReady is true", () => {
      const readyPlayer = mockPlayers[1]; // isLobbyReady: true, isReady: true
      const badge = getPlayerStatusBadge(readyPlayer, true);
      expect(badge.text).toBe("✓ พร้อมแล้ว");
      expect(badge.variant).toBe("ready");

      const notReadyLobbyPlayer = { ...mockPlayers[2], isLobbyReady: true, isReady: false };
      const waitingBadge = getPlayerStatusBadge(notReadyLobbyPlayer, true);
      expect(waitingBadge.text).toBe("รอสักครู่...");
      expect(waitingBadge.variant).toBe("waiting");

      const hostLobbyPlayer = { ...mockPlayers[0], isLobbyReady: true };
      const hostBadge = getPlayerStatusBadge(hostLobbyPlayer, true);
      expect(hostBadge.text).toBe("👑 ผู้สร้างห้อง");
      expect(hostBadge.variant).toBe("host");
    });

    it("returns '📊 กำลังดูสรุปผล' when isGameOverPendingHost is true and isLobbyReady is false", () => {
      const viewingPlayer = mockPlayers[2]; // isLobbyReady: false
      const badge = getPlayerStatusBadge(viewingPlayer, true);
      expect(badge.text).toBe("📊 กำลังดูสรุปผล");
      expect(badge.variant).toBe("waiting");
    });

    it("returns standard '👑 ผู้สร้างห้อง' and '✓ พร้อมแล้ว' when not in game over pending mode", () => {
      const hostPlayer = mockPlayers[0];
      const hostBadge = getPlayerStatusBadge(hostPlayer, false);
      expect(hostBadge.text).toBe("👑 ผู้สร้างห้อง");

      const readyPlayer = mockPlayers[1];
      const readyBadge = getPlayerStatusBadge(readyPlayer, false);
      expect(readyBadge.text).toBe("✓ พร้อมแล้ว");
    });

    it("renders PlayerCard with '📊 กำลังดูสรุปผล' badge for player reading results", () => {
      const renderedStr = renderToString(
        <PlayerCard
          player={mockPlayers[2]}
          isGameOverPendingHost={true}
        />
      );

      expect(renderedStr).toContain("📊 กำลังดูสรุปผล");
    });

    it("renders PlayerCard with standard '✓ พร้อมแล้ว' badge for player who returned to lobby", () => {
      const renderedStr = renderToString(
        <PlayerCard
          player={mockPlayers[1]}
          isGameOverPendingHost={true}
        />
      );

      expect(renderedStr).toContain("✓ พร้อมแล้ว");
      expect(renderedStr).not.toContain("รอกลับห้องแล้ว");
      expect(renderedStr).not.toContain("คะแนน");
    });
  });

  describe("LobbyView with isGameOverPendingHost & onViewPodium", () => {
    it("renders '📊 ดูสรุปผลการแข่งขันอีกครั้ง' button when isGameOverPendingHost is true", () => {
      const renderedStr = renderToString(
        <LobbyView
          roomCode="TEST1"
          players={mockPlayers}
          myPlayer={mockPlayers[1]}
          isHost={false}
          settings={defaultSettings}
          isGameOverPendingHost={true}
          onViewPodium={vi.fn()}
          onStartGame={vi.fn().mockResolvedValue(undefined)}
          onToggleReady={vi.fn().mockResolvedValue(undefined)}
          onUpdateSettings={vi.fn().mockResolvedValue(true)}
          onTransferHost={vi.fn().mockResolvedValue(true)}
        />
      );

      expect(renderedStr).toContain("ดูสรุปผลการแข่งขันอีกครั้ง (View Results)");
    });

    it("displays 'กลับล็อบบี้แล้ว 2/4 คน' when isGameOverPendingHost is true", () => {
      const renderedStr = renderToString(
        <LobbyView
          roomCode="TEST1"
          players={mockPlayers} // 2 out of 4 have isLobbyReady: true
          myPlayer={mockPlayers[1]}
          isHost={false}
          settings={defaultSettings}
          isGameOverPendingHost={true}
          onStartGame={vi.fn().mockResolvedValue(undefined)}
          onToggleReady={vi.fn().mockResolvedValue(undefined)}
          onUpdateSettings={vi.fn().mockResolvedValue(true)}
          onTransferHost={vi.fn().mockResolvedValue(true)}
        />
      );

      expect(renderedStr).toContain("กลับล็อบบี้แล้ว 2/4 คน");
    });

    it("formatSettingsSummary produces human-readable configuration string", () => {
      const summary = formatSettingsSummary(defaultSettings);
      expect(summary).toContain("โหมด: แย่งกดกริ่ง");
      expect(summary).toContain("10 ข้อ");
      expect(summary).toContain("ค้นหาชื่อเพลง");
    });
  });

  describe("useRoomRealtime Hook & Reducer isLobbyReady State Tracking", () => {
    it("parsePresencePlayers correctly parses isLobbyReady boolean flag", () => {
      const rawPresence = {
        key1: [
          {
            id: "p1",
            displayName: "Player 1",
            isHost: true,
            isReady: true,
            isLobbyReady: true,
            score: 150,
          },
          {
            id: "p2",
            displayName: "Player 2",
            isHost: false,
            isReady: false,
            isLobbyReady: false,
            score: 80,
          },
        ],
      };

      const players = parsePresencePlayers(rawPresence);
      expect(players).toHaveLength(2);
      expect(players[0].isLobbyReady).toBe(true);
      expect(players[1].isLobbyReady).toBe(false);
    });

    it("set_player_lobby_ready action updates isLobbyReady on target player and myPlayer", () => {
      const initialState = createInitialRoomRealtimeState("ROOM1", {
        id: "p1",
        displayName: "Me",
        isLobbyReady: false,
      });

      const nextState = reduceRoomRealtimeEvent(initialState, {
        type: "set_player_lobby_ready",
        playerId: "p1",
        isLobbyReady: true,
      });

      expect(nextState.myPlayer?.isLobbyReady).toBe(true);
      expect(nextState.players.find((p) => p.id === "p1")?.isLobbyReady).toBe(true);
    });

    it("round_start and room_state lobby reset isLobbyReady to false", () => {
      const stateWithReadyPlayers = {
        ...createInitialRoomRealtimeState("ROOM1", {
          id: "p1",
          displayName: "Me",
          isLobbyReady: true,
        }),
        players: [
          {
            id: "p1",
            displayName: "Me",
            isHost: true,
            isReady: true,
            isLobbyReady: true,
            score: 100,
            sessionToken: "s1",
            lastSeenAt: "",
          },
          {
            id: "p2",
            displayName: "Other",
            isHost: false,
            isReady: true,
            isLobbyReady: true,
            score: 50,
            sessionToken: "s2",
            lastSeenAt: "",
          },
        ],
      };

      // 1. round_start resets isLobbyReady
      const afterRoundStart = reduceRoomRealtimeEvent(stateWithReadyPlayers, {
        type: "broadcast",
        event: "round_start",
        payload: { round: 1 },
      });

      expect(afterRoundStart.players[0].isLobbyReady).toBe(false);
      expect(afterRoundStart.players[1].isLobbyReady).toBe(false);
      expect(afterRoundStart.myPlayer?.isLobbyReady).toBe(false);

      // 2. room_state lobby resets isLobbyReady
      const afterLobbyReset = reduceRoomRealtimeEvent(stateWithReadyPlayers, {
        type: "broadcast",
        event: "room_state",
        payload: { status: "lobby" },
      });

      expect(afterLobbyReset.players[0].isLobbyReady).toBe(false);
      expect(afterLobbyReset.players[1].isLobbyReady).toBe(false);
      expect(afterLobbyReset.myPlayer?.isLobbyReady).toBe(false);
    });

    it("presence_sync preserves myPlayer isLobbyReady when remote presence briefly omitted isLobbyReady", () => {
      const stateWithLobbyReady = {
        ...createInitialRoomRealtimeState("ROOM1", {
          id: "p1",
          displayName: "Me",
          isLobbyReady: true,
        }),
      };

      const syncState = reduceRoomRealtimeEvent(stateWithLobbyReady, {
        type: "presence_sync",
        players: [
          {
            id: "p1",
            displayName: "Me",
            isHost: false,
            isReady: false,
            isLobbyReady: false, // simulated missing/omitted key converted by parser to false
            score: 0,
            sessionToken: "",
            lastSeenAt: "",
          },
        ],
      });

      expect(syncState.myPlayer?.isLobbyReady).toBe(true);
      expect(syncState.players[0].isLobbyReady).toBe(true);
    });
  });
});
