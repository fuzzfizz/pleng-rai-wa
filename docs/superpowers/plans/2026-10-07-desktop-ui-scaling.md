# Desktop UI Scaling & Typography Enhancement Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Expand and scale the user interface on desktop monitors (1024px+ and 1280px+) across Home, Lobby, Game Arena, and Solo Play without compromising mobile or tablet layouts.

**Architecture:** Utilize Tailwind CSS responsive prefixes (`lg:` and `xl:`) to widen containers (`max-w-xl`, `max-w-4xl`, `max-w-6xl`), scale up typography for Thai fonts (Kanit / Prompt), and render giant interactive gameplay elements (up to 384px buzzer).

**Tech Stack:** Next.js 16 (App Router), React 19, Tailwind CSS v4, Lucide React, TypeScript 5.

## Global Constraints

- **Mobile First Preservation**: All existing mobile classes (< 1024px) must remain functional with zero horizontal overflow and minimum 44px touch targets.
- **Tailwind Version**: Tailwind CSS v4 is used with `@import "tailwindcss";` in `src/app/globals.css`.
- **Theme Support**: All changes must preserve both Light and Dark mode styling (`dark:` classes).
- **TypeScript Strictness**: Zero TypeScript compilation or build errors on `npm run build`.

---

### Task 1: Home Page Desktop Scaling

**Files:**
- Modify: `src/app/page.tsx:145-285`

**Interfaces:**
- Consumes: Next.js routing, Lucide icons, `NavHeader`
- Produces: Expanded desktop hero, wider action card (`lg:max-w-xl`), and spacious 3-column game modes showcase (`lg:max-w-6xl`).

- [ ] **Step 1: Update Hero Section and Action Box responsive classes**

Update `src/app/page.tsx`:
- Scale Hero container: `max-w-3xl` to `max-w-3xl lg:max-w-5xl`.
- Scale Hero Heading: `text-4xl sm:text-6xl lg:text-7xl mb-4 lg:mb-6`.
- Scale Hero Description: `text-base sm:text-lg lg:text-xl max-w-xl lg:max-w-2xl mb-8 lg:mb-10`.
- Scale Action Box: `max-w-md` to `max-w-md lg:max-w-xl p-6 lg:p-8`.
- Scale "สร้างห้องเล่นกับเพื่อน" button: `py-3.5 lg:py-4 px-6 text-base lg:text-lg`.
- Scale Room Code Input: `min-h-[44px] lg:min-h-[52px] text-base sm:text-sm lg:text-lg px-4 lg:px-5`.
- Scale Submit Arrow Button: `min-h-[44px] min-w-[44px] lg:min-h-[52px] lg:min-w-[52px]`.
- Scale Rejoin Room shortcut & Solo practice link: `text-xs lg:text-sm py-2.5 lg:py-3`.

- [ ] **Step 2: Update 3 Game Modes Grid responsive classes**

In `src/app/page.tsx`:
- Scale section container: `max-w-5xl` to `max-w-5xl lg:max-w-6xl py-6 lg:py-10`.
- Scale Grid cards: `p-5 lg:p-7`.
- Scale icon containers: `w-10 h-10 lg:w-12 lg:h-12`.
- Scale mode titles: `text-base lg:text-lg font-bold`.
- Scale descriptions: `text-xs lg:text-sm`.

- [ ] **Step 3: Verify build with next build**

Run: `npx next build` (or check compilation).
Expected: Successful compile with no JSX or type errors.

- [ ] **Step 4: Commit changes**

```bash
git add src/app/page.tsx
git commit -m "feat(ui): scale home page layout and typography for desktop"
```

---

### Task 2: Buzzer Button Desktop Sizing

**Files:**
- Modify: `src/components/room/buzzer-button.tsx:100-225`

**Interfaces:**
- Consumes: `BuzzerStatus`, `soundEffects`
- Produces: Giant interactive buzzer button scaling up to 320px (`lg:`) and 384px (`xl:`), with proportional icons, typography, and pulse animation.

- [ ] **Step 1: Update outer pulse wave and main button classes**

In `src/components/room/buzzer-button.tsx`:
- Pulse wave:
  Change `w-56 h-56 sm:w-64 sm:h-64 md:w-80 md:h-80` to:
  `w-56 h-56 sm:w-64 sm:h-64 md:w-80 md:h-80 lg:w-[380px] lg:h-[380px] xl:w-[440px] xl:h-[440px]`.
- Main button:
  Change `w-48 h-48 sm:w-56 sm:h-56 md:w-64 md:h-64` to:
  `w-48 h-48 sm:w-56 sm:h-56 md:w-64 md:h-64 lg:w-80 lg:h-80 xl:w-96 xl:h-96`.

- [ ] **Step 2: Update internal icons, text sizes and badges**

