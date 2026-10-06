# 🎵 เพลงไรวะ (Pleng-Rai-Wa)

> **เว็บเกมทายเพลงออนไลน์เล่นกับเพื่อนหรือคนเดียว สไตล์ชิวๆ สนุกๆ พร้อมระบบเพิ่มเพลงเข้าคลังด้วย AI 100% Free Stack**

[![Vercel](https://img.shields.io/badge/Deploy-Vercel-black?logo=vercel)](https://vercel.com)
[![Next.js](https://img.shields.io/badge/Framework-Next.js%2015-black?logo=next.js)](https://nextjs.org)
[![Supabase](https://img.shields.io/badge/Database-Supabase-3ECF8E?logo=supabase)](https://supabase.com)
[![Cloudflare R2](https://img.shields.io/badge/Storage-Cloudflare%20R2-F38020?logo=cloudflare)](https://www.cloudflare.com/products/r2/)
[![Google Gemini](https://img.shields.io/badge/AI-Google%20Gemini-4285F4?logo=google)](https://ai.google.dev/)

---

## 📖 สารบัญ
- [เกี่ยวกับโปรเจค](#-เกี่ยวกับโปรเจค)
- [ฟีเจอร์เด่น](#-ฟีเจอร์เด่น)
- [โหมดการเล่น](#-โหมดการเล่น)
- [สถาปัตยกรรมและเทคโนโลยี (Tech Stack)](#-สถาปัตยกรรมและเทคโนโลยี-tech-stack)
- [ความคุ้มค่าและความเป็นไปได้ในการรันฟรี (Free Feasibility)](#-ความคุ้มค่าและความเป็นไปได้ในการรันฟรี-free-feasibility)
- [แผนการพัฒนา (Roadmap)](#-แผนการพัฒนา-roadmap)
- [การติดตั้งและใช้งานสำหรับนักพัฒนา (Getting Started)](#-การติดตั้งและใช้งานสำหรับนักพัฒนา-getting-started)
- [การนำขึ้นระบบจริง (Production Deployment)](#-การนำขึ้นระบบจริง-production-deployment)
- [Mobile Ergonomics & PWA Installation](#-mobile-ergonomics--pwa-installation)
- [ชุดทดสอบระบบ (Automated Verification Suites)](#-ชุดทดสอบระบบ-automated-verification-suites)
- [Git Repository](#-git-repository)

---

## 🌟 เกี่ยวกับโปรเจค

**"เพลงไรวะ"** เกิดขึ้นจากไอเดียที่อยากสร้างกิจกรรมเล่นสนุกๆ ในกลุ่มเพื่อนและคอมมูนิตี้ ไม่ว่าจะเป็นงานปาร์ตี้ หรือการเปิดคอล Discord เล่นด้วยกัน โดยไม่ต้องดาวน์โหลดแอป รองรับการเล่นทั้งบนคอมพิวเตอร์และมือถือ มีระบบห้องที่เชิญเพื่อนได้ง่ายผ่านลิงก์หรือ QR Code และมีเครื่องมือ Admin สำหรับให้เจ้าของห้องดึงเพลงจาก YouTube มาตัดเป็น MP3 พร้อมใช้ AI แท็กข้อมูลเพลงลงระบบอย่างอัตโนมัติ

---

## 🎮 โหมดการเล่น

### 1. โหมด Audio Slice (ตัดเสี้ยววินาที)
- เลือกฟังเพลงเพียงสั้นๆ เช่น **1 วินาที, 2 วินาที หรือ 5 วินาที** (หรือลากจุดตัดท่อนฮุกเอง)
- ท้าทายความจำและประสาทการฟังขั้นสุด ใครทายถูกได้คะแนนสูงสุด

### 2. โหมดกดกริ่งแย่งตอบ (Buzzer Battle)
- เพลงจะเล่นไปเรื่อยๆ จนกว่าจะมีผู้เล่นคนใดคนหนึ่ง **"กดกริ่ง"**
- เมื่อมีคนกดกริ่ง เพลงจะหยุดทันที และระบบจะให้สิทธิ์เฉพาะผู้เล่นที่กดกริ่งคนแรก (First-Come-First-Serve) ในการตอบคำถาม
- ถ้าตอบถูกได้รับคะแนน ถ้าตอบผิดจะเปิดโอกาสให้ผู้เล่นคนอื่นแย่งกดต่อ

### 3. โหมด AI อ่านเนื้อเพลง (AI Deadpan Lyrics Reader) ⭐ ฟีเจอร์ใหม่!
- ให้เสียง **AI / Web Speech API (ฟรี 100% ตลอดชีพ ไม่จำกัดครั้ง)** มาอ่านเนื้อเพลงภาษาไทยแบบเรียบนิ่ง ไร้ทำนอง
- สลับเลือกได้ว่าจะให้ AI อ่าน **"ท่อนฮุก (Chorus)"** หรือ **"ท่อนเปิด (Intro)"**
- ชวนหัวเราะและท้าทายความจำขั้นสุด เพราะเพลงที่เราฮัมได้ทุกวัน พอได้ยินเป็นเสียงอ่านแบบไร้อารมณ์จะจำยากขึ้นทันที!

### รูปแบบการตอบคำถาม
- **โหมดพิมพ์เอง**: รองรับการสะกดตกหล่นด้วยระบบ Fuzzy String Matching ภาษาไทย
- **โหมด Autocomplete**: พิมพ์แล้วมีชื่อเพลงแนะนำให้เลือกทันที (ค้นหาเร็วด้วย `fuse.js`)
- **โหมดตัวเลือก (Multiple Choice)**: สุ่มช้อยส์ขึ้นมาให้กดเลือกตอบทันใจ

---

## ⚙️ สถาปัตยกรรมและเทคโนโลยี (Tech Stack)

| ส่วนประกอบ | เทคโนโลยี | รายละเอียด |
| :--- | :--- | :--- |
| **Frontend** | Next.js (App Router), TypeScript, Tailwind CSS, shadcn/ui | UI ชิวๆ สนุก เป็นระเบียบ รองรับมือถือและเดสก์ท็อป |
| **Backend & DB** | Supabase (PostgreSQL + Auth + Realtime + Edge Functions) | จัดการข้อมูลเพลง บัญชีผู้ใช้ และระบบ WebSocket Multiplayer |
| **Audio Storage** | Cloudflare R2 | เก็บไฟล์ MP3 คุณภาพสูง ฟรี 10GB พร้อม **$0 ค่าส่งข้อมูล (Zero Egress)** |
| **AI Integration** | Google Gemini Free API / Jev AI (TypeSafe) | ดึง Metadata, แท็กแนวเพลง, ตรวจหาท่อนฮุกอัตโนมัติ |
| **Local Pipeline** | Next.js `/admin` + `yt-dlp` + `ffmpeg` | เครื่องมือแอดมินรันในเครื่องเพื่อดาวน์โหลดและนำเข้าเพลงเข้าคลัง |
| **Sound Engine** | Web Audio API / Howler.js | ควบคุมเสียงเพลง และเล่น Sound Effects (กริ่ง, จับเวลา, คะแนน) |

---

## 💸 ความคุ้มค่าและความเป็นไปได้ในการรันฟรี (Free Feasibility)

โปรเจคนี้ถูกออกแบบมาเพื่อ **รัน Public ได้ฟรี 100%** ภายใต้ข้อจำกัดของบริการ Free Tier ชั้นนำ:

1. **Vercel Hobby Tier**: โฮสต์หน้าเว็บและ API Routes ฟรี รองรับ Bandwidth 100GB/เดือน
2. **Supabase Free Tier**: ฟรี PostgreSQL 500MB, จัดการ Realtime พร้อมกันได้ 200 คน (เล่นได้หลายสิบห้องพร้อมกัน)
3. **Cloudflare R2**: พื้นที่เก็บไฟล์เสียง 10GB (บรรจุเพลงได้ 2,500 - 3,000 แทร็ก) และไม่คิดค่า Bandwidth ในการสตรีมเพลงเลย
4. **Google AI Studio**: ฟรี 1,500 Requests/วัน เพียงพอต่อการเพิ่มเพลงเข้าคลังได้อย่างต่อเนื่อง
5. **Local Pipeline**: รัน `yt-dlp` ในเครื่องส่วนตัว ทำให้ไม่ติดปัญหา IP YouTube โดนแบนบน Cloud Serverless

---

## 🗺️ แผนการพัฒนา (Roadmap)

- [x] **Phase 1: Foundation**: ติดตั้ง Next.js, Tailwind, shadcn/ui, ฟอนต์ไทย, และเชื่อมต่อ Git
- [x] **Phase 2: Admin AI Pipeline**: หน้า `/admin` พร้อมระบบดึง YouTube MP3 และ AI Auto-fill Tag
- [x] **Phase 3: Core Game Engine**: ระบบตัดเสียง Audio Slice, Web Audio Player, SFX และระบบตรวจคำตอบ
- [x] **Phase 5: Member & Playlists**: ระบบโปรไฟล์สมาชิก (Email/Google Auth), หน้ารวมและแก้ไข Custom Playlist (`/playlists`), เลือกใช้เพลย์ลิสต์ในห้อง Multiplayer และ Solo Play
- [x] **Phase 6: Testing & Launch**: ปรับแต่ง Responsive มือถือ, ระบบ PWA Web App Manifest, Haptic Touch Juice, ตรวจสอบความพร้อมผ่าน Suite อัตโนมัติ 14 ชุด (100% Green) และคู่มือ Deploy บน Vercel

---

## 💻 การติดตั้งและใช้งานสำหรับนักพัฒนา (Getting Started)

### ความต้องการของระบบ (Prerequisites)
- [Node.js](https://nodejs.org/) v18.17 หรือสูงกว่า (แนะนำ Node.js 20.x)
- [yt-dlp](https://github.com/yt-dlp/yt-dlp) และ [ffmpeg](https://ffmpeg.org/) (สำหรับรัน Local Admin Pipeline)
- บัญชี [Supabase](https://supabase.com/) และ [Cloudflare](https://www.cloudflare.com/)

### ขั้นตอนการรันโปรเจค

```bash
# 1. ติดตั้ง Dependencies
npm install

# 2. คัดลอกไฟล์ Environment Variables
cp .env.example .env.local

# 3. เริ่มต้นรันเซิร์ฟเวอร์ Localhost
npm run dev
```

เปิดบราวเซอร์ไปที่ `http://localhost:3000` สำหรับหน้าเกม และ `http://localhost:3000/admin` สำหรับเครื่องมือเพิ่มเพลง

---

## 🚀 การนำขึ้นระบบจริง (Production Deployment)

สถาปัตยกรรมของโปรเจคนี้ได้รับการออกแบบให้สามารถ **Deploy และเปิดให้บริการสู่สาธารณะได้ฟรี 100% ตลอดชีพ (100% Free Public Feasibility)** โดยใช้บริการ Free Tier ที่เสถียรและทรงพลัง:

| บริการ | Tier | ฟังก์ชันการทำงาน | ข้อจำกัดฟรีที่ได้รับ |
| :--- | :--- | :--- | :--- |
| **Vercel** | Hobby (Free) | Next.js Serverless & Static Hosting, Edge CDN | 100GB Bandwidth/เดือน, Fast Global Edge |
| **Supabase** | Free Tier | PostgreSQL Database, Auth, Realtime WebSocket | 500MB DB, 200 Realtime Concurrents, 50k MAU |
| **Cloudflare R2** | Free Tier | เก็บไฟล์เสียง MP3 และสตรีมมิ่งความเร็วสูง | 10GB Storage, **$0 Egress Fees (ไม่คิดค่าแบนด์วิดท์สตรีม)** |
| **Google AI Studio** | Free Tier | AI Gemini Model สกัด Metadata และตรวจจับท่อนฮุก | 1,500 Requests/วัน (ฟรีไม่มีค่าใช้จ่าย) |

### ตาราง Production Environment Variables

กำหนดค่า Environment Variables บนหน้า **Vercel Project Settings > Environment Variables**:

| Variable Name | Required? | คำอธิบาย & แหล่งที่มาของข้อมูล | ตัวอย่างค่า |
| :--- | :---: | :--- | :--- |
| `NEXT_PUBLIC_SUPABASE_URL` | **Yes** | Supabase Project URL จากหน้า Settings > API | `https://xyzproject.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | **Yes** | Supabase Anonymous Public Key จากหน้า Settings > API | `eyJhbGciOi...` |
| `SUPABASE_SERVICE_ROLE_KEY` | **Yes** | Supabase Service Role Key (สิทธิ์ Admin สำหรับ API routes) | `eyJhbGciOi...` |
| `R2_ACCOUNT_ID` | **Yes** | Cloudflare Account ID (หรือใช้ `CLOUDFLARE_R2_ACCOUNT_ID`) | `a1b2c3d4e5f6...` |
| `R2_ACCESS_KEY_ID` | **Yes** | R2 API Token Access Key ID (สิทธิ์ Object Read/Write) | `9876543210abcdef...` |
| `R2_SECRET_ACCESS_KEY` | **Yes** | R2 API Token Secret Access Key | `fedcba0123456...` |
| `R2_BUCKET_NAME` | **Yes** | ชื่อ R2 Bucket ที่สร้างไว้สำหรับเก็บไฟล์เสียง | `pleng-rai-wa-audio` |
| `R2_PUBLIC_DOMAIN` | **Yes** | Public Domain หรือ R2 Dev URL (หรือใช้ `CLOUDFLARE_R2_PUBLIC_URL`) | `https://pub-xxxxxx.r2.dev` |
| `GEMINI_API_KEY` | **Yes** | Google AI Studio API Key จาก [aistudio.google.com](https://aistudio.google.com/) | `AIzaSy...` |
| `ADMIN_SECRET_KEY` | **Yes** | รหัสผ่านสำหรับเข้าใช้งานหน้า `/admin` ในการเพิ่มเพลง | `your-secure-admin-secret` |
| `NEXT_PUBLIC_SITE_URL` | Optional | URL โดเมนหลักของระบบสำหรับสร้างลิงก์และ OpenGraph | `https://pleng-rai-wa.vercel.app` |

> 💡 **Tip:** ระบบรองรับทั้งชื่อตัวแปรแบบย่อ (`R2_*`) และชื่อเต็ม (`CLOUDFLARE_R2_*`) เพื่อความยืดหยุ่นในการตั้งค่า

### Vercel Deployment Checklist

เมื่อเชื่อมต่อ GitHub Repository กับ Vercel ให้ตรวจสอบการตั้งค่าดังนี้:

- [x] **Framework Preset**: `Next.js`
- [x] **Root Directory**: `./`
- [x] **Build Command**: `npm run build`
- [x] **Output Directory**: `.next` (ค่าเริ่มต้น)
- [x] **Install Command**: `npm install`
- [x] **Node.js Version**: `20.x` (แนะนำ) หรือ `>= 18.17`
- [x] **Environment Variables**: กรอกตัวแปรทั้งหมดตามตารางด้านบนให้ครบถ้วนใน Environment: `Production`, `Preview`, `Development`
- [x] **Database Migration**: รันคำสั่ง SQL Migration จากไฟล์ `supabase/migrations/20261005_profiles_and_playlists.sql` ใน Supabase SQL Editor
- [x] **Supabase Auth Redirect URL**: เพิ่ม `https://<your-project>.vercel.app/**` ใน Supabase Dashboard > Authentication > URL Configuration

---

## 📱 Mobile Ergonomics & PWA Installation

เว็บเกม "เพลงไรวะ" ได้รับการปรับแต่งเพื่อประสบการณ์การเล่นที่ลื่นไหลบนสมาร์ทโฟนทุกระบบ:

### 1. การติดตั้งแบบเว็บแอป (PWA Installation)
- **Web App Manifest**: รองรับโหมดหน้าต่างเต็มจอไร้แถบ URL (`display: "standalone"`) ผ่าน Next.js Metadata Route `/manifest.webmanifest`
- **iOS Safari**: กดปุ่ม **แชร์ (Share)** ➔ เลือก **"เพิ่มไปยังหน้าจอโฮม (Add to Home Screen)"**
- **Android Chrome**: แตะเมนู **3 จุด (⋮)** ➔ เลือก **"ติดตั้งแอป (Install App)"** หรือ **"เพิ่มลงในหน้าจอหลัก"**

### 2. ฟีเจอร์ความลื่นไหลสำหรับมือถือ (Mobile Game Juice)
- **Safe Area Inset Adaptation**: ป้องกันขอบจอบดบังเนื้อหาสำหรับ iPhone ที่มี Dynamic Island หรือขอบปุ่ม Home (`.pt-safe`, `.pb-safe` อิงตาม `env(safe-area-inset-*)`)
- **iOS Safari Auto-Zoom Prevention**: ช่องกรอกข้อความและ Dropdown ทั้งหมดใช้ `font-size >= 16px` (`text-base` / `text-base sm:text-sm`) หมดปัญหากล้องซูมเข้าอัตโนมัติขณะแตะพิมพ์ชื่อเพลง
- **Eliminate 300ms Tap Delay**: ปุ่มกริ่งแย่งตอบใช้คุณสมบัติ CSS `touch-manipulation` และ `[touch-action:manipulation]` เพื่อการตอบสนองทันที
- **Tactile Haptic Vibration**: ตอบสนองการกดกริ่งด้วยแรงสั่น 45ms (`navigator.vibrate?.([45])`) และอนิเมชันยุบตัว `active:scale-95 duration-75`
- **Generous Touch Targets**: ปุ่มควบคุมหลักทุกปุ่มรองรับขนาดสัมผัสขั้นต่ำ >= 44px (`min-h-[44px]` / `min-w-[44px]`) ตามมาตรฐาน WCAG 2.1 Ergonomics

---

## 🧪 ชุดทดสอบระบบ (Automated Verification Suites)

โปรเจคมีชุดทดสอบครอบคลุมทุกโมดูลรวม 14 ชุดทดสอบ สามารถรันเพื่อตรวจสอบความถูกต้องได้ตลอดเวลา:

```bash
# รันชุดตรวจสอบความพร้อม Phase 6 (Ergonomics, PWA, Tactile Buzzer, Viewport)
npx tsx scripts/test-phase6-readiness.ts

# ตรวจสอบ Type Safety ทั้งหมด
npx tsc --noEmit

# ทดสอบ Production Build
npm run build
```

รายชื่อชุดทดสอบทั้ง 14 ชุดในไดเรกทอรี `scripts/`:
1. `test-phase6-readiness.ts`: Viewport, CSS Safe-Area, PWA Manifest, Haptics, Touch Targets, iOS Font sizes
2. `test-auth-components.ts`: useAuth hook, Context contracts, Modals & NavHeader
3. `test-gameplay-apis.ts`: FCFS Buzzer Locking, Anti-cheat Secret redaction, Penalties & Round progression
4. `test-playlist-gameplay.ts`: Settings payload, SongService joining & Solo play resolution
5. `test-playlist-service.ts`: Playlist CRUD, Sequence preservation, Visibility filtering
6. `test-playlist-ui.ts`: Playlist Editor, 5-song validation thresholds & Duration utilities
7. `test-profiles-migration.ts`: Database Schema, RLS policies & Profile models
8. `test-room-apis.ts`: Room CRUD, Host authorization & State sanitization
9. `test-room-code.ts`: 6-char room code generation, Ambiguity exclusion & Entropy
10. `test-room-gameplay-ui.ts`: Buzzer button, Answer modal, Timer colors & Autocomplete
11. `test-room-lobby.ts`: Lobby view, QR Code generation, Player avatars & Host settings
12. `test-room-page-integration.ts`: Session storage lifecycle, Nickname validation & View resolution
13. `test-room-realtime.ts`: Supabase Realtime broadcast reducer & Sound FX cues
14. `test-room-tv-podium.ts`: TV Spectator mode & 3-Tier Podium winner fanfare

---

## 🔗 Git Repository

- **Repository**: `git@github.com:fuzzfizz/pleng-rai-wa.git`
- **Main Branch**: `main`
