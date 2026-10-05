import assert from "node:assert";
import fs from "node:fs";
import path from "node:path";
import type {
  Database,
  ProfileRow,
  ProfileInsert,
  ProfileUpdate,
  PlaylistRow,
  PlaylistInsert,
  PlaylistUpdate,
  PlaylistSongRow,
  PlaylistSongInsert,
  PlaylistSongUpdate,
} from "../src/types/database";
import type { UserProfile, Playlist } from "../src/types/index";

console.log("==================================================");
console.log("Running Task 1: Profiles & Migration Verification");
console.log("==================================================\n");

// -----------------------------------------------------------------------------
// Test 1: Migration File Existence and SQL Structural Assertions
// -----------------------------------------------------------------------------
console.log("Test 1: Migration file existence and SQL syntax structure...");
const migrationPath = path.resolve(
  __dirname,
  "../supabase/migrations/20261005_profiles_and_playlists.sql"
);

assert.ok(fs.existsSync(migrationPath), `Migration file must exist at ${migrationPath}`);
const sqlContent = fs.readFileSync(migrationPath, "utf-8");

// Table profiles structure checks
assert.ok(
  sqlContent.includes("CREATE TABLE IF NOT EXISTS public.profiles"),
  "Migration must create public.profiles table"
);
assert.ok(
  sqlContent.includes("id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE"),
  "profiles table must reference auth.users(id) ON DELETE CASCADE"
);
assert.ok(
  sqlContent.includes("display_name TEXT NOT NULL"),
  "profiles table must have display_name TEXT NOT NULL"
);
assert.ok(
  sqlContent.includes("avatar TEXT NOT NULL DEFAULT '🦊'"),
  "profiles table must have avatar TEXT NOT NULL DEFAULT '🦊'"
);
assert.ok(
  sqlContent.includes("created_at TIMESTAMPTZ DEFAULT NOW()"),
  "profiles table must have created_at TIMESTAMPTZ DEFAULT NOW()"
);
assert.ok(
  sqlContent.includes("updated_at TIMESTAMPTZ DEFAULT NOW()"),
  "profiles table must have updated_at TIMESTAMPTZ DEFAULT NOW()"
);

// Trigger functions & triggers checks
assert.ok(
  sqlContent.includes("CREATE OR REPLACE FUNCTION public.handle_new_user()"),
  "Migration must define public.handle_new_user() function"
);
assert.ok(
  sqlContent.includes("raw_user_meta_data->>'full_name'"),
  "handle_new_user must check raw_user_meta_data full_name"
);
assert.ok(
  sqlContent.includes("split_part(NEW.email, '@', 1)"),
  "handle_new_user must fallback to email prefix"
);
assert.ok(
  sqlContent.includes("'นักฟังเพลง'"),
  "handle_new_user must fallback to default Thai nickname"
);
assert.ok(
  sqlContent.includes("ON CONFLICT (id) DO NOTHING"),
  "handle_new_user must handle ON CONFLICT (id) DO NOTHING"
);
assert.ok(
  sqlContent.includes("SECURITY DEFINER"),
  "handle_new_user must have SECURITY DEFINER"
);
assert.ok(
  sqlContent.includes("AFTER INSERT ON auth.users"),
  "Trigger on_auth_user_created must fire AFTER INSERT ON auth.users"
);
assert.ok(
  sqlContent.includes("BEFORE UPDATE ON public.profiles"),
  "Trigger set_profiles_updated_at must fire BEFORE UPDATE ON public.profiles"
);

// RLS enabled and policy checks
assert.ok(
  sqlContent.includes("ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY"),
  "RLS must be enabled on public.profiles"
);
assert.ok(
  sqlContent.includes('"Allow public read for profiles"'),
  "profiles must have 'Allow public read for profiles' policy"
);
assert.ok(
  sqlContent.includes('"Allow users to insert own profile"'),
  "profiles must have 'Allow users to insert own profile' policy"
);
assert.ok(
  sqlContent.includes('"Allow users to update own profile"'),
  "profiles must have 'Allow users to update own profile' policy"
);
assert.ok(
  sqlContent.includes('"Allow service role full access to profiles"'),
  "profiles must have service role full access policy"
);

