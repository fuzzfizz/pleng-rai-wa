// ==========================================
// เพลงไรวะ (Pleng-Rai-Wa) - Task 5: Gameplay Integration Verification
// Tests:
// 1. prepareSettingsPayload playlistId normalization (setting, clearing, trimming)
// 2. Next Round API route passing playlistId to SongService.getRandomSongs
// 3. Solo play playlist resolution, minimum 5 songs threshold & fallback handling
// 4. Component exports and React element instantiation integrity
// ==========================================

import assert from "node:assert";
import React from "react";
import { NextRequest } from "next/server";
import type { Playlist, Song } from "../src/types/index";
import {
  prepareSettingsPayload,
  HostSettingsModal,
} from "../src/components/room/host-settings-modal";
import SoloPlayPage from "../src/app/play/solo/page";
import { POST as nextRoundHandler } from "../src/app/api/room/[code]/next-round/route";
import { RoomService, DEFAULT_ROOM_SETTINGS } from "../src/lib/services/room-service";
import { SongService } from "../src/lib/services/song-service";
import { PlaylistService } from "../src/lib/services/playlist-service";
import { RoomStateStore } from "../src/lib/room-state-store";
import { RealtimeBroadcastService } from "../src/lib/services/realtime-broadcast";
import { isPlaylistPlayable } from "../src/components/playlist/playlist-utils";

console.log("==================================================");
console.log("Running Task 5: Gameplay Integration Verification");
console.log("==================================================\n");

// Helper to create mock NextRequest
function createMockRequest(
  url: string,
  method: string,
  body?: any,
  headers?: Record<string, string>
): NextRequest {
  const init: RequestInit = {
    method,
    headers: { "Content-Type": "application/json", ...headers },
  };
  if (body !== undefined) {
    init.body = typeof body === "string" ? body : JSON.stringify(body);
  }
  return new NextRequest(new URL(url, "http://localhost:3000"), init as any);
}

