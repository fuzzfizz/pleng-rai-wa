import { describe, it, expect } from "vitest";
import {
  scoreYouTubeCandidate,
  selectBestAudioCandidate,
  YouTubeCandidate,
} from "../audio-downloader";

describe("audio-downloader smart candidate selection", () => {
  it("penalizes MV, short film, live, and concert titles", () => {
    const mvCandidate: YouTubeCandidate = {
      id: "mv1",
      title: "วัดใจ - Silly Fools OFFICIAL MV",
      channel: "GMM GRAMMY OFFICIAL",
      duration: 257,
    };
    const score = scoreYouTubeCandidate(mvCandidate);
    expect(score).toBeLessThan(0);
  });

  it("gives highest priority to YouTube Topic tracks (Studio Master)", () => {
    const topicCandidate: YouTubeCandidate = {
      id: "topic1",
      title: "วัดใจ",
      channel: "Silly Fools - Topic",
      duration: 254,
    };
    const score = scoreYouTubeCandidate(topicCandidate);
    expect(score).toBeGreaterThanOrEqual(100);
  });

  it("gives bonus to Official Audio and Lyric videos", () => {
    const audioCandidate: YouTubeCandidate = {
      id: "aud1",
      title: "Silly Fools - วัดใจ (Official Audio)",
      channel: "Some Channel",
      duration: 254,
    };
    const score = scoreYouTubeCandidate(audioCandidate);
    expect(score).toBeGreaterThan(40);
  });

  it("selects the highest scoring candidate from a list", () => {
    const candidates: YouTubeCandidate[] = [
      { id: "1", title: "วัดใจ OFFICIAL MV", channel: "GMM", duration: 257 },
      { id: "2", title: "วัดใจ (Drum Cover)", channel: "Drummer", duration: 260 },
      { id: "3", title: "วัดใจ [Official Lyrics]", channel: "90s Lyrics", duration: 254 },
      { id: "4", title: "วัดใจ", channel: "Silly Fools - Topic", duration: 254 },
    ];
    const best = selectBestAudioCandidate(candidates);
    expect(best?.id).toBe("4");
  });

  it("penalizes various blacklist keywords (หนังสั้น, Short Film, Live, Concert, Cover, คาราโอเกะ, Teaser, Reaction, Longplay)", () => {
    const blacklistExamples = [
      "เพลงรัก (Short Film)",
      "เพลงรัก [หนังสั้น]",
      "เพลงรัก Live in Concert",
      "เพลงรัก Concert 2024",
      "เพลงรัก (Cover by Anyone)",
      "เพลงรัก คาราโอเกะ",
      "เพลงรัก Karaoke Version",
      "เพลงรัก Official Teaser",
      "เพลงรัก Reaction Video",
      "เพลงรัก รวมเพลงฮิต Longplay",
    ];

    for (const title of blacklistExamples) {
      const candidate: YouTubeCandidate = {
        id: "bl-test",
        title,
        channel: "Any Channel",
        duration: 240,
      };
      const score = scoreYouTubeCandidate(candidate);
      expect(score, `Expected negative score for title: ${title}`).toBeLessThan(0);
    }
  });

  it("disqualifies candidates shorter than 90s or longer than 480s with -999", () => {
    const shortCandidate: YouTubeCandidate = {
      id: "short1",
      title: "วัดใจ (Short Clip)",
      channel: "Silly Fools - Topic",
      duration: 60, // < 90s
    };
    expect(scoreYouTubeCandidate(shortCandidate)).toBe(-999);

    const longCandidate: YouTubeCandidate = {
      id: "long1",
      title: "วัดใจ (Full Concert 2 Hours)",
      channel: "Silly Fools - Topic",
      duration: 600, // > 480s
    };
    expect(scoreYouTubeCandidate(longCandidate)).toBe(-999);
  });

  it("applies duration proximity bonus and penalty when expectedDurationSec is provided", () => {
    const closeCandidate: YouTubeCandidate = {
      id: "close1",
      title: "เพลงรัก",
      channel: "Normal Channel",
      duration: 200,
    };
    const exactScore = scoreYouTubeCandidate(closeCandidate, 202); // diff 2s -> +30 bonus
    expect(exactScore).toBe(30);

    const farCandidate: YouTubeCandidate = {
      id: "far1",
      title: "เพลงรัก",
      channel: "Normal Channel",
      duration: 300,
    };
    const farScore = scoreYouTubeCandidate(farCandidate, 200); // diff 100s -> -40 penalty
    expect(farScore).toBe(-40);
  });

  it("returns null when candidate list is empty or all candidates are disqualified", () => {
    expect(selectBestAudioCandidate([])).toBeNull();

    const disqualifiedList: YouTubeCandidate[] = [
      { id: "d1", title: "Teaser 1", channel: "Channel", duration: 30 },
      { id: "d2", title: "Full Album 1 hr", channel: "Channel", duration: 3600 },
    ];
    expect(selectBestAudioCandidate(disqualifiedList)).toBeNull();
  });

  it("falls back to Official Audio or Lyrics video when Topic track is missing", () => {
    const candidates: YouTubeCandidate[] = [
      { id: "mv", title: "วัดใจ OFFICIAL MV", channel: "GMM", duration: 257 },
      { id: "aud", title: "วัดใจ (Official Audio)", channel: "GMM", duration: 254 },
      { id: "lyric", title: "วัดใจ [Official Lyrics]", channel: "GMM", duration: 254 },
    ];
    const best = selectBestAudioCandidate(candidates);
    expect(best?.id).toBe("aud");
  });
});
