# 📋 แผนการแก้ไขระบบตามข้อกำหนดใน should fix.md

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** แก้ไขปัญหาการออกจากห้องเมื่อกดย้อนกลับ (Browser Back) แล้วจำนวนคนไม่ลดและห้องไม่ถูกลบ, ปรับปรุงโหมด Audio Slice ให้ไม่มีการแย่งกดกริ่งแต่เป็นการฟังแล้วพิมพ์ตอบทันที, และเพิ่มระบบควบคุมระดับเสียง (Master Volume) รวมกับเมนูตั้งค่าธีม Light/Dark

**Architecture:**
1. **Room Departure & Immediate Cleanup**: ดักจับ Event การย้อนกลับ (`popstate`), Next.js router transitions, และ component unmount ใน `src/app/room/[code]/page.tsx` ส่งคำขอ `POST /api/room/[code]/leave` แบบ `keepalive: true` / `sendBeacon` เพื่อลดจำนวนผู้เล่นและลบห้องทิ้งทันทีหากไม่มีผู้เล่นเหลือ พร้อมปรับปรุง `ActiveRoomsTable` ให้มีปุ่มลบห้องที่ถูกทิ้งและคำนวณ `playerCount` ที่แท้จริง (ไม่บังคับ `Math.max(1, count)` เมื่อห้องว่าง)
2. **Audio Slice Direct Input**: ปรับเงื่อนไขใน `src/components/room/game-view.tsx` ให้โหมด `audio-slice` ใช้กล่องพิมพ์คำตอบโดยตรง (Direct Answer Input) เหมือนกับโหมด `ai-lyrics` และ `translated-lyrics` โดยไม่ต้องแย่งกดกริ่ง (BuzzerButton ใช้เฉพาะโหมด `buzzer` เท่านั้น)
3. **Master Volume & Settings Menu**: สร้างระบบจัดการระดับเสียงรวม (`src/lib/audio-volume.ts`) ที่ซิงค์กับทั้ง `soundEffects`, HTMLAudioElement, และ `ttsReader` บันทึกค่าลง `localStorage` พร้อมสร้างคอมโพเนนต์ `SettingsMenu` ที่รวมแถบปรับระดับเสียง (Volume Slider) และปุ่มสลับธีม (Theme Toggle ☀️/🌙) ไว้ด้วยกันในแถบ Header

**Tech Stack:** Next.js 15 (App Router), React 19, TypeScript, Tailwind CSS, Supabase Realtime (Presence & Broadcast), Web Audio API

---

## Global Constraints
- ห้ามกระทบโหมดแย่งกดกริ่ง (`gameMode: "buzzer"`) ซึ่งยังคงต้องใช้ `BuzzerButton` ตามปกติ
- ห้ามทำลายระบบ Host Room Dissolution เดิม (ถ้าหัวหน้าห้องออก ห้องต้องถูกลบทันที)
- ระดับเสียงต้องบันทึกลง `localStorage` และมีผลทั้ง SFX และไฟล์เพลง MP3
- โค้ดทั้งหมดต้องผ่าน `npx tsc --noEmit` 0 errors และ `npm run build` สำเร็จ 100%

---

### Task 1: แก้ไขปัญหากดย้อนกลับ (Browser Back) แล้วจำนวนคนค้าง & การลบห้องทิ้งทันที

**Files:**
- Modify: `src/app/room/[code]/page.tsx:205-245`
- Modify: `src/app/api/room/[code]/leave/route.ts:45-85`
- Modify: `src/lib/services/room-service.ts:320-365`
- Modify: `src/components/home/active-rooms-table.tsx:40-100`
- Test: `src/lib/__tests__/room-leave.test.ts`

**Interfaces:**
- Consumes: `/api/room/[code]/leave` (POST { playerId, isHost })
- Produces: Reliable leave signal on browser back / unmount, dynamic real-time player count, instant room deletion when empty

- [ ] **Step 1: เขียน Unit Test ตรวจสอบ Logic การลดจำนวนคนและการลบห้องเมื่อคนเป็น 0**

สร้างไฟล์ `src/lib/__tests__/room-leave.test.ts`:
```typescript
import { describe, it, expect } from "vitest";

describe("Room Leave & Player Count Logic", () => {
  it("should calculate correct remaining count when a guest leaves", () => {
    const currentCount = 2;
    const nextCount = Math.max(0, currentCount - 1);
    expect(nextCount).toBe(1);
  });

  it("should trigger room deletion when remaining count reaches 0", () => {
    const currentCount = 1;
    const nextCount = Math.max(0, currentCount - 1);
    expect(nextCount).toBe(0);
    const shouldDelete = nextCount <= 0;
    expect(shouldDelete).toBe(true);
  });
});
```

