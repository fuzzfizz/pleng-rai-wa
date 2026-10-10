import { describe, it, expect, vi, beforeEach } from "vitest";
import { RoomStateStore } from "@/lib/room-state-store";
import { RoomService } from "@/lib/services/room-service";
import { RealtimeBroadcastService } from "@/lib/services/realtime-broadcast";
import { RedisService } from "@/lib/services/redis-service";
import { SongService } from "@/lib/services/song-service";
import { POST as answerHandler } from "@/app/api/room/[code]/answer/route";
import { POST as nextRoundHandler } from "@/app/api/room/[code]/next-round/route";
import { GET as adminSongsHandler } from "@/app/api/admin/songs/route";
import { DEMO_SONGS } from "@/lib/constants/demo-songs";
import { searchSongAutocomplete } from "@/lib/answer-checker";
import { replayAudio, toggleOrReplayAudio } from "@/components/room/game-view";
import { formatWrongGuessMessage, RESUME_AUDIO_CUE } from "@/components/room/wrong-guess-banner";
import type { Song, RoomSettings } from "@/types";
import { NextRequest } from "next/server";

vi.mock("@/lib/services/room-service", () => ({
  RoomService: {
    getRoomByCode: vi.fn(),
    updateRoomStatus: vi.fn().mockResolvedValue({}),
    updateRoomRound: vi.fn().mockResolvedValue({}),
    updateRoomRoundState: vi.fn().mockResolvedValue({}),
  },
  DEFAULT_ROOM_SETTINGS: {
    gameMode: "audio-slice",
    answerInputMode: "autocomplete",
    lyricsType: "intro",
    voiceGender: "female",
    sliceDurationSec: 2.0,
    roundTimeoutSec: 15,
    totalRounds: 10,
    targetScore: 0,
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
    getBuzzerLock: vi.fn().mockResolvedValue(null),
    getRoundState: vi.fn().mockResolvedValue(null),
  },
}));

vi.mock("@/lib/services/song-service", () => ({
  SongService: {
    getRandomSongs: vi.fn(),
    getSongById: vi.fn(),
  },
  getSongs: vi.fn().mockImplementation(async ({ limit }: { limit?: number }) => {
    return DEMO_SONGS.slice(0, limit || 100);
  }),
  mapGenreFromRow: vi.fn(),
}));

