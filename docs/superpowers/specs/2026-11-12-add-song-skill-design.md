# Design Document: Systematic Song Addition Skill (`add-song`)

- **Date**: 2026-11-12
- **Topic**: Systematic Song Addition Pipeline & Agent Skill for Pleng-Rai-Wa
- **Status**: Draft / Awaiting Review

---

## 1. Executive Summary & Goals

ระบบเกมทายเพลง **เพลงไรวะ (Pleng-Rai-Wa)** พึ่งพาคุณภาพของข้อมูลเพลงสูงมากในการเล่นจริง:
1. **Audio Slicing & Playback**: ต้องการไฟล์เสียง Studio Master ที่สะอาด ไม่มีเสียงละครเกริ่นนำ และท่อนฮุกเริ่มต้นตรงจังหวะ
2. **Lyrics Challenge & TTS Reader**: ต้องการเนื้อเพลงจริงที่ไม่มโน และผ่านการฟอกคอร์ด/เครดิตออก
3. **Guessing & Autocomplete Engine**: ต้องการ `aliases` ที่ครอบคลุมทั้งชื่อไทย คาราโอเกะ และคำสะกดผิดยอดฮิต

เอกสารนี้กำหนดสถาปัตยกรรมและการทำงานของ **Skill `add-song`** ซึ่งเป็น Orchestrator ควบคุม Pipeline เดิมของโปรเจกต์ (`src/lib/ai-extractor.ts`, `src/lib/audio-downloader.ts`, `src/lib/r2.ts`, `src/lib/services/song-service.ts`, และ `scripts/import-song.mjs`) เพื่อให้การเพิ่มเพลงใหม่ทุกครั้งมีมาตรฐาน คุณภาพ และความเสถียรสูงสุดตาม **แนวทางที่ 1 (Hybrid Mode)**

---

## 2. Core Principles & Policies

### 2.1 Audio-First (No MV) Policy
- **ปัญหา**: คลิป YouTube ที่เป็น Official MV ของไทยมักมีบทละครสั้น (Intro Skit) 1–3 นาทีก่อนเริ่มเพลง หรือมี SFX แทรก ทำให้เวลาท่อนฮุก (`hook_start_sec`) คลาดเคลื่อนและตัดเสียงเกมไม่ตรง
- **กฎ**:
  1. หากเป็นคำค้นหา (ไม่ใช่ URL ที่ผู้ใช้เจาะจง) ให้ค้นหา 5 คลิปแรก (`ytsearch5`) แล้วคัดกรองด้วยระบบ Scoring:
     - **คัดทิ้ง / ติดลบหนัก**: คลิปที่มีคำว่า `"Official MV"`, `"MV"`, `"Music Video"`, `"หนังสั้น"`, `"Short Film"`, `"Live"`, `"Concert"`, `"Cover"`, `"คาราโอเกะ"`, `"Teaser"`, `"Reaction"` หรือคลิปยาวเกิน 8 นาที / สั้นกว่า 1.5 นาที
     - **คะแนนสูงสุด (+100)**: คลิปจากช่อง `- Topic` (YouTube Music Official Studio Track ที่ค่ายเพลงอัปโหลด)
     - **คะแนนสูง (+50)**: คลิปที่มีคำว่า `Official Audio`, `Lyric Video`, `Audio`, `เนื้อเพลง`
  2. หากมีเฉพาะ MV ที่มีละคร หรือไม่มีคลิป Audio ที่มั่นใจได้ ให้ทริกเกอร์ **Human Fallback Protocol** (ข้อ 2.3)

### 2.2 Multi-Layer Lyrics Verification Policy
- **ชั้นที่ 1 (Ground Truth First)**: ค้นหาใน LRCLIB (`plainLyrics` / `syncedLyrics`) และ Curated Knowledge Base (`KNOWN_THAI_SONGS`) หากพบจะล็อกเป็นเนื้อเพลงแท้ 100%
- **ชั้นที่ 2 (Google Search Grounding)**: หากไม่มีใน LRCLIB ให้ Gemini ค้นหาผ่าน Google Search โดยมี Prompt บังคับห้ามมโนคำ (Anti-Hallucination) หากไม่แน่ใจให้คืน `lyricsConfidence: "not_found"`
- **ชั้นที่ 3 (Sanitization)**: ผ่านฟังก์ชัน `cleanLyricsForGame()` เพื่อลบ Header เครดิต คอร์ดกีตาร์ และแท็กวงเล็บ
- **ชั้นที่ 4 (Database Sync)**: บันทึกทั้ง `lyrics_intro`, `lyrics_chorus` และ `lyrics_full` (ระดับ Top-level column ในตาราง `songs`)

### 2.3 Interactive Missing Asset Fallback Protocol (Human-in-the-Loop)
หากการทำงานอัตโนมัติติดขัดในส่วนสำคัญ AI จะหยุดถามผู้ใช้แทนที่จะเดาเอง:
1. **ไม่พบคลิปเสียง Audio หรือเจอแต่ MV ละคร**:
   - AI แจ้งเตือนและขอให้ผู้ใช้ส่ง URL YouTube คลิปที่ต้องการใช้โดยตรง