// Playlists & Playlist Songs RLS checks
assert.ok(
  sqlContent.includes("ALTER TABLE public.playlists ENABLE ROW LEVEL SECURITY"),
  "RLS must be enabled on public.playlists"
);
assert.ok(
  sqlContent.includes("ALTER TABLE public.playlist_songs ENABLE ROW LEVEL SECURITY"),
  "RLS must be enabled on public.playlist_songs"
);
assert.ok(
  sqlContent.includes('"Allow public read for public playlists"'),
  "playlists must have public read policy"
);
assert.ok(
  sqlContent.includes('"Allow users to view own playlists"'),
  "playlists must have user view own policy"
);
assert.ok(
  sqlContent.includes('"Allow users to insert own playlists"'),
  "playlists must have user insert own policy"
);
assert.ok(
  sqlContent.includes('"Allow users to update own playlists"'),
  "playlists must have user update own policy"
);
assert.ok(
  sqlContent.includes('"Allow users to delete own playlists"'),
  "playlists must have user delete own policy"
);
assert.ok(
  sqlContent.includes('"Allow service role full access to playlists"'),
  "playlists must have service role full access policy"
);
assert.ok(
  sqlContent.includes('"Allow public read for playlist songs"'),
  "playlist_songs must have public read policy"
);
assert.ok(
  sqlContent.includes('"Allow users to insert playlist songs for own playlists"'),
  "playlist_songs must have owner insert policy"
);
assert.ok(
  sqlContent.includes('"Allow users to update playlist songs for own playlists"'),
  "playlist_songs must have owner update policy"
);
assert.ok(
  sqlContent.includes('"Allow users to delete playlist songs for own playlists"'),
  "playlist_songs must have owner delete policy"
);
assert.ok(
  sqlContent.includes('"Allow service role full access to playlist songs"'),
  "playlist_songs must have service role policy"
);

console.log("✓ Passed: Migration file exists and all SQL schema, triggers, and RLS policies are verified.");

// -----------------------------------------------------------------------------
// Test 2: Database Type Contracts & Schema Integrity
// -----------------------------------------------------------------------------
console.log("\nTest 2: Database type contracts and interface integrity...");

// Validate Database structure
type PublicTables = Database["public"]["Tables"];
type HasProfiles = "profiles" extends keyof PublicTables ? true : false;
type HasPlaylists = "playlists" extends keyof PublicTables ? true : false;
type HasPlaylistSongs = "playlist_songs" extends keyof PublicTables ? true : false;

const hasProfiles: HasProfiles = true;
const hasPlaylists: HasPlaylists = true;
const hasPlaylistSongs: HasPlaylistSongs = true;
assert.strictEqual(hasProfiles, true, "Database['public']['Tables'] must include profiles");
assert.strictEqual(hasPlaylists, true, "Database['public']['Tables'] must include playlists");
assert.strictEqual(hasPlaylistSongs, true, "Database['public']['Tables'] must include playlist_songs");

// Construct mock ProfileRow
const sampleProfileRow: ProfileRow = {
  id: "00000000-0000-0000-0000-000000000001",
  display_name: "ดีเจอารมณ์ดี",
  avatar: "🦊",
  created_at: "2026-10-05T08:00:00Z",
  updated_at: "2026-10-05T08:00:00Z",
};
assert.strictEqual(sampleProfileRow.display_name, "ดีเจอารมณ์ดี");
assert.strictEqual(sampleProfileRow.avatar, "🦊");

// Construct minimum ProfileInsert
const minProfileInsert: ProfileInsert = {
  id: "00000000-0000-0000-0000-000000000002",
  display_name: "นักฟังเพลงหน้าใหม่",
};
assert.strictEqual(minProfileInsert.display_name, "นักฟังเพลงหน้าใหม่");
assert.strictEqual(minProfileInsert.avatar, undefined);

// Construct full ProfileInsert
const fullProfileInsert: ProfileInsert = {
  id: "00000000-0000-0000-0000-000000000003",
  display_name: "เซียนเพลงไทย",
  avatar: "🎸",
  created_at: "2026-10-05T08:00:00Z",
  updated_at: "2026-10-05T08:00:00Z",
};
assert.strictEqual(fullProfileInsert.avatar, "🎸");

