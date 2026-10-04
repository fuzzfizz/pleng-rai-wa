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

### 🟡 Phase 2: คลังเพลงและระบบ Admin AI Pipeline (Local Admin Tool)
- [ ] **2.1 Database Schema (Supabase)**:
  - [ ] สร้างตาราง `songs`, `genres`, `playlists`, `playlist_songs` บน Supabase PostgreSQL (เพิ่มคอลัมน์ `lyrics_intro` และ `lyrics_chorus`)
  - [ ] กำหนด Row Level Security (RLS) เพื่อความปลอดภัย
- [ ] **2.2 Local Admin Portal (`/admin`)**:
  - [ ] สร้างหน้าเว็บแอดมินสำหรับรันบน Localhost (`/admin`) พร้อมระบบล็อกรหัสผ่าน Local
  - [ ] สร้างฟอร์มรับ URL YouTube หรือชื่อเพลง/ศิลปิน
- [ ] **2.3 Local Download & Audio Conversion (yt-dlp + ffmpeg)**:
  - [ ] สร้าง API Route เบื้องหลังที่เรียกคำสั่ง `yt-dlp` และ `ffmpeg` ในเครื่อง
  - [ ] แปลงไฟล์เสียงเป็น MP3 คุณภาพมาตรฐาน 128kbps พร้อมเขียน ID3 Tags
  - [ ] ตรวจจับหรือสกัดช่วงความยาวเพลงทั้งหมด และท่อนฮุก (Chorus Timestamp)
- [ ] **2.4 AI Metadata Extraction**:
  - [ ] สร้าง Service เชื่อมต่อ Google Gemini API / Jev AI เพื่อสกัดข้อมูลอัตโนมัติ
  - [ ] ดึงข้อมูล: ชื่อเพลงทางการ, ศิลปิน, ชื่อย่อ/ชื่อเรียกอื่น (Aliases), ปีที่ปล่อย, แนวเพลง, Timestamp ท่อนฮุก, และ **เนื้อเพลงท่อนเปิด (`lyrics_intro`) + ท่อนฮุก (`lyrics_chorus`)**
  - [ ] แสดงข้อมูลบน UI ให้แอดมินสามารถตรวจสอบ/แก้ไขก่อนกดยืนยัน
- [ ] **2.5 Cloudflare R2 Upload**:
  - [ ] อัปโหลดเฉพาะไฟล์เพลงเต็ม (`full.mp3`) เพียงไฟล์เดียวขึ้น Cloudflare R2 (ประหยัดพื้นที่จัดเก็บ ไม่ต้องเก็บไฟล์ตัดซ้ำซ้อน)
  - [ ] บันทึก Metadata และ Audio URL ลงตาราง `songs` ใน Supabase Database

---

### 🟠 Phase 3: กลไกเกมและระบบเสียง (Core Game Engine & Game Modes)
- [ ] **3.1 Dynamic Server-side Audio Slicing**:
  - [ ] สร้าง API Route `/api/audio/slice?id=xxx&start=45.2&duration=1.0` ทำการดึง HTTP Range Request จาก Cloudflare R2 และตัดเฉพาะ MP3 Frames ที่ต้องการส่งกลับให้ผู้เล่นแบบสดๆ
  - [ ] ใช้ Pure TypeScript / Node.js MP3 Frame Parser น้ำหนักเบา ประมวลผลไวใน 5-15ms โดยไม่ต้องลง FFmpeg binary บน Serverless
  - [ ] ทุกรอบที่สุ่มเพลงขึ้นมา ระบบจะสุ่มจุดตัดใหม่ไม่ซ้ำกัน (หรือให้ผู้เล่นลากเลือกจุดตัดเองได้)
  - [ ] ป้องกันการโกง 100%: ผู้เล่นได้รับเฉพาะก้อนเสียงสั้น ~16-80 KB ไม่มีทางรู้ชื่อเพลงหรือฟังเพลงเต็มได้
  - [ ] Multiplayer Synchronization: ฝั่ง Host/Server สุ่ม Timestamp วินาทีเริ่มต้น แล้วกระจายผ่าน Supabase Realtime ให้ทุกคนในห้องฟังจุดเดียวกันเป๊ะๆ
- [ ] **3.2 Sound Effects & Web Audio Player**:
  - [ ] รวบรวมชุดเสียง Royalty-Free CC0 (เสียงกริ่งแย่งตอบ, เสียงจับเวลา, เสียงตอบถูก/ผิด, เสียงเข้าห้อง)
  - [ ] สร้าง Hook `useAudioPlayer` และ `useSoundEffects` พร้อมปุ่มควบคุมระดับเสียง/Mute
- [ ] **3.3 Answer Checking Engine**:
  - [ ] ระบบตรวจคำตอบแบบพิมพ์เอง: ฟังก์ชัน Normalize สระ/วรรณยุกต์ภาษาไทย + Fuzzy Search (Levenshtein)
  - [ ] ระบบค้นหาแบบ Autocomplete: ใช้ `fuse.js` กรองเฉพาะรายชื่อเพลงในหมวดหมู่ที่เล่น
- [ ] **3.4 โหมดทายเนื้อเพลงด้วยเสียง AI (AI Deadpan Lyrics Reader)**:
  - [ ] ใช้ **Web Speech API (`window.speechSynthesis`)** ของ Browser: **ฟรี 100% ไม่จำกัดจำนวนครั้งตลอดชีพ** ไม่ต้องใช้ API Key รองรับภาษาไทย (`th-TH`) ในตัว
  - [ ] มีตัวเลือกการเล่น: สลับฟัง **"ท่อนฮุก (Chorus)"** หรือ **"ท่อนเปิด (Intro)"**
  - [ ] เล่นเสียง AI อ่านเนื้อเพลงแบบเรียบนิ่ง ไร้ทำนอง เพิ่มความตลกและท้าทายความจำ
- [ ] **3.5 โหมดเล่นคนเดียว (Single Player Testbed)**:
  - [ ] โหมด Audio Slice: เลือกเสี้ยววินาที ฟังเสียง แล้วทายชื่อเพลง
  - [ ] โหมด Buzzer Run: ปล่อยเพลงเล่นไปเรื่อยๆ แล้วกดหยุดเพื่อตอบ
  - [ ] โหมด AI Lyrics: ให้ AI อ่านเนื้อเพลงท่อนเปิด/ท่อนฮุก แล้วทายเพลง

---

### 🔵 Phase 4: ระบบห้องและ Realtime Multiplayer
- [ ] **4.1 ระบบสร้างห้องและจัดการ Lobby**:
  - [ ] ระบบสุ่ม Room Code 6 ตัวอักษร
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
