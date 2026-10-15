# รายการแก้ไขบั๊กและการปรับปรุง (Fixes & Improvements) โหมด audio slice

### 1. [แก้ไขแล้ว ✓] การแสดงผล Responsive บนมือถือ (Mobile Responsiveness Polish)
- **ปัญหาเดิม:** Navbar อัดกันแน่นจนล้นจอ, ปุ่มกรอกรหัสห้องเลยขอบหน้าจอ, Typography/Headers บนมือถือดูแน่นเกินไป
- **สาเหตุ (Root Cause):**
  - ใน `nav-header.tsx` ปุ่มเข้าสู่ระบบยาวเกินไป (~160px) เมื่อรวมกับ Logo, SettingsMenu และ Hamburger บนจอ 360px-375px จะล้นหน้าจอ
  - ใน `page.tsx` Action Box มี padding `p-6` กว้างเกินไปสำหรับมือถือ และช่อง Input ใช้ข้อความ Placeholder ยาวพร้อม tracking กว้าง ทำให้ดันปุ่มลูกศรเลยขอบจอ
- **การแก้ไข (Solution):**
  - ใน `nav-header.tsx`: บนหน้าจอมือถือ (`< sm`) ย่อข้อความปุ่มเป็น "เข้าสู่ระบบ", จำกัด `max-w` ของชื่อผู้ใช้บนมือถือ (`max-w-[70px] xs:max-w-[100px]`), และปรับระยะห่าง (`gap-1.5 sm:gap-3`)
  - ใน `page.tsx`: ปรับ Padding ของ Action Box เป็น `p-4 sm:p-6 lg:p-8`, ใช้ placeholder ย่อบนมือถือ `"รหัสห้อง 6 หลัก"`, ปรับ `tracking-wider sm:tracking-widest` และขนาดฟอนต์ให้พอดีกับจอ 320px-390px โดยไม่มี horizontal scroll
  - ปรับขนาดหัวข้อ Hero เป็น `text-2xl sm:text-4xl md:text-5xl` ตัดปัญหาข้อความเบียดแน่น

### 2. [แก้ไขแล้ว ✓] อิงชื่อและอวาตาร์จากโปรไฟล์อัตโนมัติเมื่อเข้าห้อง (Profile Auto-fill on Room Join)
- **ปัญหาเดิม:** ผู้ใช้ที่ล็อกอินระบบไว้แล้วเมื่อเข้าห้องยังต้องกรอกชื่อเล่นและเลือกอวาตาร์ใหม่ซ้ำซ้อน
- **สาเหตุ (Root Cause):** ใน `src/app/room/[code]/page.tsx` ค่าเริ่มต้นของ `nickname` กำหนดเป็น `""` และไม่มี effect ซิงค์ข้อมูลจาก `useAuth().profile`
- **การแก้ไข (Solution):**
  - เพิ่มระบบตรวจจับ `profile?.displayName` เมื่อผู้ใช้ล็อกอินอยู่ จะทำการ pre-fill `nickname` และ `selectedAvatar` ให้อัตโนมัติทันที
  - เพิ่มป้าย Badge แสดงสถานะ `"กำลังเข้าร่วมในชื่อโปรไฟล์: {profile.displayName} (คุณสามารถเปลี่ยนชื่อเล่นสำหรับห้องนี้ได้)"`
  - อนุญาตให้กด "เข้าร่วมห้อง" ได้ในคลิกเดียวโดยไม่ต้องพิมพ์ใหม่ พร้อมคงชื่อเดิมไว้หากผู้ใช้พิมพ์แก้ไขเอง

