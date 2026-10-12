# รายการแก้ไขบั๊กและการปรับปรุง (Fixes & Improvements) โหมด audio slice

### 1. ปัญหาตอบไม่ทันแล้วค้าง (Timeout Freeze Issue)
- [x] **แก้ไขเรียบร้อยแล้ว:**
  - **สาเหตุรากฐาน (Root Causes):**
    1. ใน `GameView` เมื่อนับถอยหลังถึง 0 (`prev <= 1`) โค้ดเดิมมีเงื่อนไข `if (!isExcludedRef.current) handleTimeout()` — หากผู้เล่นเคยเดาผิดไปก่อนหน้านี้หรือยอมแพ้ โค้ดจะไม่ส่งสัญญาณ timeout ไปยังเซิร์ฟเวอร์เลย ทำให้เกมหยุดนิ่งอยู่ที่ 0 วินาทีตลอดกาล
    2. ใน `handleTimeout()` โค้ดเดิมมี `if (isExcludedFromBuzz) return;` ซึ่งบล็อกการส่ง timeout ซ้ำอีกชั้นหนึ่ง
    3. ใน `RoomStateStore.surrenderPlayer` เมื่อได้รับ `reason: "timed_out"` ตรรกะเดิมนับจำนวนผู้เล่นที่ timeout แยกทีละคน (`excludedPlayerIds.length >= effectiveTotalPlayers`) หากมีผู้เล่นคนอื่นปิดจอ/สลับแท็บ/เน็ตหลุด เซิร์ฟเวอร์จะไม่ยอมเฉลยและค้างรอ
  - **การแก้ไข:**
    - ลบเงื่อนไขการบล็อก `isExcluded` ออกจาก `handleTimeout()` เมื่อเวลานับถอยหลังหมดลง จะส่งสัญญาณ timeout ไปยังเซิร์ฟเวอร์เสมอ
    - ใน `RoomStateStore.surrenderPlayer` เพิ่มการตรวจสอบว่าหากเวลาของรอบหมดลงแล้ว (`elapsedSec >= roundDurationSec - 2`) หรือหัวห้องเป็นผู้ส่ง timeout ระบบจะตัดสินให้รอบนั้นเฉลยเพลงทันที (`allExcluded = true` -> `revealing`) ไม่รอการ timeout แยกของแต่ละคนจนค้าง
    - เพิ่ม **Client Watchdog Timer**: หากเวลานับถอยหลังถึง 0 แล้ว แต่ผ่านไป 2.5 วินาทียังไม่ได้รับสถานะเฉลย ระบบจะรีเฟรชสถานะห้องอัตโนมัติ (`refetchState()`) และหากเป็นหัวห้องจะส่งคำสั่งเฉลยความปลอดภัยทันที

### 2. Autocomplete Suggestions & อ้างอิงจากฐานข้อมูลจริง
- [x] **แก้ไขเรียบร้อยแล้ว:**
  - **สาเหตุรากฐาน (Root Causes):**
    1. ฟังก์ชัน `searchSongAutocomplete` ใน `src/lib/answer-checker.ts` และ `directSuggestions` ใน `GameView` มีโค้ดเดิม `if (!query) return effectiveSongLibrary.slice(0, 5);` และช่อง input มี `onFocus={() => setShowSuggestions(true)}` ส่งผลให้เมื่อคลิกเข้าช่อง input ขณะยังไม่ได้พิมพ์ จะเด้งกล่องข้อความขึ้นมา 5 (หรือ 3) เพลงทันที
    2. หน้าเว็บเดิมดึงเพลงผ่าน `/api/admin/songs` ซึ่งผู้เล่นทั่วไปไม่มีสิทธิ์เข้าถึง และไม่มี Public API สำหรับเพลง ทำให้เมื่อ fetch ไม่สำเร็จ ตัวแปรจะ fallback ไปที่ `DEMO_SONGS` ซึ่งมีเพลงตัวอย่างเพียง 3 เพลง (วัดใจ, ซ่อนกลิ่น, ขอบคุณที่รักกัน) ผู้เล่นจึงเห็นและค้นหาได้เพียง 3 เพลงเท่านั้น
  - **การแก้ไข:**
    - สร้าง Public Endpoint ใหม่ [`GET /api/songs`](file:///D:/pleng-rai-wa/src/app/api/songs/route.ts) ดึงเพลงทั้งหมดจากฐานข้อมูล Supabase โดยตรง (พร้อมคัดกรองข้อมูลความลับเพื่อความปลอดภัย ป้องกันการรั่วไหลของเนื้อเพลง/ท่อนฮุก)
    - เพิ่มระบบแคชเพลงฝั่ง Client [`src/lib/services/song-library-cache.ts`](file:///D:/pleng-rai-wa/src/lib/services/song-library-cache.ts) โหลดเพลงจากฐานข้อมูลเก็บใน memory และ `sessionStorage` เพื่อให้โหลดทันที
    - อัปเดต `src/lib/answer-checker.ts`, `src/components/room/game-view.tsx`, `src/components/room/answer-modal.tsx` และ `src/app/play/solo/page.tsx` ให้คืนค่า `[]` (ไม่แสดงคำแนะนำใดๆ) เมื่อข้อความเป็นค่าว่าง และแสดงผลเฉพาะเมื่อผู้เล่นเริ่มพิมพ์ข้อความเท่านั้น

---
**ผลการตรวจสอบ (Verification Results):**
- Vitest Suite: 25 test suites, 203/203 passed (100%)
- Next.js 16.3 Production Build: `npm run build` ผ่านสมบูรณ์แบบ 0 errors
