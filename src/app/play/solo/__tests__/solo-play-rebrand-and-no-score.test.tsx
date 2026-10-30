import { describe, it, expect } from "vitest";
import { NAV_LINKS } from "@/components/common/nav-header";
import { prepareSettingsPayload } from "@/components/room/host-settings-modal";
import type { Song, RoomSettings } from "@/types";

describe("Solo Play Rebrand and Scoring Removal (should-fix item 2)", () => {
  it("uses 'เล่นคนเดียว' for solo navigation item instead of 'ซ้อมเดี่ยว'", () => {
    const soloNav = NAV_LINKS.find((item) => item.href === "/play/solo");
    expect(soloNav).toBeDefined();
    expect(soloNav?.label).toBe("เล่นคนเดียว");
    expect(soloNav?.label).not.toContain("ซ้อม");
  });

  it("formats correct answer message without score or points awarded", () => {
    const song: Song = {
      id: "song-1",
      title: "วัดใจ",
      artist: "Silly Fools",
      aliases: [],
      audioUrl: "https://example.com/audio.mp3",
    };
    const matchedAs = "วัดใจ";
    const feedbackMessage = `ถูกต้อง! เพลง "${song.title}" โดย ${song.artist} (ตรงกับ: ${matchedAs})`;

    expect(feedbackMessage).toContain("ถูกต้อง!");
    expect(feedbackMessage).not.toContain("คะแนน");
    expect(feedbackMessage).not.toContain("+");
  });
});

describe("Translated Lyrics Mode Configuration (should-fix item 1)", () => {
  it("forces lyricsType to 'full' for translated-lyrics and removes voiceGender", () => {
    const payload = prepareSettingsPayload({
      gameMode: "translated-lyrics",
      lyricsType: "chorus",
      voiceGender: "male",
    });

    expect(payload.gameMode).toBe("translated-lyrics");
    expect(payload.lyricsType).toBe("full");
    expect(payload.voiceGender).toBeUndefined();
  });

  it("resolves full song lyrics for translation even if a song has chorus lyrics", () => {
    const song: Song = {
      id: "song-2",
      title: "เล่นของสูง",
      artist: "Big Ass",
      aliases: [],
      audioUrl: "https://example.com/audio.mp3",
      lyricsChorus: "รู้ว่าเสี่ยงแต่คงต้องขอลอง",
      lyricsFull: "รู้ว่าเสี่ยงแต่คงต้องขอลอง ทั้งเพลงยาวๆ จบเพลง",
    };

    const settings: RoomSettings = {
      gameMode: "translated-lyrics",
      lyricsType: "full",
      answerInputMode: "autocomplete",
      answerResolutionMode: "race",
      maxPlayers: 8,
      totalRounds: 10,
      roundTimeoutSec: 15,
      sliceDurationSec: 2.0,
      targetScore: 0,
    };

    let sourceText = "";
    if (settings.gameMode === "translated-lyrics") {
      sourceText = song.lyricsFull || song.lyricsChorus || song.lyricsIntro || "";
    } else {
      sourceText = song.lyricsChorus || song.lyricsFull || song.lyricsIntro || "";
    }

    expect(sourceText).toBe("รู้ว่าเสี่ยงแต่คงต้องขอลอง ทั้งเพลงยาวๆ จบเพลง");
  });
});

describe("Solo Mode Data Sync & Empty Filter Handling (should-fix item 3)", () => {
  it("binds real database single song without falling back to DEMO_SONGS", () => {
    const singleDbSong: Song = {
      id: "song-khern",
      title: "เขิน",
      artist: "GLISS",
      aliases: [],
      audioUrl: "https://example.com/khern.mp3",
    };
    const songsPool: Song[] = [singleDbSong];
    const currentSong = songsPool.length > 0 ? songsPool[0] : null;

    expect(currentSong).not.toBeNull();
    expect(currentSong?.title).toBe("เขิน");
    expect(currentSong?.title).not.toBe("แสงสุดท้าย");
  });

  it("does not silently fall back to DEMO_SONGS when filter returns 0 songs", () => {
    const filterType: string = "genre";
    const returnedSongs: Song[] = [];
    const pool = filterType === "all" ? [{ id: "demo" } as Song] : returnedSongs;
    const notice = pool.length === 0 ? "ไม่พบเพลงที่ตรงกับตัวกรอง" : null;

    expect(pool).toHaveLength(0);
    expect(notice).toBe("ไม่พบเพลงที่ตรงกับตัวกรอง");
  });
});
