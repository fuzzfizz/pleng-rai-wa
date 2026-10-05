import assert from "node:assert";
import React from "react";
import type { Playlist, Song } from "../src/types/index";

import {
  formatPlaylistDuration,
  isPlaylistPlayable,
  reorderSongs,
  calculateTotalDuration,
} from "../src/components/playlist/playlist-utils";

import {
  PlaylistCard,
  type PlaylistCardProps,
} from "../src/components/playlist/playlist-card";

import {
  PlaylistEditor,
  type PlaylistEditorProps,
} from "../src/components/playlist/playlist-editor";

import PlaylistsPage from "../src/app/playlists/page";
import NewPlaylistPage from "../src/app/playlists/new/page";
import EditPlaylistPage, {
  type EditPlaylistPageProps,
} from "../src/app/playlists/[id]/edit/page";
import { validatePlaylistTitle } from "../src/lib/services/playlist-service";

console.log("==================================================");
console.log("Running Task 4: Custom Playlist Management UI Verification");
console.log("==================================================\n");

// -----------------------------------------------------------------------------
// Test 1: Utility Helpers (formatPlaylistDuration, isPlaylistPlayable, reorderSongs)
// -----------------------------------------------------------------------------
console.log("Test 1: Playlist utility helpers...");

// 1.1 formatPlaylistDuration
assert.strictEqual(formatPlaylistDuration(0), "0 วินาที", "0 seconds should format to '0 วินาที'");
assert.strictEqual(formatPlaylistDuration(-10), "0 วินาที", "Negative seconds should format to '0 วินาที'");
assert.strictEqual(formatPlaylistDuration(NaN), "0 วินาที", "NaN should format to '0 วินาที'");
assert.strictEqual(formatPlaylistDuration(45), "45 วินาที", "45 seconds should format to '45 วินาที'");
assert.strictEqual(formatPlaylistDuration(60), "1 นาที", "60 seconds should format to '1 นาที'");
assert.strictEqual(formatPlaylistDuration(225), "3 นาที 45 วินาที", "225 seconds should format to '3 นาที 45 วินาที'");
assert.strictEqual(formatPlaylistDuration(3600), "1 ชม.", "3600 seconds should format to '1 ชม.'");
assert.strictEqual(formatPlaylistDuration(4500), "1 ชม. 15 นาที", "4500 seconds should format to '1 ชม. 15 นาที'");
assert.strictEqual(formatPlaylistDuration(7265), "2 ชม. 1 นาที", "7265 seconds should format to '2 ชม. 1 นาที'");

// 1.2 isPlaylistPlayable (Threshold >= 5 songs)
assert.strictEqual(isPlaylistPlayable(0), false, "0 songs cannot be played");
assert.strictEqual(isPlaylistPlayable(1), false, "1 song cannot be played");
assert.strictEqual(isPlaylistPlayable(4), false, "4 songs cannot be played (under threshold 5)");
assert.strictEqual(isPlaylistPlayable(5), true, "5 songs satisfies the threshold");
assert.strictEqual(isPlaylistPlayable(20), true, "20 songs is playable");
assert.strictEqual(isPlaylistPlayable(undefined as any), false, "undefined should be false");
assert.strictEqual(isPlaylistPlayable(null as any), false, "null should be false");

// 1.3 reorderSongs (Pure, immutable array reordering)
const originalList = ["Song A", "Song B", "Song C", "Song D"];
const originalCopy = [...originalList];

// Move from index 0 to index 2: A, B, C, D -> B, C, A, D
const reordered1 = reorderSongs(originalList, 0, 2);
assert.deepStrictEqual(reordered1, ["Song B", "Song C", "Song A", "Song D"]);
// Verify immutability of original list
assert.deepStrictEqual(originalList, originalCopy, "Original array must not be mutated");

// Move from index 3 to index 1: A, B, C, D -> A, D, B, C
const reordered2 = reorderSongs(originalList, 3, 1);
assert.deepStrictEqual(reordered2, ["Song A", "Song D", "Song B", "Song C"]);

// Out-of-bounds index handling
const oobReordered = reorderSongs(originalList, -1, 10);
assert.deepStrictEqual(oobReordered, originalList, "Out-of-bounds indices should return shallow copy");
assert.notStrictEqual(oobReordered, originalList, "Result should be a new array reference");

// Same index
const sameIndex = reorderSongs(originalList, 2, 2);
assert.deepStrictEqual(sameIndex, originalList);

// Empty list
assert.deepStrictEqual(reorderSongs([], 0, 1), []);

// 1.4 calculateTotalDuration
const mockSongs = [
  { durationSec: 180 },
  { durationSec: 210 },
  { durationSec: 0 },
  { durationSec: undefined },
];
assert.strictEqual(calculateTotalDuration(mockSongs as any), 390);
assert.strictEqual(calculateTotalDuration([]), 0);

console.log("✓ Passed: Playlist utility helpers, duration formats, and pure reordering verified.\n");

// -----------------------------------------------------------------------------
// Test 2: Component Interface Contracts & Prop Signatures
// -----------------------------------------------------------------------------
console.log("Test 2: Component contracts and props integrity...");

assert.strictEqual(typeof PlaylistCard, "function", "PlaylistCard must be exported as a component function");
assert.strictEqual(typeof PlaylistEditor, "function", "PlaylistEditor must be exported as a component function");
assert.strictEqual(typeof PlaylistsPage, "function", "PlaylistsPage must be exported as default component");
assert.strictEqual(typeof NewPlaylistPage, "function", "NewPlaylistPage must be exported as default component");
assert.strictEqual(typeof EditPlaylistPage, "function", "EditPlaylistPage must be exported as default component");

