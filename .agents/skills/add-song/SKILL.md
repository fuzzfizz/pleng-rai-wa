---
name: add-song
description: Use when importing, adding, or batch-seeding songs, tracks, or discographies into Pleng-Rai-Wa via CLI or Supabase, or verifying audio/lyrics quality.
---

# Add-Song Workflow (กระบวนการนำเข้า ตรวจสอบคุณภาพ และจัดเก็บเพลงสำหรับเพลงไรวะ)

กระบวนการมาตรฐานสำหรับการนำเข้าเพลง (Song Ingestion Pipeline) เข้าสู่ระบบฐานข้อมูล Supabase และ Cloudflare R2 ของเกม **เพลงไรวะ (Pleng-Rai-Wa)**
ทำหน้าที่เป็น **Intelligent Orchestrator & Quality Gatekeeper** ควบคุมคุณภาพของไฟล์เสียง, ความถูกต้องของท่อนฮุก (Hook Timing), ความถูกต้องของเนื้อเพลง (Lyrics Ground Truth), และการเสริมรายการคำพ้อง (Aliases Augmentation) เพื่อประสบการณ์การเล่นเกมทายเพลงที่ราบรื่นและสนุกที่สุด

ผู้ช่วย AI (Agent) **ต้องปฏิบัติตาม 7 ขั้นตอน (Phases) นี้อย่างเคร่งครัดตามลำดับเสมอ**:

```
[Phase 1: ตรวจสอบความซ้ำซ้อน & เลือกโหมด (Pre-Check Duplicates & Workflow Selection)] 
       ↓
[Phase 2: คัดเลือกแหล่งเสียง Audio-First (No-MV Policy & Candidate Scoring)] 
       ↓
[Phase 3: ยืนยันเนื้อเพลงหลายชั้น (Multi-Layer Lyrics Verification)] 
       ↓
[Phase 4: ระเบียบจัดการข้อมูลไม่ครบถ้วน (Interactive Fallback: Human-in-the-Loop)] 
       ↓
[Phase 5: รัน Pipeline นำเข้าเสียงและข้อมูล (CLI Execution & R2/Supabase)] 
       ↓
[Phase 6: ตรวจสอบคุณภาพ & เสริมคำพ้อง (Quality Audit & Alias Augmentation)] 
       ↓
[Phase 7: แสดงการ์ดสรุปผลการนำเข้า (Audit Summary Card)]
```

---

## Phase 1: Pre-Check Duplicates & Workflow Selection (ตรวจสอบความซ้ำซ้อน & เลือกโหมดการทำงาน)

ก่อนเริ่มนำเข้าเพลงเข้าสู่ระบบ ต้องเลือกรูปแบบการทำงานให้เหมาะสมและตรวจสอบว่าเพลงนั้นมีอยู่ในฐานข้อมูลแล้วหรือไม่:

### 1.1 การเลือกโหมดการทำงาน (Hybrid Workflow Protocol)

1. **โหมด A: Single Song / Direct YouTube URL (นำเข้ารายเพลง หรือใช้ URL เจาะจง)**
   - ใช้เมื่อผู้ใช้ระบุชื่อเพลงชัดเจน (เช่น *"เพิ่มเพลง วัดใจ Silly Fools"*) หรือส่งลิงก์ YouTube มาโดยตรง
   - ตรวจสอบความซ้ำซ้อน -> รัน Pipeline ทันที -> ตรวจสอบและเสริม Aliases -> แสดงผลสรุป

