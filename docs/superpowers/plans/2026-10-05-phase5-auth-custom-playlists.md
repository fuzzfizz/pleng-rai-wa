# Implementation Plan - Phase 5: ระบบสมาชิกและ Custom Playlists

**Project:** เพลงไรวะ (Pleng-Rai-Wa)  
**Spec Document:** [`docs/superpowers/specs/2026-10-05-phase5-auth-custom-playlists-design.md`](file:///D:/pleng-rai-wa/docs/superpowers/specs/2026-10-05-phase5-auth-custom-playlists-design.md)  
**Target Branch:** `feature/phase-5-auth-playlists`  

---

## Global Constraints & Binding Rules
1. **100% Free Public Feasibility**: Runs on Supabase Free Tier + Vercel Hobby Tier. Zero external paid APIs.
2. **Guest-First Policy**: All visitors can play Solo and Join/Host rooms as Guests without mandatory login. Login is prompted only when creating, saving, or editing playlists, or updating persistent profile stats.
3. **Anti-Cheat Protection**: Songs from custom playlists must remain sanitized prior to round reveal (`revealing` status).
4. **Mobile-First Touch Ergonomics**: Minimum 44px touch targets across playlist cards, song selectors, audio preview controls, and modal buttons.
5. **Clean TypeScript Build**: `npm run build` and `npx tsc --noEmit` must exit with code 0.

---

## Tasks Breakdown

### Task 1: Database Migration & Schema Updates
- **Brief**: Create migration `supabase/migrations/20261005_profiles_and_playlists.sql` defining `public.profiles` (`id REFERENCES auth.users(id) ON DELETE CASCADE`, `display_name`, `avatar`, `created_at`, `updated_at`), trigger `on_auth_user_created` for auto-profile creation, and RLS policies for `profiles`, `playlists`, and `playlist_songs`.
- **Files**:
  - `supabase/migrations/20261005_profiles_and_playlists.sql`
  - `src/types/database.ts`
  - `src/types/index.ts`
- **Verification**: `scripts/test-profiles-migration.ts` verifying table definitions, RLS structure, and TypeScript compilation.

### Task 2: Auth Context, Supabase Client & User Profile Management
- **Brief**: Implement client-side `useAuth` hook (`src/hooks/use-auth.ts`) handling `onAuthStateChange`, profile sync, `signInWithEmail`, `signUpWithEmail`, `signInWithGoogle`, `signOut`, and `updateProfile`. Implement `AuthModal` (`src/components/auth/auth-modal.tsx`), `ProfileModal` (`src/components/auth/profile-modal.tsx` with 20 emoji avatar choices), and `NavHeader` (`src/components/common/nav-header.tsx`). Connect `NavHeader` to `src/app/page.tsx`.
- **Files**:
  - `src/hooks/use-auth.ts`
  - `src/components/auth/auth-modal.tsx`
  - `src/components/auth/profile-modal.tsx`
  - `src/components/common/nav-header.tsx`
  - `src/app/page.tsx`
- **Verification**: `scripts/test-auth-components.ts` testing auth hook interfaces, modals render/exports, and nickname prefilling.

### Task 3: Custom Playlist Backend Service & Song Joining
- **Brief**: Implement `PlaylistService` (`src/lib/services/playlist-service.ts`) with typed CRUD operations: `getUserPlaylists`, `getPublicPlaylists`, `getPlaylistById`, `createPlaylist`, `updatePlaylist`, `deletePlaylist`. Modify `SongService.getRandomSongs` (`src/lib/services/song-service.ts`) to support `playlistId` option.
- **Files**:
  - `src/lib/services/playlist-service.ts`
  - `src/lib/services/song-service.ts`
- **Verification**: `scripts/test-playlist-service.ts` testing playlist creation, song addition, song ordering, update, delete, and song pool selection from playlists.

### Task 4: Custom Playlist Management UI
- **Brief**: Implement the user-facing playlist catalog and editor:
  - `/playlists/page.tsx`: Catalog displaying user's playlists and public playlists, song count, duration, action buttons.
  - `/playlists/new/page.tsx` and `/playlists/[id]/edit/page.tsx`: Interactive playlist editor with Title, Description, Public toggle, Song search with 5s audio preview, drag/reorder, minimum 5 songs validation badge.
- **Files**:
  - `src/app/playlists/page.tsx`
  - `src/app/playlists/new/page.tsx`
  - `src/app/playlists/[id]/edit/page.tsx`
  - `src/components/playlist/playlist-editor.tsx`
  - `src/components/playlist/playlist-card.tsx`
- **Verification**: `scripts/test-playlist-ui.ts` asserting component exports, prop contracts, song duration calculations, and minimum 5 songs validation logic.

### Task 5: Gameplay Integration (Multiplayer Room Settings & Solo Practice)
- **Brief**: Integrate custom playlists into game modes:
  - `src/components/room/host-settings-modal.tsx`: Add "แหล่งเพลง (Song Source)" with Custom Playlist selector.
  - `src/app/api/room/[code]/next-round/route.ts`: Support picking songs from `room.settings.playlistId`.
  - `src/app/play/solo/page.tsx`: Add playlist selection dropdown to practice custom playlists solo.
- **Files**:
  - `src/components/room/host-settings-modal.tsx`
  - `src/app/api/room/[code]/next-round/route.ts`
  - `src/app/play/solo/page.tsx`
- **Verification**: `scripts/test-playlist-gameplay.ts` testing host settings payload with playlistId, API round drawing from playlist, and solo playlist loading.

### Task 6: Comprehensive Verification, End-to-End Tests & Documentation Update
- **Brief**: Run all test suites across Phase 1 through 5, perform `npm run build`, update `PLAN.md` with completed Phase 5 tasks, and update `README.md`.
- **Files**:
  - `PLAN.md`
  - `README.md`
- **Verification**: All 8+ test suites green, `npm run build` exits 0 with 0 errors.
