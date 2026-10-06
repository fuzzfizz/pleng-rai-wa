# 🎨 Design Spec: ธีม "Vinyl Cafe & Warm Lo-Fi" พร้อมระบบ Light / Dark Mode Toggle

## 📌 ภาพรวม (Overview)
ปรับเปลี่ยนอัตลักษณ์ทางสายตา (Visual Identity) ของโปรเจกต์ "เพลงไรวะ" จากเดิมที่เป็นสไตล์ผับนีออน (Cyberpunk / Neon Club: ดำสนิท, ชมพูนีออน, ม่วงเลเซอร์) ให้เปลี่ยนเป็นบรรยากาศ **"Vinyl Cafe & Warm Lo-Fi"** ที่มีความอบอุ่น ชิว สบายตา มีสไตล์ Indie / Art และรองรับการสลับโหมด **Light Mode (Daylight Vinyl Studio)** และ **Dark Mode (Nighttime Listening Lounge)** ได้อย่างลื่นไหล

---

## 🎨 Token System: Dual Palette (Day & Night)

### 1. โหมดกลางคืน (Dark Mode - "Nighttime Vinyl Lounge")
* **Background**: `stone-950` (`#0c0a09` / Deep Warm Charcoal) ให้ความลึก อบอุ่นกว่าสีดำผับแบบเดิม
* **Surface / Cards**: `stone-900/85` (`#1c1917`) ขอบละมุน `stone-800` (`#292524`)
* **Primary Accent**: `amber-500` (`#f59e0b`) และ `amber-400` (ปุ่มวินเทจ, ไฮไลท์หลัก)
* **Secondary Accent**: `orange-600` (`#ea580c`) ส้มอิฐ Terracotta
* **Text Headings**: `stone-100` (`#f5f5f4` / Warm Linen Cream)
* **Text Body / Muted**: `stone-300` / `stone-400`
* **Ambient Glow**: แสงอุ่นสลัวโทน Sunset & Hearth Ember (`amber-600/10`, `orange-700/08`)

### 2. โหมดกลางวัน (Light Mode - "Daylight Vinyl Cafe")
* **Background**: `stone-50` / `#FAF7F2` (Warm Cream Linen Paper) เหมือนกระดาษหนังสือเพลงวินเทจ สบายตา ไม่ขาวจ้า
* **Surface / Cards**: `white` (`#ffffff`) และ `stone-100/90` ขอบนุ่ม `stone-200` (`#e7e5e4`)
* **Primary Accent**: `amber-600` (`#d97706`) สีน้ำผึ้งเข้ม และ `amber-500`
* **Secondary Accent**: `orange-700` (`#c2410c`) ส้มอิฐคลาสสิก
* **Text Headings**: `stone-900` (`#1c1917` / Deep Espresso Ink)
* **Text Body / Muted**: `stone-700` / `stone-500`
* **Ambient Glow**: แสงแดดอุ่นธรรมชาติละมุนตา (`amber-200/40`)

---

## 🌗 สถาปัตยกรรมระบบ Theme Toggle

1. **`ThemeContext` & `useTheme()` Hook (`src/contexts/theme-context.tsx`)**:
   * จัดการ State: `'dark' | 'light' | 'system'`
   * บันทึกค่าลงใน `localStorage` (`pleng_theme`)
   * ตรวจสอบค่าเริ่มต้นจาก System Preference (`window.matchMedia('(prefers-color-scheme: dark)')`)
   * ปรับคลาส `dark` ที่ `<html class="dark">` หรือ `<html>`
2. **ป้องกัน Flash of Wrong Theme (FOUC)**:
   * แทรก Inline Script ขนาดเล็กใน `src/app/layout.tsx` อ่าน `localStorage` ก่อนเรนเดอร์ React เพื่อไม่ให้เกิดหน้ากระพริบขาว/ดำ
3. **`ThemeToggle` Component (`src/components/common/theme-toggle.tsx`)**:
   * ปุ่มกดสลับ พระอาทิตย์ (☀️) / พระจันทร์ (🌙)
   * แสดงใน `NavHeader` ข้างปุ่มโปรไฟล์ / เข้าสู่ระบบ
   * มี Touch target $\ge 44\text{px}$ รองรับมือถือ พร้อม Micro-animation นุ่มนวล

---

## 🧩 การปรับแต่งในแต่ละส่วนประกอบ (Component Transformation)

| ส่วนประกอบ | แบบเดิม (Pub/Neon Club) | แบบใหม่ (Vinyl Cafe Dual Mode) |
| :--- | :--- | :--- |
| **Nav Header** | ขอบนีออน ปุ่มสีม่วง | โลโก้แผ่นเสียงวินเทจ + ปุ่ม Toggle พระอาทิตย์/พระจันทร์ |
| **Hero & Landing Page** | แสงสีม่วง/ชมพูนีออน พาดหัวการ์เดียนต์สามสี | แสงเรืองรองสีอำพันสลัว การ์เดียนต์สีครีมทองอุ่น ปุ่มไม้/ทองเหลืองแอมเบอร์สัมผัสนุ่ม |
| **Buzzer Button (ปุ่มกริ่ง)** | ปุ่มสีชมพูนีออนกระพริบจัดจ้าน | ปุ่มกดทรงวินเทจ Bakelite / Brass สีอำพันทองลึก สั่นตอบสนองนุ่มนวล รองรับทั้ง Light & Dark |
| **Host Settings & Lobby** | การ์ดสีดำเข้มขอบนีออน ปุ่มสีม่วงสด | สตูดิโอบอร์ด การ์ดสีหินอุ่น แท็กโหมดเพลงสีอำพันและเขียวเสจอุ่นๆ |
| **Solo Play & Guessing** | ปุ่มตัวเลือกไล่สีชมพูม่วง | แผงเครื่องเล่นเพลงคลาสสิก คอนเฟตติและผลลัพธ์โทนสีทองอำพัน |
| **Playlists & Admin** | แท็บสีม่วงสดจัดจ้าน | คอลเลกชันแผ่นเสียงมินิมอล ขอบการ์ดเรียบหรู สบายตา |

---

## 🧪 แผนการทดสอบและเกณฑ์ความสำเร็จ (Verification & Acceptance)

1. **Theme Switching**:
   - กดปุ่ม Toggle แล้วสลับระหว่าง Light และ Dark Mode ได้ทันที
   - ปิดแท็บแล้วเปิดใหม่ ค่าโหมดที่เลือกไว้ยังคงอยู่ (Persistence)
   - ไม่เกิดหน้าจอกระพริบ (No FOUC) ตอนโหลดหน้าเว็บครั้งแรก
2. **Automated Verification**:
   - `npm run build` ผ่าน 100% (0 TypeScript/CSS Errors)
   - `npx tsx scripts/test-phase6-readiness.ts` ผ่าน 100% Green
   - Touch targets $\ge 44\text{px}$ ครบทุกปุ่มรวมถึง `ThemeToggle`