In `src/components/room/buzzer-button.tsx`:
- Ready state:
  - Icon container: `p-3 sm:p-3.5 md:p-4 lg:p-5 xl:p-6 mb-2 lg:mb-3`.
  - Bell icon: `w-10 h-10 sm:w-12 sm:h-12 md:w-14 md:h-14 lg:w-18 lg:h-18 xl:w-22 xl:h-22`.
  - "กดกริ่ง!" text: `text-xl sm:text-2xl md:text-3xl lg:text-4xl xl:text-5xl font-black`.
  - "(SPACE)" badge: `text-xs sm:text-sm lg:text-base px-2.5 py-0.5 lg:px-4 lg:py-1`.
- Buzzed by me state:
  - Sparkles icon: `w-10 h-10 sm:w-12 sm:h-12 md:w-14 md:h-14 lg:w-18 lg:h-18 xl:w-22 xl:h-22`.
  - "คุณได้สิทธิ์ตอบ!" text: `text-base sm:text-lg md:text-xl lg:text-2xl xl:text-3xl font-black`.
- Locked by other / Excluded / Idle states:
  - Icons and text scaled up with `lg:` and `xl:`.
- Helper cue text below button:
  - Text: `text-xs sm:text-sm lg:text-base`.
  - Kbd tag: `px-1.5 py-0.5 lg:px-2 lg:py-1 text-xs lg:text-sm`.

- [ ] **Step 3: Verify build**

Run: `npx next build`
Expected: PASS

- [ ] **Step 4: Commit changes**

```bash
git add src/components/room/buzzer-button.tsx
git commit -m "feat(ui): enlarge buzzer button and hotkey cues for desktop"
```

---

### Task 3: Lobby View Desktop Expansion

**Files:**
- Modify: `src/components/room/lobby-view.tsx:190-360`

**Interfaces:**
- Consumes: Room players, settings, host permissions
- Produces: Wider lobby view with prominent room code, larger copy button, expanded host buttons, and comfortable player grid.

- [ ] **Step 1: Scale Lobby Navigation and Hero Card**

In `src/components/room/lobby-view.tsx`:
- Header container: `max-w-5xl` to `max-w-5xl lg:max-w-6xl`.
- Header buttons (Leave, TV Mode, SFX): add `lg:px-4 lg:py-2.5 lg:text-sm`.
- Main content container: `max-w-5xl` to `max-w-5xl lg:max-w-6xl py-6 lg:py-10 space-y-6 lg:space-y-8`.
- Room Code Hero Card:
  - Container: `max-w-2xl` to `max-w-2xl lg:max-w-4xl p-6 sm:p-8 lg:p-10`.
  - Subtitle: `text-xs sm:text-sm lg:text-base`.
  - Code Display box: `px-6 py-3 lg:px-10 lg:py-5`.
  - Code text: `text-3xl sm:text-5xl lg:text-6xl font-black tracking-widest`.
  - Action buttons (QR Code, Host Settings): `px-4 py-2.5 lg:px-6 lg:py-3.5 text-xs sm:text-sm lg:text-base min-h-[44px] lg:min-h-[50px]`.

- [ ] **Step 2: Scale Settings Summary Pill and Player Roster Grid**

In `src/components/room/lobby-view.tsx`:
- Settings Summary pill container: `max-w-2xl` to `max-w-2xl lg:max-w-4xl px-4 py-2 lg:px-6 lg:py-3 text-xs lg:text-sm`.
- Players Roster section header: `text-base sm:text-lg lg:text-xl font-bold`.
- Ready badge: `text-xs lg:text-sm px-3 py-1 lg:px-4 lg:py-1.5`.
- Players Grid: `gap-3.5 lg:gap-5 grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4`.

- [ ] **Step 3: Verify build**

Run: `npx next build`
Expected: PASS

- [ ] **Step 4: Commit changes**

```bash
git add src/components/room/lobby-view.tsx
git commit -m "feat(ui): expand lobby view containers and typography for desktop"
```

---

### Task 4: In-Game Arena, Answer Modal & Round Reveal Scaling

**Files:**
- Modify: `src/components/room/game-view.tsx:195-385`
- Modify: `src/components/room/answer-modal.tsx:80-210`
- Modify: `src/components/room/round-reveal-card.tsx:75-220`

**Interfaces:**
- Consumes: Realtime game state, active question, answer input
- Produces: Enhanced arena view on desktop with larger scoreboard ribbon, spacious lyrics reading card, and comfortably sized answer modal.

- [ ] **Step 1: Scale Game Arena View (`src/components/room/game-view.tsx`)**

