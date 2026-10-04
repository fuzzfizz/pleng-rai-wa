# 📋 แผนการพัฒนาโปรเจค "เพลงไรวะ" (Pleng-Rai-Wa)
> **เอกสารแผนงานหลัก (Master Implementation Plan)** สำหรับติดตามความคืบหน้าและกลับมาทำต่อได้ตลอดเวลา

---

## 📌 ข้อมูลโปรเจค (Project Overview)
- **ชื่อโปรเจค**: เพลงไรวะ (Pleng-Rai-Wa)
- **เป้าหมาย**: เว็บเกมทายเพลงออนไลน์เล่นคนเดียวหรือเล่นกับเพื่อนผ่านห้อง Realtime (สไตล์สนุก ชิว เป็นกันเอง รองรับมือถือและคอมพิวเตอร์) พร้อมระบบ Admin Pipeline เพิ่มเพลงด้วย AI บนงบประมาณ **0 บาท (100% Free Public Feasibility)**
- **Git Repository**: `git@github.com:fuzzfizz/pleng-rai-wa.git` (Default Branch: `main`)

---

## 🛠️ สรุป Tech Stack & สถาปัตยกรรม (Architecture Summary)

| ชั้นระบบ (Layer) | เทคโนโลยีที่เลือก | หน้าที่และรายละเอียด |
| :--- | :--- | :--- |
| **Frontend** | **Next.js 15 (App Router) + TypeScript** | Core Web Framework, SSR/SSG, Responsive Layout |
| **Styling & UI** | **Tailwind CSS + shadcn/ui + Lucide Icons** | Design System สไตล์เกมชิวๆ ฟอนต์ไทย (Kanit/Prompt) |
| **Database & Auth** | **Supabase (PostgreSQL + Auth)** | เก็บข้อมูลเพลง, เพลย์ลิสต์, ผู้ใช้ (Guest & Registered Members) |
| **Realtime Engine** | **Supabase Realtime (Presence & Broadcast)** | ซิงค์ห้อง Lobby, การเล่นเพลงพร้อมกัน, และระบบกดกริ่ง |
| **Audio Storage** | **Cloudflare R2** (10GB Free) | จัดเก็บไฟล์เสียง MP3 **ฟรีค่าส่งข้อมูล (Zero Egress Bandwidth)** |
| **Audio Processing** | **Server-side Slicing / Range Requests** | สตรีมเฉพาะช่วงวินาทีที่ต้องการ ป้องกันการโกงคำตอบ |
| **Game Audio & SFX** | **Web Audio API / Howler.js** | เล่นเสียงประกอบ (เสียงกริ่ง, เสียงจับเวลา, เสียงถูก/ผิด) |
| **Answer Matching** | **Fuzzy String Matching + `fuse.js`** | โหมดพิมพ์เอง (ตรวจคำสะกดผิด) และโหมด Autocomplete |
| **Local Admin Tool** | Route `/admin` ในโปรเจค (Local Only) | หน้าเว็บให้แอดมินใส่ลิงก์ YouTube/ชื่อเพลง ดึง MP3 เข้าคลัง |
| **AI Integration** | **Google Gemini Flash (Free) / Jev AI** | แกะชื่อเพลง, ศิลปิน, ปี, แนวเพลง และตำแหน่งท่อนฮุก (Chorus) |
| **Hosting & Deploy** | **Vercel Hobby Tier** (Frontend) | โฮสต์เว็บและ API Routes สาธารณะฟรี 100% |

---

## 🗺️ แผนการพัฒนาทีละขั้นตอน (Phase-by-Phase Checklist)

### 🟢 Phase 1: การวางรากฐานและโครงสร้างโปรเจค (Foundation & Repository) ✅ เสร็จสิ้นแล้ว
- [x] **1.1 Git Setup**:
  - [x] Initialize git repository ในโฟลเดอร์โปรเจค (Branch `main`)
  - [x] ผูก Remote: `git remote add origin git@github.com:fuzzfizz/pleng-rai-wa.git`
  - [x] ตั้งค่า `.gitignore` ให้ครอบคลุม `node_modules`, `.env*.local`, `.obsidian`, ไฟล์ดาวน์โหลดชั่วคราว