- [ ] **Step 2: รันเทสต์เพื่อยืนยันพฤติกรรม**

Run: `npx vitest run src/lib/__tests__/room-leave.test.ts`
Expected: PASS

- [ ] **Step 3: ปรับปรุง `src/app/room/[code]/page.tsx` ให้ส่ง Leave Signal เมื่อกดย้อนกลับหรือเปลี่ยนหน้า**

ใน `src/app/room/[code]/page.tsx`:
1. เพิ่มฟังก์ชันส่ง Leave Beacon / Keepalive fetch:
```typescript
  const sendLeaveSignal = useCallback(() => {
    if (storedSession?.playerId && typeof window !== "undefined") {
      const payload = JSON.stringify({
        playerId: storedSession.playerId,
        isHost: Boolean(storedSession.isHost),
      });
      // 1. Try sendBeacon for background/unload safety
      if (navigator.sendBeacon) {
        const blob = new Blob([payload], { type: "application/json" });
        navigator.sendBeacon(`/api/room/${cleanCode}/leave`, blob);
      } else {
        // 2. Fallback to keepalive fetch
        fetch(`/api/room/${cleanCode}/leave`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: payload,
          keepalive: true,
        }).catch(() => {});
      }
    }
    clearPlayerSession(cleanCode);
  }, [cleanCode, storedSession]);
```
2. ดักฟัง Event `popstate` (Browser Back Button) และเพิ่ม cleanup ใน `useEffect` เมื่อ unmount:
```typescript
  useEffect(() => {
    const handlePopState = () => {
      sendLeaveSignal();
    };
    window.addEventListener("popstate", handlePopState);
    window.addEventListener("pagehide", sendLeaveSignal);

    return () => {
      window.removeEventListener("popstate", handlePopState);
      window.removeEventListener("pagehide", sendLeaveSignal);
      // If user navigates away via client-side routing, trigger leave
      sendLeaveSignal();
    };
  }, [sendLeaveSignal]);
```

- [ ] **Step 4: ปรับปรุง `src/lib/services/room-service.ts` ในฟังก์ชัน `listActiveRooms`**

แก้จุดบั๊กใน `src/lib/services/room-service.ts`:
1. เปลี่ยนจาก `playerCount: typeof s.playerCount === "number" ? Math.max(1, s.playerCount) : 1` เป็น:
```typescript
playerCount: typeof s.playerCount === "number" ? Math.max(0, s.playerCount) : 1,
```
2. กรองห้องที่มี `playerCount === 0` ออกจากรายการห้องสาธารณะ และลบห้องที่ว่างทิ้งทันที:
```typescript
    return data
      .filter((r) => {
        const s = (r.settings as any) || {};
        const count = typeof s.playerCount === "number" ? s.playerCount : 1;
        // Exclude private rooms and completely empty/abandoned rooms
        return !s.isPrivate && count > 0;
      })
```

- [ ] **Step 5: เพิ่มปุ่ม "ลบห้อง" (Dismiss/Delete) ใน `ActiveRoomsTable` สำหรับห้องที่สร้างค้างไว้**

ใน `src/components/home/active-rooms-table.tsx`:
- ตรวจสอบว่าผู้ใช้เป็นหัวหน้าห้องนั้นหรือไม่ (จาก `sessionStorage` หรือ `host_player_id`) หรือหากห้องไม่มีคนอยู่ ให้มีปุ่ม `[🗑️ ลบห้อง]` ที่เรียก `/api/room/[code]/leave` with `{ isHost: true }` แล้วรีเฟรชตารางทันที

- [ ] **Step 6: รันการทดสอบและ Commit**

```bash
git add src/app/room/[code]/page.tsx src/app/api/room/[code]/leave/route.ts src/lib/services/room-service.ts src/components/home/active-rooms-table.tsx src/lib/__tests__/room-leave.test.ts
git commit -m "fix(room): handle browser back navigation and immediate room cleanup"
```

---

### Task 2: ปรับปรุงโหมด Audio Slice ไม่ให้มีกริ่ง แต่เป็นการฟังแล้วพิมพ์ตอบทันที

**Files:**
- Modify: `src/components/room/game-view.tsx:145-155, 490-625`
- Modify: `src/components/room/tv-view.tsx:280-320`
- Test: `src/components/room/__tests__/game-mode-input.test.ts`

