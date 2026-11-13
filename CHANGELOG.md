# Changelog

All notable changes to the **เพลงไรวะ (Pleng-Rai-Wa)** project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [v1.3.0] - 2026-11-13

### Added
- **Progressive Audio Slice Mode (Heardle / Songless Style Time Ladder)**:
  - Added new `sliceType: "progressive" | "fixed"` setting to `RoomSettings`, set as the **first & primary default choice** when Audio Slice mode is selected across Solo and Multiplayer rooms.
  - Implemented 5-step progressive duration ladder:
    - Step 1: `0.1s` (100 คะแนน)
    - Step 2: `0.5s` (80 คะแนน)
    - Step 3: `1.0s` (60 คะแนน)
    - Step 4: `2.0s` (40 คะแนน)
    - Step 5: `4.0s` (20 คะแนน)
  - **Solo Play (`/play/solo`)**:
    - Heardle-style 5-block Segmented Progress Bar with active step glow, step duration labels, and live score badge.
    - Quick "ฟังเพิ่ม (+วิ)" button that advances step and immediately triggers audio playback with the expanded snippet.
    - Wrong-guess retry prompt allowing one-click duration expansion to listen longer.
  - **Multiplayer Room (`/room/[code]`)**:
    - New API endpoint `POST /api/room/[code]/slice-step` for players to independently expand snippet durations.
    - `HostSettingsModal`: Audio Slice mode defaults to "⚡ ไต่ระดับ (0.1s - 4.0s)" as the first option, with "⏱️ กำหนดเวลาคงที่" as secondary option.
    - `GameView`: Independent player slice step progression with Heardle-style segmented timeline and custom scoring in `RoomStateStore.submitAnswer`.
    - `TVView`: Displays eye-catching progressive slice ladder indicator on the host/big screen.
    - `LobbyView`: Displays "เสี้ยววินาที: ไต่ระดับ (0.1s - 4.0s)" badge in lobby settings summary.
  - **Comprehensive Test Coverage**:
    - Added unit test suites for API, state store scoring, host settings modal, and solo play (`src/lib/__tests__/progressive-audio-slice.test.ts`, `src/app/api/room/__tests__/slice-step-endpoint.test.ts`, `src/components/room/__tests__/host-settings-progressive-slice.test.ts`, `src/app/play/solo/__tests__/solo-progressive-audio-slice.test.tsx`), bringing full test suite to 758 tests across 68 files (100% passing).

---

## [v1.2.2] - 2026-11-12

### Changed
- **Database-Driven Genre & Era Filter Display**:
  - Filtered `SongService.getSongFilterOptions()` to only return genres and eras with `songCount > 0`, removing empty categories from `/api/songs/filters`.
  - Updated `SongSourceModal` to dynamically hide genres and eras that have 0 songs in the database, preventing players from selecting empty categories.
  - Added clean empty state messages when no genres or eras with songs exist in the database.
  - Aligned "✓ เลือกทั้งหมด" and "✓ เลือกทุกยุค" action buttons and tab-switching default selection to only target available items with songs.
  - Added comprehensive unit tests in `src/components/common/__tests__/song-source-modal-empty-filters.test.ts`.

---

## [v1.2.1] - 2026-11-12

### Added
- **Album Filtering Support Across Solo & Multiplayer Room Setup**:
  - Added dedicated 💿 **"อัลบั้ม" (Album)** tab in `SongSourceModal` with 6-tab responsive grid navigation.
  - Interactive album cards displaying vinyl icon, album title, artist name, song count badge, and multi-select capability (`draft.albums` & `draft.album`).
  - Search filter within Album tab allowing instant searching by album title or artist name.
  - Backend API & Service layer aggregation in `SongService.getSongFilterOptions()` returning available albums with accurate song counts and artist metadata.
  - Added album query filtering support in `SongService.getSongs()`, `SongService.getRandomSongs()`, `/api/admin/songs`, and room round generator `/api/room/[code]/next-round`.
  - Added comprehensive unit tests in `src/components/common/__tests__/song-source-modal-album.test.ts`.

---

## [v1.2.0] - 2026-11-12