- [x] **1.2 Initialize Next.js Project**:
  - [x] ติดตั้ง Next.js 15 App Router พร้อม TypeScript และ Tailwind CSS
  - [x] ติดตั้ง Core Packages: Supabase Client, Lucide Icons, Fuse.js, QRCode, AWS S3 Client, Howler
  - [x] ติดตั้งฟอนต์ภาษาไทย `Kanit` และ `Prompt` พร้อมธีม Dark Mode สไตล์เกมปาร์ตี้
- [x] **1.3 Environment & Configs**:
  - [x] สร้างไฟล์ `.env.example` ระบุตัวแปรสำหรับ Supabase, Cloudflare R2, และ Gemini API Key
  - [x] วางโครงสร้างโฟลเดอร์โปรเจค (`src/app`, `src/lib`, `src/types`)
  - [x] สร้างโมเดลข้อมูลหลัก (Song, Room, Player, GameMode) ใน `src/types/index.ts`
  - [x] สร้างหน้าแรก (Landing Page) พร้อม Hero และการแสดงผล 3 โหมดเกม

---

### 🟡 Phase 2: คลังเพลงและระบบ Admin AI Pipeline (Local Admin Tool) ✅ เสร็จสิ้นแล้ว
- [x] **2.1 Database Schema (Supabase)**:
  - [x] สร้าง SQL Migration `supabase/migrations/20261004_initial_schema.sql` (ตาราง `genres`, `songs`, `playlists`, `playlist_songs`, `rooms` พร้อม `lyrics_intro`, `lyrics_chorus` และ seed genres)
  - [x] กำหนด Row Level Security (RLS) เพื่อความปลอดภัย
  - [x] สร้าง Song Service (`src/lib/services/song-service.ts`) พร้อม Typed Database Models
- [x] **2.2 Local Admin Portal (`/admin`)**:
  - [x] สร้างหน้าเว็บแอดมินสำหรับรันบน Localhost (`/admin`) ใน `src/app/admin/page.tsx`
  - [x] สร้างฟอร์มรับ URL YouTube หรือชื่อเพลง/ศิลปิน พร้อมปุ่มตัวอย่างเพลงทดสอบ
  - [x] แท็บจัดการคลังเพลง (ค้นหา, เล่นเสียงพรีวิว, ลบเพลง) และแท็บตั้งค่า API Key
- [x] **2.3 Local Download & Audio Conversion (yt-dlp + ffmpeg)**:
  - [x] สร้างตัวช่วย `src/lib/audio-downloader.ts` เรียก `yt-dlp` และ `ffmpeg` แปลงเป็น MP3 128kbps อัตโนมัติ
  - [x] ระบบ Auto-detection ตรวจหา binary ในเครื่อง หรือดาวน์โหลด yt-dlp ลง `./bin/` อัตโนมัติ
  - [x] วัดความยาวเพลง (duration) และสกัดช่วงท่อนฮุก
- [x] **2.4 AI Metadata Extraction**:
  - [x] สร้าง Service `src/lib/ai-extractor.ts` เชื่อมต่อ Google Gemini API (`@google/genai`)
  - [x] สกัดชื่อเพลง, ศิลปิน, ชื่อเรียกอื่น (Aliases), ปีที่ปล่อย, แนวเพลง, ท่อนฮุก, และเนื้อเพลงท่อนเปิด/ฮุก
  - [x] มี Heuristic Fallback อัตโนมัติรองรับการทำงานแม้ยังไม่ได้ใส่ API Key
  - [x] ฟอร์ม UI ให้แอดมินตรวจสอบและแก้ไขทุกฟิลด์ก่อนกดยืนยันนำเข้า
- [x] **2.5 Cloudflare R2 Upload**:
  - [x] สร้าง Client S3/R2 ใน `src/lib/r2.ts` รองรับทั้งการอัปโหลด, ลบ, และสตรีมมิ่งด้วย Range Requests
  - [x] ระบบสำรองบันทึกลง Local (`public/audio/uploads/`) อัตโนมัติกรณีที่ยังไม่ได้ใส่ค่า R2 Credentials
  - [x] บันทึก Metadata และ Audio URL ลงตาราง `songs` ใน Supabase Database ผ่าน `/api/admin/import`

