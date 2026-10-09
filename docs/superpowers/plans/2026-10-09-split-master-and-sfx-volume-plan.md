# Implementation Plan: Split Master Volume & Sound Effects Volume

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Decouple audio volume controls into independent Master Volume (music/streams) and SFX Volume (procedural game effects) with dedicated sliders and mute toggles in the settings menu.

**Architecture:** 
1. Expand `src/lib/audio-volume.ts` with dedicated SFX volume state management, event subscriptions (`EVENT_SFX_VOLUME_CHANGE`), and composite gain calculation ($\text{Master} \times \text{SFX}$).
2. Update `src/components/common/settings-menu.tsx` to render two distinct volume controls (Master and SFX) with independent mute toggles and a sound test button.
3. Verify with unit tests in `src/lib/__tests__/audio-volume-sfx-split.test.ts` and ensure full build stability.

**Tech Stack:** Next.js 15, TypeScript, Web Audio API, Tailwind CSS, Lucide Icons, Vitest.

---

### Task 1: Core SFX State Engine & Event Bus
**Files:**
- Modify: `src/lib/audio-volume.ts`
- Modify: `src/lib/sound-effects.ts`
- Test: `src/lib/__tests__/audio-volume-sfx-split.test.ts`

- [ ] **Step 1: Write unit tests in `src/lib/__tests__/audio-volume-sfx-split.test.ts`**
- [ ] **Step 2: Run test to verify failure**
- [ ] **Step 3: Implement SFX volume getters, setters, mute toggles, event subscription, and composite gain logic**
- [ ] **Step 4: Run test to verify pass**
- [ ] **Step 5: Commit changes**

---

### Task 2: UI Controls in SettingsMenu
**Files:**
- Modify: `src/components/common/settings-menu.tsx`
- Test: `src/components/common/__tests__/settings-menu-volume.test.ts`

- [ ] **Step 1: Write test for SettingsMenu dual volume sliders and mute toggles**
- [ ] **Step 2: Run test to verify failure**
- [ ] **Step 3: Implement dual sliders for Master Volume and SFX Volume with test button**
- [ ] **Step 4: Run test to verify pass**
- [ ] **Step 5: Commit changes**

---

### Task 3: Full Verification, Documentation & Cleanup
**Files:**
- Modify: `idea.md`
- Modify: `docs/superpowers/plans/2026-10-09-split-master-and-sfx-volume-plan.md`

- [ ] **Step 1: Run complete vitest test suite**
- [ ] **Step 2: Run `npm run build`**
- [ ] **Step 3: Update `idea.md` and commit**
