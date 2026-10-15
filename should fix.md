# รายการแก้ไขบั๊กและการปรับปรุง (Fixes & Improvements) โหมด audio slice

### 1. [แก้ไขแล้ว ✓] เมนูตั้งค่าระบบและระดับเสียงเลยขอบจอบนมือถือ (Settings Popover Mobile Overflow Resolution)
- **ปัญหาเดิม:** เมนูตั้งค่าและระดับเสียง (`SettingsMenu`) เมื่อเปิดบนมือถือ ข้อความและแถบเลื่อนเลยขอบจอด้านซ้าย (Overflow ไปที่ -85px บนหน้าจอ 375px/360px) ทำให้ตกขอบจอ
- **สาเหตุ (Root Cause):**
  - ใน `src/components/common/settings-menu.tsx` เดิมกำหนดคลาสเป็น `absolute right-0 top-full mt-2.5 w-72 sm:w-80`
  - เมื่อเปิดจากปุ่มที่ไม่ได้ชิดขอบจอขวาสุด คลาส `right-0` รวมกับความกว้าง `w-72` (288px) บนจอมือถือ 360px - 375px ทำให้ขอบซ้ายของป็อปอัปหลุดออกนอกหน้าจอไปทางซ้าย
- **การแก้ไข (Solution):**
  - เพิ่ม **Mobile Backdrop Overlay** (`fixed inset-0 bg-black/40 backdrop-blur-xs z-40 sm:hidden`) สำหรับหน้าจอมือถือ เพื่อเบลอพื้นหลังและแตะปิดเมนูได้ทันที
  - ปรับตำแหน่งป็อปอัปสำหรับหน้าจอมือถือเป็น `fixed inset-x-3 top-16 sm:absolute sm:inset-x-auto sm:right-0 sm:top-full mt-2.5 sm:w-80 max-w-[calc(100vw-24px)] mx-auto` ทำให้จัดกึ่งกลางและมีระยะขอบปลอดภัยซ้าย-ขวาข้างละ 12px เสมอ ไม่มีทางล้นขอบจอ
  - ปรับองค์ประกอบภายใน เช่น Slider, Header และกล่องควบคุมให้มี `w-full min-w-0` ป้องกัน horizontal scrollbar บนจอรุ่นเล็ก (เช่น 320px)

### 2. [ติดตั้งและใช้งานแล้ว ✓] ระบบทดสอบหน้าจอจริงอัตโนมัติด้วย Headless Chrome (Automated Real-Screen Verification)
- **เครื่องมือที่ใช้:** ติดตั้ง `puppeteer-core` (ฟรี 100% โอเพนซอร์ส) เชื่อมต่อกับ Google Chrome ในเครื่อง (`C:\Program Files\Google\Chrome\Application\chrome.exe`) โดยไม่ต้องเสียค่าบริการใดๆ
- **สคริปต์ตรวจสอบ:** `scripts/audit-mobile-ui.mjs`
  - จำลองหน้าจอมือถือจริง Viewport ขนาด 375x667 (iPhone SE), 320x568 (Ultra-narrow), และ 1024x768 (Desktop)
  - คลิกเปิดปุ่มตั้งค่า `[aria-label="ตั้งค่าระบบและระดับเสียง (Settings)"]`
  - ตรวจสอบ Bounding Box ทางเรขาคณิตว่า `rect.left >= 0` และ `rect.right <= 375` (Zero horizontal overflow 100%)
  - ถ่ายภาพหน้าจอจริง (Visual Screenshots) บันทึกไว้ที่โฟลเดอร์ `scripts/screenshots/`
- **ผลการทดสอบ:** ผ่านการตรวจสอบทุกเงื่อนไข (12/12 Vitest unit tests และ Headless Chrome audit ผ่านทั้งหมด)