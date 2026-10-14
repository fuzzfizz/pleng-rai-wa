import { describe, it, expect, beforeEach } from "vitest";
import { RoomStateStore, toSongDomain } from "@/lib/room-state-store";
import { SongService } from "@/lib/services/song-service";
import type { Song, RoomSettings } from "@/types";

describe("Audio Slice Song Fidelity & Rehydration", () => {
  const ROOM_CODE = "FIDEL1";

  const song1: Song = {
    id: "song-uuid-1",
    title: "วัดใจ",
    artist: "Silly Fools",
    aliases: ["wat jai"],
    releaseYear: 2004,
    genreId: "rock",
    era: "2000s",
    audioUrl: "https://r2.dev/song-1.mp3",
    hookStartSec: 68,
    durationSec: 260,
  };

  const song2: Song = {
    id: "song-uuid-2",
    title: "ซ่อนกลิ่น",
    artist: "Palmy",
    aliases: ["son klin"],
    releaseYear: 2018,
    genreId: "pop",
    era: "2010s",
    audioUrl: "https://r2.dev/song-2.mp3",
    hookStartSec: 65,
    durationSec: 250,
  };

  const defaultSettings: RoomSettings = {
    gameMode: "audio-slice",
    totalRounds: 5,
    roundTimeoutSec: 15,
  };

  beforeEach(() => {
    RoomStateStore.clearAll();
  });

  it("invalidates stale in-memory state when DB has round 1 (game restarted) but memory has round 5", async () => {
    // 1. Initialize round 5 in memory (simulating leftover state from completed game on this container)
    RoomStateStore.initRound(ROOM_CODE, 5, song1, defaultSettings);
    const existing = RoomStateStore.getRoomRoundState(ROOM_CODE);
    expect(existing?.currentRound).toBe(5);
    expect(existing?.currentSong.title).toBe("วัดใจ");

    // 2. DB represents a brand new game starting at round 1 with song2
    const dbRoom = {
      room_code: ROOM_CODE,
      status: "question_active",
      current_song_id: song2.id,
      played_song_ids: [song2.id],
      settings: {
        ...defaultSettings,
        round_state: RoomStateStore.serializeRoundState({
          ...existing!,
          currentRound: 1,
          currentSong: song2,
          roundStatus: "question_active",
        }),
      },
    };

    // 3. ensureRoundState MUST detect that memory round 5 is stale compared to DB round 1
    const rehydrated = await RoomStateStore.ensureRoundState(ROOM_CODE, dbRoom);
    expect(rehydrated).toBeDefined();
    expect(rehydrated?.currentRound).toBe(1);
    expect(rehydrated?.currentSong.id).toBe(song2.id);
    expect(rehydrated?.currentSong.title).toBe("ซ่อนกลิ่น");
  });

  it("invalidates in-memory state when DB current_song_id differs from memory currentSong.id even if round number is the same", async () => {
    // 1. Initialize round 1 with song1 in memory
    RoomStateStore.initRound(ROOM_CODE, 1, song1, defaultSettings);
    const existing = RoomStateStore.getRoomRoundState(ROOM_CODE);
    expect(existing?.currentSong.id).toBe("song-uuid-1");

    // 2. DB has round 1 but with song2 (e.g. host skipped or replaced song)
    const dbRoom = {
      room_code: ROOM_CODE,
      status: "question_active",
      current_song_id: song2.id,
      played_song_ids: [song2.id],
      settings: {
        ...defaultSettings,
        round_state: {
          currentRound: 1,
          currentSong: song2,
          roundStatus: "question_active",
        },
      },
    };

    // 3. ensureRoundState MUST detect the song mismatch and load song2
    const rehydrated = await RoomStateStore.ensureRoundState(ROOM_CODE, dbRoom);
    expect(rehydrated).toBeDefined();
    expect(rehydrated?.currentSong.id).toBe(song2.id);
    expect(rehydrated?.currentSong.title).toBe("ซ่อนกลิ่น");
  });
});
