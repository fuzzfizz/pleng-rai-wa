# Add Song Skill & Pipeline Enhancement Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Create the `add-song` agent skill and enhance the song ingestion pipeline with Audio-First (No-MV) YouTube selection, multi-layer lyrics verification, interactive fallbacks, and complete database storage.

**Architecture:** 
1. Upgrade `audio-downloader.ts` with smart candidate inspection (`ytsearch5`) scoring to eliminate drama MVs and prioritize Topic/Audio tracks.
2. Upgrade `scripts/import-song.mjs` to support direct YouTube URLs, CLI override flags, and ensure `lyrics_full` is populated at top-level in Supabase.
3. Author `.agents/skills/add-song/SKILL.md` enforcing the Hybrid workflow, Missing Asset Fallback protocol, quality audit card, and alias augmentation.

**Tech Stack:** Next.js, TypeScript, Vitest, yt-dlp, ffmpeg, Supabase, Cloudflare R2, Gemini API (@google/genai).

## Global Constraints
- Target workspace: `D:\pleng-rai-wa`
- Preserve existing public API of `downloadAndProcessYoutube` in `src/lib/audio-downloader.ts`.
- The `lyrics_full` column in Supabase `songs` table must always be populated.
- Audio duration must be bounded between 90s and 480s for automatically selected YouTube tracks.
- Blacklist keywords: `["OFFICIAL MV", "MV", "Music Video", "หนังสั้น", "Short Film", "Live", "Concert", "Cover", "คาราโอเกะ", "Teaser", "Reaction", "Longplay"]`.

---

### Task 1: Smart Audio-First Candidate Selection in Audio Downloader

**Files:**
- Modify: `src/lib/audio-downloader.ts`
- Create: `src/lib/__tests__/audio-downloader-smart-filter.test.ts`

**Interfaces:**
- Produces: `scoreYouTubeCandidate(candidate: YouTubeCandidate): number`
- Produces: `selectBestAudioCandidate(candidates: YouTubeCandidate[], expectedDurationSec?: number): YouTubeCandidate | null`
- Produces: `searchSmartAudioCandidate(query: string, ytDlpPath?: string): Promise<{ url: string; title: string; duration: number } | null>`

- [ ] **Step 1: Write unit tests for candidate scoring and selection**

Create `src/lib/__tests__/audio-downloader-smart-filter.test.ts`:
```typescript
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
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/__tests__/audio-downloader-smart-filter.test.ts`
Expected: FAIL with missing exports `YouTubeCandidate`, `scoreYouTubeCandidate`, `selectBestAudioCandidate`.

- [ ] **Step 3: Implement candidate scoring and selection in `src/lib/audio-downloader.ts`**

In `src/lib/audio-downloader.ts`, add the candidate types, scoring functions, and update `downloadAndProcessYoutube`:
```typescript
export interface YouTubeCandidate {
  id: string;
  title: string;
  channel: string;
  duration: number;
}

const BLACKLIST_PATTERNS = [
  /\bofficial\s+mv\b/i,
  /\bmv\b/i,
  /\bmusic\s+video\b/i,
  /หนังสั้น/i,
  /short\s+film/i,
  /\blive\b/i,
  /\bconcert\b/i,
  /\bcover\b/i,
  /คาราโอเกะ/i,
  /\bkaraoke\b/i,
  /\bteaser\b/i,
  /\breaction\b/i,
  /\blongplay\b/i,
  /รวมเพลง/i,
  /full\s+album/i,
];

export function scoreYouTubeCandidate(
  candidate: YouTubeCandidate,
  expectedDurationSec?: number
): number {
  let score = 0;
  const title = candidate.title || "";
  const channel = candidate.channel || "";

  // Duration guard: reject overly long or very short videos
  if (candidate.duration > 480 || (candidate.duration > 0 && candidate.duration < 80)) {
    return -999;
  }

  // Blacklist check
  for (const pattern of BLACKLIST_PATTERNS) {
    if (pattern.test(title)) {
      score -= 100;
      break;
    }
  }

  // Topic channel bonus (YouTube Music auto-generated studio master)
  if (/- topic$/i.test(channel.trim())) {
    score += 100;
  }

  // Audio / Lyric keywords bonus
  if (/\b(?:official\s+)?audio\b/i.test(title)) score += 50;
  if (/\b(?:official\s+)?lyrics?(?:\s+video)?\b/i.test(title) || /เนื้อเพลง/i.test(title)) score += 40;

  // Expected duration proximity bonus (within 10s)
  if (expectedDurationSec && expectedDurationSec > 0 && candidate.duration > 0) {
    const diff = Math.abs(candidate.duration - expectedDurationSec);
    if (diff <= 5) score += 30;
    else if (diff <= 15) score += 15;
    else if (diff > 45) score -= 40;
  }

  return score;
}

export function selectBestAudioCandidate(
  candidates: YouTubeCandidate[],
  expectedDurationSec?: number
): YouTubeCandidate | null {
  if (!candidates || candidates.length === 0) return null;

  let best: YouTubeCandidate | null = null;
  let highestScore = -Infinity;

  for (const candidate of candidates) {
    const score = scoreYouTubeCandidate(candidate, expectedDurationSec);
    if (score > highestScore) {
      highestScore = score;
      best = candidate;
    }
  }

  return best;
}
```

