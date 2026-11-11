import { describe, it, expect } from "vitest";
import React from "react";
import { renderToString } from "react-dom/server";
import {
  TranslatedLyricsTeleprompter,
  TELEPROMPTER_SPEEDS,
} from "../translated-lyrics-teleprompter";

describe("TranslatedLyricsTeleprompter Component", () => {
  const sampleLyrics = `Is it true that you love me?
Say it again one more time
Underneath the midnight sky
My heart will always be yours`;

  describe("Speeds Configuration", () => {
    it("defines correct speed values for slow, normal, and fast", () => {
      expect(TELEPROMPTER_SPEEDS.slow).toBe(20);
      expect(TELEPROMPTER_SPEEDS.normal).toBe(38);
      expect(TELEPROMPTER_SPEEDS.fast).toBe(65);
    });
  });

  describe("Rendering in Standard Non-TV Mode", () => {
    it("renders translated lyrics text properly", () => {
      const html = renderToString(
        <TranslatedLyricsTeleprompter lyrics={sampleLyrics} roundKey={1} />
      );

      expect(html).toContain("Is it true that you love me?");
      expect(html).toContain("Say it again one more time");
      expect(html).toContain("Underneath the midnight sky");
      expect(html).toContain("My heart will always be yours");
    });

    it("displays default fallback message when lyrics is empty", () => {
      const html = renderToString(
        <TranslatedLyricsTeleprompter lyrics="" roundKey={1} />
      );

      expect(html).toContain("กำลังสตรีมเสียงเนื้อเพลง...");
    });

    it("renders Google Translate Karaoke title badge", () => {
      const html = renderToString(
        <TranslatedLyricsTeleprompter lyrics={sampleLyrics} roundKey={1} />
      );

      expect(html).toContain("🌐 Google Translate Karaoke (เนื้อเพลงแปลอังกฤษ)");
      expect(html).toContain("animate-pulse");
    });

    it("has interactive controls: speed buttons (ช้า, ปกติ, เร็ว), play/pause, and restart", () => {
      const html = renderToString(
        <TranslatedLyricsTeleprompter lyrics={sampleLyrics} roundKey={1} />
      );

      // Speed buttons
      expect(html).toContain("ช้า");
      expect(html).toContain("ปกติ");
      expect(html).toContain("เร็ว");
      expect(html).toContain('aria-label="ความเร็วการเลื่อนเนื้อเพลง"');

      // Play/Pause button (default auto-scrolling is active, so button shows pause "พัก")
      expect(html).toContain("พัก");
      expect(html).toContain('aria-label="พักการเลื่อน"');

      // Restart button
      expect(html).toContain("เริ่มใหม่");
      expect(html).toContain('aria-label="เริ่มใหม่"');
    });

    it("includes top and bottom gradient fade masks overlay", () => {
      const html = renderToString(
        <TranslatedLyricsTeleprompter lyrics={sampleLyrics} roundKey={1} />
      );

      // Top fade mask
      expect(html).toContain("bg-gradient-to-b");
      expect(html).toContain("from-white dark:from-stone-900 to-transparent");
      expect(html).toContain("pointer-events-none absolute inset-x-0 top-0 h-10");

      // Bottom fade mask
      expect(html).toContain("bg-gradient-to-t");
      expect(html).toContain("from-white dark:from-stone-900 to-transparent");
      expect(html).toContain("pointer-events-none absolute inset-x-0 bottom-0 h-10");
    });

    it("uses single centered column without horizontal column split", () => {
      const html = renderToString(
        <TranslatedLyricsTeleprompter lyrics={sampleLyrics} roundKey={1} />
      );

      // Must not split into columns
      expect(html).not.toContain("columns-2");
      expect(html).not.toContain("sm:columns-2");

      // Centered readable teleprompter typography
      expect(html).toContain("text-center");
      expect(html).toContain("whitespace-pre-line break-words");
      expect(html).toContain("custom-scrollbar");
      expect(html).toContain("max-h-[300px] sm:max-h-[380px] lg:max-h-[440px]");
    });
  });

  describe("Rendering in TV Mode (isTvMode = true)", () => {
    it("renders lyrics with large TV typography", () => {
      const html = renderToString(
        <TranslatedLyricsTeleprompter
          lyrics={sampleLyrics}
          roundKey={1}
          isTvMode={true}
        />
      );

      expect(html).toContain("Is it true that you love me?");
      expect(html).toContain("text-white text-xl sm:text-2xl font-bold leading-loose");
      expect(html).not.toContain("columns-2");
    });

    it("renders TV title badge and centers it", () => {
      const html = renderToString(
        <TranslatedLyricsTeleprompter
          lyrics={sampleLyrics}
          roundKey={1}
          isTvMode={true}
        />
      );

      expect(html).toContain("🌐 Google Translate Karaoke (เนื้อเพลงแปลอังกฤษ)");
      expect(html).toContain("justify-center");
    });

    it("hides all interactive buttons in TV mode", () => {
      const html = renderToString(
        <TranslatedLyricsTeleprompter
          lyrics={sampleLyrics}
          roundKey={1}
          isTvMode={true}
        />
      );

      // No speed buttons
      expect(html).not.toContain('aria-label="ความเร็วการเลื่อนเนื้อเพลง"');
      expect(html).not.toContain(">ช้า<");
      expect(html).not.toContain(">ปกติ<");
      expect(html).not.toContain(">เร็ว<");

      // No pause/play button
      expect(html).not.toContain('aria-label="พักการเลื่อน"');
      expect(html).not.toContain(">พัก<");
      expect(html).not.toContain(">เลื่อนต่อ<");

      // No restart button
      expect(html).not.toContain('aria-label="เริ่มใหม่"');
      expect(html).not.toContain(">เริ่มใหม่<");
    });

    it("includes top and bottom gradient masks suited for TV dark theme", () => {
      const html = renderToString(
        <TranslatedLyricsTeleprompter
          lyrics={sampleLyrics}
          roundKey={1}
          isTvMode={true}
        />
      );

      expect(html).toContain("bg-gradient-to-b");
      expect(html).toContain("bg-gradient-to-t");
      expect(html).toContain("pointer-events-none absolute inset-x-0 top-0 h-10");
      expect(html).toContain("pointer-events-none absolute inset-x-0 bottom-0 h-10");
      expect(html).toContain("from-stone-950");
    });
  });
});
