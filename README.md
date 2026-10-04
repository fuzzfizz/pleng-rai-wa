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

- [ ] **Phase 1: Foundation**: ติดตั้ง Next.js, Tailwind, shadcn/ui, ฟอนต์ไทย, และเชื่อมต่อ Git
- [ ] **Phase 2: Admin AI Pipeline**: หน้า `/admin` พร้อมระบบดึง YouTube MP3 และ AI Auto-fill Tag
- [ ] **Phase 3: Core Game Engine**: ระบบตัดเสียง Audio Slice, Web Audio Player, SFX และระบบตรวจคำตอบ
- [ ] **Phase 4: Realtime Multiplayer**: ระบบสร้างห้อง, รหัสห้อง, QR Code, Lobby, FCFS Buzzer, Reconnect เมื่อรีเฟรช F5
- [ ] **Phase 5: Member & Playlists**: ระบบโปรไฟล์สมาชิก และการสร้าง Playlist เพลงโปรดส่วนตัว
- [ ] **Phase 6: Testing & Launch**: ปรับแต่ง Responsive มือถือ, ทดสอบเสถียรภาพ และ Deploy บน Vercel

---

## 💻 การติดตั้งและใช้งานสำหรับนักพัฒนา (Getting Started)

### ความต้องการของระบบ (Prerequisites)
- [Node.js](https://nodejs.org/) v18.17 หรือสูงกว่า
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

## 🔗 Git Repository

- **Repository**: `git@github.com:fuzzfizz/pleng-rai-wa.git`
- **Main Branch**: `main`
