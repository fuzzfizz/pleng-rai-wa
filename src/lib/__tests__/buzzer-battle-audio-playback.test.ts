import { describe, it, expect, vi, beforeEach } from "vitest";
import { DEFAULT_ROOM_SETTINGS, RoomService } from "@/lib/services/room-service";
import { prepareSettingsPayload } from "@/components/room/host-settings-modal";
import { shouldLoopAudio } from "@/components/room/game-view";
import { formatSettingsSummary } from "@/components/room/lobby-view";
import { RoomStateStore } from "@/lib/room-state-store";
import { SongService } from "@/lib/services/song-service";
import { RealtimeBroadcastService } from "@/lib/services/realtime-broadcast";
import { POST as nextRoundHandler } from "@/app/api/room/[code]/next-round/route";
import type { Song, RoomSettings } from "@/types";
import { NextRequest } from "next/server";

vi.mock("@/lib/services/room-service", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/services/room-service")>();
  return {
    ...actual,
    RoomService: {
      getRoomByCode: vi.fn(),
      updateRoomStatus: vi.fn(),
      updateRoomRound: vi.fn().mockResolvedValue({}),
      updateRoomRoundState: vi.fn().mockResolvedValue({}),
    },
  };
});

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

describe("Buzzer Battle Audio Playback & Settings (should fix.md)", () => {
  const roomCode = "BUZZ01";

  const mockSong: Song = {
    id: "song-buzz-1",
    title: "เพลงท่อนฮุกโดนๆ",
    artist: "ศิลปินคุณภาพ",
    aliases: ["Hit Song"],
    audioUrl: "https://example.com/song.mp3",
    hookStartSec: 52,
    hookEndSec: 78,
    durationSec: 215,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    RoomStateStore.clearAll();
  });

  // 1. Default room settings has buzzerPlayRegion: "hook"
  describe("1. Default Room Settings", () => {
    it("has buzzerPlayRegion set to 'hook' by default", () => {
      expect(DEFAULT_ROOM_SETTINGS.buzzerPlayRegion).toBe("hook");
    });
  });

  // 2. prepareSettingsPayload normalizes buzzerPlayRegion
  describe("2. prepareSettingsPayload normalizations", () => {
    it("preserves 'hook' when valid", () => {
      const payload = prepareSettingsPayload({ buzzerPlayRegion: "hook" });
      expect(payload.buzzerPlayRegion).toBe("hook");
    });

    it("preserves 'entire_song' when valid", () => {
      const payload = prepareSettingsPayload({ buzzerPlayRegion: "entire_song" });
      expect(payload.buzzerPlayRegion).toBe("entire_song");
    });

    it("normalizes invalid or unknown buzzerPlayRegion values to 'hook'", () => {
      const payload1 = prepareSettingsPayload({ buzzerPlayRegion: "intro_only" as any });
      expect(payload1.buzzerPlayRegion).toBe("hook");

      const payload2 = prepareSettingsPayload({ buzzerPlayRegion: "random" as any });
      expect(payload2.buzzerPlayRegion).toBe("hook");
    });
  });

  // 3. Next round route sets startSec = hookStartSec for hook and 0 for entire_song with full duration
  describe("3. Next Round Route Buzzer Playback", () => {
    it("starts from hookStartSec with full song duration for buzzerPlayRegion = 'hook'", async () => {
      (RoomService.getRoomByCode as any).mockResolvedValue({
        room_code: roomCode,
        host_player_id: "host-1",
        settings: {
          gameMode: "buzzer",
          buzzerPlayRegion: "hook",
          totalRounds: 5,
        },
        played_song_ids: [],
      });

      (SongService.getRandomSongs as any).mockResolvedValueOnce([mockSong]);

      const req = new NextRequest(`http://localhost:3000/api/room/${roomCode}/next-round`, {
        method: "POST",
        body: JSON.stringify({ sessionToken: "host-1" }),
      });

      const response = await nextRoundHandler(req, {
        params: Promise.resolve({ code: roomCode }),
      });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);

      const state = RoomStateStore.getRoomRoundState(roomCode);
      expect(state).toBeDefined();
      expect(state?.sliceStartSec).toBe(52);
      expect(state?.sliceDurationSec).toBe(215);
      expect(state?.sliceUrl).toBe(
        `/api/audio/slice?id=${encodeURIComponent(mockSong.id)}&start=52&duration=215`
      );

      expect(RealtimeBroadcastService.broadcast).toHaveBeenCalledWith(
        roomCode,
        "round_start",
        expect.objectContaining({
          sliceUrl: `/api/audio/slice?id=${encodeURIComponent(mockSong.id)}&start=52&duration=215`,
          durationSec: 215,
        })
      );
    });

    it("starts from 0:00 with full song duration for buzzerPlayRegion = 'entire_song'", async () => {
      (RoomService.getRoomByCode as any).mockResolvedValue({
        room_code: roomCode,
        host_player_id: "host-1",
        settings: {
          gameMode: "buzzer",
          buzzerPlayRegion: "entire_song",
          totalRounds: 5,
        },
        played_song_ids: [],
      });

      (SongService.getRandomSongs as any).mockResolvedValueOnce([mockSong]);

      const req = new NextRequest(`http://localhost:3000/api/room/${roomCode}/next-round`, {
        method: "POST",
        body: JSON.stringify({ sessionToken: "host-1" }),
      });

      const response = await nextRoundHandler(req, {
        params: Promise.resolve({ code: roomCode }),
      });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);

      const state = RoomStateStore.getRoomRoundState(roomCode);
      expect(state).toBeDefined();
      expect(state?.sliceStartSec).toBe(0);
      expect(state?.sliceDurationSec).toBe(215);
      expect(state?.sliceUrl).toBe(
        `/api/audio/slice?id=${encodeURIComponent(mockSong.id)}&start=0&duration=215`
      );
    });

    it("falls back to 300 seconds if song has no durationSec", async () => {
      const songWithoutDuration: Song = {
        ...mockSong,
        durationSec: 0,
        hookStartSec: 30,
      };

      (RoomService.getRoomByCode as any).mockResolvedValue({
        room_code: roomCode,
        host_player_id: "host-1",
        settings: {
          gameMode: "buzzer",
          buzzerPlayRegion: "hook",
          totalRounds: 5,
        },
        played_song_ids: [],
      });

      (SongService.getRandomSongs as any).mockResolvedValueOnce([songWithoutDuration]);

      const req = new NextRequest(`http://localhost:3000/api/room/${roomCode}/next-round`, {
        method: "POST",
        body: JSON.stringify({ sessionToken: "host-1" }),
      });

      const response = await nextRoundHandler(req, {
        params: Promise.resolve({ code: roomCode }),
      });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);

      const state = RoomStateStore.getRoomRoundState(roomCode);
      expect(state?.sliceStartSec).toBe(30);
      expect(state?.sliceDurationSec).toBe(300);
    });

    it("falls back to 0 if song hookStartSec is 0 or negative", async () => {
      const songWithoutHook: Song = {
        ...mockSong,
        hookStartSec: 0,
      };

      (RoomService.getRoomByCode as any).mockResolvedValue({
        room_code: roomCode,
        host_player_id: "host-1",
        settings: {
          gameMode: "buzzer",
          buzzerPlayRegion: "hook",
          totalRounds: 5,
        },
        played_song_ids: [],
      });

      (SongService.getRandomSongs as any).mockResolvedValueOnce([songWithoutHook]);

      const req = new NextRequest(`http://localhost:3000/api/room/${roomCode}/next-round`, {
        method: "POST",
        body: JSON.stringify({ sessionToken: "host-1" }),
      });

      const response = await nextRoundHandler(req, {
        params: Promise.resolve({ code: roomCode }),
      });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);

      const state = RoomStateStore.getRoomRoundState(roomCode);
      expect(state?.sliceStartSec).toBe(0);
    });
  });

  // 4. shouldLoopAudio("buzzer") returns false
  describe("4. shouldLoopAudio", () => {
    it("returns false for buzzer mode", () => {
      expect(shouldLoopAudio("buzzer")).toBe(false);
    });

    it("returns false for audio-slice mode", () => {
      expect(shouldLoopAudio("audio-slice")).toBe(false);
    });
  });

  // 5. formatSettingsSummary in lobby shows "เริ่มจากท่อนฮุก" / "เริ่มจากต้นเพลง" for buzzer mode
  describe("5. formatSettingsSummary for Buzzer Mode", () => {
    const baseSettings: RoomSettings = {
      gameMode: "buzzer",
      answerInputMode: "autocomplete",
      sliceDurationSec: 2.0,
      roundTimeoutSec: 15,
      totalRounds: 10,
      targetScore: 0,
    };

    it("displays 'เริ่มจากท่อนฮุก' when buzzerPlayRegion is 'hook'", () => {
      const summary = formatSettingsSummary({
        ...baseSettings,
        buzzerPlayRegion: "hook",
      });
      expect(summary).toContain("โหมด: แย่งกดกริ่ง");
      expect(summary).toContain("เริ่มจากท่อนฮุก");
      expect(summary).not.toContain("เริ่มจากต้นเพลง");
    });

    it("displays 'เริ่มจากท่อนฮุก' when buzzerPlayRegion is undefined (default behavior)", () => {
      const summary = formatSettingsSummary({
        ...baseSettings,
        buzzerPlayRegion: undefined,
      });
      expect(summary).toContain("โหมด: แย่งกดกริ่ง");
      expect(summary).toContain("เริ่มจากท่อนฮุก");
    });

    it("displays 'เริ่มจากต้นเพลง' when buzzerPlayRegion is 'entire_song'", () => {
      const summary = formatSettingsSummary({
        ...baseSettings,
        buzzerPlayRegion: "entire_song",
      });
      expect(summary).toContain("โหมด: แย่งกดกริ่ง");
      expect(summary).toContain("เริ่มจากต้นเพลง");
      expect(summary).not.toContain("เริ่มจากท่อนฮุก");
    });
  });
});