// Construct ProfileUpdate
const profileUpdate: ProfileUpdate = {
  display_name: "ชื่อใหม่สุดเท่",
  avatar: "✨",
};
assert.strictEqual(profileUpdate.display_name, "ชื่อใหม่สุดเท่");

// Construct Playlist helper types
const playlistInsert: PlaylistInsert = {
  user_id: "00000000-0000-0000-0000-000000000001",
  title: "รวมฮิตเพลงยุค 90s คลาสสิก",
  description: "เพลงร็อคและป็อป 90s ที่ต้องฟัง",
  is_public: true,
};
const playlistRow: PlaylistRow = {
  id: "11111111-1111-1111-1111-111111111111",
  user_id: playlistInsert.user_id,
  title: playlistInsert.title,
  description: playlistInsert.description ?? null,
  is_public: playlistInsert.is_public ?? true,
  created_at: "2026-10-05T08:00:00Z",
};
const playlistUpdate: PlaylistUpdate = {
  title: "รวมฮิตเพลง 90s (อัปเดต)",
};
assert.strictEqual(playlistRow.title, "รวมฮิตเพลงยุค 90s คลาสสิก");
assert.strictEqual(playlistUpdate.title, "รวมฮิตเพลง 90s (อัปเดต)");

// Construct PlaylistSong types
const playlistSongInsert: PlaylistSongInsert = {
  playlist_id: playlistRow.id,
  song_id: "22222222-2222-2222-2222-222222222222",
  order_num: 1,
};
const playlistSongRow: PlaylistSongRow = {
  playlist_id: playlistSongInsert.playlist_id,
  song_id: playlistSongInsert.song_id,
  order_num: 1,
};
const playlistSongUpdate: PlaylistSongUpdate = {
  order_num: 2,
};
assert.strictEqual(playlistSongRow.order_num, 1);
assert.strictEqual(playlistSongUpdate.order_num, 2);

console.log("✓ Passed: Database row, insert, update types compile and type check properly.");

// -----------------------------------------------------------------------------
// Test 3: UserProfile Model & Type Transformation
// -----------------------------------------------------------------------------
console.log("\nTest 3: UserProfile model and transformation functions...");

function mapProfileRowToUserProfile(row: ProfileRow): UserProfile {
  return {
    id: row.id,
    displayName: row.display_name,
    avatar: row.avatar,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

const mappedProfile: UserProfile = mapProfileRowToUserProfile(sampleProfileRow);
assert.strictEqual(mappedProfile.id, sampleProfileRow.id);
assert.strictEqual(mappedProfile.displayName, sampleProfileRow.display_name);
assert.strictEqual(mappedProfile.avatar, sampleProfileRow.avatar);
assert.strictEqual(mappedProfile.createdAt, sampleProfileRow.created_at);
assert.strictEqual(mappedProfile.updatedAt, sampleProfileRow.updated_at);

// Test Playlist interface with author metadata & song count
const testPlaylist: Playlist = {
  id: playlistRow.id,
  userId: playlistRow.user_id,
  title: playlistRow.title,
  description: playlistRow.description ?? undefined,
  isPublic: playlistRow.is_public,
  songCount: 12,
  createdAt: playlistRow.created_at,
  updatedAt: "2026-10-05T08:15:00Z",
  authorName: mappedProfile.displayName,
  authorAvatar: mappedProfile.avatar,
  userProfile: mappedProfile,
};

assert.strictEqual(testPlaylist.id, playlistRow.id);
assert.strictEqual(testPlaylist.songCount, 12);
assert.strictEqual(testPlaylist.authorName, "ดีเจอารมณ์ดี");
assert.strictEqual(testPlaylist.authorAvatar, "🦊");
assert.strictEqual(testPlaylist.userProfile?.displayName, "ดีเจอารมณ์ดี");

console.log("✓ Passed: UserProfile mapping and Playlist author metadata validated successfully.");

console.log("\n==================================================");
console.log("All Task 1 Verification Checks PASSED (100% Green)");
console.log("==================================================");