---

### 🟠 Phase 3: กลไกเกมและระบบเสียง (Core Game Engine & Game Modes) ✅ เสร็จสิ้นแล้ว
- [x] **3.1 Dynamic Server-side Audio Slicing**:
  - [x] สร้างโมดูลตัดเสียงระดับเฟรม Pure TypeScript ใน `src/lib/mp3-slicer.ts` ตรวจจับ MPEG sync words และสกัดเฉพาะเฟรมเสียงที่ต้องการ
  - [x] สร้าง API Route `/api/audio/slice?id=xxx&start=45.2&duration=1.0` ดึงเสียงจาก Cloudflare R2 / Local storage แล้วตัดเสี้ยววินาทีส่งกลับแบบ On-demand
  - [x] ขนาดไฟล์ตัดสั้นเพียง ~16-80 KB โหลดไว และป้องกันการโกงคำตอบ 100%
- [x] **3.2 Sound Effects & Web Audio Synthesizer**:
  - [x] สร้างระบบจำลองเสียงประกอบ Procedural Synthesizer ด้วย Web Audio API ใน `src/lib/sound-effects.ts` (0ms latency, โหลดไว, ฟรี ไม่ต้องพึ่งพาไฟล์เสียงภายนอก)
  - [x] เสียงกริ่ง (Buzzer), เสียงนับถอยหลังตึกตัก (Countdown tick), เสียงตอบถูก (Correct chime), เสียงตอบผิด (Wah-wah), เสียงคลิก UI
  - [x] ระบบสลับ Mute และปรับ Volume บันทึกลง LocalStorage อัตโนมัติ
- [x] **3.3 Answer Checking Engine**:
  - [x] ฟังก์ชัน Normalize ภาษาไทยและสกัดคำพ้องเสียง (`src/lib/answer-checker.ts`) รองรับการพิมพ์สะกดตกหล่น, สลับ ใ/ไ, ัย/ไ, และพยัญชนะพ้องเสียง
  - [x] ระบบค้นหา Autocomplete แบบรวดเร็วด้วย `fuse.js`
- [x] **3.4 โหมดทายเนื้อเพลงด้วยเสียง AI (AI Deadpan Lyrics Reader)**:
  - [x] เชื่อมต่อ Web Speech API (`window.speechSynthesis`) ใน `src/lib/tts-reader.ts` ฟรี 100% ตลอดชีพ ไม่จำกัดครั้ง
  - [x] รองรับเสียงภาษาไทย (`th-TH`) อ่านด้วยน้ำเสียงเรียบนิ่ง ไร้ทำนอง
  - [x] มีสวิตช์เลือกฟัง **"ท่อนฮุก (Chorus)"** หรือ **"ท่อนเปิด (Intro)"**