2. **ไม่พบเนื้อเพลงที่ยืนยัน (`lyricsConfidence: "not_found"`)**:
   - AI ถามผู้ใช้ว่าต้องการแปะเนื้อเพลง (หรือท่อนฮุก) ให้หรือไม่ หรือต้องการให้ข้ามการบันทึกเนื้อเพลงไปก่อน

---

## 3. Workflow Architecture (Hybrid Approach)

```
                       [คำขอจากผู้ใช้]
                              │
               ┌──────────────┴──────────────┐
       [เพลงเดี่ยว / URL]               [Batch / กว้างๆ]
               │                              │
    (ตรวจเพลงซ้ำใน Supabase)          (ดึงรายชื่อเพลงเสนอผู้ใช้)
               │                              │
               │                      [ผู้ใช้ยืนยันรายชื่อ]
               │                              │
               └──────────────┬───────────────┘
                              ▼
           [Step 1: สกัด Metadata & ค้นหาเนื้อเพลง]
                              │
                    ┌─────────┴─────────┐
             [พบเนื้อเพลง]         [ไม่พบเนื้อเพลง]
                    │                   │
                    │             (ถามผู้ใช้ขอเนื้อเพลง)
                    │                   │
                    └─────────┬─────────┘
                              ▼
             [Step 2: ค้นหาเสียง YouTube Audio-First]
                              │
                    ┌─────────┴─────────┐
             [พบ Topic/Audio]      [พบแต่ Drama MV]
                    │                   │
                    │             (ถามผู้ใช้ขอ URL)
                    │                   │
                    └─────────┬─────────┘
                              ▼
            [Step 3: ดาวน์โหลด MP3 128kbps via yt-dlp]
                              │
            [Step 4: อัปโหลด Cloudflare R2 (songs/{id}/full.mp3)]
                              │
            [Step 5: บันทึกลง Supabase (songs, genres, lyrics_full)]
                              │
            [Step 6: เสริม Aliases ภาษาไทย/คาราโอเกะ]
                              │
            [Step 7: แสดง Audit Summary Card สรุปผล]
```

---

## 4. Technical Implementation & Modifications

### 4.1 Audio Downloader Enhancement (`src/lib/audio-downloader.ts`)
- เพิ่มฟังก์ชัน `searchSmartAudioCandidate(query: string)`:
  - เรียก `yt-dlp --flat-playlist -J "ytsearch5:${query}"`
  - วิเคราะห์ candidates ตามกฎ Audio-First (No MV)
  - ส่งคืน best video ID หรือ URL ที่เป็น Studio Master ที่สุด
- ปรับปรุง `downloadAndProcessYoutube(youtubeUrlOrQuery, options)`:
  - ถ้าระบุเป็น URL ให้โหลดตรงทันที
  - ถ้าระบุเป็น Query ให้ค้นหาผ่าน `searchSmartAudioCandidate` ก่อนเริ่มดาวน์โหลด

### 4.2 CLI Script Upgrade (`scripts/import-song.mjs`)
- รองรับ CLI Options / Flags:
  - `node --env-file=.env.local scripts/import-song.mjs "<query>"`
  - `--youtube-url <url>` (บังคับใช้ YouTube URL เฉพาะเจาะจง)
  - `--lyrics <text>` (ป้อนเนื้อเพลงแบบกำหนดเอง)
  - `--hook-start <sec>` / `--hook-end <sec>` (กำหนดท่อนฮุกเฉพาะ)
- แก้ไขการบันทึกฐานข้อมูล Supabase ให้ใส่ `lyrics_full: metadata.lyricsFull || null` ในระดับ row เสมอ

### 4.3 Skill Definition (`.agents/skills/add-song/SKILL.md`)
- สร้าง Skill ตามมาตรฐาน **Agent Skills Specification**:
  - Name: `add-song`
  - Trigger Description: *"Use when adding, importing, or updating songs in Pleng-Rai-Wa database, whether single song, YouTube URL, or batch discographies."*
  - ชี้แจง SOP ทีละขั้นตอนอย่างเคร่งครัด
  - กำหนดเกณฑ์คุณภาพ (Quality Checklist) ก่อนจบงาน

---

## 5. Verification & Testing Plan
1. **Unit Test / Direct Invocation Test**:
   - ทดสอบค้นหาเพลงที่มี MV ดราม่ายาว (เช่น เพลงของ GMM/RS) ยืนยันว่าระบบคัดเลือก Topic Track / Audio แทน MV
2. **Duplicate Detection Test**:
   - ทดสอบรันเพลงที่มีอยู่ในฐานข้อมูลแล้ว ยืนยันว่าแจ้งเตือนและไม่สร้างขยะใน R2
3. **Database & Storage Audit**:
   - ตรวจสอบว่า `audio_url` บน Cloudflare R2 เข้าถึงได้
   - ตรวจสอบว่า `lyrics_full` ถูกบันทึกลงในคอลัมน์ของ Supabase ครบถ้วน