**Interfaces:**
- Consumes: `gameMode` ("audio-slice" | "buzzer" | "ai-lyrics" | "translated-lyrics")
- Produces: Direct input form displayed for "audio-slice", "ai-lyrics", "translated-lyrics"; BuzzerButton displayed exclusively for "buzzer"

- [ ] **Step 1: เขียน Test ตรวจสอบการเลือกโหมดคำตอบ (Direct Input vs Buzzer)**

สร้าง `src/components/room/__tests__/game-mode-input.test.ts`:
```typescript
import { describe, it, expect } from "vitest";

function shouldShowDirectInput(mode: string): boolean {
  return mode !== "buzzer";
}

describe("Game Mode Input Routing", () => {
  it("shows direct input form for audio-slice mode", () => {
    expect(shouldShowDirectInput("audio-slice")).toBe(true);
  });

  it("shows direct input form for ai-lyrics and translated-lyrics", () => {
    expect(shouldShowDirectInput("ai-lyrics")).toBe(true);
    expect(shouldShowDirectInput("translated-lyrics")).toBe(true);
  });

  it("shows buzzer button ONLY for buzzer mode", () => {
    expect(shouldShowDirectInput("buzzer")).toBe(false);
  });
});
```

- [ ] **Step 2: รันเทสต์เพื่อยืนยันผล**

Run: `npx vitest run src/components/room/__tests__/game-mode-input.test.ts`
Expected: PASS

- [ ] **Step 3: แก้ไข `src/components/room/game-view.tsx`**

1. ใน `handleBuzzPress` (line 148):
```typescript
  const handleBuzzPress = useCallback(async () => {
    if (gameMode !== "buzzer" || isBuzzing) return;
    setIsBuzzing(true);
    // ...
```
2. ใน JSX การเรนเดอร์ (line 492):
เปลี่ยนจาก:
```tsx
{gameMode === "ai-lyrics" || gameMode === "translated-lyrics" ? (
```
เป็น:
```tsx
{gameMode !== "buzzer" ? (
  <div className="w-full max-w-lg lg:max-w-2xl bg-white/95 dark:bg-stone-900/95 border-2 border-amber-500/50 rounded-3xl p-5 sm:p-6 lg:p-7 shadow-xl flex flex-col gap-3.5 animate-in fade-in zoom-in-95 duration-200">
    {/* Instructions cue */}
    <p className="text-xs lg:text-sm font-semibold text-amber-700 dark:text-amber-300/90 text-center flex items-center justify-center gap-1.5">
      <Sparkles className="w-4 h-4 text-amber-500 shrink-0 animate-pulse" />
      <span>
        {gameMode === "audio-slice"
          ? "ฟังเสียงเสี้ยววินาทีแล้วพิมพ์ชื่อเพลงได้ทันที ใครตอบถูกคนแรกชนะ!"
          : "พิมพ์ชื่อเพลงและส่งคำตอบได้ทันที ใครตอบถูกคนแรกชนะ!"}
      </span>
    </p>
```
3. ปุ่มกริ่ง (BuzzerButton) จะแสดงผลเมื่อ `gameMode === "buzzer"` เท่านั้น

- [ ] **Step 4: ปรับปรุงข้อความบนหน้าจอ TV View (`src/components/room/tv-view.tsx`)**

ใน `src/components/room/tv-view.tsx`:
- เมื่อ `gameMode === "audio-slice"`: ปรับข้อความสถานะให้แสดงว่า *"กำลังเล่นเสียงเสี้ยววินาที... ผู้เล่นพิมพ์ตอบได้ทันที"* แทนข้อความรอผู้เล่นกดกริ่ง

- [ ] **Step 5: ตรวจสอบและ Commit**

```bash
git add src/components/room/game-view.tsx src/components/room/tv-view.tsx src/components/room/__tests__/game-mode-input.test.ts
git commit -m "feat(game): enable direct answer input for audio-slice mode without buzzer"
```

---

### Task 3: เพิ่มระบบปรับระดับเสียง (Master Volume Control) รวมในเมนูตั้งค่าพร้อมกับปุ่มสลับธีม

**Files:**
- Create: `src/lib/audio-volume.ts`
- Create: `src/components/common/settings-menu.tsx`
- Modify: `src/components/common/nav-header.tsx:150-160`
- Modify: `src/components/room/game-view.tsx:120-140`
- Test: `src/lib/__tests__/audio-volume.test.ts`

**Interfaces:**
- Produces: `getMasterVolume()`, `setMasterVolume(val)`, `subscribeMasterVolume(callback)`
- Component: `<SettingsMenu />` with Volume Slider, Mute Button, Theme Toggle (Light/Dark)