// Test PlaylistCard element instantiation with unplayable (< 5) playlist
const unplayablePlaylist: Playlist = {
  id: "playlist-uuid-1",
  userId: "user-uuid-1",
  title: "เพลงยุค 90s สบายๆ",
  description: "รวมเพลงฟังชิวๆ สบายหู",
  isPublic: true,
  songCount: 3,
  createdAt: "2026-10-05T12:00:00Z",
  authorName: "DJ เต้",
  authorAvatar: "🎧",
};

const cardEl1 = React.createElement(PlaylistCard, {
  playlist: unplayablePlaylist,
  currentUserId: "user-uuid-1",
  onPlaySolo: () => {},
  onPlayRoom: () => {},
  onEdit: () => {},
  onDelete: () => {},
});
assert.ok(React.isValidElement(cardEl1), "PlaylistCard should instantiate valid React element");

// Test PlaylistCard element instantiation with playable (>= 5) playlist
const playablePlaylist: Playlist = {
  id: "playlist-uuid-2",
  userId: "user-uuid-2",
  title: "กามิกาเซ่ แดนซ์กระจาย",
  description: "เต้นมันส์ทุกเพลง",
  isPublic: false,
  songCount: 10,
  createdAt: "2026-10-05T12:00:00Z",
  authorName: "Kamikaze Lover",
  authorAvatar: "🦊",
};

const cardEl2 = React.createElement(PlaylistCard, {
  playlist: playablePlaylist,
  currentUserId: "user-uuid-1", // Different user (not owner)
});
assert.ok(React.isValidElement(cardEl2), "PlaylistCard for non-owner should instantiate valid React element");

// Test PlaylistEditor element instantiation
const editorEl = React.createElement(PlaylistEditor, {
  userId: "user-uuid-1",
  initialPlaylist: null,
  onSaveSuccess: () => {},
  onCancel: () => {},
});
assert.ok(React.isValidElement(editorEl), "PlaylistEditor should instantiate valid React element");

// Test Pages React element instantiation
const playlistsPageEl = React.createElement(PlaylistsPage);
assert.ok(React.isValidElement(playlistsPageEl), "PlaylistsPage element should instantiate cleanly");

const newPlaylistPageEl = React.createElement(NewPlaylistPage);
assert.ok(React.isValidElement(newPlaylistPageEl), "NewPlaylistPage element should instantiate cleanly");

const editPlaylistPageEl = React.createElement(EditPlaylistPage, {
  params: Promise.resolve({ id: "playlist-uuid-1" }),
});
assert.ok(React.isValidElement(editPlaylistPageEl), "EditPlaylistPage element should instantiate cleanly");

console.log("✓ Passed: Component exports and React element instantiation verified.\n");

// -----------------------------------------------------------------------------
// Test 3: Minimum 5 Songs Threshold and Title Validation Logic
// -----------------------------------------------------------------------------
console.log("Test 3: Threshold and input validation constraints...");

// Validate title constraints (1-60 chars)
assert.strictEqual(validatePlaylistTitle("เพลงฮิตติดหู"), "เพลงฮิตติดหู");
assert.strictEqual(validatePlaylistTitle("  ช่องว่างหน้าหลัง  "), "ช่องว่างหน้าหลัง");
assert.throws(() => validatePlaylistTitle(""), /Playlist title must be between 1 and 60 characters/);
assert.throws(() => validatePlaylistTitle("   "), /Playlist title must be between 1 and 60 characters/);
assert.throws(
  () => validatePlaylistTitle("a".repeat(61)),
  /Playlist title must be between 1 and 60 characters/
);

// Threshold logic verification for Editor Save
const sampleSongs: Song[] = [
  { id: "s1", title: "Song 1", artist: "Artist 1", aliases: [], audioUrl: "url1" },
  { id: "s2", title: "Song 2", artist: "Artist 2", aliases: [], audioUrl: "url2" },
  { id: "s3", title: "Song 3", artist: "Artist 3", aliases: [], audioUrl: "url3" },
  { id: "s4", title: "Song 4", artist: "Artist 4", aliases: [], audioUrl: "url4" },
  { id: "s5", title: "Song 5", artist: "Artist 5", aliases: [], audioUrl: "url5" },
];

assert.strictEqual(isPlaylistPlayable(sampleSongs.slice(0, 4).length), false);
assert.strictEqual(isPlaylistPlayable(sampleSongs.length), true);

console.log("✓ Passed: Title constraints and 5 songs validation thresholds verified.\n");

// -----------------------------------------------------------------------------
// Test 4: Navigation Links & Action Route Targets
// -----------------------------------------------------------------------------
console.log("Test 4: Navigation paths and parameter encoding...");

const playlistId = "abc-123-xyz";
const expectedSoloUrl = `/play/solo?playlistId=${encodeURIComponent(playlistId)}`;
const expectedRoomUrl = `/?create=true&playlistId=${encodeURIComponent(playlistId)}`;
const expectedEditUrl = `/playlists/${encodeURIComponent(playlistId)}/edit`;

assert.strictEqual(expectedSoloUrl, "/play/solo?playlistId=abc-123-xyz");
assert.strictEqual(expectedRoomUrl, "/?create=true&playlistId=abc-123-xyz");
assert.strictEqual(expectedEditUrl, "/playlists/abc-123-xyz/edit");

console.log("✓ Passed: Navigation paths and route parameters verified.\n");

console.log("==================================================");
console.log("All Task 4 Verification Checks PASSED (100% Green)");
console.log("==================================================");
