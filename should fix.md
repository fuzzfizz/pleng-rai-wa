# รายการแก้ไขบั๊กและการปรับปรุง (Fixes & Improvements) โหมด audio slice

- [แก้ไขแล้ว ✓] **เมื่อกดสมัคร/เข้าสู่ระบบด้วย Google แจ้ง {"code":400,"error_code":"validation_failed","msg":"Unsupported provider: provider is not enabled"} (Google OAuth Safe Verification & Pre-flight UX)**:
  - **สาเหตุ (Root Cause)**: ใน `@supabase/supabase-js` ฟังก์ชัน `signInWithOAuth` มีพฤติกรรมเริ่มต้นที่จะ redirect browser ทันที เมื่อ Google provider ถูกปิดใน Supabase Dashboard เบราว์เซอร์ของผู้ใช้จะถูกส่งไปหน้า JSON ดิบที่ Supabase
  - **การแก้ไข**:
    1. ใน [`src/hooks/use-auth.ts`](file:///D:/pleng-rai-wa/src/hooks/use-auth.ts) (`performGoogleSignIn`): ส่ง `options: { redirectTo, skipBrowserRedirect: true }` ไปยัง `supabase.auth.signInWithOAuth`
    2. ทำ Pre-flight verification ยิง `fetch(data.url, { method: "GET" })` ตรวจสอบสถานะก่อนเปลี่ยนหน้า
    3. หากได้ HTTP 400 หรือเนื้อหาระบุ `"Unsupported provider"` / `"provider is not enabled"` / `"validation_failed"` จะระงับการ redirect ทั้งหมด และคืนค่าแจ้งเตือนภาษาไทยที่ชัดเจน: *"ระบบ Google Sign-in ยังไม่ได้เปิดใช้งานในเซิร์ฟเวอร์ Supabase (กรุณาเข้าสู่ระบบด้วยอีเมลและรหัสผ่าน หรือเล่นแบบ Guest ได้ทันที)"*
    4. หากเปิดใช้งานสำเร็จ (สถานะ 200/302) จะนำทางไปยังหน้า Google Login ผ่าน `window.location.assign(data.url)` อย่างปลอดภัย
    5. ใน [`src/components/auth/auth-modal.tsx`](file:///D:/pleng-rai-wa/src/components/auth/auth-modal.tsx) จัดการแสดงกล่องแจ้งเตือนสีเหลือง (Amber Alert) สวยงาม ไม่ปิด Modal พร้อมปุ่มลัดสลับไปสมัคร/ล็อกอินด้วยอีเมลทันที
    6. เขียน Unit test ครอบคลุมใน [`src/hooks/__tests__/google-auth-safe-check.test.ts`](file:///D:/pleng-rai-wa/src/hooks/__tests__/google-auth-safe-check.test.ts) ผ่าน 100% (20/20 tests)
- [แก้ไขแล้ว ✓] **ปัญหาเมื่อหัวห้องออกแต่ผู้ที่อยู่ในห้องกลับไม่ได้สิท host และห้องหายไปจาก active room (Host Migration & Active Room Retention)**:
  - **สาเหตุ (Root Cause)**: ใน [`src/app/api/room/[code]/leave/route.ts`](file:///D:/pleng-rai-wa/src/app/api/room/%5Bcode%5D/leave/route.ts) เดิม เมื่อ Host ออกจากห้อง ระบบจะเรียก `RoomService.deleteRoomByCode` ลบห้องทิ้งทันที และกระจายอีเวนต์ `room_dissolved` ทำให้:
    1. ห้องถูกลบออกจากฐานข้อมูล Supabase และหายไปจากรายการห้องแข่งขันที่เปิดอยู่ (`/api/room/list`)
    2. ผู้เล่นคนอื่นที่ยังค้างอยู่ในห้องถูกเตะออกจากเกมและไม่มีใครได้รับสิทธิ์เป็น Host สืบต่อ
  - **การแก้ไข**:
    1. ใน [`src/app/api/room/[code]/leave/route.ts`](file:///D:/pleng-rai-wa/src/app/api/room/%5Bcode%5D/leave/route.ts): ปรับปรุงให้ตรวจสอบว่าหาก Host ออกจากห้อง แต่ยังมีผู้เล่นอื่นเหลืออยู่ (`remainingCount > 0` หรือ `remainingPlayersList.length > 0`) ระบบจะไม่ลบห้องเด็ดขาด โดยจะทำการส่งมอบตำแหน่ง Host (Host Migration) ให้ผู้เล่นคนถัดไปอัตโนมัติ โดยให้ความสำคัญกับผู้เล่นมนุษย์ก่อนหน้าจอทีวี (TV Spectator)
    2. อัปเดต `rooms.host_player_id` ในฐานข้อมูล Supabase เป็น Player ID ของ Host คนใหม่
    3. อัปเดต `rooms.settings`: `hostDisplayName`, `hostAvatar`, `playerCount`, และ `players`
    4. กระจายอีเวนต์ Realtime `host_changed`, `room_settings`, และ `player_left` แบบเรียลไทม์
    5. ห้องจะถูกลบออกจากฐานข้อมูล Supabase ทันทีเฉพาะเมื่อผู้เล่นทุกคนออกจากห้องจนหมดครบ 100% (`remainingCount <= 0` และไม่มีผู้เล่นเหลืออยู่)
    6. ใน [`src/hooks/use-room-realtime.ts`](file:///D:/pleng-rai-wa/src/hooks/use-room-realtime.ts): รองรับการรับอีเวนต์ `host_changed` และเลื่อนขั้นผู้เล่นที่ได้รับเลือกเป็น Host ทันที (`isHost: true`, `myPlayer.isHost: true`) พร้อมบันทึก `sessionStorage.setItem('pleng_host_' + code, 'true')` ปลดล็อกปุ่มเริ่มเกม, การตั้งค่า, และข้ามเพลง
    7. ใน [`src/app/room/[code]/page.tsx`](file:///D:/pleng-rai-wa/src/app/room/%5Bcode%5D/page.tsx): ปรับ `sendLeaveSignal` ให้ส่ง `remainingPlayers` และ `candidateHost` แนบไปใน Request Body เสมอ พร้อมซิงก์ State ของ Host เมื่อได้รับการโปรโมต
    8. ใน [`src/app/api/room/join/route.ts`](file:///D:/pleng-rai-wa/src/app/api/room/join/route.ts): รักษาและอัปเดต `room.settings.players` ให้มีข้อมูลผู้เล่นครบถ้วน
    9. เขียน Unit test ครอบคลุมใน [`src/app/api/room/__tests__/host-migration-leave.test.ts`](file:///D:/pleng-rai-wa/src/app/api/room/__tests__/host-migration-leave.test.ts) ผ่าน 100% (12/12 tests)