2. **โหมด B: Batch Discography / Broad Category (นำเข้าแบบรวมชุด หรือรายชื่อศิลปิน)**
   - ใช้เมื่อผู้ใช้สั่งให้นำเข้าทั้งอัลบั้ม, ผลงานของศิลปิน, หรือหมวดหมู่เพลง (เช่น *"นำเข้า 5 เพลงฮิตของวง Bodyslam"*, *"เพิ่มเพลงฮิตยุค 90s"*):
     - **Step 1:** ค้นหาและสร้างรายชื่อเพลงที่แนะนำ (Proposed Candidate Songs) พร้อมระบุ ปี, อัลบั้ม, และแนวเพลง
     - **Step 2:** ตรวจสอบเทียบกับตาราง `songs` ใน Supabase เพื่อคัดกรองเพลงที่มีอยู่แล้วออก
     - **Step 3:** **หยุดนำเสนอรายชื่อเพลงให้ผู้ใช้ยืนยันก่อนเริ่มดาวน์โหลดจริง** (ห้ามรันแบตช์โดยที่ผู้ใช้ยังไม่อนุมัติรายชื่อ)
     - **Step 4:** ดำเนินการนำเข้าเพลงตามลำดับทีละเพลง พร้อมเว้นช่วงหน่วงเวลาเพื่อป้องกัน Rate Limit
     - **Step 5:** แสดงรายงานสรุปภาพรวมทั้งหมด (Batch Audit Report)

### 1.2 ตรวจสอบความซ้ำซ้อนใน Supabase (Duplicate Pre-Check)

ก่อนจะเริ่มดาวน์โหลดหรือสร้างเรคคอร์ดใหม่ ให้ตรวจสอบว่ามีเพลงชื่อเดียวกันหรือศิลปินเดียวกันอยู่ในตาราง `songs` แล้วหรือไม่:

```sql
SELECT id, title, artist, audio_url, release_year 
FROM songs 
WHERE title ILIKE '%<ชื่อเพลง>%' 
   OR artist ILIKE '%<ชื่อศิลปิน>%'
LIMIT 5;
```

> [!WARNING]
> หากพบเพลงซ้ำในระบบ ให้แจ้งผู้ใช้ทันทีพร้อมแสดงข้อมูลเดิม (`id`, `title`, `artist`, `audio_url`) และถามผู้ใช้ว่าต้องการ:
> 1. อัปเดต/เขียนทับข้อมูลเดิม (Update existing record)
> 2. ข้ามเพลงนี้ (Skip)
> 3. นำเข้าเป็นเวอร์ชันใหม่ (เช่น เวอร์ชัน Acoustic หรือ Cover พิเศษ)

---

## Phase 2: Audio-First (No-MV) Policy & YouTube Resolution (นโยบายคัดเลือกไฟล์เสียง ห้ามใช้ MV ละคร)

เกมเพลงไรวะอาศัย **การตัดท่อนเพลงอัตโนมัติ (Audio Slicing: 1s, 2s, 5s, Full)** และ **ท่อนฮุก (Hook Guessing)** ดังนั้นไฟล์เสียงต้องมีความยาวและโครงสร้างเพลงที่เที่ยงตรง:

### 2.1 กฎเหล็ก Audio-First (Strict No-MV Policy)

> [!IMPORTANT]
> **ห้ามดาวน์โหลด Music Video ที่มีละครสั้น (Short Film / Skit) หรือบทพูดยาวๆ ก่อนเข้าเพลงเด็ดขาด!**
> การมีบทพูด 1-3 นาทีก่อนเข้าเพลง จะทำให้ Timestamp ท่อนฮุก (`hook_start_sec`, `hook_end_sec`) คลาดเคลื่อนทั้งหมด ส่งผลให้ผู้เล่นในห้องได้ยินเสียงเงียบหรือเสียงคุยแทนเสียงเพลงจริง

### 2.2 ลำดับความสำคัญในการเลือกวิดีโอ YouTube (Source Priority Hierarchy)

เมื่อระบบค้นหาคลิปเสียงจาก YouTube ต้องยึดลำดับความสำคัญตามคะแนน (Candidate Scoring) ดังนี้:

1. **ระดับดีที่สุด (Score +100): YouTube Music Topic Track (`- Topic`)**
   - เช่น แชนแนล `Silly Fools - Topic`, `Bodyslam - Topic`
   - เป็นไฟล์ Studio Master แท้จากค่ายเพลง ไม่มีเสียงรบกวน ไม่มีบทพูด เริ่มเพลงทันที 0:00
