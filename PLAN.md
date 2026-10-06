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
| **AI Integration** | **Google Gemini Flash (Free Tier)** | แกะชื่อเพลง, ศิลปิน, ปี, แนวเพลง และตำแหน่งท่อนฮุก (Chorus) ผ่าน @google/genai SDK |
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

### 🔵 Phase 4: ระบบห้องและ Realtime Multiplayer ✅ เสร็จสิ้นแล้ว
- [x] **4.1 ระบบสร้างห้องและจัดการ Lobby**:
  - [x] ระบบสุ่ม Room Code 6 ตัวอักษรแบบปลอดภัย ตัดตัวอักษรสับสน (`src/lib/room-code.ts`)
  - [x] Room Service สำหรับจัดการห้องใน Supabase (`src/lib/services/room-service.ts`)
  - [x] API Routes สำหรับห้อง: `/api/room/create`, `/api/room/join`, `/api/room/[code]/state` (Anti-cheat sanitized), `/api/room/[code]/settings` (Host authorization)
  - [x] ตัวสร้าง QR Code และปุ่ม Copy ลิงก์สำหรับชวนเพื่อน (`src/components/room/qr-code-modal.tsx`)
  - [x] หน้า Lobby รอผู้เล่น แสดงชื่อ, Avatar, และสถานะ Ready (`src/components/room/lobby-view.tsx`, `player-card.tsx`)
  - [x] สิทธิ์ Host: เลือกโหมด, เลือก Genre/Playlist, ตั้งเวลาตอบ, กำหนดจำนวนข้อ และปุ่ม Transfer Host (`src/components/room/host-settings-modal.tsx`)
- [x] **4.2 Session Persistence & Reconnect**:
  - [x] บันทึก `session_token` และ `room_code` ลงใน LocalStorage (`src/lib/session-storage.ts`)
  - [x] รองรับการกด F5 รีเฟรชหน้าจอ หรือสัญญาณหลุด ให้ Reconnect กลับเข้าห้องเดิมอัตโนมัติ (`src/hooks/use-room-realtime.ts`, `src/app/room/[code]/page.tsx`)
- [x] **4.3 Realtime Game Synchronization (Supabase Realtime)**:
  - [x] ซิงค์ Event การเริ่มเพลงพร้อมกันทุกหน้าจอ (`src/app/api/room/[code]/next-round`, `useRoomRealtime`)
  - [x] ระบบแย่งกดกริ่งแบบ First-Come-First-Serve (FCFS) ฝั่ง Server (`src/lib/room-state-store.ts`, `/api/room/[code]/buzz`, `buzzer-button.tsx`)
  - [x] ล็อกสิทธิ์ให้ผู้ที่กดกริ่งคนแรกตอบภายในเวลาที่กำหนด พร้อมระบบกริ่งเปิดใหม่เมื่อตอบผิด (`/api/room/[code]/answer`, `answer-modal.tsx`, `wrong-guess-banner.tsx`)
  - [x] อัปเดตคะแนน Scoreboard แบบ Realtime และเฉลยเพลงพร้อมเสียงฮุก (`round-reveal-card.tsx`, `game-view.tsx`)
  - [x] สรุปผลการแข่งขัน (Podium / Winner Announcement) และ TV Party Display Mode (`src/components/room/podium-view.tsx`, `src/components/room/tv-view.tsx`)

---

### 🟣 Phase 5: ระบบสมาชิกและ Custom Playlists ✅ เสร็จสิ้นแล้ว
- [x] **5.1 Database Schema & Migration (`profiles`, `playlists`, `playlist_songs`)**:
  - [x] SQL Migration `supabase/migrations/20261005_profiles_and_playlists.sql` พร้อมตาราง `profiles`, `playlists`, `playlist_songs`
  - [x] Trigger `on_auth_user_created` สำหรับสร้าง Profile อัตโนมัติเมื่อผู้ใช้สมัครสมาชิก
  - [x] Row Level Security (RLS) policies ปลอดภัยสำหรับข้อมูลโปรไฟล์ เพลย์ลิสต์ส่วนตัว และเพลย์ลิสต์สาธารณะ
  - [x] TypeScript Models ใน `src/types/database.ts` และ `src/types/index.ts`
- [x] **5.2 Client Auth & Profile Management**:
  - [x] Context & Hook `useAuth` (`src/hooks/use-auth.ts`) รองรับ Email/Password, Google OAuth, และ State Sync
  - [x] `AuthModal` (`src/components/auth/auth-modal.tsx`) รองรับ Guest-first policy สมัครเมื่อต้องการสร้างเพลย์ลิสต์
  - [x] `ProfileModal` (`src/components/auth/profile-modal.tsx`) พร้อมตัวเลือก Emoji Avatar 20 แบบและเปลี่ยนชื่อเล่น
  - [x] `NavHeader` (`src/components/common/nav-header.tsx`) แสดงสถานะล็อกอิน, เหรียญคะแนน และปุ่มเข้าสู่ระบบ
