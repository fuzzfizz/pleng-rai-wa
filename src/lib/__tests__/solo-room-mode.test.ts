import React from "react";
import { describe, it, expect } from "vitest";
import { renderToString } from "react-dom/server";
import { formatSettingsSummary } from "@/components/room/lobby-view";
import { getPerformanceBadge } from "@/components/room/podium-view";
import { RoomManageModal } from "@/components/room/room-manage-modal";
import { DEFAULT_ROOM_SETTINGS } from "@/lib/services/room-service";
import type { Player, RoomSettings } from "@/types";

describe("Solo Room Unification & Accuracy Tracking", () => {
  it("formats lobby settings summary with solo badge when isSolo is true", () => {
    const soloSettings: RoomSettings = {
      ...DEFAULT_ROOM_SETTINGS,
      isSolo: true,
      gameMode: "ai-lyrics",
      lyricsType: "intro",
    };

    const summary = formatSettingsSummary(soloSettings);
    expect(summary).toContain("🎮 เล่นคนเดียว (Solo)");
    expect(summary).toContain("AI อ่านเนื้อเพลง");
    expect(summary).toContain("ท่อนเปิด");
  });

  it("calculates performance badges accurately based on correct vs wrong answers", () => {
    // 100% Accuracy
    expect(getPerformanceBadge(10, 0)).toContain("100%");
    expect(getPerformanceBadge(10, 0)).toContain("หูทิพย์ระดับเทพ");

    // 80%+ Accuracy
    expect(getPerformanceBadge(8, 2)).toContain("80%");
    expect(getPerformanceBadge(8, 2)).toContain("เซียนเพลงตัวจริง");

    // 50%+ Accuracy
    expect(getPerformanceBadge(5, 5)).toContain("พอตัวเลยนะ");

    // < 50% Accuracy
    expect(getPerformanceBadge(2, 8)).toContain("วอร์มหูอีกนิด");

    // 0 rounds played
    expect(getPerformanceBadge(0, 0)).toContain("เล่นเพลินๆ");
  });

  it("formats AI lyrics choices with intro and chorus", () => {
    const chorusSettings: RoomSettings = {
      ...DEFAULT_ROOM_SETTINGS,
      gameMode: "ai-lyrics",
      lyricsType: "chorus",
    };
    expect(formatSettingsSummary(chorusSettings)).toContain("ท่อนฮุก");

    const introSettings: RoomSettings = {
      ...DEFAULT_ROOM_SETTINGS,
      gameMode: "ai-lyrics",
      lyricsType: "intro",
    };
    expect(formatSettingsSummary(introSettings)).toContain("ท่อนเปิด");
  });

  describe("RoomManageModal solo room safety guards", () => {
    const mockPlayers: Player[] = [
      {
        id: "player-solo",
        displayName: "Solo Host",
        isHost: true,
        isReady: true,
        isLobbyReady: true,
        score: 0,
        sessionToken: "token-solo",
        lastSeenAt: new Date().toISOString(),
      },
    ];

    it("returns null / empty markup when settings.isSolo is true even if isOpen is true", () => {
      const soloSettings: RoomSettings = {
        ...DEFAULT_ROOM_SETTINGS,
        isSolo: true,
      };

      const rendered = renderToString(
        React.createElement(RoomManageModal, {
          isOpen: true,
          onClose: () => {},
          players: mockPlayers,
          settings: soloSettings,
          currentHostPlayerId: "player-solo",
          onSaveSettings: async () => {},
          onTransferHost: async () => {},
        })
      );

      expect(rendered).toBe("");
    });

    it("renders modal content when isOpen is true and settings.isSolo is false", () => {
      const partySettings: RoomSettings = {
        ...DEFAULT_ROOM_SETTINGS,
        isSolo: false,
      };

      const rendered = renderToString(
        React.createElement(RoomManageModal, {
          isOpen: true,
          onClose: () => {},
          players: mockPlayers,
          settings: partySettings,
          currentHostPlayerId: "player-solo",
          onSaveSettings: async () => {},
          onTransferHost: async () => {},
        })
      );

      expect(rendered).toContain("จัดการห้อง");
      expect(rendered).toContain("จำนวนผู้เล่นสูงสุด");
    });
  });
});