### Added
- **Album Ingestion & Filtering Pipeline Support**:
  - Added `--album <name>` CLI option to `scripts/import-song.mjs` for manual album overrides.
  - Updated Gemini AI metadata extractor in `src/lib/ai-extractor.ts` to automatically extract album names for single tracks and batch discographies.
  - Added `album` column and index to Supabase `songs` table with full type safety across `src/types/database.ts` and `src/types/index.ts`.
  - Added album documentation and standards to `.agents/skills/add-song/SKILL.md`.
- **A La Carte Hint Selection Modal (`HintSelectModal`)**:
  - Replaced linear hint button with a dedicated "💡 ขอคำใบ้" pop-up modal allowing players to choose specific hints a la carte:
    - 🎸 แนวเพลง (Genre): -15 pts
    - 📅 ปีที่ปล่อย & ยุค (Year / Era): -20 pts
    - 💿 อัลบั้ม (Album): -20 pts (dynamically disabled with badge when song has no album)
    - 🎤 ศิลปิน / วง (Artist): -35 pts
  - Implemented instant modal dismissal on hint selection with automatic focus restoration to the answer input box for zero-friction answering.
  - Added guaranteed score floor of 20 points for correct answers.

### Changed
- **Autocomplete Limit Expansion & Scrollable Dropdown**:
  - Expanded autocomplete search result limit from 5 to 20 items in `searchSongAutocomplete`.
  - Added `max-h-60 sm:max-h-72 overflow-y-auto` scrollable container across Solo Mode, Game View, and Answer Modal, allowing smooth browsing of complete artist discographies without viewport clipping.
- **Solo Mode Score Streamlining**:
  - Purged all score banners, point deductions, and score floor messages from Solo Mode (`isSolo={true}` in `HintSelectModal`).
  - Solo players can explore hints freely without scoring pressure in casual/practice sessions.

---

## [v1.1.4] - 2026-11-11

### Added
- **Translated Lyrics Teleprompter Auto-Scroll**:
  - Introduced `TranslatedLyricsTeleprompter` component with smooth 60fps downward auto-scroll powered by `requestAnimationFrame` and timestamp delta timing.
  - Added user control toolbar with speed presets (`[ ช้า (20px/s) | ปกติ (38px/s) | เร็ว (65px/s) ]`), play/pause toggle button, and smooth restart to top button.
  - Implemented automatic manual override: temporarily pauses auto-scrolling when player touches, scrolls, or drags, smoothly resuming after 2.5s of inactivity.
  - Designed centered, single-column natural lyrics flow with top and bottom gradient fade masks.
  - Integrated teleprompter auto-scroll into both Player Game View (`GameView`) and Party TV View (`TVView`).

---

## [v1.1.3] - 2026-11-11

### Changed
- **Translated Lyrics Gameplay Readability Overhaul**:
  - Re-architected translated lyrics presentation into a balanced layout on tablet and desktop screens, enabling players to read full songs at a glance.
  - Reduced oversized font to a balanced, comfortable scale with relaxed line-height.
  - Expanded display box viewport height and width for optimal reading ergonomics.
  - Updated TV view (`TVView`) for large screen readability.
- **Homepage 4 Modes Showcase & Natural Copywriting**:
  - Expanded homepage game modes grid to 4 columns (`grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4`), adding **โหมดแปลเนื้อเพลง (Translated Lyrics)**.
  - Rewrote game mode descriptions using natural, professional, and clear Thai language (replacing unnatural marketing slang like "ท้าทายหูทิพย์ขั้นสุด" and "ชวนขำและจำยากมาก").
  - Polished the Hero Section subtitle to cleanly highlight all 4 game modes.

---

## [v1.1.2] - 2026-11-11

### Changed
- **Create Room Button & Modal Title Rebrand**:
  - Renamed the main hero action button in `src/app/page.tsx` from "สร้างห้อง" to "สร้างห้องทายเพลง".
  - Updated Create Room modal title for multiplayer mode to "สร้างห้องเล่นหลายคน (Party)".
  - Updated public room directory guidance text in `ActiveRoomsTable` to reference "สร้างห้องทายเพลง".
