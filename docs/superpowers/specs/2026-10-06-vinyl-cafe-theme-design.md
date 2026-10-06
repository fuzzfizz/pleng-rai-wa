# 🎨 Design Spec: ธีม "Vinyl Cafe & Warm Lo-Fi" (Pleng-Rai-Wa UI/UX Restyle)

## 📌 ภาพรวม (Overview)
ปรับเปลี่ยนอัตลักษณ์ทางสายตา (Visual Identity) ของโปรเจกต์ "เพลงไรวะ" จากเดิมที่มีบรรยากาศแบบผับนีออน (Cyberpunk / Neon Club: ดำสนิท, ชมพูนีออน, ม่วงเลเซอร์, ไซแอน) ให้เปลี่ยนเป็นบรรยากาศ **"Vinyl Cafe & Warm Lo-Fi"** ที่มีความอบอุ่น ชิว สบายตา มีสไตล์ Indie / Art และให้ความรู้สึกเหมือนนั่งฟังเพลงและเล่นเกมกับเพื่อนในสตูดิโอแผ่นเสียงหรือคาเฟ่แจ๊สยามค่ำคืน

---

## 🎨 Token System: Palette, Typography & Surfaces

### 1. Palette โทนสีหลัก
* **Background (พื้นหลังหลัก)**: `stone-950` (`#0c0a09` / Deep Warm Charcoal) ให้ความลึก อบอุ่นกว่าสีดำผับแบบเดิม
* **Surface / Cards (พื้นผิวการ์ดและโมดอล)**: `stone-900/80` (`#1c1917`) พร้อมขอบละมุน `stone-800` (`#292524`)
* **Primary Accent (ไฮไลท์หลัก - สีแผ่นเสียงทองเหลือง/อำพัน)**: `amber-500` (`#f59e0b`) และ `amber-400` (`#fbbf24`) สำหรับปุ่มหลัก, ไฮไลท์, ไอคอนสำคัญ
* **Secondary Accent (สีส้มอิฐคลาสสิก / Terracotta)**: `orange-600` (`#ea580c`) / `stone-warm` สำหรับโทนแทรกสร้างมิติ
* **Text Colors (ตัวหนังสือ)**:
  * พาดหัว (Headings): `stone-100` (`#f5f5f4` / Warm Linen Cream) สบายตา ไม่สว่างโร่บาดตา
  * เนื้อหา (Body): `stone-300` (`#d6d3d1`)
  * ตัวหนังสือรอง (Muted/Hints): `stone-400` / `stone-500`
* **Ambient Lighting (แสงเรืองรองนวลตา)**:
  * เปลี่ยนจากแสงเลเซอร์สีชมพู/ม่วง เป็นแสงอุ่นสลัวโทนพระอาทิตย์ตก / หลอดไส้วินเทจ (`amber-600/10` และ `orange-700/08`)

---

## 🧩 การปรับแต่งในแต่ละส่วนประกอบ (Component Transformation)

| ส่วนประกอบ | แบบเดิม (Pub/Neon Club) | แบบใหม่ (Vinyl Cafe & Warm Lo-Fi) |
| :--- | :--- | :--- |
| **Hero & Landing Page** | แสงสีม่วง/ชมพูนีออน พาดหัวการ์เดียนต์สามสี | แสงเรืองรองสีอำพันสลัว การ์เดียนต์สีครีมทองอุ่น ปุ่มไม้/ทองเหลืองแอมเบอร์สัมผัสนุ่ม |
| **Buzzer Button (ปุ่มกริ่ง)** | ปุ่มสีชมพูนีออนกระพริบจัดจ้าน | ปุ่มกดทรงวินเทจ Bakelite / Brass สีอำพันทองลึก สั่นตอบสนองนุ่มนวล มีเงาลึกแบบปุ่มสัมผัสจริง |
| **Navbar & Header** | ตัวหนังสือไล่สีนีออน ขอบม่วงสะท้อนแสง | โลโก้แผ่นเสียงวินเทจ ขอบสีหินอุ่น `stone-800/80` ไอคอนสีทองเหลือง |
| **Host Settings & Lobby** | การ์ดสีดำเข้มขอบนีออน ปุ่มสีม่วงสด | สตูดิโอบอร์ด การ์ดสีหินอุ่น แท็กโหมดเพลงสีอำพันและเขียวเสจอุ่นๆ |
| **Solo Play & Guessing** | ปุ่มตัวเลือกไล่สีชมพูม่วง | แผงเครื่องเล่นเพลงคลาสสิก คอนเฟตติและผลลัพธ์โทนสีทองอำพัน |
| **Playlists & Admin** | แท็บสีม่วงสดจัดจ้าน | คอลเลกชันแผ่นเสียงมินิมอล ขอบการ์ดเรียบหรู สบายตา |

---

## 🛠️ แผนการนำไปใช้งาน (Implementation Scope)

1. **Global Styles (`src/app/globals.css`)**:
   - ปรับ `--background` เป็น `#0c0a09` และ `--foreground` เป็น `#f5f5f4`
   - ปรับแต่ง `.bg-radial-glow` ให้เป็นการกระจายแสงสลัวโทน Amber/Warm Hearth
   - ปรับ `.text-gradient` ให้ออกสีครีมทองอบอุ่น
2. **Landing Page (`src/app/page.tsx`) & Navigation (`src/components/common/nav-header.tsx`)**:
   - เปลี่ยนสี Hero Badge, ปุ่มสร้างห้อง, กล่องรหัสห้อง, และการ์ด 3 โหมดเกม
3. **Multiplayer Room Components (`src/components/room/*`)**:
   - `buzzer-button.tsx`: ออกแบบปุ่มกดกริ่งวินเทจสัมผัสทองเหลือง/อำพัน
   - `lobby-view.tsx`, `game-view.tsx`, `podium-view.tsx`, `tv-view.tsx`, `round-reveal-card.tsx`
4. **Solo Play & Playlist Pages (`src/app/play/solo/page.tsx`, `src/app/playlists/*`)**:
   - เปลี่ยนโทนสีบอร์ดคำถาม, การ์ดเพลย์ลิสต์, แถบตัวเลือก
5. **Admin Portal (`src/app/admin/page.tsx`)**:
   - เปลี่ยนธีมหน้าจัดการคลังเพลงให้อ่านสบายตา เหมาะกับการทำงานต่อเนื่อง
