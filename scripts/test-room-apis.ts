// ==========================================
// เพลงไรวะ (Pleng-Rai-Wa) - Room API Tests
// ==========================================

import assert from "node:assert";
import { NextRequest } from "next/server";
import { POST as createRoomHandler } from "../src/app/api/room/create/route";
import { POST as joinRoomHandler } from "../src/app/api/room/join/route";
import { GET as getRoomStateHandler, sanitizeRoomState } from "../src/app/api/room/[code]/state/route";
import { POST as updateSettingsHandler } from "../src/app/api/room/[code]/settings/route";
import { RoomService, DEFAULT_ROOM_SETTINGS } from "../src/lib/services/room-service";
import type { RoomRow, RoomSettings } from "../src/types";

function createMockRequest(url: string, method: string, body?: any): NextRequest {
  const init: RequestInit = {
    method,
    headers: { "Content-Type": "application/json" },
  };
  if (body !== undefined) {
    init.body = typeof body === "string" ? body : JSON.stringify(body);
  }
  return new NextRequest(new URL(url, "http://localhost:3000"), init as any);
}

// In-memory mock store for simulating RoomService in API integration tests
const mockRooms = new Map<string, any>();

function setupMockRoomService() {
  RoomService.createRoom = async (
    hostDisplayName: string,
    initialSettings?: Partial<RoomSettings>
  ) => {
    const playerId = "host-player-uuid-123";
    const sessionToken = "host-session-uuid-123";
    const roomCode = "ABC234";

    const room: RoomRow = {
      id: "room-uuid-123",
      room_code: roomCode,
      host_player_id: playerId,
      status: "lobby",
      settings: { ...DEFAULT_ROOM_SETTINGS, ...initialSettings } as any,
      current_song_id: null,
      played_song_ids: [],
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    mockRooms.set(roomCode, { ...room, songs: null });

    return {
      roomCode,
      sessionToken,
      playerId,
      room,
    };
  };

  RoomService.getRoomByCode = async (code: string) => {
    if (!code || typeof code !== "string") return null;
    return mockRooms.get(code.trim().toUpperCase()) || null;
  };

  RoomService.updateRoomSettings = async (
    code: string,
    settings: Partial<RoomSettings>
  ) => {
    const clean = code.trim().toUpperCase();
    const existing = mockRooms.get(clean);
    if (!existing) throw new Error("Room not found");
    const updated = {
      ...existing,
      settings: { ...existing.settings, ...settings },
      updated_at: new Date().toISOString(),
    };
    mockRooms.set(clean, updated);
    return updated;
  };

  RoomService.updateRoomStatus = async (code: string, status: string) => {
    const clean = code.trim().toUpperCase();
    const existing = mockRooms.get(clean);
    if (!existing) throw new Error("Room not found");
    const updated = {
      ...existing,
      status,
      updated_at: new Date().toISOString(),
    };
    mockRooms.set(clean, updated);
    return updated;
  };

  RoomService.transferHost = async (code: string, newHostPlayerId: string) => {
    const clean = code.trim().toUpperCase();
    const existing = mockRooms.get(clean);
    if (!existing) throw new Error("Room not found");
    const updated = {
      ...existing,
      host_player_id: newHostPlayerId,
      updated_at: new Date().toISOString(),
    };
    mockRooms.set(clean, updated);
    return updated;
  };
}

async function runTests() {
  console.log("==========================================");
  console.log("Running Room Management API Verification");
  console.log("==========================================\n");

  setupMockRoomService();

  // ----------------------------------------------------
  // Test 1: POST /api/room/create Validation & Success
  // ----------------------------------------------------
  console.log("Test 1: POST /api/room/create...");

  // 1.1 Missing / empty displayName
  {
    const req = createMockRequest("http://localhost:3000/api/room/create", "POST", {
      hostDisplayName: "",
    });
    const res = await createRoomHandler(req);
    assert.strictEqual(res.status, 400, "Should return 400 for empty displayName");
    const data = await res.json();
    assert.strictEqual(data.success, false);
    assert.ok(data.error.includes("1 ถึง 30 ตัวอักษร"));
  }

  // 1.2 Overly long displayName (>30 chars)
  {
    const req = createMockRequest("http://localhost:3000/api/room/create", "POST", {
      hostDisplayName: "A".repeat(31),
    });
    const res = await createRoomHandler(req);
    assert.strictEqual(res.status, 400, "Should return 400 for displayName > 30 chars");
    const data = await res.json();
    assert.strictEqual(data.success, false);
  }

  // 1.3 Invalid JSON body
  {
    const req = createMockRequest("http://localhost:3000/api/room/create", "POST", "{invalid-json");
    const res = await createRoomHandler(req);
    assert.strictEqual(res.status, 400, "Should return 400 for malformed json");
    const data = await res.json();
    assert.strictEqual(data.success, false);
  }

  // 1.4 Successful room creation
  {
    const req = createMockRequest("http://localhost:3000/api/room/create", "POST", {
      hostDisplayName: "DJ TestHost",
      settings: { roundTimeoutSec: 20 },
    });
    const res = await createRoomHandler(req);
    assert.strictEqual(res.status, 201, "Should return 201 on success");
    const data = await res.json();
    assert.strictEqual(data.success, true);
    assert.strictEqual(data.roomCode, "ABC234");
    assert.strictEqual(data.playerId, "host-player-uuid-123");
    assert.strictEqual(data.sessionToken, "host-session-uuid-123");
    assert.strictEqual(data.isHost, true);
    assert.ok(data.room);
    assert.strictEqual(data.room.settings.roundTimeoutSec, 20);
  }
  console.log("✓ Passed: POST /api/room/create validates input and returns 201 with room data.");

  // ----------------------------------------------------
  // Test 2: POST /api/room/join Validation & Success
  // ----------------------------------------------------
  console.log("\nTest 2: POST /api/room/join...");

  // 2.1 Invalid room code format
  {
    const req = createMockRequest("http://localhost:3000/api/room/join", "POST", {
      roomCode: "INVALID123",
      displayName: "Player 1",
    });
    const res = await joinRoomHandler(req);
    assert.strictEqual(res.status, 400, "Should return 400 for invalid room code");
    const data = await res.json();
    assert.strictEqual(data.success, false);
    assert.ok(data.error.includes("รหัสห้องไม่ถูกต้อง"));
  }

  // 2.2 Invalid displayName
  {
    const req = createMockRequest("http://localhost:3000/api/room/join", "POST", {
      roomCode: "ABC234",
      displayName: "",
    });
    const res = await joinRoomHandler(req);
    assert.strictEqual(res.status, 400, "Should return 400 for empty displayName");
    const data = await res.json();
    assert.strictEqual(data.success, false);
  }

  // 2.3 Non-existent room code
  {
    const req = createMockRequest("http://localhost:3000/api/room/join", "POST", {
      roomCode: "XYZ999",
      displayName: "Player 2",
    });
    const res = await joinRoomHandler(req);
    assert.strictEqual(res.status, 404, "Should return 404 for missing room");
    const data = await res.json();
    assert.strictEqual(data.success, false);
    assert.strictEqual(data.error, "ไม่พบห้องนี้ในระบบ");
  }

  // 2.4 Room with status 'game_over'
  {
    mockRooms.set("OVER99", {
      id: "over-uuid",
      room_code: "OVER99",
      host_player_id: "host-1",
      status: "game_over",
      settings: DEFAULT_ROOM_SETTINGS,
      current_song_id: null,
      played_song_ids: [],
    });
    const req = createMockRequest("http://localhost:3000/api/room/join", "POST", {
      roomCode: "OVER99",
      displayName: "Player Late",
    });
    const res = await joinRoomHandler(req);
    assert.strictEqual(res.status, 400, "Should return 400 when game_over");
    const data = await res.json();
    assert.strictEqual(data.success, false);
    assert.strictEqual(data.error, "เกมในห้องนี้จบลงแล้ว");
  }

  // 2.5 Successful join as normal player (new session token)
  {
    const req = createMockRequest("http://localhost:3000/api/room/join", "POST", {
      roomCode: "abc234", // lowercase test
      displayName: "Guest Player",
    });
    const res = await joinRoomHandler(req);
    assert.strictEqual(res.status, 200, "Should return 200 for normal join");
    const data = await res.json();
    assert.strictEqual(data.success, true);
    assert.strictEqual(data.roomCode, "ABC234");
    assert.ok(data.sessionToken);
    assert.ok(data.playerId);
    assert.strictEqual(data.isHost, false, "New player should not be host");
    assert.deepStrictEqual(data.room, {
      id: "room-uuid-123",
      roomCode: "ABC234",
      status: "lobby",
      settings: mockRooms.get("ABC234").settings,
    });
  }

  // 2.6 Rejoining as host with existingSessionToken === host_player_id
  {
    const req = createMockRequest("http://localhost:3000/api/room/join", "POST", {
      roomCode: "ABC234",
      displayName: "DJ Host Reconnecting",
      existingSessionToken: "host-player-uuid-123",
    });
    const res = await joinRoomHandler(req);
    assert.strictEqual(res.status, 200);
    const data = await res.json();
    assert.strictEqual(data.success, true);
    assert.strictEqual(data.isHost, true, "Reconnecting host should be detected as host");
    assert.strictEqual(data.sessionToken, "host-player-uuid-123", "Should reuse existing session token");
  }
  console.log("✓ Passed: POST /api/room/join handles validation, 404, game_over, guest join & host reconnect.");

  // ----------------------------------------------------
  // Test 3: GET /api/room/[code]/state & Anti-Cheat Sanitization
  // ----------------------------------------------------
  console.log("\nTest 3: GET /api/room/[code]/state & Anti-Cheat Sanitization...");

  // 3.1 Invalid room code
  {
    const req = createMockRequest("http://localhost:3000/api/room/INVALID/state", "GET");
    const res = await getRoomStateHandler(req, {
      params: Promise.resolve({ code: "INVALID" }),
    });
    assert.strictEqual(res.status, 400);
    const data = await res.json();
    assert.strictEqual(data.success, false);
  }

  // 3.2 Room not found
  {
    const req = createMockRequest("http://localhost:3000/api/room/NOTFND/state", "GET");
    const res = await getRoomStateHandler(req, {
      params: Promise.resolve({ code: "NOTFND" }),
    });
    assert.strictEqual(res.status, 404);
    const data = await res.json();
    assert.strictEqual(data.success, false);
    assert.strictEqual(data.error, "ไม่พบห้องนี้ในระบบ");
  }

  // 3.3 Active room (lobby/question_active/playing) - Anti-Cheat Sanitization
  {
    const roomWithSecret = {
      id: "room-active-123",
      room_code: "SECR01",
      host_player_id: "host-uuid",
      status: "question_active",
      settings: DEFAULT_ROOM_SETTINGS,
      current_song_id: "song-secret-999",
      played_song_ids: [],
      songs: {
        id: "song-secret-999",
        title: "รักแรก (First Love)",
        artist: "NONT TANONT",
        aliases: ["รักแรก", "first love"],
        audio_url: "https://example.com/audio.mp3",
        hook_start_sec: 45,
        hook_end_sec: 65,
        duration_sec: 210,
        lyrics_intro: "เธอทำให้ฉันรู้...",
        lyrics_chorus: "รักแรกมันลืมยาก...",
        metadata: { youtubeSearchQuery: "รักแรก non tanont" },
      },
    };
    mockRooms.set("SECR01", roomWithSecret);

    const req = createMockRequest("http://localhost:3000/api/room/SECR01/state", "GET");
    const res = await getRoomStateHandler(req, {
      params: Promise.resolve({ code: "SECR01" }),
    });
    assert.strictEqual(res.status, 200);
    const data = await res.json();
    assert.strictEqual(data.success, true);
    assert.ok(data.room);
    assert.ok(data.room.songs);

    // Verify secrets are completely stripped
    assert.strictEqual(data.room.songs.title, undefined, "Title must be stripped in question_active");
    assert.strictEqual(data.room.songs.artist, undefined, "Artist must be stripped in question_active");
    assert.strictEqual(data.room.songs.aliases, undefined, "Aliases must be stripped in question_active");
    assert.strictEqual(data.room.songs.lyrics_intro, undefined, "Lyrics intro must be stripped");
    assert.strictEqual(data.room.songs.lyrics_chorus, undefined, "Lyrics chorus must be stripped");
    assert.strictEqual(data.room.songs.metadata, undefined, "Metadata must be stripped");

    // Verify non-secret gameplay data is preserved
    assert.strictEqual(data.room.songs.id, "song-secret-999");
    assert.strictEqual(data.room.songs.audio_url, "https://example.com/audio.mp3");
    assert.strictEqual(data.room.songs.hook_start_sec, 45);
  }

  // 3.4 Revealing status - Secrets allowed
  {
    mockRooms.get("SECR01").status = "revealing";
    const req = createMockRequest("http://localhost:3000/api/room/SECR01/state", "GET");
    const res = await getRoomStateHandler(req, {
      params: Promise.resolve({ code: "SECR01" }),
    });
    assert.strictEqual(res.status, 200);
    const data = await res.json();
    assert.strictEqual(data.room.songs.title, "รักแรก (First Love)");
    assert.strictEqual(data.room.songs.artist, "NONT TANONT");
    assert.strictEqual(data.room.songs.lyrics_chorus, "รักแรกมันลืมยาก...");
  }

  // 3.5 Game Over status - Secrets allowed
  {
    mockRooms.get("SECR01").status = "game_over";
    const req = createMockRequest("http://localhost:3000/api/room/SECR01/state", "GET");
    const res = await getRoomStateHandler(req, {
      params: Promise.resolve({ code: "SECR01" }),
    });
    assert.strictEqual(res.status, 200);
    const data = await res.json();
    assert.strictEqual(data.room.songs.title, "รักแรก (First Love)");
  }
  console.log("✓ Passed: GET /api/room/[code]/state correctly sanitizes secrets during play and reveals them on reveal/game_over.");

  // ----------------------------------------------------
  // Test 4: POST /api/room/[code]/settings
  // ----------------------------------------------------
  console.log("\nTest 4: POST /api/room/[code]/settings...");

  // 4.1 Invalid room code
  {
    const req = createMockRequest("http://localhost:3000/api/room/SHORT/settings", "POST", {
      settings: { roundTimeoutSec: 30 },
    });
    const res = await updateSettingsHandler(req, {
      params: Promise.resolve({ code: "SHORT" }),
    });
    assert.strictEqual(res.status, 400);
    const data = await res.json();
    assert.strictEqual(data.success, false);
  }

  // 4.2 Room not found
  {
    const req = createMockRequest("http://localhost:3000/api/room/ZZZ888/settings", "POST", {
      settings: { roundTimeoutSec: 30 },
    });
    const res = await updateSettingsHandler(req, {
      params: Promise.resolve({ code: "ZZZ888" }),
    });
    assert.strictEqual(res.status, 404);
    const data = await res.json();
    assert.strictEqual(data.success, false);
  }

  // 4.3 Update settings
  {
    const req = createMockRequest("http://localhost:3000/api/room/ABC234/settings", "POST", {
      settings: {
        gameMode: "ai-lyrics",
        totalRounds: 15,
        roundTimeoutSec: 25,
      },
    });
    const res = await updateSettingsHandler(req, {
      params: Promise.resolve({ code: "ABC234" }),
    });
    assert.strictEqual(res.status, 200);
    const data = await res.json();
    assert.strictEqual(data.success, true);
    assert.strictEqual(data.room.settings.gameMode, "ai-lyrics");
    assert.strictEqual(data.room.settings.totalRounds, 15);
    assert.strictEqual(data.room.settings.roundTimeoutSec, 25);
  }

  // 4.4 Transfer host
  {
    const req = createMockRequest("http://localhost:3000/api/room/ABC234/settings", "POST", {
      newHostPlayerId: "new-player-host-999",
    });
    const res = await updateSettingsHandler(req, {
      params: Promise.resolve({ code: "ABC234" }),
    });
    assert.strictEqual(res.status, 200);
    const data = await res.json();
    assert.strictEqual(data.success, true);
    assert.strictEqual(data.room.host_player_id, "new-player-host-999");
  }
  console.log("✓ Passed: POST /api/room/[code]/settings updates settings and transfers host properly.");

  // ----------------------------------------------------
  // Test 5: Direct sanitizeRoomState helper tests
  // ----------------------------------------------------
  console.log("\nTest 5: sanitizeRoomState helper function...");
  {
    const raw = {
      status: "playing",
      currentSong: {
        title: "Song A",
        artist: "Artist B",
        aliases: ["A"],
        lyrics_intro: "intro",
        lyrics_chorus: "chorus",
        id: "song-1",
      },
    };
    const sanitized = sanitizeRoomState(raw);
    assert.strictEqual(sanitized.currentSong.id, "song-1");
    assert.strictEqual(sanitized.currentSong.title, undefined);
    assert.strictEqual(sanitized.currentSong.artist, undefined);
    assert.strictEqual(sanitized.currentSong.lyrics_chorus, undefined);
  }
  console.log("✓ Passed: sanitizeRoomState helper handles currentSong object.");

  console.log("\n==========================================");
  console.log("All Room Management API tests passed successfully!");
  console.log("==========================================");
}

runTests().catch((err) => {
  console.error("Test failed:", err);
  process.exit(1);
});
