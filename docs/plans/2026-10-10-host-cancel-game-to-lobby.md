# Task: Host Cancel/Abort Game and Return to Lobby

## Goal
Implement the feature requested in `idea.md`:
"ทำให้เมื่อเริ่มเกมไปแล้วหัวห้องสามารถยกเลิกเกมนั้นแล้วกลับสู่ lobby ได้เผื่อต้องการตั้งค่าเกมใหม่"

## Requirements & Specifications

### 1. API Route Authorization & Robustness (`src/app/api/room/[code]/reset-lobby/route.ts`)
- Check host authorization:
  - Extract `sessionToken` / `playerId` from JSON body or `Authorization: Bearer <token>` header.
  - If a token is provided and does not match `room.host_player_id` (or `room.hostPlayerId`), reject with HTTP 403: "ไม่มีสิทธิ์ยกเลิกเกม (เฉพาะ Host เท่านั้น)".
  - If valid host (or backwards compatible with internal server resets):
    - Reset room in DB via `RoomService.updateRoomRound(cleanCode, { status: "lobby", playedSongIds: [], currentSongId: null, roundState: null })`.
    - Reset `RoomStateStore.resetRoom(cleanCode)` and delete Redis cache if configured.
    - Broadcast `room_state` with `{ status: "lobby", round: 0, scores: {}, room: updatedRoom }`.

### 2. Client Hook (`src/hooks/use-room-realtime.ts`)
- Ensure `resetToLobby` sends `playerId: state.myPlayer?.id` and `Authorization: Bearer ${state.myPlayer?.id}` so host check passes.
- On success, dispatch local `room_state` transition to `"lobby"`, clearing question and buzzer states.

### 3. UI in `src/components/room/game-view.tsx`
- For the room Host (`roomRealtime.isHost === true`):
  - In the top header bar (next to settings/leave button or in host controls area), show a button:
    - Icon: `RotateCcw` or `Undo2`
    - Label/Tooltip: "กลับล็อบบี้" (Return to Lobby)
    - Distinctive, tactile styling with `touch-manipulation` and `min-h-[44px]` touch target.
  - Clicking this button opens a Confirmation Modal:
    - Title: "ยกเลิกเกมและกลับสู่ล็อบบี้?"
    - Description: "คุณต้องการยกเลิกเกมรอบนี้และพาทุกคนกลับไปที่หน้า Lobby หรือไม่? (คะแนนในรอบปัจจุบันจะถูกรีเซ็ต)"
    - Cancel Button: "เล่นต่อ"
    - Confirm Button: "ยืนยันกลับล็อบบี้" (amber/rose styling, with loading spinner when submitting)
  - When confirmed, triggers `await roomRealtime.resetToLobby()`.

### 4. Tests
- Add endpoint unit tests in `src/app/api/room/__tests__/reset-lobby-endpoint.test.ts` verifying host authorization, room reset, and state clearance.
- Add UI unit tests in `src/components/room/__tests__/abort-game-ui.test.ts` verifying host button presence, modal confirmation, and non-host hidden state.

### 5. Documentation
- Update `idea.md` noting completion of this feature.
