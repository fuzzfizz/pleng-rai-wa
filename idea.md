# ไอเดียพัฒนาเพิ่มเติม (Ideas)

- [x] ทำให้เมื่อเริ่มเกมไปแล้วหัวห้องสามารถยกเลิกเกมนั้นแล้วกลับสู่ lobby ได้เผื่อต้องการตั้งค่าเกมใหม่
  - **สถานะ:** เสร็จสมบูรณ์ (Implemented)
  - เพิ่มปุ่ม "กลับล็อบบี้" (Return to Lobby) ใน Game View Header สำหรับ Host พร้อม Modal ยืนยันการยกเลิกเกม
  - อัปเดต API `/api/room/[code]/reset-lobby` ให้ตรวจสอบสิทธิ์ Host (sessionToken/playerId หรือ Bearer token), รีเซ็ตคะแนนและสถานะห้องกลับสู่ lobby, ล้างแคช Redis และบรอดแคสต์ `room_state` ไปยังผู้เล่นทุกคน
  - อัปเดต `useRoomRealtime` ให้ส่ง Authorization header และ payload ข้อมูล playerId พร้อมอัปเดต state กลับสู่ lobby ทันที