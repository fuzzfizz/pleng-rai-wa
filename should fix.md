# รายการแก้ไขบั๊กและการปรับปรุง (Fixes & Improvements) โหมด audio slice

- [แก้ไขแล้ว ✓] **แก้ไขปัญหาเมื่อเลือกเพลงหลายหมวดหมู่แล้วแต่จำนวนข้อที่เลือกยังจำกัดเหลือแค่หมวดหมู่เดียว (Multi-genre & Multi-era rounds selection)**:
  - **สาเหตุ (Root Cause)**:
    1. ใน `HostSettingsModal` การคำนวณ `maxAvailableSongs` และ fallback ใน `currentFilterConfig` อ้างอิงเฉพาะ `genreId` เดี่ยวและไม่ได้รวมเพลงจาก `genreIds` / `eraIds` ทุกอันที่เลือก
    2. ฟังก์ชัน `prepareSettingsPayload` และ `handleSave` ทำการยุบค่าเหลือเพียง `genreId` ตัวแรกตัวเดียว ทำให้เมื่อบันทึกการตั้งค่าห้อง `genreIds` และ `eraIds` สูญหาย
    3. `useEffect` ที่ซิงก์ `draft` ทำงานทุกครั้งที่ `settings` อัปเดต (เช่น เมื่อมีผู้เล่นอื่นส่ง heartbeat/presence) ทำให้ draft ถูกรีเซ็ตกลับเป็นค่าเดี่ยว
  - **การแก้ไข**:
    1. ปรับปรุง `currentFilterConfig` และ `maxAvailableSongs` ให้ดึง `songCount` ของทุกหมวดหมู่ใน `genreIds` และทุกยุคใน `eraIds` มารวมกันอย่างถูกต้อง (เช่น ร็อค 7 เพลง + ป็อป 4 เพลง = 11 เพลง)
    2. อัปเดต `prepareSettingsPayload` และ `handleSave` ให้ส่งและบันทึก `genreIds` และ `eraIds` เข้า `RoomSettings`
    3. เพิ่ม `prevIsOpenRef` ใน `HostSettingsModal` เพื่อป้องกันไม่ให้ presence/state update ในห้องมารีเซ็ต draft ขณะที่หัวห้องกำลังตั้งค่า
    4. ปรับปรุง `SongService.getRandomSongs` และ `/api/room/[code]/next-round` ให้รองรับการค้นหาเพลงด้วย `genreIds` และ `eraIds` ครบถ้วน ไม่หยุดหรือตัดจบเร็วเมื่อหมดแค่หมวดหมู่แรก
