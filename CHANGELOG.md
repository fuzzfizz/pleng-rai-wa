# Changelog

All notable changes to the **เพลงไรวะ (Pleng-Rai-Wa)** project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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