2. **ระดับดีมาก (Score +50): Official Audio**
   - เช่น `Silly Fools - วัดใจ (Official Audio)`
   - มาสเตอร์แท้ เริ่มเพลงตรงจังหวะ
3. **ระดับดี (Score +40): Official Lyric Video**
   - เช่น `วัดใจ - Silly Fools [Official Lyric Video]`
   - มีเสียงเพลงเต็ม ไม่มีฉากละครคั่น
4. **ระดับต้องระวัง (Score -100 & Blacklist): Official Music Video (MV)**
   - อนุญาตเฉพาะกรณีที่ไม่มี Audio / Topic อื่นใดเลย และเพลงเริ่มเล่นทันทีภายใน 5 วินาทีแรกเท่านั้น
   - **Blacklist คำต้องห้าม:** `หนังสั้น`, `Short Film`, `Official MV`, `Live`, `Concert`, `Cover`, `Karaoke`, `คาราโอเกะ`, `Teaser`, `Reaction`, `รวมเพลง`, `Longplay`, `Full Album`

### 2.3 การจำกัดความยาวเพลง (Duration Boundaries)

- เพลงมาตรฐานต้องมีความยาวอยู่ในช่วง **90 วินาที ถึง 480 วินาที (1.5 - 8 นาที)**
- หากคลิปยาวเกิน 480 วินาที (เสี่ยงเป็นคลิปรวมเพลง) หรือสั้นกว่า 90 วินาที ให้ตัดทิ้งทันที

---

## Phase 3: Multi-Layer Lyrics Verification (การตรวจสอบเนื้อเพลงหลายชั้น ป้องกันสปอยล์)

โหมดเกม **AI Lyrics (อ่านเนื้อเพลงด้วยเสียงแปลกๆ)** และ **Translated Karaoke (คาราโอเกะแปลไทย-อังกฤษ)** จำเป็นต้องใช้เนื้อเพลงเต็มที่ถูกต้องและปลอดการสปอยล์:

### 3.1 ลำดับชั้นการค้นหาเนื้อเพลง (Verification Layers)

1. **Layer 1: LRCLIB Open Database & Curated Base**
   - เรียกตรวจสอบจากฐานข้อมูลเปิด LRCLIB (`https://lrclib.net/api/search`) หรือ `KNOWN_THAI_SONGS`
   - หากพบจะได้เนื้อเพลงแท้ระดับ Verbatim Ground Truth พร้อม Time-synced lyrics
2. **Layer 2: Google Search Grounding with Gemini**
   - ใช้ Gemini API ร่วมกับโมเดลการค้นหาเว็บ (Search Grounding) เพื่อดึงเนื้อร้องภาษาไทยที่ถูกต้องตรงตามต้นฉบับ
3. **Layer 3: Lyrics Sanitization (`cleanLyricsForGame`)**
   - ทำความสะอาดเนื้อเพลงผ่านฟังก์ชัน `cleanLyricsForGame` ใน `src/lib/lyrics-cleaner.ts` เสมอ
   - **ตัดหัวข้อเครดิตออกทั้งหมด:** เช่น `เพลง:`, `ศิลปิน:`, `คำร้อง/ทำนอง:`, `อัลบั้ม:`, `Produced by`, `Written by`
   - **เหตุผล:** ป้องกันไม่ให้ AI อ่านชื่อเพลงหรือชื่อศิลปินเฉลยผู้เล่นระหว่างรอบเกม

---

## Phase 4: Interactive Missing Asset Fallback (ระเบียบการรับมือเมื่อข้อมูลไม่ครบถ้วน)

หากการทำงานอัตโนมัติติดขัดหรือไม่มั่นใจในความถูกต้อง **ห้ามสุ่มเดาหรือบันทึกข้อมูลมั่วเด็ดขาด** ให้หยุดและเข้าสู่ Human-in-the-Loop Protocol:

```
+-------------------------------------------------------------------------+
|                  INTERACTIVE FALLBACK PROTOCOL                         |
+-------------------------------------------------------------------------+
|  1. Audio Candidate ไม่ชัดเจน / มีแต่ MV ละครสั้น                       |
|     -> หยุดทันที! แจ้งเตือนผู้ใช้และขอ YouTube URL ตรง (--youtube-url)   |
|                                                                         |
|  2. ไม่พบเนื้อเพลงเต็ม (lyricsConfidence = 'not_found')                  |
|     -> หยุดและถามผู้ใช้:                                                 |
|        [A] ให้ผู้ใช้วางเนื้อเพลงเอง (--lyrics "<text>")                   |
|        [B] บันทึกเฉพาะเสียง (ปิดโหมดเนื้อเพลงสำหรับเพลงนี้)               |
|        [C] ยกเลิกการนำเข้าเพลงนี้                                        |
|                                                                         |
|  3. ท่อนฮุก (Hook Timing) สุ่มเสี่ยงผิดพลาด                              |
|     -> ให้เสนอช่วงวินาทีที่ AI วิเคราะห์ และเปิดให้ระบุ                   |
|        --hook-start <sec> และ --hook-end <sec>                          |
+-------------------------------------------------------------------------+
```

---

## Phase 5: CLI Execution & Pipeline Processing (การรันคำสั่งนำเข้าเพลงจริง)

ระบบนำเข้าเพลงมีสคริปต์มาตรฐานอยู่ที่ `scripts/import-song.mjs` ซึ่งรองรับการรันผ่าน Node.js พร้อมอ่านค่าคอนฟิกจาก `.env.local`:

### 5.1 ไวยากรณ์คำสั่ง CLI

```bash
# นำเข้าด้วยชื่อเพลง (ระบบจะค้นหา Metadata, YouTube Topic และเนื้อเพลงให้อัตโนมัติ)
node --env-file=.env.local scripts/import-song.mjs "<ชื่อเพลง และ ศิลปิน>"

# นำเข้าด้วย YouTube URL ตรง (กรณีมีลิงก์เสียงที่ต้องการโดยเฉพาะ)
node --env-file=.env.local scripts/import-song.mjs "https://www.youtube.com/watch?v=XXXXXXXXXXX"

# นำเข้าพร้อมระบุ Overrides ครบถ้วน (URL ตรง, ท่อนฮุก, และเนื้อเพลงที่เตรียมไว้)
node --env-file=.env.local scripts/import-song.mjs "<ชื่อเพลง>" \
  --youtube-url "https://youtu.be/XXXXXXXXXXX" \
  --hook-start 65 \
  --hook-end 95 \
  --lyrics "เนื้อเพลงเต็มบรรทัดที่ 1\nเนื้อเพลงเต็มบรรทัดที่ 2..."
```

### 5.2 ตัวเลือกคำสั่ง (CLI Flags)

| Flag | คำอธิบาย | ตัวอย่าง |
|---|---|---|
| `--youtube-url <url>` | บังคับใช้ลิงก์ YouTube ที่ระบุโดยตรงแทนการค้นหา | `--youtube-url "https://youtu.be/..."` |
| `--lyrics <text>` | บังคับใช้เนื้อเพลงเต็มที่ระบุ (ข้ามการค้นหา LRCLIB/Google) | `--lyrics "ท่อนแรก..."` |
| `--lyrics-intro <text>` | บังคับใช้เนื้อเพลงท่อนเปิด/อินโทร (หรือ `--intro`) | `--lyrics-intro "ท่อนเปิด..."` |
| `--album <name>` | กำหนดชื่ออัลบั้ม (Studio Album / EP) | `--album "Save My Life"` |
| `--hook-start <sec>` | ระบุจุดเริ่มต้นของท่อนฮุกเป็นวินาที | `--hook-start 70` |
| `--hook-end <sec>` | ระบุจุดสิ้นสุดของท่อนฮุกเป็นวินาที | `--hook-end 98` |
| `-h, --help` | แสดงคำแนะนำและตัวอย่างการใช้งาน | `-h` |