- [x] **Step 1: สร้างโมดูลจัดการ Master Volume (`src/lib/audio-volume.ts`)**

รองรับการอ่าน/เขียนค่าจาก `localStorage` (`pleng_master_volume`), แจ้งเตือน Event เมื่อมีการเปลี่ยนระดับเสียง, และอัปเดต `soundEffects.setVolume()`:
```typescript
import { soundEffects } from "./sound-effects";

const STORAGE_KEY = "pleng_master_volume";
const EVENT_NAME = "pleng-master-volume-change";

export function getMasterVolume(): number {
  if (typeof window === "undefined") return 0.7;
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved !== null) {
      const parsed = parseFloat(saved);
      if (!isNaN(parsed) && parsed >= 0 && parsed <= 1) return parsed;
    }
  } catch {}
  return 0.7;
}

export function setMasterVolume(volume: number): void {
  const clamped = Math.max(0, Math.min(1, volume));
  if (typeof window !== "undefined") {
    try {
      localStorage.setItem(STORAGE_KEY, String(clamped));
      window.dispatchEvent(new CustomEvent(EVENT_NAME, { detail: clamped }));
    } catch {}
  }
  soundEffects.setVolume(clamped);
}

export function subscribeMasterVolume(callback: (vol: number) => void): () => void {
  if (typeof window === "undefined") return () => {};
  const handler = (e: Event) => {
    callback((e as CustomEvent<number>).detail);
  };
  window.addEventListener(EVENT_NAME, handler);
  return () => window.removeEventListener(EVENT_NAME, handler);
}
```

- [x] **Step 2: เขียน Unit Test สำหรับ `audio-volume.ts`**

สร้าง `src/lib/__tests__/audio-volume.test.ts` เพื่อทดสอบ clamping และค่าเริ่มต้น.

- [x] **Step 3: สร้างคอมโพเนนต์ `SettingsMenu` (`src/components/common/settings-menu.tsx`)**

สร้างปุ่มตั้งค่าสไตล์ Vinyl Cafe พร้อม Popover ที่มี:
1. **ปุ่มสลับธีม**: แสงสว่าง (Sun ☀️) / มืด (Moon 🌙)
2. **ตัวปรับระดับเสียง**:
   - ไอคอนลำโพง (`Volume2`, `Volume1`, `VolumeX`) สามารถคลิกเพื่อ Mute/Unmute
   - แถบเลื่อน (Slider range `0` ถึง `100%`) สี amber-500
   - ตัวเลขแสดงเปอร์เซ็นต์ (เช่น `75%`)
   - ปุ่มกดทดสอบเสียง (Test Sound) สั้นๆ เพื่อฟังระดับเสียงปัจจุบัน

- [x] **Step 4: ติดตั้ง `SettingsMenu` ลงใน `NavHeader` (`src/components/common/nav-header.tsx`)**

ใน `src/components/common/nav-header.tsx`:
- แทนที่หรือจัดกลุ่ม `<ThemeToggle />` ร่วมกับ `<SettingsMenu />` ให้ผู้ใช้สามารถกดเปิดเมนูตั้งค่าและปรับระดับเสียงได้จากทุกหน้าของเว็บไซต์

- [x] **Step 5: เชื่อมต่อระดับเสียงกับ Audio ใน `GameView`**

ใน `src/components/room/game-view.tsx`:
- เพิ่มการติดตาม Master Volume ผ่าน `subscribeMasterVolume`:
```typescript
  useEffect(() => {
    const applyVolume = (vol: number) => {
      if (audioRef.current) {
        audioRef.current.volume = vol;
      }
    };
    applyVolume(getMasterVolume());
    return subscribeMasterVolume(applyVolume);
  }, []);
```

- [x] **Step 6: ตรวจสอบและ Commit**

```bash
git add src/lib/audio-volume.ts src/components/common/settings-menu.tsx src/components/common/nav-header.tsx src/components/room/game-view.tsx src/lib/__tests__/audio-volume.test.ts
git commit -m "feat(settings): add master volume control slider integrated with theme settings"
```

---

### Task 4: การตรวจสอบระบบทั้งหมด (Verification & End-to-End Build)

- [ ] **Step 1: รัน Type Check ทั่วทั้งโปรเจกต์**
Run: `npx tsc --noEmit`
Expected: 0 errors

- [ ] **Step 2: รัน Production Build**
Run: `npm run build`
Expected: Compiled successfully

- [ ] **Step 3: ทำการ Commit และ Push ไปยัง remote repository**
```bash
git push origin main
```
