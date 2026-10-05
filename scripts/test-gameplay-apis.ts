// ==========================================
// เพลงไรวะ (Pleng-Rai-Wa) - Gameplay & Buzzer Arbitration API Tests
// Comprehensive verification for Task 3:
// 1. Next round progression & anti-cheat secret redaction
// 2. FCFS buzzer locking & duplicate rejection (409)
// 3. Non-buzzer answer rejection (403)
// 4. Wrong guess handling (-20 penalty, buzzer unlocked, exclusion)
// 5. Excluded player cannot re-buzz same round (409 already_guessed_wrong)
// 6. Second player buzzes successfully
// 7. Correct guess handling (+100 points, round reveal with song metadata)
// 8. Buzzer timeout penalty & release
// 9. Total rounds limit & game over progression
// ==========================================

import assert from "node:assert";
import { NextRequest } from "next/server";
import { POST as nextRoundHandler } from "../src/app/api/room/[code]/next-round/route";
import { POST as buzzHandler } from "../src/app/api/room/[code]/buzz/route";
import { POST as answerHandler } from "../src/app/api/room/[code]/answer/route";
import { GET as getRoomStateHandler } from "../src/app/api/room/[code]/state/route";
import { RoomService, DEFAULT_ROOM_SETTINGS } from "../src/lib/services/room-service";
import { SongService } from "../src/lib/services/song-service";
import { RoomStateStore } from "../src/lib/room-state-store";
import { RealtimeBroadcastService } from "../src/lib/services/realtime-broadcast";
import type { Song, RoomRow, RoomSettings } from "../src/types";

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

// In-memory mock store for room and songs
const mockRooms = new Map<string, any>();

const mockSongs: Song[] = [
  {
    id: "song-uuid-001",
    title: "รักแท้",
    artist: "NuNew",
    aliases: ["True Love", "รักแท้ (True Love)"],
    audioUrl: "https://example.com/audio/rak-tae.mp3",
    hookStartSec: 45,
    hookEndSec: 65,
    durationSec: 210,
    lyricsIntro: "เคยคิดว่ารักแท้มันไม่มีอยู่จริง",
    lyricsChorus: "รักแท้ รักแท้ แม้ระยะทางไกลแค่ไหน",
    createdAt: new Date().toISOString(),
  },
  {
    id: "song-uuid-002",
    title: "ทรงอย่างแบด",
    artist: "Paper Planes",
    aliases: ["Bad Boy", "ทรงอย่างแบด (Bad Boy)"],
    audioUrl: "https://example.com/audio/bad-boy.mp3",
    hookStartSec: 30,
    hookEndSec: 50,
    durationSec: 190,
    lyricsIntro: "ยู้ววว",
    lyricsChorus: "ทรงอย่างแบด แซดอย่างบ่อย เธอเข้ามาอ่อยแล้วก็ทิ้งไป",
    createdAt: new Date().toISOString(),
  },
];