### 3. [แก้ไขแล้ว ✓] แทนที่ปุ่มเปิด/ปิดเสียงใน Lobby ด้วยเมนูตั้งค่าเต็มรูปแบบ (Lobby Settings UI Replacement)
- **ปัญหาเดิม:** ในห้องไม่มีส่วนตั้งค่าให้ใช้ มีเพียงปุ่มเปิด/ปิดเสียงเดี่ยวๆ
- **สาเหตุ (Root Cause):** ใน `lobby-view.tsx` มีเพียงปุ่ม toggle mute เสียงเอฟเฟกต์ ไม่ได้นำคอมโพเนนต์เมนูการตั้งค่ามาใช้งาน
- **การแก้ไข (Solution):**
  - นำเข้าและวางคอมโพเนนต์ `<SettingsMenu />` แทนที่ปุ่ม mute เดิมใน Header ของ `LobbyView`
  - รองรับการปรับ Master Volume, SFX Volume, Dark/Light Theme และ Haptics อย่างครบถ้วน สอดคล้องกับหน้าเกมอื่น

### 4. [แก้ไขแล้ว ✓] ปิดหน้าต่างการตั้งค่าอัตโนมัติเมื่อกดบันทึกสำเร็จ (Settings Modal Auto-close on Save)
- **ปัญหาเดิม:** เมื่อตั้งค่าห้องแล้วกด Save หน้าต่างตั้งค่าไม่ปิด ต้องกดปิดเอง
- **สาเหตุ (Root Cause):**
  - API endpoint `/api/room/[code]/settings` ปฏิเสธคำขอด้วย 403 Forbidden เพราะตรวจสอบสิทธิ์ด้วย `callerToken !== room.host_player_id` (เนื่องจาก `sessionToken` ไม่ตรงกับ `playerId`) ทำให้คืนค่า `false`
  - ใน `HostSettingsModal` ฟังก์ชัน `handleSave` มีเงื่อนไข `if (res !== false) onClose()` เมื่อได้ `false` จึงไม่ยอมปิด Modal
- **การแก้ไข (Solution):**
  - แก้ไขการยืนยันตัวตนโฮสต์ใน API settings ให้รองรับทั้ง `sessionToken` และ `playerId` (ทำให้บันทึกสำเร็จ ไม่ติด 403)
  - ปรับปรุง `handleSave` ใน `HostSettingsModal` ให้เรียก `onClose()` ทันทีเมื่อ `onSaveSettings` สำเร็จ และแจ้งเตือนข้อผิดพลาดหากไม่สำเร็จ

### 5. [แก้ไขแล้ว ✓] แก้ไขข้อผิดพลาด 403 Forbidden เมื่อกดเริ่มเกม (Game Start 403 Forbidden Resolution)
- **ปัญหาเดิม:** เมื่อโฮสต์กด "เริ่มเกมเลย!" เกิด Error `Failed to load resource: the server responded with a status of 403 ()`
- **สาเหตุ (Root Cause):**
  - เมื่อสร้างห้องหรือเข้าร่วมห้อง `playerId` และ `sessionToken` ถูกสร้างเป็นคนละ UUID
  - คอลัมน์ `rooms.host_player_id` บันทึก `playerId` ไว้ แต่ Client Hook `use-room-realtime.ts` ส่ง `callerToken = myPlayer.sessionToken`
  - ใน `/api/room/[code]/next-round/route.ts` ทำการตรวจสอบ `if (callerToken !== room.host_player_id)` จึงไม่ตรงกันและส่ง HTTP 403 Forbidden เสมอ
- **การแก้ไข (Solution):**
  - เพิ่มฟังก์ชัน Helper `RoomService.isCallerHost(room, tokens)` ตรวจสอบสิทธิ์โดยจับคู่กับทั้ง `room.host_player_id` และรายการผู้เล่นที่เป็น Host ใน `room.settings.players` (รองรับทั้ง `id` และ `sessionToken`)
  - อัปเดต API endpoints ที่เกี่ยวข้อง: `next-round`, `settings`, และ `skip` ให้ใช้ `RoomService.isCallerHost`
  - อัปเดต `use-room-realtime.ts` ให้ส่งทั้ง `playerId` และ `sessionToken` ใน Request Body อย่างถูกต้อง