# รายการแก้ไขบั๊กและการปรับปรุง (Fixes & Improvements) โหมด audio slice

## 1. โหมดตั้งต้นเมื่อเข้าห้องมาควรตั้งไว้ที่โหมด audio slice - [แก้ไขแล้ว ✓]
- **การแก้ไข:**
  - อัปเดต `DEFAULT_ROOM_SETTINGS.gameMode = "audio-slice"` ใน [`src/lib/services/room-service.ts`](file:///D:/pleng-rai-wa/src/lib/services/room-service.ts)
  - ปรับ default state ใน [`src/hooks/use-room-realtime.ts`](file:///D:/pleng-rai-wa/src/hooks/use-room-realtime.ts) ให้เริ่มต้นที่ `"audio-slice"` แทน `"buzzer"`

---

## 2. เริ่มเกมเพลงไม่เล่นเอง 1 รอบก่อน (ต้องมากดฟังซ้ำแทน) - [แก้ไขแล้ว ✓]
- **สาเหตุที่พบ (Root Cause):**
  - เกิดการชนกันของ `useEffect` โหลด buffer เสียง (`audio.load()`) และ `useEffect` เล่นเสียง (`audio.play()`) เมื่อขึ้นรอบใหม่ ส่งผลให้เบราว์เซอร์โยน `AbortError` และ catch block บังคับเซ็ต `isAudioPlaying = false` ทันที
- **การแก้ไข:**
  - รวมการจัดการ buffer และการเล่นรอบแรกให้ทำงานสอดคล้องกันผ่าน `prevSliceKeyRef` (`${currentRound}:${activeQuestion.sliceUrl}`) ใน [`src/components/room/game-view.tsx`](file:///D:/pleng-rai-wa/src/components/room/game-view.tsx)
  - เมื่อขึ้นรอบใหม่ ระบบจะ reset buffer, load และสั่งเล่นอัตโนมัติ 1 รอบทันที เมื่อเล่นจบ `<audio onEnded={...}>` จะตั้ง `isAudioPlaying = false` และปลดล็อกปุ่มฟังซ้ำให้ใช้งานต่อได้

---

## 3. Autocomplete ให้เลื่อน Scroll ตามลูกศรขึ้น/ลง - [แก้ไขแล้ว ✓]
- **การแก้ไข:**
  - เพิ่ม ref callback และ `useEffect` ตรวจจับ `highlightedIndex` ใน [`src/components/room/game-view.tsx`](file:///D:/pleng-rai-wa/src/components/room/game-view.tsx) และ [`src/components/room/answer-modal.tsx`](file:///D:/pleng-rai-wa/src/components/room/answer-modal.tsx)
  - เรียก `element.scrollIntoView({ block: "nearest", behavior: "smooth" })` เพื่อให้ตัวเลือกที่กำลังไฮไลต์เลื่อนตามสายตาตลอดเวลาแม้จะเลื่อนเกินความสูงของกล่อง `max-h-48`

---

## 4. โหมดรอทุกคนตอบ (Wait for All) แสดงว่าเหลือใครที่ยังไม่ตอบ - [แก้ไขแล้ว ✓]
- **การแก้ไข:**
  - เพิ่มฟังก์ชันคำนวณ `getWaitAllPlayerStatus` แยกรายชื่อคนที่ส่งคำตอบแล้ว (`submittedPlayers`) และคนที่ยังไม่ตอบ (`pendingPlayers`)
  - **บนจอมือถือผู้เล่น (`GameView`):** แสดง Badge ผู้เล่นทุกคน พร้อมข้อความสรุปชัดเจน เช่น *"⏳ กำลังรออีก 2 คน: สมชาย, สมหญิง"*
  - **บนจอทีวี (`TVView`):** แสดง Live Card ตรงกลางจอและแถบ Scoreboard ด้านข้างว่าใครตอบแล้ว (`✓ ตอบแล้ว`) และใครกำลังคิดอยู่ (`⏳ กำลังคิด...`)

---

## 5. จำนวนครั้งที่ตอบผิดแบบไม่จำกัด แสดงเฉพาะโหมดแย่งกันตอบ (Race) - [แก้ไขแล้ว ✓]
- **การแก้ไข:**
  - ใน [`src/components/room/host-settings-modal.tsx`](file:///D:/pleng-rai-wa/src/components/room/host-settings-modal.tsx):
    - เมื่อเลือกกติกา `wait_all` ตัวเลือกจะแสดงเฉพาะ `1 ครั้ง`, `2 ครั้ง`, `3 ครั้ง` (ซ่อนตัวเลือก `0 / ไม่จำกัด`)
    - เพิ่ม Auto-normalization ใน `prepareSettingsPayload` หากเป็น `wait_all` และค่าเป็น 0 จะปรับเป็น 1 เสมอ
    - ในโหมด `race` จะแสดงตัวเลือกครบทั้ง `1`, `2`, `3` และ `ไม่จำกัด` ตามเดิม

---

## 6. หัวห้องเปลี่ยนโหมดแล้ว ผู้เล่นในห้องซิงค์เห็นแบบ Real-time - [แก้ไขแล้ว ✓]
- **การแก้ไข:**
  - ใน [`src/app/api/room/[code]/settings/route.ts`](file:///D:/pleng-rai-wa/src/app/api/room/%5Bcode%5D/settings/route.ts): เพิ่มการ broadcast event `room_settings` เมื่อมีการบันทึกการตั้งค่าหรือโอนสิทธิ์ Host
  - ใน [`src/hooks/use-room-realtime.ts`](file:///D:/pleng-rai-wa/src/hooks/use-room-realtime.ts): เพิ่ม listener รับ event `room_settings` และ dispatch อัปเดต `room.settings`, `gameMode`, `totalRounds` และสถานะ Host ทันที
  - ส่งผลให้ผู้เล่นทุกคนและจอทีวีเห็นการเปลี่ยนโหมดห้องพร้อมกันทันที

---

## 7. ตอบผิดได้ 2-3 ครั้ง แจ้งผลถูก/ผิด และให้สิทธิ์ตอบต่อตามที่กำหนด - [แก้ไขแล้ว ✓]
- **การแก้ไข:**
  - ปรับปรุงตรรกะใน [`src/lib/room-state-store.ts`](file:///D:/pleng-rai-wa/src/lib/room-state-store.ts):
    - เมื่อตอบผิด จะตรวจสอบ `wrongCount < maxWrong`
    - หากยังไม่ครบโควตา จะ **ไม่ exclude ผู้เล่น** และส่ง response `canRetry: true, remainingAttempts: maxWrong - wrongCount`
  - ปรับปรุง [`src/app/api/room/[code]/answer/route.ts`](file:///D:/pleng-rai-wa/src/app/api/room/%5Bcode%5D/answer/route.ts) และ [`src/hooks/use-room-realtime.ts`](file:///D:/pleng-rai-wa/src/hooks/use-room-realtime.ts) ให้ broadcast `wrong_guess` โดย exclude ผู้เล่นเฉพาะเมื่อสิทธิ์ตอบหมดแล้วเท่านั้น
  - ใน [`src/components/room/game-view.tsx`](file:///D:/pleng-rai-wa/src/components/room/game-view.tsx): แสดงแบนเนอร์แจ้งเตือน `"❌ ยังไม่ถูกต้อง! (เหลือสิทธิ์ตอบอีก X ครั้ง)"` และเคลียร์ช่องพิมพ์ให้พิมพ์ตอบต่อได้ทันทีโดยไม่ถูกล็อก

---

## 8. ระบบเลือกหลายหมวดหมู่ (Multi-Genre), กำหนดจำนวนข้อเอง พร้อม Auto-clamp และจบเกมเมื่อเพลงหมด - [แก้ไขแล้ว ✓]
- **การแก้ไข:**
  - **Multi-Genre Selection:**
    - ขยาย `SongFilterConfig` ใน [`src/types/index.ts`](file:///D:/pleng-rai-wa/src/types/index.ts) ให้รองรับ `genreIds?: string[]`
    - ปรับ [`src/components/common/song-source-modal.tsx`](file:///D:/pleng-rai-wa/src/components/common/song-source-modal.tsx) ให้สามารถคลิกเลือกหมวดหมู่แนวเพลงได้หลายหมวดพร้อมกัน พร้อมแสดงยอดรวมเพลง
    - ปรับ [`src/lib/services/song-service.ts`](file:///D:/pleng-rai-wa/src/lib/services/song-service.ts) และ [`src/app/api/room/[code]/next-round/route.ts`](file:///D:/pleng-rai-wa/src/app/api/room/%5Bcode%5D/next-round/route.ts) ให้ query เพลงด้วย `query.in("genre_id", genreIds)`
  - **Custom Rounds Input & Auto-Clamp:**
    - ใน [`src/components/room/host-settings-modal.tsx`](file:///D:/pleng-rai-wa/src/components/room/host-settings-modal.tsx) เพิ่มช่องระบุจำนวนข้อเอง (Custom Input) ควบคู่กับปุ่มทางลัด
    - คำนวณ `maxAvailableSongs` หากกรอกจำนวนข้อเกินจำนวนเพลงที่มีจริง ระบบจะ auto-clamp ลดลงมาเท่ากับเพลงที่มี พร้อมแสดงข้อความเตือนเด่นชัด: `"⚠️ เกินจำนวนเพลงที่เลือกไว้ (ระบบปรับเป็น X ข้อตามจำนวนเพลงที่มี)"`
  - **Graceful Game Over:**
    - ตัดระบบวนเพลงซ้ำ (song recycling) ใน `SongService.getRandomSongs` ออกเด็ดขาด
    - เมื่อเพลงหมดก่อนถึงจำนวนข้อที่ตั้งไว้ ระบบจะจบเกมอย่างสง่างามด้วยข้อความ: `"เล่นครบทุกเพลงในคลัง/เพลย์ลิสต์แล้ว (รวม X ข้อ) สรุปคะแนนผู้ชนะ!"`