- [x] **3.5 โหมดเล่นคนเดียว (Single Player Testbed)**:
  - [x] สร้างหน้าจอเกมเล่นเดี่ยวที่ [`src/app/play/solo/page.tsx`](file:///D:/pleng-rai-wa/src/app/play/solo/page.tsx)
  - [x] รองรับทั้ง 3 โหมด: **Audio Slice (1s/2s/5s)**, **Buzzer Battle (กด Spacebar/คลิก)**, และ **AI Deadpan Lyrics**
  - [x] ระบบตรวจคำตอบแบบ Dual Mode (Autocomplete / พิมพ์เอง), ระบบคะแนน, สตรีค, และเฉลยเพลงพร้อม Confetti

---

### 🔵 Phase 4: ระบบห้องและ Realtime Multiplayer (กำลังดำเนินการ ⏳)
- [ ] **4.1 ระบบสร้างห้องและจัดการ Lobby**:
  - [x] ระบบสุ่ม Room Code 6 ตัวอักษรแบบปลอดภัย ตัดตัวอักษรสับสน (`src/lib/room-code.ts`)
  - [x] Room Service สำหรับจัดการห้องใน Supabase (`src/lib/services/room-service.ts`)
  - [x] API Routes สำหรับห้อง: `/api/room/create`, `/api/room/join`, `/api/room/[code]/state` (Anti-cheat sanitized), `/api/room/[code]/settings` (Host authorization)
  - [ ] ตัวสร้าง QR Code และปุ่ม Copy ลิงก์สำหรับชวนเพื่อน
  - [ ] หน้า Lobby รอผู้เล่น แสดงชื่อ, Avatar, และสถานะ Ready
  - [ ] สิทธิ์ Host: เลือกโหมด, เลือก Genre/Playlist, ตั้งเวลาตอบ, กำหนดจำนวนข้อ และปุ่ม Transfer Host
- [ ] **4.2 Session Persistence & Reconnect**:
  - [ ] บันทึก `session_token` และ `room_code` ลงใน LocalStorage
  - [ ] รองรับการกด F5 รีเฟรชหน้าจอ หรือสัญญาณหลุด ให้ Reconnect กลับเข้าห้องเดิมอัตโนมัติ
- [ ] **4.3 Realtime Game Synchronization (Supabase Realtime)**:
  - [ ] ซิงค์ Event การเริ่มเพลงพร้อมกันทุกหน้าจอ
  - [ ] ระบบแย่งกดกริ่งแบบ First-Come-First-Serve (FCFS) ฝั่ง Server
  - [ ] ล็อกสิทธิ์ให้ผู้ที่กดกริ่งคนแรกตอบภายในเวลาที่กำหนด
  - [ ] อัปเดตคะแนน Scoreboard แบบ Realtime
  - [ ] สรุปผลการแข่งขัน (Podium / Winner Announcement)

---

### 🟣 Phase 5: ระบบสมาชิกและ Custom Playlists
- [ ] **5.1 User Authentication**:
  - [ ] Supabase Auth (รองรับ Guest Mode ชั่วคราว และการสมัครผ่าน Email / Google)
  - [ ] หน้าจัดการโปรไฟล์ผู้ใช้ (แก้ไขชื่อ Display Name, เลือกรูป Avatar)
- [ ] **5.2 Custom Playlist Management**:
  - [ ] หน้าค้นหาเพลงในคลัง และสร้าง Playlist ส่วนตัว
  - [ ] ดึง Playlist ส่วนตัวมาใช้เป็นชุดคำถามในห้องเล่นเกมได้

---

### ⚪ Phase 6: การทดสอบ การขัดเกลา และ Deploy สู่ Public
- [ ] **6.1 Responsive & Mobile Ergonomics**:
  - [ ] ทดสอบบนหน้าจอมือถือ (iOS Safari, Android Chrome) ปุ่มกดกริ่งต้องแตะง่าย ถนัดมือ
  - [ ] ปรับปรุง Animation และ Transition เพิ่มความสนุก
- [ ] **6.2 Production Deployment**:
  - [ ] Deploy เว็บขึ้น Vercel พร้อมเชื่อมโยง Custom Domain หรือ vercel.app
  - [ ] ตั้งค่า Production Environment Variables บน Vercel Dashboard
  - [ ] ตรวจสอบความถูกต้องและ Push โค้ดทั้งหมดขึ้น GitHub `main`

---

## 💡 แนวทางการกลับมาทำต่อ (How to Resume Work)
เมื่อคุณปิดหน้าต่างแชตนี้ไปแล้ว และเปิดเซสชันใหม่กับ AI Agent ในอนาคต คุณสามารถพิมพ์คำสั่งต่อไปนี้เพื่อให้ AI รับช่วงต่อได้ทันที:

```text
อ่านไฟล์ PLAN.md และช่วยทำต่อใน Phase [ระบุเลข Phase เช่น Phase 1.1]
```
AI จะตรวจสอบสถานะ Checkbox ในไฟล์นี้ อ่านบริบท และเริ่มเขียนโค้ดตามแผนงานที่วางไว้อย่างต่อเนื่องทันที
