# Desktop UI Scaling & Typography Enhancement Design

**Date**: 2026-10-07  
**Status**: Approved  
**Topic**: Scaling up Desktop/PC user experience across Home, Multiplayer Room, Game Arena, and Solo Play.

---

## 1. Problem Statement

The "เพลงไรวะ? (Pleng-Rai-Wa)" web app was built primarily mobile-first with narrow container limits (`max-w-md` ~448px, `max-w-2xl`), small typography (`text-xs` 12px, `text-sm` 14px), and a compact buzzer button (max 256px).

On desktop computers and laptops (1080p, 1440p displays):
1. **Empty space & narrow containers**: Cards and containers look like a mobile app floating in empty space.
2. **Small Thai typography**: 12px-14px text with Thai fonts (Kanit / Prompt) is small and strenuous to read at standard desktop viewing distance (60-80 cm).
3. **Undersized gameplay elements**: The buzzer button, lyrics prompt, and answer suggestions take up only a small fraction of the screen, reducing engagement and fun during party play.

---

## 2. Goals & Success Criteria

1. **Expansive Desktop Layouts**: Widen containers on `lg:` (1024px+) and `xl:` (1280px+) breakpoints to comfortably fit desktop screen real estate.
2. **Readable Typography**: Scale headings, labels, instructions, and lyrics text to larger font scales (`lg:text-base`, `lg:text-lg`, `lg:text-xl`, `lg:text-2xl`).
3. **Giant Interactive Buzzer**: Upgrade the buzzer button on desktop to `lg:w-80 lg:h-80` (320px) and `xl:w-96 xl:h-96` (384px) with large animated icons and clear hotkey indicators.
4. **Zero Mobile Regression**: Maintain 100% of current mobile (375px) and tablet (768px) layouts, touch targets, and ergonomics using Tailwind responsive prefixes (`lg:` and `xl:`).

---

## 3. Detailed Component Specifications

### 3.1 Home Page (`src/app/page.tsx`)
- **Hero Container**: Scale from `max-w-3xl` to `max-w-3xl lg:max-w-5xl`.
- **Hero Title**: Scale to `text-4xl sm:text-6xl lg:text-7xl`.
- **Hero Subtitle**: Scale to `text-base sm:text-lg lg:text-xl max-w-xl lg:max-w-2xl`.
- **Action Box (Create/Join Room)**:
  - Container: Widen from `max-w-md` to `max-w-md lg:max-w-xl`.
  - Padding: `p-6 lg:p-8`.
  - Create Room Button: `py-3.5 lg:py-4 text-base lg:text-lg`.
  - Room Code Input: `min-h-[44px] lg:min-h-[52px] text-base lg:text-lg tracking-widest`.
  - Rejoin Room / Solo links: `text-xs lg:text-sm py-2.5 lg:py-3`.
- **3 Game Modes Showcase**:
  - Container: `max-w-5xl lg:max-w-6xl`.
  - Cards: `p-5 lg:p-7`, icons `w-10 h-10 lg:w-12 lg:h-12`, title `text-base lg:text-lg`, description `text-xs lg:text-sm`.

### 3.2 Multiplayer Lobby View (`src/components/room/lobby-view.tsx`)
- **Header**: Container `max-w-5xl lg:max-w-6xl`.
- **Room Code Hero Card**:
  - Container: Widen from `max-w-2xl` to `max-w-2xl lg:max-w-4xl`.
  - Padding: `p-6 sm:p-8 lg:p-10`.
  - Room Code Badge: Font size `text-3xl sm:text-5xl lg:text-6xl tracking-widest font-black`.
  - Action Buttons (QR Code, Host Settings): `min-h-[44px] lg:min-h-[48px] text-xs sm:text-sm lg:text-base px-4 lg:px-6`.
- **Settings Summary Pill**:
  - Container: `max-w-2xl lg:max-w-4xl py-2 lg:py-2.5 text-xs lg:text-sm`.
- **Player Roster Grid**:
  - Grid: `grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3.5 lg:gap-4`.
  - Section Header: `text-base sm:text-lg lg:text-xl`.

