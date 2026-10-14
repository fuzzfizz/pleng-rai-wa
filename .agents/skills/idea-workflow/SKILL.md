---
name: idea-workflow
description: Use when the user mentions, provides, or references 'idea.md' (or idea-workflow), or discusses new feature ideas, brainstorming, or implementing concepts from the idea list.
---

# Idea Workflow (กระบวนการพัฒนาและต่อยอดฟีเจอร์จาก idea.md)

กระบวนการมาตรฐานสำหรับการบริหารจัดการ ออกแบบ และพัฒนาฟีเจอร์ใหม่ ๆ จากไฟล์ `idea.md` ในโปรเจกต์ เพลงไรวะ (Pleng-Rai-Wa)
ผู้ช่วย AI (Agent) **ต้องปฏิบัติตาม 5 ขั้นตอน (Phases) นี้อย่างเคร่งครัดตามลำดับเสมอ**:

```
[Phase 1: ทำความเข้าใจ, วิเคราะห์ความเป็นไปได้ & เสนอทางเลือกที่ดีกว่า] 
       ↓
[Phase 2: วางแผน & ถามผู้ใช้เลือกขอบเขต (แยกส่วนเก็บไว้ทำอนาคต) -> รออนุมัติ] 
       ↓
[Phase 3: พัฒนาด้วย Subagents & รายงานความคืบหน้าทีละ Task] 
       ↓
[Phase 4: ตรวจสอบความถูกต้อง & ยืนยันว่าไม่กระทบส่วนอื่น (Non-Regression)] 
       ↓
[Phase 5: อัปเดต idea.md, ทดสอบ Build 100% & Push ขึ้น GitHub]
```

---

## Phase 1: Deep Understanding, Feasibility & Innovation (ทำความเข้าใจ, หาความเป็นไปได้ & เสนอทางเลือกที่ดีกว่า)

เมื่อได้รับไฟล์ `idea.md` หรือมีไอเดียฟีเจอร์ใหม่เข้ามา:
1. **ทำความเข้าใจไอเดียอย่างลึกซึ้ง:**
   - ศึกษาฟังก์ชัน จุดประสงค์ ประสบการณ์ผู้เล่น (UX) และกลไกของเกมที่ไอเดียต้องการสื่อ
   - ตรวจสอบโค้ดระบบปัจจุบันที่เกี่ยวข้อง (Next.js App Router, Supabase Realtime / Broadcast, Room State Store, Audio Engine, UI Components)
2. **ประเมินความเป็นไปได้ทางเทคนิค (Technical Feasibility):**
   - วิเคราะห์ข้อจำกัดของระบบ เช่น Serverless timeout, Rate limits, Realtime sync, Mobile responsiveness
3. **เสนอแนะทางเลือกที่ดีกว่าเชิงรุก (Proactive Optimization & Better Alternatives):**
   - **หากมีวิธีที่ดีกว่า มีประสิทธิภาพสูงกว่า ปลอดภัยกว่า หรือมอบ UX ที่น่าประทับใจกว่า ให้แจ้งและถามผู้ใช้เสมอ**
   - ระบุข้อดี-ข้อเสีย (Pros & Cons) และความเป็นไปได้ของแต่ละทางเลือกอย่างชัดเจน เพื่อช่วยให้ผู้ใช้ตัดสินใจได้ดีที่สุด

---

## Phase 2: Planning & Scope Alignment (วางแผน & สอบถามขอบเขตการพัฒนา)

1. **ร่างแผนการพัฒนา (Implementation Plan):**
   - แบ่งไอเดียออกเป็นโมดูล/ฟีเจอร์ย่อยที่ชัดเจน
   - กำหนดสถาปัตยกรรม (Database schema, API endpoints, Real-time events, UI Components)
2. **ถามผู้ใช้เรื่องขอบเขตงานรอบนี้ (Scope Decision):**
   - **สอบถามผู้ใช้โดยตรง:**
     - *"ต้องการให้พัฒนาส่วนไหนบ้างในรอบนี้?"*
     - *"มีส่วนใดที่ยังไม่ต้องทำในตอนนี้หรือไม่?"*
   - ส่วนที่ผู้ใช้ยังไม่ต้องการทำในรอบนี้ ให้บันทึกแยกไว้ในหมวด **"เก็บไว้พัฒนาในอนาคต (Backlog / Future Enhancements)"** ใน `idea.md`
