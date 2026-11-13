import { describe, it, expect, vi, beforeEach } from "vitest";
import { prepareSettingsPayload } from "../host-settings-modal";
import { formatSettingsSummary } from "../lobby-view";
import {
  PROGRESSIVE_SLICE_STEPS,
  getProgressiveStep,
  calculatePointsForSliceStep,
  getNextSliceStep,
} from "@/lib/audio-slice-utils";
import { RoomStateStore } from "@/lib/room-state-store";
import { RoomService } from "@/lib/services/room-service";
import { SongService } from "@/lib/services/song-service";
import { POST as nextRoundHandler } from "@/app/api/room/[code]/next-round/route";
import { NextRequest } from "next/server";
import type { RoomSettings, Song } from "@/types";

vi.mock("@/lib/services/room-service", () => ({
  RoomService: {
    getRoomByCode: vi.fn(),
    updateRoomStatus: vi.fn().mockResolvedValue({}),
    updateRoomRound: vi.fn().mockResolvedValue({}),
    updateRoomRoundState: vi.fn().mockResolvedValue({}),
    isCallerHost: vi.fn().mockReturnValue(true),
  },
  DEFAULT_ROOM_SETTINGS: {
    gameMode: "audio-slice",
    sliceType: "progressive",
    answerInputMode: "autocomplete",
    sliceDurationSec: 2.0,
    roundTimeoutSec: 15,
    totalRounds: 5,
    targetScore: 0,
  },
}));

vi.mock("@/lib/services/song-service", () => ({
  SongService: {
    getRandomSongs: vi.fn(),
  },
}));

vi.mock("@/lib/services/realtime-broadcast", () => ({
  RealtimeBroadcastService: {
    broadcast: vi.fn().mockResolvedValue({}),
  },
}));

vi.mock("@/lib/services/redis-service", () => ({
  RedisService: {
    isRedisAvailable: vi.fn().mockReturnValue(false),
    releaseBuzzerLock: vi.fn().mockResolvedValue(true),
    saveRoundState: vi.fn().mockResolvedValue(true),
    deleteRoom: vi.fn().mockResolvedValue(true),
  },
}));

