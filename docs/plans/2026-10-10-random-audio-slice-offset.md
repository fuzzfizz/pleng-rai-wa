# Task: Random Audio Slice Offset for Dynamic Variety

## Goal
Resolve the issue reported in `should fix.md`:
"ฉันเล่นโหมด audio slice แล้วเริ่มเห็นว่ามันตัดเพลงท่อนเดิมมารบกวนตรวจเช็คว่ามันสุ่มตำแหน่งที่ตัดเพลงทุกครั้งรึเปล่าเพื่อให้เพลงเดิมไม่จำเจ"

## Root Cause
Previously, `src/app/api/room/[code]/next-round/route.ts` and `src/app/play/solo/page.tsx` strictly hardcoded `startSec = song.hookStartSec || 0`. Every time a song was selected, players heard the exact same slice starting from the very first second of the chorus, making gameplay repetitive and easily memorized.

## Specifications & Requirements

### 1. `src/lib/audio-slice-utils.ts`
Implement and export:
```typescript
export interface SongHookMetadata {
  hookStartSec?: number | null;
  hookEndSec?: number | null;
  duration?: number | null;
}

export function calculateSliceStart(
  song: SongHookMetadata,
  durationSec: number = 2.0
): number
```
- **Algorithm:**
  - Base hook start: `minStart = Math.max(0, song.hookStartSec && song.hookStartSec > 0 ? song.hookStartSec : 0)`
  - Target chorus span:
    - If `song.hookEndSec && song.hookEndSec > minStart + durationSec`, `chorusEnd = song.hookEndSec`
    - Otherwise, default to estimating a 20-second chorus span: `chorusEnd = minStart + 20`
  - Max start offset:
    - `maxStart = Math.max(minStart, chorusEnd - durationSec)`
    - If `song.duration && song.duration > durationSec`, ensure `maxStart = Math.min(maxStart, Math.max(minStart, song.duration - durationSec))`
  - If `maxStart <= minStart`, return `minStart`.
  - Pick a pseudo-random point `minStart + Math.random() * (maxStart - minStart)`, rounded to 1 decimal place (`Math.round(val * 10) / 10`).

### 2. Multiplayer Gameplay Integration (`src/app/api/room/[code]/next-round/route.ts`)
- Use `calculateSliceStart(song, durationSec)` when determining `startSec`.
- Store `sliceStartSec: startSec` and build `sliceUrl` using this `startSec`.
- This ensures:
  - Each time the song appears, a different slice of the chorus is selected.
  - All players in the multiplayer room during that round hear the **exact same** slice (synchronized via `round_state`).

### 3. Solo Mode Integration (`src/app/play/solo/page.tsx`)
- In solo mode, compute a randomized `roundSliceStartSec` when a new song/round begins.
- When the player clicks "ฟังอีกครั้ง" (Replay audio slice) during that round, use `roundSliceStartSec` so they hear the same snippet.
- When moving to a new song/round, recalculate a new randomized slice start.

### 4. Tests (`src/lib/__tests__/audio-slice-randomization.test.ts`)
- Test `calculateSliceStart` with:
  - Standard song (`hookStartSec: 60`, `hookEndSec: 85`, `duration: 180`)
  - Missing `hookEndSec` (uses default chorus span)
  - Edge cases (`hookStartSec: 0`, `duration` shorter than hook span, `hookEndSec <= hookStartSec`)
  - Random distribution verification (multiple calls produce variance within `[minStart, maxStart]`)
- Verify multiplayer round generation assigns `sliceStartSec` correctly.

### 5. Documentation
- Update `should fix.md` to mark the task completed with root cause and fix details.