function setupMocks() {
  mockRooms.clear();
  RoomStateStore.clearAll();
  RealtimeBroadcastService.clearAllListeners();

  const testRoomCode = "TEST99";
  const hostPlayerId = "host-player-uuid";

  const room: RoomRow = {
    id: "room-db-uuid-1",
    room_code: testRoomCode,
    host_player_id: hostPlayerId,
    status: "lobby",
    settings: {
      ...DEFAULT_ROOM_SETTINGS,
      totalRounds: 2,
      sliceDurationSec: 2.0,
      gameMode: "buzzer",
    } as any,
    current_song_id: null,
    played_song_ids: [],
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  mockRooms.set(testRoomCode, { ...room, songs: null });

  RoomService.getRoomByCode = async (code: string) => {
    if (!code) return null;
    return mockRooms.get(code.trim().toUpperCase()) || null;
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

  RoomService.updateRoomRound = async (code: string, updates: any) => {
    const clean = code.trim().toUpperCase();
    const existing = mockRooms.get(clean);
    if (!existing) throw new Error("Room not found");
    const updated = {
      ...existing,
      ...updates,
      current_song_id:
        updates.currentSongId !== undefined
          ? updates.currentSongId
          : existing.current_song_id,
      played_song_ids:
        updates.playedSongIds !== undefined
          ? updates.playedSongIds
          : existing.played_song_ids,
      status: updates.status !== undefined ? updates.status : existing.status,
      updated_at: new Date().toISOString(),
    };
    // If current_song_id changed, attach full song object for join / state lookups
    if (updated.current_song_id) {
      updated.songs =
        mockSongs.find((s) => s.id === updated.current_song_id) || null;
    }
    mockRooms.set(clean, updated);
    return updated;
  };

  SongService.getRandomSongs = async (count: number, options?: any) => {
    const excludeSet = new Set(options?.excludeIds || []);
    const available = mockSongs.filter((s) => !excludeSet.has(s.id));
    return available.slice(0, count);
  };
}

async function runGameplayTests() {
  console.log("==========================================");
  console.log("Running Realtime Gameplay & Buzzer Tests");
  console.log("==========================================\n");

  setupMocks();

  const roomCode = "TEST99";
  const hostId = "host-player-uuid";
  const player1Id = "p1-alice";
  const player2Id = "p2-bob";

  // Capture broadcast events
  const broadcastEvents: Array<{ event: string; payload: any }> = [];
  RealtimeBroadcastService.subscribe(roomCode, (event, payload) => {
    broadcastEvents.push({ event, payload });
  });

  // ----------------------------------------------------
  // Test 1: Next-round authorization & anti-cheat secret redaction
  // ----------------------------------------------------
  console.log("Test 1: Next round authorization & anti-cheat secret redaction...");

  // 1a. Unauthorized non-host attempt
  const unauthReq = createMockRequest(
    `http://localhost:3000/api/room/${roomCode}/next-round`,
    "POST",
    { sessionToken: "impostor-token" }
  );
  const unauthRes = await nextRoundHandler(unauthReq, {
    params: Promise.resolve({ code: roomCode }),
  });
  assert.strictEqual(
    unauthRes.status,
    403,
    "Expected 403 when non-host calls next-round"
  );
  const unauthData = await unauthRes.json();
  assert.strictEqual(unauthData.success, false);

  // 1b. Authorized host starts round 1
  const startReq = createMockRequest(
    `http://localhost:3000/api/room/${roomCode}/next-round`,
    "POST",
    { sessionToken: hostId }
  );
  const startRes = await nextRoundHandler(startReq, {
    params: Promise.resolve({ code: roomCode }),
  });
  assert.strictEqual(startRes.status, 200, "Expected 200 when host calls next-round");
  const startData = await startRes.json();

  assert.strictEqual(startData.success, true);
  assert.strictEqual(startData.round, 1);
  assert.strictEqual(startData.totalRounds, 2);
  assert.strictEqual(startData.gameMode, "buzzer");
  assert.ok(startData.sliceUrl, "sliceUrl must be provided");
  assert.ok(startData.sliceUrl.includes("id=song-uuid-001"), "sliceUrl must contain song ID");
  assert.ok(startData.sliceUrl.includes("start=45"), "sliceUrl must contain hook start time");

  // ANTI-CHEAT ASSERTION: NEVER leak title or artist in response!
  assert.strictEqual(
    (startData as any).title,
    undefined,
    "Anti-Cheat: response MUST NOT contain song title!"
  );
  assert.strictEqual(
    (startData as any).artist,
    undefined,
    "Anti-Cheat: response MUST NOT contain song artist!"
  );
  assert.strictEqual(
    (startData as any).aliases,
    undefined,
    "Anti-Cheat: response MUST NOT contain aliases!"
  );

  // Realtime broadcast verification
  const roundStartEvent = broadcastEvents.find((e) => e.event === "round_start");
  assert.ok(roundStartEvent, "Realtime 'round_start' event must be broadcasted");
  assert.strictEqual(roundStartEvent.payload.round, 1);
  assert.strictEqual(
    roundStartEvent.payload.title,
    undefined,
    "Anti-Cheat: Realtime broadcast MUST NOT leak song title!"
  );
  assert.strictEqual(
    roundStartEvent.payload.artist,
    undefined,
    "Anti-Cheat: Realtime broadcast MUST NOT leak song artist!"
  );

  // State route check: active question hides current_song_id and title
  const stateReq = createMockRequest(
    `http://localhost:3000/api/room/${roomCode}/state`,
    "GET"
  );
  const stateRes = await getRoomStateHandler(stateReq, {
    params: Promise.resolve({ code: roomCode }),
  });
  const stateData = await stateRes.json();
  assert.strictEqual(stateData.room.current_song_id, null, "current_song_id must be sanitized");
  assert.strictEqual(stateData.room.songs?.title, undefined, "song title must be sanitized");

  console.log("✓ Passed: Next round successfully started with full anti-cheat secret redaction.\n");

  // ----------------------------------------------------
  // Test 2: FCFS buzzer locking & duplicate rejection (HTTP 409)
  // ----------------------------------------------------
  console.log("Test 2: FCFS buzzer locking & duplicate rejection (HTTP 409)...");

  // 2a. Player 1 hits buzzer first
  const buzz1Req = createMockRequest(
    `http://localhost:3000/api/room/${roomCode}/buzz`,
    "POST",
    { playerId: player1Id, displayName: "Alice" }
  );
  const buzz1Res = await buzzHandler(buzz1Req, {
    params: Promise.resolve({ code: roomCode }),
  });
  assert.strictEqual(buzz1Res.status, 200, "Expected 200 on first buzzer hit");
  const buzz1Data = await buzz1Res.json();
  assert.strictEqual(buzz1Data.success, true);
  assert.strictEqual(buzz1Data.buzzedPlayerId, player1Id);
  assert.ok(buzz1Data.deadline, "Deadline must be generated for buzzer holder");

  // Realtime buzzer broadcast
  const buzzerHitEvent = broadcastEvents.find(
    (e) => e.event === "buzzer_hit" && e.payload.playerId === player1Id
  );
  assert.ok(buzzerHitEvent, "Realtime 'buzzer_hit' event must be broadcasted");

  // 2b. Player 2 hits buzzer milliseconds later -> HTTP 409 conflict
  const buzz2Req = createMockRequest(
    `http://localhost:3000/api/room/${roomCode}/buzz`,
    "POST",
    { playerId: player2Id, displayName: "Bob" }
  );
  const buzz2Res = await buzzHandler(buzz2Req, {
    params: Promise.resolve({ code: roomCode }),
  });
  assert.strictEqual(
    buzz2Res.status,
    409,
    "Expected 409 when buzzer is already locked by another player"
  );
  const buzz2Data = await buzz2Res.json();
  assert.strictEqual(buzz2Data.success, false);
  assert.strictEqual(buzz2Data.reason, "already_buzzed");

  console.log("✓ Passed: FCFS buzzer locked player 1 and rejected player 2 with HTTP 409.\n");

  // ----------------------------------------------------
  // Test 3: Non-buzzer answer rejection (HTTP 403)
  // ----------------------------------------------------
  console.log("Test 3: Non-buzzer answer rejection (HTTP 403)...");

  // Player 2 attempts to submit an answer without holding the buzzer lock
  const unauthAnswerReq = createMockRequest(
    `http://localhost:3000/api/room/${roomCode}/answer`,
    "POST",
    { playerId: player2Id, displayName: "Bob", answerText: "รักแท้" }
  );
  const unauthAnswerRes = await answerHandler(unauthAnswerReq, {
    params: Promise.resolve({ code: roomCode }),
  });
  assert.strictEqual(
    unauthAnswerRes.status,
    403,
    "Expected 403 when non-buzzer holder submits an answer"
  );
  const unauthAnswerData = await unauthAnswerRes.json();
  assert.strictEqual(unauthAnswerData.success, false);
  assert.ok(unauthAnswerData.error.includes("ไม่มีสิทธิ์ตอบคำถาม"));

  console.log("✓ Passed: Non-buzzer answer submission correctly rejected with HTTP 403.\n");

  // ----------------------------------------------------
  // Test 4: Wrong guess handling (-20 penalty, buzzer unlocked, exclusion)
  // ----------------------------------------------------
  console.log("Test 4: Wrong guess handling (-20 penalty, buzzer unlocked, exclusion)...");

  // Player 1 submits wrong answer "ทน"
  const wrongAnswerReq = createMockRequest(
    `http://localhost:3000/api/room/${roomCode}/answer`,
    "POST",
    { playerId: player1Id, displayName: "Alice", answerText: "ทน" }
  );
  const wrongAnswerRes = await answerHandler(wrongAnswerReq, {
    params: Promise.resolve({ code: roomCode }),
  });
  assert.strictEqual(wrongAnswerRes.status, 200);
  const wrongAnswerData = await wrongAnswerRes.json();

  assert.strictEqual(wrongAnswerData.success, true);
  assert.strictEqual(wrongAnswerData.isCorrect, false);
  assert.strictEqual(wrongAnswerData.scoreDelta, -20);
  assert.strictEqual(wrongAnswerData.newScore, 0, "Score clamped to 0 minimum");
  assert.strictEqual(wrongAnswerData.resumeAudio, true, "resumeAudio must be signaled");
  assert.strictEqual(wrongAnswerData.wrongGuesses.length, 1);
  assert.strictEqual(wrongAnswerData.wrongGuesses[0].answerText, "ทน");

  // Realtime wrong_guess broadcast
  const wrongGuessEvent = broadcastEvents.find((e) => e.event === "wrong_guess");
  assert.ok(wrongGuessEvent, "Realtime 'wrong_guess' event must be broadcasted");
  assert.strictEqual(wrongGuessEvent.payload.scoreDelta, -20);
  assert.strictEqual(wrongGuessEvent.payload.resumeAudio, true);

  // Store state inspection: buzzer unlocked & player 1 excluded
  const storeStateAfterWrong = RoomStateStore.getRoomRoundState(roomCode);
  assert.strictEqual(
    storeStateAfterWrong?.roundStatus,
    "question_active",
    "roundStatus must reset to question_active"
  );
  assert.strictEqual(
    storeStateAfterWrong?.buzzedPlayerId,
    null,
    "buzzedPlayerId must be cleared"
  );
  assert.ok(
    storeStateAfterWrong?.excludedPlayerIds.includes(player1Id),
    "player 1 must be added to excludedPlayerIds"
  );

  console.log("✓ Passed: Wrong guess handled properly with -20 penalty, audio resumption, and buzzer unlock.\n");

  // ----------------------------------------------------
  // Test 5: Excluded player cannot re-buzz same round (HTTP 409 already_guessed_wrong)
  // ----------------------------------------------------
  console.log("Test 5: Excluded player cannot re-buzz same round...");

  const rebuzzReq = createMockRequest(
    `http://localhost:3000/api/room/${roomCode}/buzz`,
    "POST",
    { playerId: player1Id, displayName: "Alice" }
  );
  const rebuzzRes = await buzzHandler(rebuzzReq, {
    params: Promise.resolve({ code: roomCode }),
  });
  assert.strictEqual(
    rebuzzRes.status,
    409,
    "Expected 409 when previously excluded player tries to buzz"
  );
  const rebuzzData = await rebuzzRes.json();
  assert.strictEqual(rebuzzData.success, false);
  assert.strictEqual(rebuzzData.reason, "already_guessed_wrong");

  console.log("✓ Passed: Player 1 barred from re-buzzing after answering wrong in the same round.\n");

  // ----------------------------------------------------
  // Test 6: Second player buzzes successfully
  // ----------------------------------------------------
  console.log("Test 6: Second player buzzes successfully...");

  const buzzPlayer2Req = createMockRequest(
    `http://localhost:3000/api/room/${roomCode}/buzz`,
    "POST",
    { playerId: player2Id, displayName: "Bob" }
  );
  const buzzPlayer2Res = await buzzHandler(buzzPlayer2Req, {
    params: Promise.resolve({ code: roomCode }),
  });
  assert.strictEqual(buzzPlayer2Res.status, 200, "Second player should successfully buzz");
  const buzzPlayer2Data = await buzzPlayer2Res.json();
  assert.strictEqual(buzzPlayer2Data.buzzedPlayerId, player2Id);

  console.log("✓ Passed: Player 2 successfully grabbed the unlocked buzzer.\n");

  // ----------------------------------------------------
  // Test 7: Correct guess handling (+100 points, round reveal with song metadata)
  // ----------------------------------------------------
  console.log("Test 7: Correct guess handling (+100 points, round reveal with song metadata)...");

  // Player 2 answers with alias "True Love"
  const correctAnswerReq = createMockRequest(
    `http://localhost:3000/api/room/${roomCode}/answer`,
    "POST",
    { playerId: player2Id, displayName: "Bob", answerText: "True Love" }
  );
  const correctAnswerRes = await answerHandler(correctAnswerReq, {
    params: Promise.resolve({ code: roomCode }),
  });
  assert.strictEqual(correctAnswerRes.status, 200);
  const correctAnswerData = await correctAnswerRes.json();

  assert.strictEqual(correctAnswerData.success, true);
  assert.strictEqual(correctAnswerData.isCorrect, true);
  assert.strictEqual(correctAnswerData.scoreDelta, 100);
  assert.strictEqual(correctAnswerData.newScore, 100);
  assert.strictEqual(correctAnswerData.scores[player2Id], 100);
  assert.ok(correctAnswerData.song, "Song metadata must be revealed on correct answer");
  assert.strictEqual(correctAnswerData.song.title, "รักแท้");
  assert.strictEqual(correctAnswerData.song.artist, "NuNew");

  // Realtime round_reveal broadcast
  const revealEvent = broadcastEvents.find((e) => e.event === "round_reveal");
  assert.ok(revealEvent, "Realtime 'round_reveal' event must be broadcasted");
  assert.strictEqual(revealEvent.payload.winnerPlayerId, player2Id);
  assert.strictEqual(revealEvent.payload.song.title, "รักแท้");

  // Database status check
  const currentRoomDb = mockRooms.get(roomCode);
  assert.strictEqual(currentRoomDb.status, "revealing", "DB status must be 'revealing'");

  console.log("✓ Passed: Correct guess awarded +100 points and triggered round reveal.\n");

  // ----------------------------------------------------
  // Test 8: Buzzer timeout penalty & buzzer release
  // ----------------------------------------------------
  console.log("Test 8: Buzzer timeout penalty & buzzer release...");

  // Start round 2
  const round2Req = createMockRequest(
    `http://localhost:3000/api/room/${roomCode}/next-round`,
    "POST",
    { sessionToken: hostId }
  );
  const round2Res = await nextRoundHandler(round2Req, {
    params: Promise.resolve({ code: roomCode }),
  });
  assert.strictEqual(round2Res.status, 200);
  const round2Data = await round2Res.json();
  assert.strictEqual(round2Data.round, 2);

  // Player 2 (currently at 100 points) buzzes
  const buzzR2Req = createMockRequest(
    `http://localhost:3000/api/room/${roomCode}/buzz`,
    "POST",
    { playerId: player2Id, displayName: "Bob" }
  );
  await buzzHandler(buzzR2Req, { params: Promise.resolve({ code: roomCode }) });

  // Simulate timeout on player 2
  const timeoutResult = RoomStateStore.timeoutBuzzer(roomCode, player2Id);
  assert.strictEqual(timeoutResult.success, true);
  assert.strictEqual(timeoutResult.scoreDelta, -20);
  assert.strictEqual(timeoutResult.newScore, 80, "Player 2 score should decrease from 100 to 80");
  assert.strictEqual(timeoutResult.wrongGuess?.answerText, "(หมดเวลา)");

  const stateAfterTimeout = RoomStateStore.getRoomRoundState(roomCode);
  assert.strictEqual(stateAfterTimeout?.buzzedPlayerId, null);
  assert.strictEqual(stateAfterTimeout?.roundStatus, "question_active");
  assert.ok(stateAfterTimeout?.excludedPlayerIds.includes(player2Id));

  console.log("✓ Passed: Buzzer timeout penalized player by -20 and reopened buzzer.\n");

  // ----------------------------------------------------
  // Test 9: Total rounds limit & game over progression
  // ----------------------------------------------------
  console.log("Test 9: Total rounds limit & game over progression...");

  // Room was configured with totalRounds: 2. Round 2 is now completed.
  // Next round call should conclude game with gameOver: true
  const gameOverReq = createMockRequest(
    `http://localhost:3000/api/room/${roomCode}/next-round`,
    "POST",
    { sessionToken: hostId }
  );
  const gameOverRes = await nextRoundHandler(gameOverReq, {
    params: Promise.resolve({ code: roomCode }),
  });
  assert.strictEqual(gameOverRes.status, 200);
  const gameOverData = await gameOverRes.json();
  assert.strictEqual(gameOverData.success, true);
  assert.strictEqual(gameOverData.gameOver, true);

  const gameOverEvent = broadcastEvents.find((e) => e.event === "game_over");
  assert.ok(gameOverEvent, "Realtime 'game_over' event must be broadcasted");

  const finalRoomDb = mockRooms.get(roomCode);
  assert.strictEqual(finalRoomDb.status, "game_over", "DB status must be 'game_over'");

  console.log("✓ Passed: Total rounds limit reached and game_over correctly declared.\n");

  console.log("==========================================");
  console.log("All Realtime Gameplay & Buzzer Tests Passed!");
  console.log("==========================================");
}

runGameplayTests().catch((err) => {
  console.error("Test failed with error:", err);
  process.exit(1);
});