- **Solo Room UI Streamlining & Cleanup**:
  - Hidden "พาทุกคนกลับล็อบบี้" in both `PodiumView` and `LobbyView` when in Solo room mode.
  - Hidden "QR Code ชวนเพื่อน" button and "จัดการห้อง" (room capacity and host transfer) button in `LobbyView` for Solo rooms.
  - Hidden "จอทีวี (TV Mode)" header link in `LobbyView` during Solo mode.
  - Replaced "ห้องปาร์ตี้ดนตรีสด" card badge with "🎮 ห้องเล่นคนเดียว (Solo Room)".
  - Replaced confusing ready badge ("พร้อมแล้ว 0/1 คน") with clear indicator "✓ พร้อมเริ่มได้ทันที" in Solo mode.
  - Added fail-safe guard in `RoomManageModal` to prevent rendering when `settings.isSolo` is true.

---

## [v1.1.1] - 2026-11-11

### Changed
- **Navigation Bar Cleanup**:
  - Removed obsolete "เล่นคนเดียว" (`/play/solo`) link from `NAV_LINKS` in `NavHeader` now that Solo room mode is fully integrated into the standard room creation workflow.
- **Create Room Button Label**:
  - Renamed hero action button from "สร้างห้องเล่นกับเพื่อน" to "สร้างห้อง" in `src/app/page.tsx` and updated empty rooms hint in `ActiveRoomsTable` to accurately reflect both Party and Solo modes inside the creation modal.

---

## [v1.1.0] - 2026-11-03

### Added
- **Solo Room Mode Unification**:
  - Unified Solo mode into the Room system with party/solo room switcher (`[ 👥 เล่นหลายคน (Party) | 👤 เล่นคนเดียว (Solo) ]`) in Create Room modal.
  - Enabled instant single-player game start in Lobby view without requiring a second player.
  - Added live accuracy counter tracking correct vs wrong answers (`✓ ถูก: X | ✗ ผิด: Y | Z%`) during gameplay.
  - Added dedicated **Solo Performance Summary Card** on the Podium view displaying total score, correct count, wrong count, accuracy percentage, and skill rating badges.
  - Added `SettingsMenu` on `/play/solo` page for volume and SFX audio controls.
- **AI Lyrics Listening Station**:
  - Added animated sound wave visualizer station card for AI Lyrics mode.
  - Added "ฟังอีกครั้ง (Replay Audio)" / Pause button to replay TTS speech on demand.
- **Search Grounded AI Extraction**:
  - Added Google Search Grounding (`tools: [{ googleSearch: {} }]`) to `src/lib/ai-extractor.ts` to verify authentic lyrics against Thai music databases (Siamzone, Sanook, Genius, TrueID Music).

### Fixed
- **ThreeVinylCanvas Ambient Synth Audio Leak**:
  - Fixed procedural synth audio playing indefinitely in the background when navigating away or unmounting.
  - Added `isMountedRef` and `isPlayingRef` checks to prevent starting ambient loops on unmounted components.
  - Created global `stopAllAmbientSynths()` registry to disconnect and silence all oscillators/gains immediately.
- **Authentic Lyrics for "เคลิ้ม" (Slot Machine)**:
  - Corrected lyrics in Supabase database (`nkznqmbqqbbopnnohwcn`) from `"เหมือนเดิมซ้ำ ๆ แล้วสะใจ"` to `"เหมือนโดนซ้ำซ้ำแล้วสะใจ"`.

### Changed
- **AI Lyrics Options Restriction**:
  - Restricted lyrics types in AI Lyrics mode strictly to 2 options: `🎵 ท่อนฮุก (Chorus)` and `🎼 ท่อนเปิด (Intro)` (removed "ทั้งเพลง" option).
- **Hiding Lyrics Text in AI Lyrics Mode**:
  - Lyrics text is now hidden from the screen in `ai-lyrics` mode (auditory-only guessing), while remaining visible in `translated-lyrics` mode.

---

## [v1.0.0] - 2026-10-31

### Added
- Initial production release of **เพลงไรวะ (Pleng-Rai-Wa)** music guessing web application.
- Real-time multiplayer room system using Supabase Realtime broadcast channels.
- Three interactive game modes: Audio Slice, Buzzer Battle, and AI Lyrics.
- Three-tier animated podium with victory fanfare SFX and confetti celebrations.
- 3D interactive turntable record player using Three.js with Lo-Fi ambient audio.
- Admin dashboard (`/admin`) for song library management and YouTube/MP3 extraction pipeline.
