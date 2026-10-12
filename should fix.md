# รายการแก้ไขบั๊กและการปรับปรุง (Fixes & Improvements) - เสร็จสมบูรณ์แล้ว 100%

### รายการปัญหาโหมด Audio Slice และผลการแก้ไข:

1. **Auto-complete ใช้งานไม่ได้และไม่แสดงผล:**
   - [x] **แก้ไขแล้ว:**
     - ย้าย Dropdown Suggestions เข้าไปอยู่ภายใน container input wrapper (`<div className="relative">...</div>`) เพื่อให้ `top-full` จัดวางอยู่ใต้กล่อง input อย่างถูกต้อง ไม่หลุดออกไปนอก card หรืออยู่ใต้ปุ่มส่งคำตอบ
     - แก้ไข event handler สำหรับ touch screen / mobile โดยใช้ `onPointerDown` พร้อม `e.preventDefault()` เพื่อให้การกดเลือกเพลงบนจอมือถือทำงานทันทีโดยไม่ถูก event `onBlur` แย่งปิด dropdown
     - เมื่อผู้เล่นคลิกเข้าช่อง input ขณะยังไม่ได้พิมพ์ข้อความ (`query === ""`) ระบบจะดึง 5 เพลงแนะนำเริ่มต้นมาแสดงผลทันที เพื่อให้ผู้เล่นทราบว่า autocomplete พร้อมใช้งาน
     - ปรับจูน Fuse.js search threshold ใน `src/lib/answer-checker.ts` จาก 0.25 เป็น 0.38 และค้นหาครอบคลุมทั้งชื่อเพลง, ศิลปิน และชื่อเล่น (aliases)

2. **เวลานับถอยหลังหมด ขึ้นว่ายอมแพ้แทนที่จะขึ้นตอบไม่ทัน และเกมค้างไม่ยอมเฉลยเพลง:**
   - [x] **แก้ไขแล้ว:**
     - แยกตรรกะ `handleTimeout()` ออกจาก `handleSurrender()` อย่างชัดเจนใน `src/components/room/game-view.tsx`
     - เพิ่มสถานะ `myExclusionReason = "timed_out"` และแสดงแบนเนอร์แจ้งเตือน `⏰ คุณตอบไม่ทันในข้อนี้ (หมดเวลา)` ชัดเจน (แยกต่างหากจาก `🏳️ คุณยอมแพ้ในข้อนี้แล้ว`)
     - ส่ง `reason: "timed_out"` ไปยัง API `/api/room/[code]/surrender` และกระจาย broadcast event `player_surrendered` ที่มี `reason: "timed_out"`
     - แก้ไข Deadlock การค้างไม่ยอมเฉลย: ใน `useRoomRealtime` มีการกรองผู้เล่น TV View (`avatarUrl === "📺"` หรือ `displayName.includes("(TV)")`) ออกจากการคำนวณ `totalPlayers` ทำให้ผู้เล่นจริง 2 คนหมดเวลาแล้วนับครบจำนวนคนจริงทันที และใน `RoomStateStore` ปรับเงื่อนไขการเฉลยรอบให้คำนวณจาก active human players ทำให้รอบที่ 1 ไม่เกิดการ Deadlock อีกต่อไป

3. **เพิ่มการตั้งค่าเลือกระหว่าง "แย่งกันตอบ" (race) หรือ "รอตอบให้หมดทุกคนค่อยเฉลย" (wait_all):**
   - [x] **แก้ไขแล้ว:**
     - เพิ่มชนิดข้อมูล `AnswerResolutionMode = "race" | "wait_all"` ใน `src/types/index.ts`
     - เพิ่มตัวเลือกใน `HostSettingsModal` ให้หัวห้องสามารถเลือกระหว่าง:
       - ⚡ **แย่งกันตอบ (Race to Answer):** ใครตอบถูกคนแรกชนะทันทีและเฉลยเพลงรอบนั้นทันที
       - 👥 **รอตอบให้หมดทุกคน (Wait for All):** ให้ทุกคนมีสิทธิ์ตอบจนครบหรือหมดเวลา แล้วค่อยเฉลยและคิดคะแนนให้ทุกคนที่ตอบถูก
     - อัปเดต `LobbyView` ให้แสดงป้ายสรุปการตั้งค่า `• รอตอบครบทุกคน` เมื่อเปิดใช้งาน
     - อัปเดต `RoomStateStore.submitAnswer` และ API `/api/room/[code]/answer` ให้รองรับ `playerSubmissions`:
       - ผู้เล่นตอบถูกจะได้รับคะแนนและบันทึกผลไว้ พร้อมส่งสัญญาณ `waitingForOthers: true` และ broadcast `player_submitted`
       - เกมจะคงสถานะ `question_active` เพื่อรอให้ผู้เล่นคนอื่นตอบ
       - เมื่อผู้เล่นคนสุดท้ายตอบหรือหมดเวลา/ยอมแพ้ เกมจะเปลี่ยนเป็น `revealing` และเฉลยเพลงพร้อมคะแนน

4. **เมื่อกดกลับห้องแล้วกดเล่นใหม่เกิดปัญหาข้ามข้อเอง:**
   - [x] **แก้ไขแล้ว:**
     - ตรวจสอบ `isNewGame` ใน `src/app/api/room/[code]/next-round/route.ts` เมื่อห้องมีสถานะมาจาก `lobby` หรือ `game_over` หรือมีการส่ง `playAgain / isNewGame`
     - ล้างสถานะ `played_song_ids = []`, `completedRounds = 0`, Redis round state และ in-memory round cache ทั้งหมด
     - รับประกันว่าเกมเริ่มใหม่จะเริ่มต้นที่ข้อ 1 เสมอ ไม่มีการนับต่อหรือข้ามข้อ

5. **เมื่อเกมจบ ผู้เล่นธรรมดาไม่สามารถกดกลับ lobby ได้ (แจ้ง HTTP 403) แต่หัวห้องกดได้:**
   - [x] **แก้ไขแล้ว:**
     - แก้ไขสิทธิ์ใน `src/app/api/room/[code]/reset-lobby/route.ts`: หากสถานะห้องอยู่ที่ `game_over` หรือ `lobby` อนุญาตให้ผู้เล่นทุกคนในห้อง (ทั้ง host และ non-host) กดกลับสู่ lobby ได้โดยไม่ติด 403
     - ส่งสัญญาณ broadcast `room_state` นำผู้เล่นทุกคนในห้องกลับสู่ Lobby พร้อมกัน
     - เพิ่ม Loading spinner บนปุ่ม "กลับสู่ห้องล็อบบี้" ใน `PodiumView`

6. **ตรวจสอบความละเอียด ครอบคลุมทุก Edge Case:**
   - [x] **แก้ไขแล้ว:**
     - ทดสอบรองรับ Serverless Cold Start & Redis Fallback Rehydration
     - รองรับการตัดการเชื่อมต่อของผู้เล่นระหว่างรอบ
     - รัน Vitest ครบทั้ง 24 test suites ผ่านทั้งหมด 198/198 tests (100% pass)
     - ผ่านการตรวจสอบ TypeScript และ `npm run build` Next.js 16.3 Production build สมบูรณ์ 100%