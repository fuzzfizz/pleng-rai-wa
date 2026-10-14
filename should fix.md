# รายการแก้ไขบั๊กและการปรับปรุง (Fixes & Improvements) โหมด audio slice

## 1. บั๊กบางครั้งเฉลยเพลงผิด (Wrong song revealed in audio-slice mode) - [แก้ไขแล้ว ✓]
- **สาเหตุที่พบ (Root Cause):**
  1. ในระดับ Server State (`RoomStateStore.ensureRoundState`), การตรวจสอบ `isStale` เช็คเฉพาะ `currentRound > existing.currentRound` ทำให้เมื่อห้องถูกรีเซ็ต/เริ่มเกมใหม่ (เช่น เล่นจบ 5 ข้อแล้วเริ่มรอบ 1 ใหม่) หรือเมื่อข้ามเพลง/เปลี่ยนเพลงในรอบเดียวกัน Server memory ยังคงถือ `currentSong` เดิมจากรอบก่อนหน้า
  2. ในระดับ Client Audio Playback (`GameView`), การเปลี่ยน `activeQuestion?.sliceUrl` ไม่ได้รีเซ็ต buffer ด้วย `audio.pause()`, `audio.currentTime = 0` และ `audio.load()` ทำให้เว็บบราวเซอร์เล่น audio slice buffer เดิมค้าง
  3. ใน Solo Play (`src/app/play/solo/page.tsx`), เมื่อโหลดคลังเพลงจาก Supabase DB เสร็จทีหลัง โค้ด shuffle ใหม่ไปแทนที่ `songsPool[0]` ขณะที่ผู้เล่นกำลังตอบเพลงแรก
- **การแก้ไข:**
  - เพิ่มเงื่อนไข invalidate stale state ใน `RoomStateStore.ensureRoundState`: เมื่อรอบไม่ตรงกัน (`!==`) หรือ `room.current_song_id !== existing.currentSong.id` ให้ rehydrate เพลงที่ถูกต้องจากฐานข้อมูลทันที
  - เพิ่ม audio buffer cleanup ใน `GameView`: เมื่อ `sliceUrl` เปลี่ยน ให้สั่ง pause, currentTime = 0 และ `load()` ใหม่เสมอ
  - เพิ่ม `hasInteractedRef` ใน Solo Play ป้องกัน pool swap ขณะเริ่มเล่น
  - เพิ่ม Unit Tests: `src/lib/__tests__/audio-slice-song-fidelity.test.ts` และ `src/lib/__tests__/audio-slice-buffer-reload.test.ts`

---

## 2. เมื่อกดขอคำใบ้เวลานับถอยหลังรีเซ็ทเอง (Hint request resets timer) - [แก้ไขแล้ว ✓]
- **สาเหตุที่พบ (Root Cause):**
  - ใน `GameView`, `useEffect` ที่คุม interval timer ขึ้นกับ dependency `handleTimeout`
  - เมื่อกดขอคำใบ้ Supabase Realtime broadcast สถานะใหม่ ทำให้ callback `surrender` เปลี่ยน reference ส่งผลให้ `handleTimeout` เปลี่ยน reference และทำให้ timer effect cleanup แล้วเริ่มนับ 15 วินาทีใหม่
- **การแก้ไข:**
  - ใช้ `handleTimeoutRef` เพื่อ decouple callback reference ออกจาก timer effect dependency array
  - เมื่อขอคำใบ้ timer จะไม่ re-run หรือ reset อีกต่อไป
  - เพิ่ม Unit Test: `src/components/room/__tests__/non-buzzer-unlimited-timer.test.ts`

---

## 3. นำตัวนับถอยหลัง 15 วิ ออกจากโหมดทั่วไป (Unlimited Time for Non-Buzzer Modes) - [แก้ไขแล้ว ✓]
- **ความต้องการ:**
  - โหมดที่ไม่ใช่การกดกริ่ง (`audio-slice`, `ai-lyrics`, `translated-lyrics`) ให้เป็นเวลาไม่จำกัด (Unlimited Time) เพื่อไม่ให้กดดันเกินไป
  - ตัวนับถอยหลังเวลาตอบ (Round / Buzzer Timeout) ให้เลือกปรับและแสดงผลเฉพาะในโหมดแย่งกดกริ่ง (`buzzer`) เท่านั้น
  - ในโหมดทั่วไป ผู้เล่นสามารถเลือกรูปแบบการตัดสิน (Answer Resolution Mode) ได้ 2 แบบ:
    1. **⚡ แย่งกันตอบ (Race):** ใครตอบถูกคนแรกชนะข้อนี้ทันทีและเฉลยเพลง คนตอบผิดหมดสิทธิ์ในข้อนั้น
    2. **👥 รอตอบให้หมดทุกคน (Wait for All):** ทุกคนตอบได้โดยไม่จำกัดเวลา เมื่อตอบครบทุกคนหรือยอมแพ้ จึงเฉลยพร้อมกันและรวมคะแนน
- **การแก้ไข:**
  - `GameView`: แสดง progress bar นับถอยหลังเฉพาะ `gameMode === "buzzer"` และไม่รัน answer timeout ในโหมดอื่น
  - `TVView`: แสดงตัวนับถอยหลังเฉพาะ `gameMode === "buzzer"`; โหมดอื่นแสดงแถบข้อความ "โหมดไม่จำกัดเวลา" พร้อมระบุแย่งกันตอบหรือรอตอบครบทุกคน
  - `HostSettingsModal`: ส่วนตั้งเวลา 10-30 วิ แสดงเฉพาะโหมด `buzzer`; โหมดอื่นแสดงป้าย "เวลาในการตอบ: ไม่จำกัดเวลา (Unlimited)" และเปิดให้เลือกกติกาการเฉลยคำตอบ (Race vs Wait for All) อย่างชัดเจน
  - `LobbyView`: สรุปการตั้งค่าห้องระบุชัดเจน เช่น "ไม่จำกัดเวลา (แย่งกันตอบ)" หรือ "ไม่จำกัดเวลา (รอตอบครบทุกคน)"
  - เพิ่ม Unit Test: `src/components/room/__tests__/host-settings-modes-alignment.test.ts`