3. **รอคำสั่งอนุมัติจากผู้ใช้:**
   - **หยุดรอจนกว่าผู้ใช้จะยืนยันขอบเขตงานและสั่งให้เริ่มลงมือทำ** (ห้ามเขียนโค้ดล่วงหน้าก่อนได้รับอนุมัติ)

---

## Phase 3: Subagent-Driven Execution (พัฒนาด้วย Subagents & รายงานผลทีละ Task)

เมื่อผู้ใช้อนุมัติขอบเขตและสั่งให้ลงมือพัฒนา:
1. **แบ่งงานเป็นชิ้นงานอิสระ (Decoupled Tasks):**
   - แยกตามขอบเขตงาน เช่น Backend/Database, Realtime State/API, Frontend UX/UI, Audio Effects
2. **ส่งมอบงานให้ Subagents ผ่าน `invoke_subagent`:**
   - มอบหมายคำสั่งและบริบทอย่างเจาะจง
   - Subagent รับผิดชอบการเขียนโค้ดและรัน Unit Test สำหรับส่วนที่ตนเองพัฒนา
3. **รายงานผลอย่างต่อเนื่องทีละ Task:**
   - สรุปความคืบหน้าให้ผู้ใช้ทราบเมื่อแต่ละ Task เสร็จสมบูรณ์ จนกว่าจะครบถ้วนตามขอบเขตที่เลือกไว้

---

## Phase 4: Non-Regression & Impact Verification (ตรวจสอบว่าไม่กระทบส่วนอื่น)

ก่อนจะส่งมอบงาน ต้องมีกระบวนการตรวจสอบผลกระทบต่อระบบเดิมอย่างเข้มงวด:
1. **ตรวจสอบความสมบูรณ์และผลกระทบข้ามโมดูล (Cross-Module Impact Check):**
   - ตรวจสอบว่าฟีเจอร์ใหม่ไม่กระทบต่อฟีเจอร์เดิม เช่น:
     - วงจรเกมหลัก (Game loop, Timer, Answer resolution)
     - โหมดแย่งกดปุ่ม (Buzzer) และโหมดท่อนเพลง (Audio Slice)
     - การซิงค์หน้าจอระหว่างมือถือของผู้เล่นและจอรวม (TV View)
     - การเชื่อมต่อ Realtime และสถานะของห้อง
2. **รันการทดสอบครบวงจร (Automated Test Suite):**
   - รัน Unit & Integration Tests ทั้งหมด: `npx vitest run` (ต้องผ่าน 100% ครบทุก test suite)
   - รัน Production Build: `npm run build` (ตรวจสอบ Type Check และ Build ผ่าน 0 errors)
3. **เขียน Test เพิ่มเติมสำหรับฟีเจอร์ใหม่:**
   - มี Test ครอบคลุมฟังก์ชันการทำงานใหม่เสมอ เพื่อป้องกันการพังในอนาคต

---

## Phase 5: Documentation, idea.md Update & Push to GitHub (อัปเดตเอกสาร & Push ขึ้น GitHub)

1. **อัปเดตไฟล์ `idea.md`:**
   - ย้ายไอเดียที่พัฒนาเสร็จเรียบร้อยแล้วไปไว้ที่หมวด `[พัฒนาเสร็จสิ้นแล้ว ✓]` พร้อมระบุวันที่และรายละเอียดสั้นๆ
   - จัดระเบียบไอเดียที่เก็บไว้ทำต่อไว้ที่หมวด `[เก็บไว้พัฒนาในอนาคต / Backlog]`
2. **Git Commit & Push ขึ้น GitHub:**
   - Stage ไฟล์และ commit ด้วย Semantic commit message เช่น:
     `git commit -m "feat(room): <สรุปฟีเจอร์ใหม่ที่เพิ่มเข้ามา>"`
   - Push ขึ้น Remote Repository:
     `git push origin main`
   - แจ้งสรุปผลงาน commit hash และไฟล์ที่เกี่ยวข้องให้ผู้ใช้ทราบ
