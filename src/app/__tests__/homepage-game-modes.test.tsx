import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

describe("Homepage 4 Game Modes Grid & Copy (Clean, Professional, Non-Cringe)", () => {
  const pageSource = fs.readFileSync(
    path.resolve(process.cwd(), "src/app/page.tsx"),
    "utf-8"
  );
  const gameViewSource = fs.readFileSync(
    path.resolve(process.cwd(), "src/components/room/game-view.tsx"),
    "utf-8"
  );
  const tvViewSource = fs.readFileSync(
    path.resolve(process.cwd(), "src/components/room/tv-view.tsx"),
    "utf-8"
  );

  describe("Task 1: Hero Subtitle & 4 Game Modes in Homepage", () => {
    it("updates hero subtitle to include translated lyrics and remove robotic slang", () => {
      expect(pageSource).toContain(
        "ทายเสี้ยววินาที แย่งกดกริ่ง ฟัง AI อ่านเนื้อเพลง หรืออ่านเนื้อเพลงแปลอังกฤษ เล่นสนุกได้ทั้งบนมือถือและคอมพิวเตอร์"
      );
      // Ensure old subtitle is gone
      expect(pageSource).not.toContain(
        "ทายเสี้ยววินาที แย่งกดกริ่ง หรือฟังเสียง AI อ่านเนื้อเพลงแบบไร้อารมณ์ เล่นชิวๆ บนมือถือและคอมพิวเตอร์"
      );
    });

    it("imports Languages icon from lucide-react", () => {
      expect(pageSource).toMatch(/import\s*\{[^}]*Languages[^}]*\}\s*from\s*["']lucide-react["']/);
    });

    it("uses 4-column responsive grid layout on large screens", () => {
      expect(pageSource).toContain(
        "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4"
      );
    });

    it("displays Mode 1: Audio Slice with updated professional copy", () => {
      expect(pageSource).toContain("โหมดตัดท่อนสั้น (Audio Slice)");
      expect(pageSource).toContain(
        "ฟังตัวอย่างเสียงเพลงสั้น 1 ถึง 5 วินาที แล้วทายชื่อเพลงให้ถูกต้อง เหมาะสำหรับการทดสอบความจำและความคุ้นเคยในบทเพลง"
      );
    });

    it("displays Mode 2: Buzzer Battle with updated professional copy", () => {
      expect(pageSource).toContain("โหมดกดกริ่งแย่งตอบ (Buzzer Battle)");
      expect(pageSource).toContain(
        "เพลงจะเล่นต่อเนื่องไปเรื่อยๆ ผู้เล่นสามารถกดกริ่งเพื่อหยุดเพลงและชิงสิทธิ์ตอบก่อน แข่งขันกันด้วยความรวดเร็วและความแม่นยำ"
      );
    });

    it("displays Mode 3: AI Lyrics with updated professional copy", () => {
      expect(pageSource).toContain("โหมด AI อ่านเนื้อเพลง (AI Lyrics)");
      expect(pageSource).toContain(
        "ฟังเสียงสังเคราะห์ของ AI อ่านท่อนฮุกหรือท่อนเปิดโดยไม่มีทำนอง แล้วทายชื่อเพลงจากข้อความเนื้อร้องที่ได้ยิน"
      );
    });

    it("displays Mode 4: Translated Lyrics with English literal translation copy", () => {
      expect(pageSource).toContain("โหมดแปลเนื้อเพลง (Translated Lyrics)");
      expect(pageSource).toContain(
        "อ่านเนื้อเพลงไทยที่ถูกแปลเป็นภาษาอังกฤษแบบตรงตัว แล้ววิเคราะห์หาว่ามาจากเพลงต้นฉบับเพลงใด"
      );
    });

    it("removes cringe marketing slang from all game mode cards", () => {
      expect(pageSource).not.toContain("ท้าทายหูทิพย์ขั้นสุด");
      expect(pageSource).not.toContain("ชวนขำและจำยากมาก");
      expect(pageSource).not.toContain("เพลงจะเล่นไปเรื่อยๆ ใครมั่นใจให้กดกริ่งหยุดเพลงทันที คนกดเร็วสุดได้สิทธิ์ตอบก่อน!");
      expect(pageSource).not.toContain("โหมด AI อ่านเนื้อเพลง ⭐");
    });
  });

  describe("Task 2: Teleprompter Integration for Translated Lyrics in GameView & TvView", () => {
    it("integrates TranslatedLyricsTeleprompter in game-view.tsx", () => {
      expect(gameViewSource).toContain("TranslatedLyricsTeleprompter");
      expect(gameViewSource).toContain("<TranslatedLyricsTeleprompter");
      expect(gameViewSource).toContain('lyrics={activeQuestion?.lyrics || ""}');
      expect(gameViewSource).toContain("roundKey={currentRound}");
    });

    it("integrates TranslatedLyricsTeleprompter in tv-view.tsx with isTvMode={true}", () => {
      expect(tvViewSource).toContain("TranslatedLyricsTeleprompter");
      expect(tvViewSource).toContain("<TranslatedLyricsTeleprompter");
      expect(tvViewSource).toContain("lyrics={activeQuestion.lyrics}");
      expect(tvViewSource).toContain("isTvMode={true}");
    });
  });
});