- Top header: `max-w-6xl` to `max-w-6xl lg:max-w-7xl px-4 py-3 sm:px-6 lg:py-4`.
- Round badge & game mode pill: `text-xs sm:text-sm lg:text-base px-3 py-1 lg:px-4 lg:py-1.5`.
- Scoreboard player pills:
  - Avatar: `text-[13px] lg:text-base`.
  - Name: `max-w-[70px] sm:max-w-[90px] lg:max-w-[130px] lg:text-sm`.
  - Score badge: `text-[11px] lg:text-xs px-1.5 lg:px-2`.
- Center arena container: `max-w-4xl` to `max-w-4xl lg:max-w-5xl p-4 sm:p-6 lg:p-8`.
- AI lyrics card: `max-w-lg` to `max-w-lg lg:max-w-2xl p-4 lg:p-6`.
- Lyrics text: `text-base sm:text-lg lg:text-2xl font-semibold`.
- Audio waveform pill: `h-10 lg:h-12 px-4 lg:px-6 text-xs lg:text-sm`.
- Game over summary card: `max-w-lg lg:max-w-2xl p-7 lg:p-9`.

- [ ] **Step 2: Scale Answer Modal (`src/components/room/answer-modal.tsx`)**

- Modal card: `max-w-md` to `max-w-md lg:max-w-xl p-5 sm:p-6 lg:p-8`.
- Timer indicator & title: `text-lg sm:text-xl lg:text-2xl`.
- Autocomplete / Text input: `min-h-[46px] lg:min-h-[52px] text-base lg:text-lg px-4 lg:px-5`.
- Autocomplete suggestion items: `py-2.5 lg:py-3.5 px-3.5 lg:px-4 text-sm lg:text-base`.
- Multiple choice option buttons: `min-h-[48px] lg:min-h-[56px] text-sm lg:text-base p-3.5 lg:p-4`.

- [ ] **Step 3: Scale Round Reveal Card (`src/components/room/round-reveal-card.tsx`)**

- Card container: `max-w-md` / `max-w-lg` to `max-w-lg lg:max-w-2xl p-6 lg:p-8`.
- Album cover art / icon: `w-20 h-20 sm:w-24 sm:h-24 lg:w-32 lg:h-32`.
- Song Title: `text-2xl sm:text-3xl lg:text-4xl`.
- Song Artist: `text-base sm:text-lg lg:text-xl`.
- Next Round button: `py-3.5 lg:py-4 text-base lg:text-lg`.

- [ ] **Step 4: Verify build**

Run: `npx next build`
Expected: PASS

- [ ] **Step 5: Commit changes**

```bash
git add src/components/room/game-view.tsx src/components/room/answer-modal.tsx src/components/room/round-reveal-card.tsx
git commit -m "feat(ui): scale game arena, answer modal, and reveal card for desktop"
```

---

### Task 5: Solo Play Page Desktop Scaling

**Files:**
- Modify: `src/app/play/solo/page.tsx:480-720`

**Interfaces:**
- Consumes: Demo songs pool, playlist service
- Produces: Spacious solo play experience with larger playlist picker, audio controls, and lyrics text.

- [ ] **Step 1: Scale Solo Page Header and Container**

In `src/app/play/solo/page.tsx`:
- Header: `px-4 sm:px-8 lg:px-12 py-3 lg:py-4`.
- Title: `text-sm sm:text-base lg:text-lg`.
- Score badge: `text-xs lg:text-sm px-3 py-1.5 lg:px-4 lg:py-2`.
- Main Arena: `max-w-3xl` to `max-w-3xl lg:max-w-5xl p-4 sm:p-6 lg:p-8 gap-6 lg:gap-8`.

- [ ] **Step 2: Scale Playlist Selector & Question Arena**

In `src/app/play/solo/page.tsx`:
- Playlist selector card: `p-4 sm:p-5 lg:p-6`.
- Selector dropdown: `text-base sm:text-sm lg:text-base min-h-[44px] lg:min-h-[50px]`.
- Play audio / buzzer / AI lyrics buttons: `min-h-[48px] lg:min-h-[56px] text-sm lg:text-base`.
- Lyrics text: `text-base sm:text-lg lg:text-xl`.
- Autocomplete input: `min-h-[44px] lg:min-h-[52px] text-base lg:text-lg`.
- Suggestions list: items `py-2.5 lg:py-3.5 text-sm lg:text-base`.

- [ ] **Step 3: Verify build**

Run: `npx next build`
Expected: PASS

- [ ] **Step 4: Commit changes**

```bash
git add src/app/play/solo/page.tsx
git commit -m "feat(ui): scale solo play mode arena and controls for desktop"
```

---

### Task 6: End-to-End Build Verification & Responsive Lint Check

**Files:**
- Test / Verify all modified components.

- [ ] **Step 1: Run production build**

Run: `npm run build`
Expected: 0 errors, successful Next.js route generation.

- [ ] **Step 2: Verify git status and clean tree**

Run: `git status`
Expected: Clean working tree or only expected plan/spec commits.