Implement `searchSmartAudioCandidate`:
```typescript
export async function searchSmartAudioCandidate(
  query: string,
  ytDlpPath?: string,
  expectedDurationSec?: number
): Promise<{ url: string; title: string; duration: number } | null> {
  const binary = ytDlpPath || (await getYtDlpPath());
  try {
    const searchTarget = `ytsearch5:${query}`;
    const { stdout } = await execFileAsync(binary, [
      "--flat-playlist",
      "--no-warnings",
      "--print",
      "%(id)s|||%(title)s|||%(channel)s|||%(duration)s",
      searchTarget,
    ]);

    const lines = stdout.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
    const candidates: YouTubeCandidate[] = lines.map((line) => {
      const [id, title, channel, durationStr] = line.split("|||");
      return {
        id: (id || "").trim(),
        title: (title || "").trim(),
        channel: (channel || "").trim(),
        duration: durationStr ? parseFloat(durationStr) : 0,
      };
    }).filter((c) => Boolean(c.id));

    const best = selectBestAudioCandidate(candidates, expectedDurationSec);
    if (best) {
      return {
        url: `https://www.youtube.com/watch?v=${best.id}`,
        title: best.title,
        duration: best.duration,
      };
    }
  } catch (err) {
    console.warn("[audio-downloader] Smart candidate search failed, fallback to direct query:", err);
  }
  return null;
}
```

In `downloadAndProcessYoutube`:
If `!isUrl`, call `searchSmartAudioCandidate(youtubeUrlOrQuery.trim(), ytDlpPath)` first. If a candidate is found, set `target = candidate.url`. If not, fall back to `ytsearch1:${youtubeUrlOrQuery.trim()}`.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/__tests__/audio-downloader-smart-filter.test.ts`
Expected: PASS all 4 tests.

- [ ] **Step 5: Commit changes**

```bash
git add src/lib/audio-downloader.ts src/lib/__tests__/audio-downloader-smart-filter.test.ts
git commit -m "feat(audio): add smart candidate selection favoring Topic and Audio tracks over MVs"
```

---

### Task 2: CLI Script (`scripts/import-song.mjs`) Upgrades

**Files:**
- Modify: `scripts/import-song.mjs`

**Interfaces:**
- CLI Flags:
  - Supports direct URL: `node --env-file=.env.local scripts/import-song.mjs "https://www.youtube.com/watch?v=..."`
  - Supports `--youtube-url <url>`: Override audio source directly
  - Supports `--lyrics <text>`: Override/provide lyrics text
  - Supports `--hook-start <sec>` & `--hook-end <sec>`: Override chorus timing
- Database Insert:
  - Populate `lyrics_full: metadata.lyricsFull || null` in `songRow` insert payload.

- [ ] **Step 1: Inspect and update `scripts/import-song.mjs`**

Parse arguments with support for flags (`--youtube-url`, `--lyrics`, `--hook-start`, `--hook-end`).
If input query is an HTTP URL, pass it as `youtubeSourceOverride` directly.
Update the Supabase `songs` insert object:
```javascript
  const songRow = {
    id: songId,
    title: metadata.title,
    artist: metadata.artist,
    aliases: metadata.aliases || [metadata.title],
    release_year: metadata.releaseYear ? Number(metadata.releaseYear) : null,
    genre_id: genreId || null,
    era: metadata.era || null,
    audio_url: audioUrl,
    hook_start_sec: customHookStart ?? (metadata.hookStartSec || 0),
    hook_end_sec: customHookEnd ?? (metadata.hookEndSec || 0),
    duration_sec: audioResult.durationSec || metadata.durationSec || 0,
    lyrics_intro: metadata.lyricsIntro || null,
    lyrics_chorus: metadata.lyricsChorus || null,
    lyrics_full: customLyrics ?? metadata.lyricsFull ?? null,
    metadata: {
      youtubeSource: audioSourceUrl,
      storageType: "r2",
      r2Key,
      lyricsFull: customLyrics ?? metadata.lyricsFull ?? null,
      lyricsConfidence: metadata.lyricsConfidence || "not_found",
      importedAt: new Date().toISOString(),
    },
    created_at: new Date().toISOString(),
  };
```

- [ ] **Step 2: Test CLI argument parsing and dry validation**

Run a command with `--help` or check that syntax parses cleanly:
`node -c scripts/import-song.mjs`
Expected: Syntax clean, exit code 0.

- [ ] **Step 3: Commit changes**

```bash
git add scripts/import-song.mjs
git commit -m "feat(scripts): support override flags and persist lyrics_full in import-song CLI"
```

---

### Task 3: Author the `add-song` Skill

**Files:**
- Create: `.agents/skills/add-song/SKILL.md`

**Content Requirements:**
- YAML frontmatter with `name: add-song` and triggering conditions starting with "Use when...".
- Hybrid workflow protocol (single song vs batch discography).
- Audio-First (No MV) checklist.
- Multi-layer lyrics verification check.
- Interactive Missing Asset Fallback protocol (instructions for AI to pause and ask user for YouTube URL or lyrics when confidence is low).
- Post-import verification & Alias augmentation procedure (adding romanized/karaoke & common typos to Supabase).
- Final Audit Card output format.

- [ ] **Step 1: Write `.agents/skills/add-song/SKILL.md`**

Write the complete skill according to the spec and Antigravity skill conventions.

- [ ] **Step 2: Verify skill formatting and discovery**

Check file exists and follows YAML frontmatter rules without markdown syntax errors.

- [ ] **Step 3: Commit changes**

```bash
git add .agents/skills/add-song/SKILL.md
git commit -m "feat(skills): add systematic add-song agent skill"
```

---

### Task 4: End-to-End Verification

**Files:**
- Verification only

- [ ] **Step 1: Run complete test suite**

Run: `npm test` or `npx vitest run`
Expected: All tests pass (including existing and new audio downloader tests).

- [ ] **Step 2: Verify git status and clean tree**

Run: `git status`
Expected: Clean working tree.