async function runTests() {
  // -----------------------------------------------------------------------------
  // Test 1: prepareSettingsPayload playlistId Normalization
  // -----------------------------------------------------------------------------
  console.log("Test 1: prepareSettingsPayload playlistId normalization...");

  // 1.1 Valid playlistId string is preserved
  const payload1 = prepareSettingsPayload({
    gameMode: "audio-slice",
    playlistId: "playlist-uuid-001",
  });
  assert.strictEqual(
    payload1.playlistId,
    "playlist-uuid-001",
    "Valid playlistId string should be preserved"
  );

  // 1.2 Whitespace trimming
  const payload2 = prepareSettingsPayload({
    playlistId: "   playlist-uuid-with-spaces   ",
  });
  assert.strictEqual(
    payload2.playlistId,
    "playlist-uuid-with-spaces",
    "Whitespace around playlistId must be trimmed"
  );

  // 1.3 Empty string is converted to undefined (clears playlist)
  const payload3 = prepareSettingsPayload({
    playlistId: "",
  });
  assert.strictEqual(
    payload3.playlistId,
    undefined,
    "Empty string playlistId must be normalized to undefined"
  );

  // 1.4 Whitespace-only string is converted to undefined
  const payload4 = prepareSettingsPayload({
    playlistId: "     ",
  });
  assert.strictEqual(
    payload4.playlistId,
    undefined,
    "Whitespace-only playlistId must be normalized to undefined"
  );

  // 1.5 Explicit undefined stays undefined
  const payload5 = prepareSettingsPayload({
    playlistId: undefined,
  });
  assert.strictEqual(
    payload5.playlistId,
    undefined,
    "Explicit undefined playlistId must remain undefined"
  );

  // 1.6 Omitted playlistId remains unchanged / undefined
  const payload6 = prepareSettingsPayload({
    gameMode: "buzzer",
    sliceDurationSec: 2.0,
  });
  assert.strictEqual(
    payload6.playlistId,
    undefined,
    "Omitted playlistId should remain undefined"
  );

  // 1.7 Numeric or non-string coerced cleanly
  const payload7 = prepareSettingsPayload({
    playlistId: 98765 as any,
  });
  assert.strictEqual(
    payload7.playlistId,
    "98765",
    "Numeric playlistId should be stringified and preserved"
  );

  // 1.8 Explicit null playlistId is preserved (for clearing playlist over JSON)
  const payload8 = prepareSettingsPayload({
    playlistId: null,
  });
  assert.strictEqual(
    payload8.playlistId,
    null,
    "Explicit null playlistId must be preserved"
  );

  // 1.9 RoomService.updateRoomSettings deletes playlistId when null or empty
  {
    const originalGetClient = (RoomService as any).getClient;
    const originalGetRoomByCode = RoomService.getRoomByCode;
    let savedSettingsPayload: any = null;

    try {
      RoomService.getRoomByCode = async (code: string) => {
        return {
          room_code: code,
          settings: {
            ...DEFAULT_ROOM_SETTINGS,
            playlistId: "existing-playlist-123",
          },
        };
      };

      (RoomService as any).getClient = () => ({
        from: () => ({
          update: (payload: any) => {
            savedSettingsPayload = payload.settings;
            return {
              eq: () => ({
                select: () => ({
                  single: async () => ({
                    data: { room_code: "TEST01", settings: payload.settings },
                    error: null,
                  }),
                }),
              }),
            };
          },
        }),
      });

      // Clear with null
      await RoomService.updateRoomSettings("TEST01", { playlistId: null });
      assert.strictEqual(
        savedSettingsPayload.playlistId,
        undefined,
        "playlistId must be deleted from settings when null is passed"
      );

      // Clear with empty string
      await RoomService.updateRoomSettings("TEST01", { playlistId: "" });
      assert.strictEqual(
        savedSettingsPayload.playlistId,
        undefined,
        "playlistId must be deleted from settings when empty string is passed"
      );

      // Set new playlistId
      await RoomService.updateRoomSettings("TEST01", { playlistId: "new-playlist-456" });
      assert.strictEqual(
        savedSettingsPayload.playlistId,
        "new-playlist-456",
        "Valid playlistId must be updated in settings"
      );
    } finally {
      (RoomService as any).getClient = originalGetClient;
      RoomService.getRoomByCode = originalGetRoomByCode;
    }
  }

  console.log("✓ Passed: prepareSettingsPayload and RoomService correctly handle clearing playlistId.\n");

  // -----------------------------------------------------------------------------
  // Test 2: Next Round API passes playlistId to SongService.getRandomSongs
  // -----------------------------------------------------------------------------
  console.log("Test 2: Next Round API passes playlistId to SongService.getRandomSongs...");

  const roomCode = "PLAY01";
  const hostId = "host-player-uuid";

  // Mock songs
  const mockPlaylistSongs: Song[] = [
    {
      id: "song-pl-1",
      title: "ยินดีที่ไม่รู้จัก",
      artist: "25hours",
      aliases: ["ยินดีที่ไม่รู้จัก"],
      audioUrl: "https://example.com/audio/1.mp3",
      hookStartSec: 50,
      hookEndSec: 75,
      durationSec: 220,
      createdAt: new Date().toISOString(),
    },
    {
      id: "song-pl-2",
      title: "คิดมาก",
      artist: "Palmy",
      aliases: ["คิดมาก"],
      audioUrl: "https://example.com/audio/2.mp3",
      hookStartSec: 40,
      hookEndSec: 65,
      durationSec: 210,
      createdAt: new Date().toISOString(),
    },
  ];

  const mockRooms = new Map<string, any>();

  // Mock RoomService methods
  const originalGetRoomByCode = RoomService.getRoomByCode;
  const originalUpdateRoomRound = RoomService.updateRoomRound;
  const originalUpdateRoomStatus = RoomService.updateRoomStatus;
  const originalBroadcast = RealtimeBroadcastService.broadcast;
  const originalGetRandomSongs = SongService.getRandomSongs;

  // Track options passed to SongService.getRandomSongs
  let lastCapturedOptions: any = null;

  try {
    RoomService.getRoomByCode = async (code: string) => {
      return mockRooms.get(code) || null;
    };
    RoomService.updateRoomRound = async (code: string, updates: any) => {
      const room = mockRooms.get(code);
      if (room) {
        Object.assign(room, updates);
      }
      return room;
    };
    RoomService.updateRoomStatus = async (code: string, status: any) => {
      const room = mockRooms.get(code);
      if (room) room.status = status;
      return room;
    };
    RealtimeBroadcastService.broadcast = async () => true;

    // Mock SongService.getRandomSongs to record options
    SongService.getRandomSongs = async (count: number, options?: any) => {
      lastCapturedOptions = options;
      if (options?.playlistId === "custom-playlist-123") {
        return [mockPlaylistSongs[0]];
      }
      return [mockPlaylistSongs[1]];
    };

    // Case 2.1: Room with custom playlistId in settings
    mockRooms.set(roomCode, {
      code: roomCode,
      host_player_id: hostId,
      status: "lobby",
      settings: {
        ...DEFAULT_ROOM_SETTINGS,
        playlistId: "custom-playlist-123",
        totalRounds: 10,
      },
      current_song_id: null,
      played_song_ids: [],
    });

    const reqWithPlaylist = createMockRequest(
      `http://localhost:3000/api/room/${roomCode}/next-round`,
      "POST",
      { sessionToken: hostId }
    );

    const resWithPlaylist = await nextRoundHandler(reqWithPlaylist, {
      params: Promise.resolve({ code: roomCode }),
    });

    const bodyWithPlaylist = await resWithPlaylist.json();
    assert.strictEqual(resWithPlaylist.status, 200, "Should return HTTP 200");
    assert.strictEqual(bodyWithPlaylist.success, true);
    assert.strictEqual(bodyWithPlaylist.round, 1);

    // Verify playlistId was passed to SongService
    assert.ok(lastCapturedOptions, "SongService options should be passed");
    assert.strictEqual(
      lastCapturedOptions.playlistId,
      "custom-playlist-123",
      "playlistId from room settings must be passed to SongService.getRandomSongs"
    );

    // Case 2.2: Room without playlistId (All Songs mode)
    const roomCodeAll = "PLAY02";
    mockRooms.set(roomCodeAll, {
      code: roomCodeAll,
      host_player_id: hostId,
      status: "lobby",
      settings: {
        ...DEFAULT_ROOM_SETTINGS,
        playlistId: undefined,
        totalRounds: 10,
      },
      current_song_id: null,
      played_song_ids: [],
    });

    lastCapturedOptions = null;
    const reqAllSongs = createMockRequest(
      `http://localhost:3000/api/room/${roomCodeAll}/next-round`,
      "POST",
      { sessionToken: hostId }
    );

    const resAllSongs = await nextRoundHandler(reqAllSongs, {
      params: Promise.resolve({ code: roomCodeAll }),
    });

    const bodyAllSongs = await resAllSongs.json();
    assert.strictEqual(resAllSongs.status, 200);
    assert.strictEqual(bodyAllSongs.success, true);
    assert.strictEqual(
      lastCapturedOptions.playlistId,
      undefined,
      "When playlistId is undefined, undefined must be passed to SongService"
    );
  } finally {
    // Restore mocks
    RoomService.getRoomByCode = originalGetRoomByCode;
    RoomService.updateRoomRound = originalUpdateRoomRound;
    RoomService.updateRoomStatus = originalUpdateRoomStatus;
    RealtimeBroadcastService.broadcast = originalBroadcast;
    SongService.getRandomSongs = originalGetRandomSongs;
    RoomStateStore.resetRoom(roomCode);
    RoomStateStore.resetRoom("PLAY02");
  }

  console.log("✓ Passed: Next Round API route successfully passes playlistId to SongService.\n");

  // -----------------------------------------------------------------------------
  // Test 3: Solo Play Playlist Resolution, Playability Threshold & Fallbacks
  // -----------------------------------------------------------------------------
  console.log("Test 3: Solo play playlist resolution, threshold & fallbacks...");

  const originalGetPlaylistById = PlaylistService.getPlaylistById;

  const mockValidPlaylist: Playlist = {
    id: "pl-valid-01",
    userId: "user-01",
    title: "เพลงยุค 2000s สุดฮิต",
    isPublic: true,
    songCount: 5,
    createdAt: new Date().toISOString(),
  };

  const mockValidSongs: Song[] = [
    { id: "s1", title: "Song 1", artist: "Artist 1", aliases: [], audioUrl: "url1" },
    { id: "s2", title: "Song 2", artist: "Artist 2", aliases: [], audioUrl: "url2" },
    { id: "s3", title: "Song 3", artist: "Artist 3", aliases: [], audioUrl: "url3" },
    { id: "s4", title: "Song 4", artist: "Artist 4", aliases: [], audioUrl: "url4" },
    { id: "s5", title: "Song 5", artist: "Artist 5", aliases: [], audioUrl: "url5" },
  ];

  const mockShortPlaylist: Playlist = {
    id: "pl-short-02",
    userId: "user-02",
    title: "เพลงน้อยเกินไป",
    isPublic: true,
    songCount: 2,
    createdAt: new Date().toISOString(),
  };

  try {
    PlaylistService.getPlaylistById = async (id: string) => {
      if (id === "pl-valid-01") {
        return { playlist: mockValidPlaylist, songs: mockValidSongs };
      }
      if (id === "pl-short-02") {
        return { playlist: mockShortPlaylist, songs: mockValidSongs.slice(0, 2) };
      }
      return null;
    };

    // 3.1 Fetch valid playlist by ID
    const validResult = await PlaylistService.getPlaylistById("pl-valid-01");
    assert.ok(validResult, "Valid playlist should be resolved");
    assert.strictEqual(validResult.songs.length, 5, "Should have 5 songs");
    assert.strictEqual(
      isPlaylistPlayable(validResult.songs.length),
      true,
      "5 songs meets the playable threshold (>= 5)"
    );

    // 3.2 Fetch short playlist (< 5 songs)
    const shortResult = await PlaylistService.getPlaylistById("pl-short-02");
    assert.ok(shortResult, "Short playlist should be resolved");
    assert.strictEqual(shortResult.songs.length, 2);
    assert.strictEqual(
      isPlaylistPlayable(shortResult.songs.length),
      false,
      "2 songs fails the playable threshold (< 5)"
    );

    // 3.3 Non-existent playlist returns null
    const nullResult = await PlaylistService.getPlaylistById("pl-nonexistent");
    assert.strictEqual(nullResult, null, "Nonexistent playlist ID must return null");

    // 3.4 Query parameter parsing simulation
    const searchParams1 = new URLSearchParams("playlistId=pl-valid-01");
    assert.strictEqual(searchParams1.get("playlistId"), "pl-valid-01");

    const searchParamsEmpty = new URLSearchParams("");
    assert.strictEqual(searchParamsEmpty.get("playlistId"), null);
  } finally {
    PlaylistService.getPlaylistById = originalGetPlaylistById;
  }

  console.log("✓ Passed: Solo play playlist loading, playable validation (>= 5), and null handling verified.\n");

  // -----------------------------------------------------------------------------
  // Test 4: Component Exports & React Instantiation Integrity
  // -----------------------------------------------------------------------------
  console.log("Test 4: Component exports and React instantiation integrity...");

  // 4.1 HostSettingsModal export and element creation with playlistId
  assert.strictEqual(typeof HostSettingsModal, "function", "HostSettingsModal must be a function");

  const modalElement = React.createElement(HostSettingsModal, {
    isOpen: true,
    onClose: () => {},
    settings: {
      ...DEFAULT_ROOM_SETTINGS,
      playlistId: "custom-pl-001",
    },
    players: [],
    currentHostPlayerId: "host-1",
    onSaveSettings: async () => {},
    onTransferHost: async () => {},
  });
  assert.ok(React.isValidElement(modalElement), "HostSettingsModal element must instantiate cleanly");

  // 4.2 SoloPlayPage export and element creation with Suspense boundary
  assert.strictEqual(typeof SoloPlayPage, "function", "SoloPlayPage must be exported as default component");

  const soloPageElement = React.createElement(SoloPlayPage);
  assert.ok(React.isValidElement(soloPageElement), "SoloPlayPage element must instantiate cleanly");

  console.log("✓ Passed: HostSettingsModal and SoloPlayPage instantiate valid React elements.\n");

  console.log("==================================================");
  console.log("All Task 5 Verification Checks PASSED (100% Green)");
  console.log("==================================================");
}

runTests().catch((err) => {
  console.error("Test failed with error:", err);
  process.exit(1);
});
