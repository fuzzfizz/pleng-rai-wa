import { describe, it, expect } from "vitest";
import { cleanLyricsForGame, extractIntroLyrics } from "@/lib/lyrics-cleaner";

describe("cleanLyricsForGame utility", () => {
  it("handles null, undefined, or empty string gracefully", () => {
    expect(cleanLyricsForGame(null)).toBe("");
    expect(cleanLyricsForGame(undefined)).toBe("");
    expect(cleanLyricsForGame("")).toBe("");
    expect(cleanLyricsForGame("   \n\n  ")).toBe("");
  });

  it("strips Thai song title and artist header lines (both with and without space before colon)", () => {
    const rawLyrics = `
เพลง: วัดใจ
ศิลปิน: Silly Fools
คำร้อง/ทำนอง: Silly Fools
เรียบเรียง: Silly Fools

แม้ทั้งชีวิตพังทลาย
แต่ว่าใจดวงนี้ไม่เคยสลาย
มีแค่ใจดวงเดียวดวงนี้
`;

    const cleaned = cleanLyricsForGame(rawLyrics);
    expect(cleaned).not.toContain("เพลง:");
    expect(cleaned).not.toContain("ศิลปิน:");
    expect(cleaned).not.toContain("คำร้อง/ทำนอง:");
    expect(cleaned).not.toContain("เรียบเรียง:");
    expect(cleaned).not.toContain("Silly Fools");
    expect(cleaned).toContain("แม้ทั้งชีวิตพังทลาย");
    expect(cleaned).toContain("แต่ว่าใจดวงนี้ไม่เคยสลาย");
    expect(cleaned).toContain("มีแค่ใจดวงเดียวดวงนี้");
  });

  it("strips lines with spaced colons, full-width colons, or dashes", () => {
    const raw = `
เพลง : ซ่อนกลิ่น
ศิลปิน ： Palmy
อัลบั้ม - Sun
คำร้อง : วีรณัฐ ทิพยมณฑล
ทำนอง : Palmy

ลืมตาตื่นมาพร้อมหยาดน้ำตา
คงไว้ได้แค่กลิ่นที่ไม่เคยเลือนลา
`;

    const cleaned = cleanLyricsForGame(raw);
    expect(cleaned).not.toContain("ซ่อนกลิ่น");
    expect(cleaned).not.toContain("Palmy");
    expect(cleaned).not.toContain("อัลบั้ม");
    expect(cleaned).not.toContain("คำร้อง");
    expect(cleaned).not.toContain("ทำนอง");
    expect(cleaned).toContain("ลืมตาตื่นมาพร้อมหยาดน้ำตา");
    expect(cleaned).toContain("คงไว้ได้แค่กลิ่นที่ไม่เคยเลือนลา");
  });

  it("strips English headers (Song, Artist, Album, Producer, Arranged by)", () => {
    const raw = `
Song: Wat Jai
Artist: Silly Fools
Album: Juicy
Produced by Montonn Jira
Arranged by: Silly Fools

แม้ทั้งชีวิตพังทลาย
`;

    const cleaned = cleanLyricsForGame(raw);
    expect(cleaned).not.toContain("Song:");
    expect(cleaned).not.toContain("Artist:");
    expect(cleaned).not.toContain("Juicy");
    expect(cleaned).not.toContain("Montonn Jira");
    expect(cleaned).toBe("แม้ทั้งชีวิตพังทลาย");
  });

  it("strips headers wrapped in brackets, parentheses, or bullet points", () => {
    const raw = `
[เพลง: ขอบคุณที่รักกัน]
(ศิลปิน: Potato)
* อัลบั้ม: Life
- คำร้อง/ทำนอง: ฟองเบียร์

เคยเกือบหมดหวัง และเคยเกือบถอดใจ
ขอบคุณที่รักกัน
`;

    const cleaned = cleanLyricsForGame(raw);
    expect(cleaned).not.toContain("Potato");
    expect(cleaned).not.toContain("ฟองเบียร์");
    expect(cleaned).not.toContain("Life");
    expect(cleaned).toContain("เคยเกือบหมดหวัง และเคยเกือบถอดใจ");
    expect(cleaned).toContain("ขอบคุณที่รักกัน");
  });

  it("does NOT strip actual lyrics that contain words like เพลง, ศิลปิน, or album naturally", () => {
    const raw = `
เพลงนี้ขอมอบให้เธอคนเดียว
ศิลปินคนโปรดที่เธอชอบฉันก็ชอบเหมือนกัน
เปิดอัลบั้มรูปเก่าที่เราเคยไปเที่ยวด้วยกัน
`;

    const cleaned = cleanLyricsForGame(raw);
    expect(cleaned).toContain("เพลงนี้ขอมอบให้เธอคนเดียว");
    expect(cleaned).toContain("ศิลปินคนโปรดที่เธอชอบฉันก็ชอบเหมือนกัน");
    expect(cleaned).toContain("เปิดอัลบั้มรูปเก่าที่เราเคยไปเที่ยวด้วยกัน");
  });

  it("returns empty string if the lyrics text only consists of header lines", () => {
    const raw = `
เพลง: วัดใจ
ศิลปิน: Silly Fools
อัลบั้ม: Juicy
`;

    const cleaned = cleanLyricsForGame(raw);
    expect(cleaned).toBe("");
  });
});

describe("extractIntroLyrics utility", () => {
  it("handles null, undefined, or empty string gracefully", () => {
    expect(extractIntroLyrics(null)).toBe("");
    expect(extractIntroLyrics(undefined)).toBe("");
    expect(extractIntroLyrics("")).toBe("");
    expect(extractIntroLyrics("   \n\n  ")).toBe("");
  });

  it("extracts the first 4 non-empty lines from lyrics after cleaning headers", () => {
    const raw = `
เพลง: ยาพิษ
ศิลปิน: Bodyslam

คำง่ายง่ายแต่ความหมายสุดลึกล้ำ
คำง่ายง่ายที่เธอใช้ประจำ
ซ้ำไปซ้ำมา
คิดจะพูดแต่ก็พูดอย่างไม่คิด
รู้ไหมว่าหนึ่งชีวิตของใคร
ต้องเกิดปัญหา
`;
    const intro = extractIntroLyrics(raw, 4);
    expect(intro).toBe(
      "คำง่ายง่ายแต่ความหมายสุดลึกล้ำ\nคำง่ายง่ายที่เธอใช้ประจำ\nซ้ำไปซ้ำมา\nคิดจะพูดแต่ก็พูดอย่างไม่คิด"
    );
  });

  it("respects maxLines parameter", () => {
    const raw = `
บรรทัดที่ 1
บรรทัดที่ 2
บรรทัดที่ 3
บรรทัดที่ 4
`;
    expect(extractIntroLyrics(raw, 2)).toBe("บรรทัดที่ 1\nบรรทัดที่ 2");
    expect(extractIntroLyrics(raw, 1)).toBe("บรรทัดที่ 1");
  });

  it("returns all lines if total lines are fewer than maxLines", () => {
    const raw = `
บรรทัดหนึ่ง
บรรทัดสอง
`;
    expect(extractIntroLyrics(raw, 4)).toBe("บรรทัดหนึ่ง\nบรรทัดสอง");
  });
});