- [x] **5.3 Custom Playlist Backend & Song Joining**:
  - [x] `PlaylistService` (`src/lib/services/playlist-service.ts`) Typed CRUD สำหรับเพลย์ลิสต์ส่วนตัวและสาธารณะ
  - [x] ขยาย `SongService.getRandomSongs` ให้รองรับออปชัน `playlistId`, song exclusion, recycling และ fallback อัตโนมัติ
- [x] **5.4 Custom Playlist Management UI**:
  - [x] หน้ารวมคลังเพลย์ลิสต์ `/playlists` แสดงรายการเพลย์ลิสต์ของฉันและของสาธารณะ พร้อมเวลาเล่นรวม
  - [x] หน้าสร้างและแก้ไข `/playlists/new` และ `/playlists/[id]/edit` (`PlaylistEditor`)
  - [x] ค้นหาเพลงในคลัง, เล่นเสียงตัวอย่าง 5 วินาที, จัดลำดับเพลง, และตรวจสอบเกณฑ์ขั้นต่ำ 5 เพลงสำหรับการเล่นเกม
- [x] **5.5 Gameplay Integration (Multiplayer & Solo)**:
  - [x] เพิ่มตัวเลือก "🎵 แหล่งเพลง (Song Source)" ใน `HostSettingsModal` เลือกระหว่างคลังทั้งหมดหรือเพลย์ลิสต์
  - [x] ปรับ API `/api/room/[code]/next-round` ให้สุ่มเพลงจาก `settings.playlistId`
  - [x] โหมดเล่นคนเดียว `/play/solo` รองรับ URL Query `?playlistId=` และ Selector สลับเพลย์ลิสต์พร้อม `<Suspense>`

---

### 🟢 Phase 6: การทดสอบ การขัดเกลา Mobile Ergonomics และ Deploy สู่ Public ✅ เสร็จสิ้นแล้ว
- [x] **6.1 Responsive & Mobile Ergonomics**:
  - [x] Next.js 15 `viewport: Viewport` configuration และ `min-h-[100dvh]` ป้องกัน Layout Shift จาก Navigation Bar
  - [x] Safe-Area Utilities (`.pb-safe`, `.pt-safe`) รองรับ iOS Safari Home Bar & Notch
  - [x] ป้องกัน iOS Safari Auto-Zoom ด้วย `text-base sm:text-sm` (font-size $\ge 16\text{px}$) ทุก Form Inputs
  - [x] Touch Targets มาตรฐาน $\ge 44\text{px}$ ทั่วทั้งระบบ (ปุ่มควบคุมเสียง, ปุ่มปิด Modal, Pagination)
  - [x] ปุ่มกดกริ่ง (Buzzer) ปรับแต่ง Tactile Juice: `touch-manipulation` ไร้ดีเลย์ 300ms, สั่น Haptic Feedback (`navigator.vibrate`), Micro-scale animation และ Responsive Sizing
- [x] **6.2 PWA & Social Metadata**:
  - [x] Next.js 15 Web App Manifest (`src/app/manifest.ts`) รองรับ PWA Add to Home Screen แบบ Standalone
  - [x] OpenGraph และ Twitter Card Metadata สำหรับการแชร์ลิงก์อย่างสวยงามบน LINE, Discord, Facebook, X
- [x] **6.3 Production Deployment & Automated Verification**:
  - [x] ชุดทดสอบอัตโนมัติ `scripts/test-phase6-readiness.ts` ครบ 14 Suite ผ่าน 100% Green
  - [x] คู่มือ Production Deployment Checklist บน Vercel + Supabase + Cloudflare R2 ใน `README.md`
  - [x] ตรวจสอบ `npm run build` และ TypeScript ผ่านฉลุย 0 Errors

---

## 💡 แนวทางการกลับมาทำต่อ (How to Resume Work)
เมื่อคุณปิดหน้าต่างแชตนี้ไปแล้ว และเปิดเซสชันใหม่กับ AI Agent ในอนาคต คุณสามารถพิมพ์คำสั่งต่อไปนี้เพื่อให้ AI รับช่วงต่อได้ทันที:

```text
อ่านไฟล์ PLAN.md และช่วยทำต่อใน Phase [ระบุเลข Phase เช่น Phase 1.1]
```
AI จะตรวจสอบสถานะ Checkbox ในไฟล์นี้ อ่านบริบท และเริ่มเขียนโค้ดตามแผนงานที่วางไว้อย่างต่อเนื่องทันที
