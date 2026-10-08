# Admin Song Edit and AI Re-enrichment Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Allow administrators in `/admin` to edit song metadata and trigger AI-assisted re-enrichment (lyrics, hook timestamps, era, release year, aliases) via Gemini API.

**Architecture:** A `PATCH /api/admin/songs` endpoint updating Supabase via `song-service`, paired with a portalled `SongEditModal` component that integrates with `/api/admin/extract` for real-time AI metadata population before admin saves.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript, Tailwind CSS 4, Supabase DB, Google Gemini API (`@google/genai`).

## Global Constraints
- Spec: `docs/superpowers/specs/2026-10-08-admin-song-edit-and-ai-enrichment-design.md`
- Do NOT break existing song playback, search filters, or audio audit queues.
- Any modal overlay MUST use `createPortal` to `document.body` with `z-[100]` and `backdrop-blur-md` to avoid stacking context bleed.
- Zero TypeScript errors (`npx tsc --noEmit`).
- Clean build (`npm run build`).

---

### Task 1: Backend API `PATCH /api/admin/songs`

- [x] **Step 1**: Add `PATCH` handler in `src/app/api/admin/songs/route.ts`.
- [x] **Step 2**: Parse request body: `{ id, title, artist, aliases, releaseYear, genreId, era, hookStartSec, hookEndSec, durationSec, lyricsIntro, lyricsChorus, audioUrl }`.
- [x] **Step 3**: Validate required `id` string (UUID).
- [x] **Step 4**: Call `updateSong(id, updates)` in `src/lib/services/song-service.ts`.
- [x] **Step 5**: Return `{ success: true, song: updatedSong }` on success, or appropriate error status.
- [x] **Step 6**: Verify with `npx tsc --noEmit`.

---

### Task 2: Frontend Component `SongEditModal`

- [x] **Step 1**: Create `src/components/admin/song-edit-modal.tsx`.
- [x] **Step 2**: Setup component props: `{ song: Song; genres: Genre[]; isOpen: boolean; onClose: () => void; onSaved: (updatedSong: Song) => void; apiKey?: string }`.
- [x] **Step 3**: Setup state for editable fields initialized from `song`: `title`, `artist`, `aliases`, `releaseYear`, `era`, `genreId`, `hookStartSec`, `hookEndSec`, `lyricsIntro`, `lyricsChorus`, `audioUrl`.
- [x] **Step 4**: Implement "✨ ให้ AI ค้นหาข้อมูลใหม่" button handler:
  - Calls `POST /api/admin/extract` with `{ query: `${title} ${artist}`, apiKey }`.
  - On success, updates fields and highlights AI-populated values.
- [x] **Step 5**: Implement Audio preview player inside modal for testing hook timings.
- [x] **Step 6**: Implement Save handler calling `PATCH /api/admin/songs` with loading indicator.
- [x] **Step 7**: Portal modal to `document.body` with `z-[100]` and `bg-stone-950/70 backdrop-blur-md`.
- [x] **Step 8**: Verify with `npx tsc --noEmit`.

---

### Task 3: Admin Page Integration

- [x] **Step 1**: In `src/app/admin/page.tsx`, import `SongEditModal`.
- [x] **Step 2**: Add state `editingSong: Song | null`.
- [x] **Step 3**: Add "แก้ไข" button (with `Pencil` or `Edit3` icon) to each song card in Tab 2 ("คลังเพลงทั้งหมด").
- [x] **Step 4**: Render `SongEditModal` when `editingSong` is present.
- [x] **Step 5**: On `onSaved`, update `songs` state in place and show success toast/message.
- [x] **Step 6**: Verify with `npx tsc --noEmit`.

---

### Task 4: End-to-End Verification & Deployment

- [x] **Step 1**: Run full TypeScript check (`npx tsc --noEmit`).
- [x] **Step 2**: Run Next.js production build (`npm run build`).
- [ ] **Step 3**: Commit all changes and push to `origin/main`.
- [ ] **Step 4**: Verify deployment on Vercel production.