### 3.3 Buzzer Button Component (`src/components/room/buzzer-button.tsx`)
- **Dimensions**:
  - Mobile/Tablet: `w-48 h-48 sm:w-56 sm:h-56 md:w-64 md:h-64`.
  - Large Desktop: `lg:w-80 lg:h-80 xl:w-96 xl:h-96`.
- **Pulse Wave**:
  - `w-56 h-56 sm:w-64 sm:h-64 md:w-80 md:h-80 lg:w-[380px] lg:h-[380px] xl:w-[440px] xl:h-[440px]`.
- **Interior Elements**:
  - Bell / Icons: `w-10 h-10 sm:w-12 sm:h-12 md:w-14 md:h-14 lg:w-16 lg:h-16 xl:w-20 xl:h-20`.
  - Label ("กดกริ่ง!"): `text-xl sm:text-2xl md:text-3xl lg:text-4xl xl:text-5xl`.
  - Hotkey Badge: `text-xs sm:text-sm lg:text-base px-2.5 py-0.5 lg:px-3.5 lg:py-1`.
  - Status Sub-text: `text-xs sm:text-sm lg:text-base`.

### 3.4 Game Arena View (`src/components/room/game-view.tsx`)
- **Top Header**:
  - Container: `max-w-6xl lg:max-w-7xl`.
  - Round Badge & Mode: `text-xs sm:text-sm lg:text-base px-3 lg:px-4 py-1 lg:py-1.5`.
  - Player Score Ribbon: Avatar `text-[13px] lg:text-base`, name truncation `max-w-[70px] sm:max-w-[90px] lg:max-w-[130px]`, score font `text-[11px] lg:text-xs`.
- **Center Stage Arena**:
  - Container: `max-w-4xl lg:max-w-5xl`.
  - AI Lyrics Reading Card: `max-w-lg lg:max-w-2xl p-4 lg:p-6`, lyrics text `text-base sm:text-lg lg:text-2xl`.
  - Audio Waveform Bar: `h-10 lg:h-12 px-4 lg:px-6`, text `text-xs lg:text-sm`.
  - Game Over Podium Card: `max-w-lg lg:max-w-2xl p-7 lg:p-9`.

### 3.5 Answer Modal (`src/components/room/answer-modal.tsx`)
- **Modal Container**: `max-w-md lg:max-w-xl p-5 lg:p-7`.
- **Header & Timer**: Timer badge `text-sm lg:text-base`, Title `text-lg lg:text-xl`.
- **Autocomplete Input**: `min-h-[46px] lg:min-h-[52px] text-base lg:text-lg px-4 lg:px-5`.
- **Suggestion Items**: `min-h-[44px] lg:min-h-[50px] text-sm lg:text-base px-4 py-2.5 lg:py-3`.

### 3.6 Round Reveal Card (`src/components/room/round-reveal-card.tsx`)
- **Card Container**: `max-w-lg lg:max-w-2xl p-6 lg:p-8`.
- **Song Title & Artist**: Song title `text-2xl sm:text-3xl lg:text-4xl`, artist `text-base sm:text-lg lg:text-xl`.
- **Winner Badge**: Larger avatar, text, and point badge.

### 3.7 Solo Play Mode (`src/app/play/solo/page.tsx`)
- **Main Arena**: Container `max-w-3xl lg:max-w-5xl p-4 sm:p-6 lg:p-8`.
- **Playlist Selection Bar**: `p-4 sm:p-5 lg:p-6`, selector select box `text-base lg:text-base py-2 lg:py-2.5`.
- **Play Controls**: Audio play buttons `min-h-[48px] lg:min-h-[54px]`, lyrics display `text-base sm:text-lg lg:text-xl`.
- **Guess Input & Suggestions**: `min-h-[44px] lg:min-h-[50px] text-base lg:text-lg`.

---

## 4. Verification & Testing Plan

1. **Automated Verification**:
   - `npm run build` to verify strict TypeScript and JSX typing across all modified components.
2. **Visual & Ergonomic Checks**:
   - Desktop view (1280px+ / 1920px): Ensure generous layout, legible typography, proportional giant buzzer.
   - Mobile view (375px): Ensure zero visual regressions, no horizontal overflow, touch targets `>= 44px`.
   - Light/Dark mode consistency: Ensure colors, gradients, and contrast remain sharp in both themes.