### 5.3 กระบวนการที่เกิดขึ้นภายใน Script (Execution Flow)
1. สกัดข้อมูล Metadata ด้วย Gemini (`title`, `artist`, `releaseYear`, `genreSlug`, `era`, `hookStartSec`, `hookEndSec`, `lyricsIntro`)
2. จัดการท่อนอินโทร (`lyrics_intro`) ตามลำดับความสำคัญ: ตัวเลือก `--lyrics-intro` -> `metadata.lyricsIntro` -> ตัด 2-4 บรรทัดแรกจาก `lyrics_full` อัตโนมัติ (Auto-extract Intro Fallback)
3. ดาวน์โหลดเสียงจาก YouTube ด้วย `yt-dlp` และแปลงเป็น MP3 128kbps ผ่าน `ffmpeg`
4. อัปโหลดไฟล์ MP3 ขึ้น Cloudflare R2 ที่ path `songs/<uuid>/full.mp3`
5. บันทึกข้อมูลทั้งหมดลงในตาราง `songs` บน Supabase พร้อมสถานะ `lyricsConfidence`

---

## Phase 6: Post-Import Quality Audit & Alias Augmentation (การตรวจสอบคุณภาพและเสริมคำพ้อง)

เมื่อสคริปต์รันเสร็จสมบูรณ์ Agent ต้องตรวจสอบความสมบูรณ์ในฐานข้อมูลและเสริมคำพ้อง (Aliases) เพื่อให้ผู้เล่นพิมพ์ตอบได้ง่าย:

### 6.1 ตรวจสอบความถูกต้องของ Record ใน Supabase

ตรวจสอบฟิลด์สำคัญในตาราง `songs`:
- `id`: เป็น UUID ที่ถูกต้อง
- `audio_url`: ลิงก์ Cloudflare R2 เข้าถึงได้และเล่นได้จริง
- `lyrics_full`: มีเนื้อเพลงที่ตัดเครดิตแล้ว (Cleaned) หรือระบุสถานะชัดเจน
- `hook_start_sec` และ `hook_end_sec`: ความยาวท่อนฮุกอยู่ระหว่าง 15-35 วินาที และไม่เกินความยาวเพลงรวม (`duration_sec`)

### 6.2 กฎการเสริมคำพ้อง (Alias Augmentation Rules)

ระบบตรวจคำตอบใน `src/lib/answer-checker.ts` ทำการ Normalized ภาษาไทยและตัดวรรณยุกต์ออก แต่เพื่อให้ผู้เล่นได้รับประสบการณ์ที่ดีที่สุด **Agent ต้องเสริมคำพ้องลงในฟิลด์ `aliases` ให้ครอบคลุม 4 กลุ่มเสมอ**:

1. **คำสะกดคาราโอเกะ / ถอดเสียงอักษรละติน (Romanized / Karaoke Phonics):**
   - เช่น `wat jai`, `watjai`, `khor jai thoe laek boe tho`, `pae tang`
2. **คำสะกดผิดยอดนิยม / ภาษาวิบัติ / ไม่ใส่วรรณยุกต์ (Common Typos & Slang):**
   - เช่น `วัดจัย`, `ขอใจแลกเบอร์โทร` (ตัดคำว่าเธอ), `แพ้ทางง`
3. **ท่อนฮุกติดหู / วลียอดฮิตที่คนมักจำสับสนกับชื่อเพลง (Catchphrases / Hook Lyrics):**
   - เช่น เพลง *ขอใจเธอแลกเบอร์โทร* -> ใส่ `ท่านกำลังเข้าสู่บริการรับฝากหัวใจ`, `บริการรับฝากหัวใจ`
   - เช่น เพลง *วัดใจ* -> ใส่ `มีแค่ใจดวงเดียวดวงนี้`
4. **ชื่อศิลปินคู่กับชื่อเพลง (Artist + Title Variations):**
   - เช่น `silly fools วัดใจ`, `วัดใจ silly fools`, `หญิงลี ขอใจเธอแลกเบอร์โทร`