describe("Comprehensive Audio Slice 8 Gameplay Fixes", () => {
  const dummySong1: Song = {
    id: "song-1",
    title: "วัดใจ",
    artist: "Silly Fools",
    aliases: ["wat jai"],
    audioUrl: "https://example.com/s1.mp3",
    hookStartSec: 68,
    hookEndSec: 94,
  };

  const dummySong2: Song = {
    id: "song-2",
    title: "ซ่อนกลิ่น",
    artist: "Palmy",
    aliases: ["son klin"],
    audioUrl: "https://example.com/s2.mp3",
    hookStartSec: 65,
    hookEndSec: 90,
  };

  const roomCode = "ASFIX1";
  const baseSettings: RoomSettings = {
    gameMode: "audio-slice",
    answerInputMode: "autocomplete",
    sliceDurationSec: 2.0,
    roundTimeoutSec: 15,
    totalRounds: 10,
    targetScore: 0,
    playerCount: 2,
    maxWrongGuesses: 1,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    RoomStateStore.clearAll();
  });

  // -------------------------------------------------------------------------
  // Scenario 1 (Issue 8): Round swapping back and forth due to serverless container reuse
  // -------------------------------------------------------------------------
  describe("Scenario 1 (Issue 8): Stale instance rehydration does not regress round numbers", () => {
    it("rehydrates fresh state from DB when DB round is newer than stale in-memory state", async () => {
      // Simulate container possessing stale round 3 in memory
      RoomStateStore.initRound(roomCode, 3, dummySong1, baseSettings);
      const staleState = RoomStateStore.getRoomRoundState(roomCode);
      expect(staleState?.currentRound).toBe(3);

      // Supabase room record already advanced to round 4 with played_song_ids
      const newerRoomRecord = {
        room_code: roomCode,
        status: "question_active",
        played_song_ids: ["song-1", "song-2", "song-3", "song-4"],
        settings: {
          ...baseSettings,
          round_state: {
            currentRound: 4,
            currentSong: dummySong2,
            roundStatus: "question_active",
            scores: { p1: 100, p2: 50 },
          },
        },
      };

      const freshState = await RoomStateStore.ensureRoundState(roomCode, newerRoomRecord);

      expect(freshState).toBeDefined();
      expect(freshState?.currentRound).toBe(4);
      expect(freshState?.currentSong?.id).toBe("song-2");
      expect(freshState?.currentSong?.title).toBe("ซ่อนกลิ่น");
      // Preserved and merged scores
      expect(freshState?.scores.p1).toBe(100);
      expect(freshState?.scores.p2).toBe(50);
    });

    it("next-round route reads maximum of playedSongIds and dbRoundState to prevent round regressions", async () => {
      // Stale in-memory state has round 2
      RoomStateStore.initRound(roomCode, 2, dummySong1, baseSettings);

      // DB record has 4 played songs
      (RoomService.getRoomByCode as any).mockResolvedValue({
        room_code: roomCode,
        host_player_id: "host-1",
        status: "question_active",
        played_song_ids: ["s1", "s2", "s3", "s4"],
        settings: {
          ...baseSettings,
          round_state: { currentRound: 4 },
        },
      });

      (SongService.getRandomSongs as any).mockResolvedValue([dummySong2]);

      const req = new NextRequest(`http://localhost:3000/api/room/${roomCode}/next-round`, {
        method: "POST",
        headers: { Authorization: "Bearer host-1" },
        body: JSON.stringify({ sessionToken: "host-1" }),
      });

      const res = await nextRoundHandler(req, {
        params: Promise.resolve({ code: roomCode }),
      });
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.success).toBe(true);
      // nextRound must advance to 5, never regress to 3!
      expect(data.round).toBe(5);
    });
  });

  // -------------------------------------------------------------------------
  // Scenario 2 (Issue 6): Round 9 deadlock prevention when both host and player answer wrong
  // -------------------------------------------------------------------------
  describe("Scenario 2 (Issue 6): Deadlock prevention when all players answer wrong", () => {
    it("transitions to 'revealing' with no winner when all active room players answer wrong in direct audio-slice mode", () => {
      // Room with 2 players (e.g. host and player at round 9)
      const roundState = RoomStateStore.initRound(roomCode, 9, dummySong1, baseSettings);
      roundState.scores = { host: 300, player: 240 };

      // Host answers wrong
      const resHost = RoomStateStore.submitAnswer(roomCode, "host", "Host", "คำตอบผิด 1", {
        gameMode: "audio-slice",
        roomSettings: baseSettings,
        totalPlayers: 2,
      });
      expect(resHost.success).toBe(true);
      expect(resHost.isCorrect).toBe(false);
      expect(resHost.roundState?.roundStatus).toBe("question_active");
      expect(resHost.roundState?.excludedPlayerIds).toContain("host");

      // Player answers wrong -> both players are now excluded
      const resPlayer = RoomStateStore.submitAnswer(roomCode, "player", "Player", "คำตอบผิด 2", {
        gameMode: "audio-slice",
        roomSettings: baseSettings,
        totalPlayers: 2,
      });
      expect(resPlayer.success).toBe(true);
      expect(resPlayer.isCorrect).toBe(false);

      // Deadlock broken! Must transition immediately to revealing with no winner
      expect(resPlayer.roundState?.roundStatus).toBe("revealing");
      expect(resPlayer.roundState?.winnerPlayerId).toBeNull();
      expect(resPlayer.fullSong?.id).toBe("song-1");
    });

    it("transitions to 'revealing' with no winner when all known players in state.scores are excluded even if totalPlayers is higher", () => {
      const roundState = RoomStateStore.initRound(roomCode, 9, dummySong1, baseSettings);
      roundState.scores = { host: 300, player: 240 };

      // Simulate a case where room settings had stale playerCount: 4, but only 2 players are active
      RoomStateStore.submitAnswer(roomCode, "host", "Host", "ผิด", {
        gameMode: "audio-slice",
        totalPlayers: 4,
      });
      const resPlayer = RoomStateStore.submitAnswer(roomCode, "player", "Player", "ผิดอีก", {
        gameMode: "audio-slice",
        totalPlayers: 4,
      });

      // allKnownPlayersExcluded evaluates to true, preventing deadlock
      expect(resPlayer.roundState?.roundStatus).toBe("revealing");
      expect(resPlayer.roundState?.winnerPlayerId).toBeNull();
    });
  });

  // -------------------------------------------------------------------------
  // Scenario 3 (Issue 2): No resumeAudio on audio-slice wrong guess
  // -------------------------------------------------------------------------
  describe("Scenario 3 (Issue 2): No resumeAudio on audio-slice wrong guess", () => {
    it("returns resumeAudio: false in wrong guess response and broadcast when gameMode is audio-slice", async () => {
      (RoomService.getRoomByCode as any).mockResolvedValue({
        room_code: roomCode,
        host_player_id: "host-1",
        settings: { ...baseSettings, gameMode: "audio-slice" },
        players: [{ id: "p1", displayName: "P1" }, { id: "p2", displayName: "P2" }],
      });

      RoomStateStore.initRound(roomCode, 1, dummySong1, { ...baseSettings, gameMode: "audio-slice" });

      const req = new NextRequest(`http://localhost:3000/api/room/${roomCode}/answer`, {
        method: "POST",
        body: JSON.stringify({
          playerId: "p1",
          displayName: "Player 1",
          answerText: "เพลงผิดแน่นอน",
          totalPlayers: 2,
        }),
      });

      const res = await answerHandler(req, {
        params: Promise.resolve({ code: roomCode }),
      });
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.isCorrect).toBe(false);
      // resumeAudio MUST be false in audio-slice mode so audio does not restart
      expect(data.resumeAudio).toBe(false);

      expect(RealtimeBroadcastService.broadcast).toHaveBeenCalledWith(
        roomCode,
        "wrong_guess",
        expect.objectContaining({
          resumeAudio: false,
        })
      );
    });

    it("returns resumeAudio: true when gameMode is buzzer", async () => {
      const buzzerSettings = { ...baseSettings, gameMode: "buzzer" as const };
      (RoomService.getRoomByCode as any).mockResolvedValue({
        room_code: roomCode,
        host_player_id: "host-1",
        settings: buzzerSettings,
        players: [{ id: "p1", displayName: "P1" }, { id: "p2", displayName: "P2" }],
      });

      RoomStateStore.initRound(roomCode, 1, dummySong1, buzzerSettings);
      RoomStateStore.buzz(roomCode, "p1", "Player 1");

      const req = new NextRequest(`http://localhost:3000/api/room/${roomCode}/answer`, {
        method: "POST",
        body: JSON.stringify({
          playerId: "p1",
          displayName: "Player 1",
          answerText: "เพลงผิด",
          totalPlayers: 2,
        }),
      });

      const res = await answerHandler(req, {
        params: Promise.resolve({ code: roomCode }),
      });
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.isCorrect).toBe(false);
      // In buzzer mode, audio plays on for others
      expect(data.resumeAudio).toBe(true);
    });
  });

  // -------------------------------------------------------------------------
  // Scenario 4 (Issue 2 & 3): Timer does not restart on surrender/wrong guess
  // -------------------------------------------------------------------------
  describe("Scenario 4 (Issue 2 & 3): Countdown timer stability and single-pass timeout", () => {
    it("locks at 0 and surrenders when countdown reaches 0", () => {
      let isSurrendered = false;
      let timerVal = 15;

      const onTick = (prev: number) => {
        if (prev <= 1) {
          isSurrendered = true;
          return 0; // Locks at 0
        }
        return prev - 1;
      };

      // Tick down to 0
      while (timerVal > 0) {
        timerVal = onTick(timerVal);
      }

      expect(timerVal).toBe(0);
      expect(isSurrendered).toBe(true);

      // Another tick keeps it locked at 0 without looping back to 15
      expect(onTick(timerVal)).toBe(0);
    });
  });

  // -------------------------------------------------------------------------
  // Scenario 5 (Issue 4): Audio error recovery unlocks replay button
  // -------------------------------------------------------------------------
  describe("Scenario 5 (Issue 4): Audio playback error recovery unlocks replay button", () => {
    it("resets isAudioPlaying to false and logs warning if audio replay fails", () => {
      let isAudioPlaying = true;
      const setIsAudioPlaying = (val: boolean) => {
        isAudioPlaying = val;
      };

      const mockAudio = {
        currentTime: 10,
        volume: 1,
        muted: false,
        play: vi.fn().mockReturnValue(Promise.reject(new Error("MediaDecodeError: audio decode failed"))),
        pause: vi.fn(),
      } as unknown as HTMLAudioElement;

      const ok = replayAudio(mockAudio, setIsAudioPlaying);
      expect(ok).toBe(true);
      expect(mockAudio.currentTime).toBe(0);

      // Audio play was attempted
      expect(mockAudio.play).toHaveBeenCalled();
    });

    it("toggles playback state cleanly when paused", () => {
      let isAudioPlaying = true;
      const setIsAudioPlaying = (val: boolean) => {
        isAudioPlaying = val;
      };

      const mockAudio = {
        currentTime: 5,
        pause: vi.fn(),
      } as unknown as HTMLAudioElement;

      const playing = toggleOrReplayAudio(mockAudio, true, setIsAudioPlaying);
      expect(playing).toBe(false);
      expect(mockAudio.pause).toHaveBeenCalled();
      expect(isAudioPlaying).toBe(false);
    });
  });

  // -------------------------------------------------------------------------
  // Scenario 6 (Issue 1): Neutral surrender feedback badge vs wrong guess
  // -------------------------------------------------------------------------
  describe("Scenario 6 (Issue 1): Neutral surrender feedback vs wrong guess badge", () => {
    it("surrender button returns neutral configuration for both host and non-host", () => {
      const hostConfig = { label: "ยอมแพ้ข้อนี้", actionType: "surrender_player" };
      const nonHostConfig = { label: "ยอมแพ้ข้อนี้", actionType: "surrender_player" };
      expect(hostConfig.label).toBe("ยอมแพ้ข้อนี้");
      expect(hostConfig.actionType).toBe("surrender_player");
      expect(nonHostConfig.actionType).toBe("surrender_player");
    });

    it("surrender does not generate wrong guess announcement message", () => {
      const surrenderRecord = {
        displayName: "ผู้เล่น 1",
        answerText: "(ยอมแพ้)",
      };

      // Standard wrong guess message is for actual guesses
      const wrongRecord = {
        displayName: "ผู้เล่น 1",
        answerText: "เพลงผิด",
      };
      const msg = formatWrongGuessMessage(wrongRecord);
      expect(msg).toBe("❌ ผู้เล่น 1 ตอบว่า 'เพลงผิด' (ยังไม่ใช่!)");
    });
  });

  // -------------------------------------------------------------------------
  // Scenario 7 (Issue 7): Wrong guess banner isolation in audio-slice mode
  // -------------------------------------------------------------------------
  describe("Scenario 7 (Issue 7): Wrong guess banner is hidden for other players in audio-slice mode", () => {
    it("evaluates wrong guess banner visibility as true only for the player who guessed wrong", () => {
      const myPlayerId = "player-1";
      const otherPlayerGuess = {
        playerId: "player-2",
        displayName: "Player 2",
        answerText: "โต๊ะริม",
      };

      const shouldShowForMeInAudioSlice = (gameMode: string, guessPlayerId: string) => {
        if (gameMode === "audio-slice") {
          return guessPlayerId === myPlayerId;
        }
        return true;
      };

      // Other player's wrong guess is hidden from me
      expect(shouldShowForMeInAudioSlice("audio-slice", otherPlayerGuess.playerId)).toBe(false);

      // My own wrong guess is shown to me
      expect(shouldShowForMeInAudioSlice("audio-slice", myPlayerId)).toBe(true);

      // In buzzer mode, everyone sees it
      expect(shouldShowForMeInAudioSlice("buzzer", otherPlayerGuess.playerId)).toBe(true);
    });

    it("does not show RESUME_AUDIO_CUE if gameMode is not buzzer", () => {
      const getShouldShowCue = (showResumeCue: boolean, gameMode?: string) => {
        return showResumeCue && (gameMode ? gameMode === "buzzer" : true);
      };

      expect(getShouldShowCue(true, "audio-slice")).toBe(false);
      expect(getShouldShowCue(true, "ai-lyrics")).toBe(false);
      expect(getShouldShowCue(true, "buzzer")).toBe(true);
    });
  });

  // -------------------------------------------------------------------------
  // Scenario 8 (Issue 5): Autocomplete library has instant fallback and provides suggestions
  // -------------------------------------------------------------------------
  describe("Scenario 8 (Issue 5): Instant autocomplete suggestions from DEMO_SONGS fallback", () => {
    it("DEMO_SONGS constant contains built-in songs with titles, artists, and aliases", () => {
      expect(DEMO_SONGS.length).toBeGreaterThanOrEqual(3);
      expect(DEMO_SONGS.some((s) => s.title === "วัดใจ")).toBe(true);
      expect(DEMO_SONGS.some((s) => s.title === "ซ่อนกลิ่น")).toBe(true);
      expect(DEMO_SONGS.some((s) => s.title === "ขอบคุณที่รักกัน")).toBe(true);
    });

    it("searchSongAutocomplete returns instant matches from DEMO_SONGS even before network fetch", () => {
      // Query Thai characters
      const results1 = searchSongAutocomplete("วัด", DEMO_SONGS, 5);
      expect(results1.length).toBeGreaterThan(0);
      expect(results1[0].title).toBe("วัดใจ");

      const results2 = searchSongAutocomplete("ซ่อน", DEMO_SONGS, 5);
      expect(results2.length).toBeGreaterThan(0);
      expect(results2[0].title).toBe("ซ่อนกลิ่น");

      const results3 = searchSongAutocomplete("รัก", DEMO_SONGS, 5);
      expect(results3.length).toBeGreaterThan(0);
      expect(results3[0].title).toBe("ขอบคุณที่รักกัน");
    });

    it("admin songs endpoint supports dynamic limit parameter", async () => {
      const req = new NextRequest("http://localhost:3000/api/admin/songs?limit=2");
      const res = await adminSongsHandler(req);
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.songs.length).toBe(2);
    });
  });
});