describe("Progressive Audio Slice Mode - Host Settings & Progression", () => {
  const dummySong: Song = {
    id: "song-123",
    title: "รักแท้",
    artist: "NuNew",
    aliases: ["True Love"],
    audioUrl: "https://example.com/audio.mp3",
    hookStartSec: 45,
    hookEndSec: 65,
    durationSec: 210,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    RoomStateStore.clearAll();
  });

  describe("1. prepareSettingsPayload - sliceType normalization & defaults", () => {
    it("defaults sliceType to 'progressive' when gameMode is audio-slice and sliceType is omitted", () => {
      const payload = prepareSettingsPayload({
        gameMode: "audio-slice",
      });

      expect(payload.sliceType).toBe("progressive");
    });

    it("preserves sliceType 'progressive' as primary option", () => {
      const payload = prepareSettingsPayload({
        gameMode: "audio-slice",
        sliceType: "progressive",
      });

      expect(payload.sliceType).toBe("progressive");
    });

    it("preserves sliceType 'fixed' when explicitly selected", () => {
      const payload = prepareSettingsPayload({
        gameMode: "audio-slice",
        sliceType: "fixed",
        sliceDurationSec: 5.0,
      });

      expect(payload.sliceType).toBe("fixed");
      expect(payload.sliceDurationSec).toBe(5.0);
    });

    it("normalizes invalid sliceType string to 'progressive'", () => {
      const payload = prepareSettingsPayload({
        gameMode: "audio-slice",
        sliceType: "invalid-type" as any,
      });

      expect(payload.sliceType).toBe("progressive");
    });
  });

  describe("2. formatSettingsSummary (Lobby Badge Preview)", () => {
    it("displays 'เสี้ยววินาที: ไต่ระดับ (0.1s - 4.0s)' when sliceType is progressive", () => {
      const settings: RoomSettings = {
        gameMode: "audio-slice",
        sliceType: "progressive",
        answerInputMode: "autocomplete",
        sliceDurationSec: 2.0,
        roundTimeoutSec: 15,
        totalRounds: 10,
        targetScore: 0,
      };

      const summary = formatSettingsSummary(settings);
      expect(summary).toContain("เสี้ยววินาที: ไต่ระดับ (0.1s - 4.0s)");
    });

    it("defaults to progressive badge when sliceType is undefined for audio-slice", () => {
      const settings: RoomSettings = {
        gameMode: "audio-slice",
        answerInputMode: "autocomplete",
        sliceDurationSec: 2.0,
        roundTimeoutSec: 15,
        totalRounds: 10,
        targetScore: 0,
      };

      const summary = formatSettingsSummary(settings);
      expect(summary).toContain("เสี้ยววินาที: ไต่ระดับ (0.1s - 4.0s)");
    });

    it("displays fixed duration in seconds when sliceType is 'fixed'", () => {
      const settings: RoomSettings = {
        gameMode: "audio-slice",
        sliceType: "fixed",
        answerInputMode: "autocomplete",
        sliceDurationSec: 5.0,
        roundTimeoutSec: 15,
        totalRounds: 10,
        targetScore: 0,
      };

      const summary = formatSettingsSummary(settings);
      expect(summary).toContain("5 วินาที");
      expect(summary).not.toContain("ไต่ระดับ");
    });
  });

  describe("3. Progressive Ladder Constants & Points Scoring", () => {
    it("has 5 distinct steps with exact durations and points specified", () => {
      expect(PROGRESSIVE_SLICE_STEPS).toHaveLength(5);

      expect(PROGRESSIVE_SLICE_STEPS[0]).toEqual({
        step: 1,
        durationSec: 0.1,
        points: 100,
        label: "0.1s",
      });
      expect(PROGRESSIVE_SLICE_STEPS[1]).toEqual({
        step: 2,
        durationSec: 0.5,
        points: 80,
        label: "0.5s",
      });
      expect(PROGRESSIVE_SLICE_STEPS[2]).toEqual({
        step: 3,
        durationSec: 1.0,
        points: 60,
        label: "1.0s",
      });
      expect(PROGRESSIVE_SLICE_STEPS[3]).toEqual({
        step: 4,
        durationSec: 2.0,
        points: 40,
        label: "2.0s",
      });
      expect(PROGRESSIVE_SLICE_STEPS[4]).toEqual({
        step: 5,
        durationSec: 4.0,
        points: 20,
        label: "4.0s",
      });
    });

    it("calculates points accurately with and without hints, maintaining 20pt floor", () => {
      // Step 1: 100 pts
      expect(calculatePointsForSliceStep(1)).toBe(100);
      expect(calculatePointsForSliceStep(1, 15)).toBe(85); // genre hint (-15)

      // Step 2: 80 pts
      expect(calculatePointsForSliceStep(2)).toBe(80);
      expect(calculatePointsForSliceStep(2, 20)).toBe(60); // year hint (-20)

      // Step 3: 60 pts
      expect(calculatePointsForSliceStep(3)).toBe(60);

      // Step 4: 40 pts
      expect(calculatePointsForSliceStep(4)).toBe(40);

      // Step 5: 20 pts
      expect(calculatePointsForSliceStep(5)).toBe(20);

      // Minimum guaranteed floor: 20 pts
      expect(calculatePointsForSliceStep(5, 35)).toBe(20);
      expect(calculatePointsForSliceStep(4, 35)).toBe(20);
    });

    it("handles next slice step progression correctly", () => {
      expect(getNextSliceStep(1)?.step).toBe(2);
      expect(getNextSliceStep(2)?.step).toBe(3);
      expect(getNextSliceStep(3)?.step).toBe(4);
      expect(getNextSliceStep(4)?.step).toBe(5);
      expect(getNextSliceStep(5)).toBeNull();
    });
  });

  describe("4. Next Round Generation (0.1s Initial Duration for Progressive Mode)", () => {
    it("sets durationSec to 0.1 for progressive audio slice mode", async () => {
      const roomCode = "PROG01";
      const progressiveSettings: RoomSettings = {
        gameMode: "audio-slice",
        sliceType: "progressive",
        answerInputMode: "autocomplete",
        sliceDurationSec: 2.0,
        roundTimeoutSec: 15,
        totalRounds: 5,
        targetScore: 0,
      };

      (RoomService.getRoomByCode as any).mockResolvedValue({
        room_code: roomCode,
        host_player_id: "host-user",
        status: "lobby",
        settings: progressiveSettings,
        players: [{ id: "host-user", isHost: true }],
      });

      (SongService.getRandomSongs as any).mockResolvedValue([dummySong]);

      const req = new NextRequest(`http://localhost:3000/api/room/${roomCode}/next-round`, {
        method: "POST",
        body: JSON.stringify({ playerId: "host-user" }),
      });

      const res = await nextRoundHandler(req, {
        params: Promise.resolve({ code: roomCode }),
      });
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.durationSec).toBe(0.1);
      expect(data.sliceUrl).toContain("duration=0.1");
      expect(data.sliceType).toBe("progressive");
      expect(data.sliceStep).toBe(1);

      const state = RoomStateStore.getRoomRoundState(roomCode);
      expect(state?.sliceDurationSec).toBe(0.1);
    });

    it("sets durationSec to custom sliceDurationSec when sliceType is fixed", async () => {
      const roomCode = "FIXED1";
      const fixedSettings: RoomSettings = {
        gameMode: "audio-slice",
        sliceType: "fixed",
        sliceDurationSec: 5.0,
        answerInputMode: "autocomplete",
        roundTimeoutSec: 15,
        totalRounds: 5,
        targetScore: 0,
      };

      (RoomService.getRoomByCode as any).mockResolvedValue({
        room_code: roomCode,
        host_player_id: "host-user",
        status: "lobby",
        settings: fixedSettings,
        players: [{ id: "host-user", isHost: true }],
      });

      (SongService.getRandomSongs as any).mockResolvedValue([dummySong]);

      const req = new NextRequest(`http://localhost:3000/api/room/${roomCode}/next-round`, {
        method: "POST",
        body: JSON.stringify({ playerId: "host-user" }),
      });

      const res = await nextRoundHandler(req, {
        params: Promise.resolve({ code: roomCode }),
      });
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.durationSec).toBe(5.0);
      expect(data.sliceUrl).toContain("duration=5");
      expect(data.sliceType).toBe("fixed");
    });
  });
});