> [!TIP]
> หากต้องการอัปเดตคำพ้องเพิ่มเติมหลังจากรันสคริปต์เสร็จแล้ว สามารถสั่งอัปเดตตรงเข้า Supabase:
> ```sql
> UPDATE songs 
> SET aliases = ARRAY['วัดใจ', 'wat jai', 'watjai', 'วัดจัย', 'มีแค่ใจดวงเดียวดวงนี้', 'silly fools วัดใจ']
> WHERE id = '<song-uuid>';
> ```

---

## Phase 7: Audit Summary Card (การสรุปผลการนำเข้าเพลงแบบมาตรฐาน)

เมื่อการนำเข้าและตรวจสอบเสร็จสิ้น ให้แสดงรายงานสรุปผลในรูปแบบ **Audit Summary Card** ดังนี้:

```markdown
### 🎵 รายงานสรุปการนำเข้าเพลง (Song Import Audit Card)

| ข้อมูล (Field) | รายละเอียด (Value) |
|---|---|
| **ชื่อเพลง (Title)** | วัดใจ |
| **ศิลปิน (Artist)** | Silly Fools |
| **ปีที่ปล่อย / ยุค** | 2004 / ยุค 2000s |
| **หมวดหมู่ (Genre)** | Rock (`rock`) |
| **Song ID** | `a1b2c3d4-e5f6-7890-abcd-ef1234567890` |
| **Audio Source** | YouTube Music Topic (`Silly Fools - Topic`) |
| **ความยาวเพลง (Duration)** | 258 วินาที (4:18 นาที) |
| **ท่อนฮุก (Hook Slice)** | วินาทีที่ 68 - 98 (ความยาว 30 วินาที) |
| **ความถูกต้องของเนื้อเพลง** | `verified` (LRCLIB Ground Truth, 1,240 ตัวอักษร) |
| **URL ไฟล์เสียง (R2)** | `https://r2.pleng-rai-wa.com/songs/.../full.mp3` |

#### 🏷️ รายการคำพ้องสำหรับเล่นเกม (Configured Aliases):
- `วัดใจ` (ชื่อหลัก)
- `wat jai`, `watjai` (คาราโอเกะ)
- `วัดจัย` (คำสะกดผิดที่พบบ่อย)
- `มีแค่ใจดวงเดียวดวงนี้` (ท่อนฮุกที่คนจำสับสนกับชื่อเพลง)
- `silly fools วัดใจ` (ชื่อศิลปิน + ชื่อเพลง)

#### 🎙️ พรีวิวท่อนฮุก (Chorus Preview):
> *"มีแค่ใจดวงเดียวดวงนี้ จะยินดีให้เธอทรมาน...\n...จะวัดใจ ให้รู้ไป"*
```

---

## สรุปข้อพึงระวังและข้อห้ามเด็ดขาด (Summary of Invariant Rules)

1. **ห้ามใช้ MV ที่มีบทละคร/อินโทรยาวเกิน 5 วินาที** เป็นอันขาด หากไม่มี Topic หรือ Official Audio ให้ขอลิงก์ตรงจากผู้ใช้ทันที
2. **ห้ามข้ามขั้นตอนการทำความสะอาดเนื้อเพลง** ต้องผ่าน `cleanLyricsForGame` เพื่อไม่ให้มีชื่อเพลง/ศิลปินหลุดไปในโหมด AI Reader
3. **ห้ามรันการนำเข้าแบบ Batch โดยไม่ผ่านการยืนยันรายชื่อจากผู้ใช้** เพื่อป้องกันการเสีย Quota AI และพื้นที่จัดเก็บ R2 โดยไม่จำเป็น
4. **ต้องเพิ่มคำพ้องคาราโอเกะและท่อนจำเสมอ** ทุกเพลงที่นำเข้าต้องมี Aliases อย่างน้อย 3-5 รายการที่ครอบคลุมรูปแบบการพิมพ์ของผู้เล่น
