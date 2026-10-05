// ==========================================
// เพลงไรวะ (Pleng-Rai-Wa) - Playlist Service & Song Joining Tests
// ==========================================

import assert from "node:assert";
import {
  PlaylistService,
  mapPlaylistFromRow,
  validatePlaylistTitle,
  type CreatePlaylistInput,
  type UpdatePlaylistInput,
} from "../src/lib/services/playlist-service";
import { SongService } from "../src/lib/services/song-service";
import type { Playlist, Song, UserProfile } from "../src/types/index";
import type {
  PlaylistRow,
  PlaylistSongRow,
  ProfileRow,
  SongRow,
  GenreRow,
} from "../src/types/database";

async function runTests() {
  console.log("==================================================");
  console.log("Running Task 3: PlaylistService & Song Joining Verification");
  console.log("==================================================\n");

  // -----------------------------------------------------------------------------
  // Test 1: Input Validation & Title Constraints
  // -----------------------------------------------------------------------------
  console.log("Test 1: Input validation and title constraint rules...");

  // Valid titles
  assert.strictEqual(validatePlaylistTitle("เพลงฮิต 90s"), "เพลงฮิต 90s");
  assert.strictEqual(validatePlaylistTitle("  เพลงสตริงยุคเก่า  "), "เพลงสตริงยุคเก่า");
  assert.strictEqual(validatePlaylistTitle("A".repeat(60)), "A".repeat(60));

  // Invalid titles (empty, whitespace-only, > 60 chars)
  assert.throws(
    () => validatePlaylistTitle(""),
    /Playlist title must be between 1 and 60 characters/
  );
  assert.throws(
    () => validatePlaylistTitle("   "),
    /Playlist title must be between 1 and 60 characters/
  );
  assert.throws(
    () => validatePlaylistTitle("A".repeat(61)),
    /Playlist title must be between 1 and 60 characters/
  );
  assert.throws(
    () => validatePlaylistTitle(null as unknown as string),
    /Playlist title must be between 1 and 60 characters/
  );

  // Method argument validations
  await assert.rejects(
    async () => PlaylistService.getUserPlaylists(""),
    /User ID is required/
  );
  await assert.rejects(
    async () => PlaylistService.createPlaylist("", { title: "Rock Hits", songIds: [] }),
    /User ID is required/
  );
  await assert.rejects(
    async () => PlaylistService.createPlaylist("user-1", { title: "", songIds: [] }),
    /Playlist title must be between 1 and 60 characters/
  );
  await assert.rejects(
    async () => PlaylistService.updatePlaylist("", "user-1", { title: "New Title" }),
    /Playlist ID is required/
  );
  await assert.rejects(
    async () => PlaylistService.updatePlaylist("pl-1", "", { title: "New Title" }),
    /User ID is required/
  );
  await assert.rejects(
    async () => PlaylistService.updatePlaylist("pl-1", "user-1", { title: "   " }),
    /Playlist title must be between 1 and 60 characters/
  );
  await assert.rejects(
    async () => PlaylistService.deletePlaylist("", "user-1"),
    /Playlist ID is required/
  );
  await assert.rejects(
    async () => PlaylistService.deletePlaylist("pl-1", ""),
    /User ID is required/
  );

  console.log("✓ Passed: Title validation (1-60 chars, trimmed) and method argument constraints verified.");

  // -----------------------------------------------------------------------------
  // Test 2: Domain Model Mapping (mapPlaylistFromRow)
  // -----------------------------------------------------------------------------
  console.log("\nTest 2: Domain model mapping (mapPlaylistFromRow)...");

  const sampleProfile: ProfileRow = {
    id: "user-uuid-001",
    display_name: "ดีเจยอดนิยม",
    avatar: "🦊",
    created_at: "2026-10-05T10:00:00Z",
    updated_at: "2026-10-05T10:00:00Z",
  };

  const sampleRow: PlaylistRow = {
    id: "playlist-uuid-001",
    user_id: "user-uuid-001",
    title: "รวมเพลงรักตลอดกาล",
    description: "เพลงรักฟังสบาย",
    is_public: true,
    created_at: "2026-10-05T11:00:00Z",
  };

  // Mapping with profile passed as argument
  const mapped1 = mapPlaylistFromRow(sampleRow, 15, sampleProfile);
  assert.strictEqual(mapped1.id, "playlist-uuid-001");
  assert.strictEqual(mapped1.userId, "user-uuid-001");
  assert.strictEqual(mapped1.title, "รวมเพลงรักตลอดกาล");
  assert.strictEqual(mapped1.description, "เพลงรักฟังสบาย");
  assert.strictEqual(mapped1.isPublic, true);
  assert.strictEqual(mapped1.songCount, 15);
  assert.strictEqual(mapped1.authorName, "ดีเจยอดนิยม");
  assert.strictEqual(mapped1.authorAvatar, "🦊");
  assert.strictEqual(mapped1.userProfile?.displayName, "ดีเจยอดนิยม");
  assert.strictEqual(mapped1.userProfile?.avatar, "🦊");

  // Mapping with joined profile property on row
  const joinedRow = {
    ...sampleRow,
    description: null,
    profiles: sampleProfile,
    songCount: 8,
  };
  const mapped2 = mapPlaylistFromRow(joinedRow);
  assert.strictEqual(mapped2.title, "รวมเพลงรักตลอดกาล");
  assert.strictEqual(mapped2.description, undefined, "Null description should map to undefined");
  assert.strictEqual(mapped2.songCount, 8);
  assert.strictEqual(mapped2.authorName, "ดีเจยอดนิยม");
  assert.strictEqual(mapped2.authorAvatar, "🦊");

  // Mapping with no profile attached
  const orphanRow: PlaylistRow = {
    id: "playlist-uuid-002",
    user_id: "user-uuid-999",
    title: "เพลงไร้คนแต่ง",
    description: null,
    is_public: false,
    created_at: "2026-10-05T12:00:00Z",
  };
  const mapped3 = mapPlaylistFromRow(orphanRow);
  assert.strictEqual(mapped3.songCount, 0);
  assert.strictEqual(mapped3.authorName, undefined);
  assert.strictEqual(mapped3.authorAvatar, undefined);
  assert.strictEqual(mapped3.userProfile, undefined);
  assert.strictEqual(mapped3.isPublic, false);

  console.log("✓ Passed: mapPlaylistFromRow correctly maps DB rows, joined profiles, and song counts.");

  // -----------------------------------------------------------------------------
  // Setup In-Memory Mock Database Store for PlaylistService & SongService
  // -----------------------------------------------------------------------------
  const mockProfiles = new Map<string, ProfileRow>();
  const mockPlaylists = new Map<string, PlaylistRow>();
  const mockPlaylistSongs = new Map<string, PlaylistSongRow[]>(); // key: playlist_id
  const mockSongs = new Map<string, SongRow & { genres: GenreRow | null }>();

  // Seed sample genres & songs
  const sampleGenre: GenreRow = {
    id: "genre-001",
    name_th: "สตริง 90s",
    name_en: "90s String",
    slug: "string-90s",
    icon: "🎸",
  };

  for (let i = 1; i <= 6; i++) {
    const songId = `song-00${i}`;
    mockSongs.set(songId, {
      id: songId,
      title: `เพลงที่ ${i}`,
      artist: `ศิลปิน ${i}`,
      aliases: [`Alias ${i}`],
      release_year: 1995 + i,
      genre_id: sampleGenre.id,
      era: "90s",
      audio_url: `https://example.com/audio/${songId}.mp3`,
      hook_start_sec: 30,
      hook_end_sec: 50,
      duration_sec: 210,
      lyrics_intro: `เนื้อเพลงเริ่ม ${i}`,
      lyrics_chorus: `ฮุกเพลง ${i}`,
      metadata: {},
      created_at: new Date().toISOString(),
      genres: sampleGenre,
    });
  }

  // Seed sample users
  mockProfiles.set("user-001", {
    id: "user-001",
    display_name: "แชมป์เปี้ยน",
    avatar: "🦊",
    created_at: "2026-10-05T08:00:00Z",
    updated_at: "2026-10-05T08:00:00Z",
  });

  mockProfiles.set("user-002", {
    id: "user-002",
    display_name: "นักดนตรีพเนจร",
    avatar: "🎸",
    created_at: "2026-10-05T08:00:00Z",
    updated_at: "2026-10-05T08:00:00Z",
  });

  function createMockDbClient() {
    return {
      from(table: string) {
        if (table === "playlists") {
          return {
            select(columns = "*") {
              let filtered = Array.from(mockPlaylists.values());
              const builder = {
                eq(col: string, val: any) {
                  filtered = filtered.filter((row: any) => row[col] === val);
                  return builder;
                },
                order(col: string, { ascending = true } = {}) {
                  filtered.sort((a: any, b: any) => {
                    if (a[col] < b[col]) return ascending ? -1 : 1;
                    if (a[col] > b[col]) return ascending ? 1 : -1;
                    return 0;
                  });
                  return builder;
                },
                limit(count: number) {
                  filtered = filtered.slice(0, count);
                  return builder;
                },
                async maybeSingle() {
                  return { data: filtered[0] || null, error: null };
                },
                async single() {
                  if (filtered.length === 0) {
                    return { data: null, error: new Error("Row not found") };
                  }
                  return { data: filtered[0], error: null };
                },
                then(resolve: any) {
                  resolve({ data: filtered, error: null });
                },
              };
              return builder;
            },
            insert(insertData: any) {
              const id = insertData.id || `playlist-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
              const row: PlaylistRow = {
                id,
                user_id: insertData.user_id,
                title: insertData.title,
                description: insertData.description ?? null,
                is_public: insertData.is_public ?? true,
                created_at: new Date().toISOString(),
              };
              mockPlaylists.set(id, row);
              return {
                select() {
                  return {
                    async single() {
                      return { data: row, error: null };
                    },
                  };
                },
              };
            },
            update(updateData: any) {
              let targetId: string | null = null;
              const builder = {
                eq(col: string, val: any) {
                  if (col === "id") targetId = val;
                  return builder;
                },
                select() {
                  return {
                    async single() {
                      if (!targetId || !mockPlaylists.has(targetId)) {
                        return { data: null, error: new Error("Playlist not found") };
                      }
                      const existing = mockPlaylists.get(targetId)!;
                      const updated: PlaylistRow = {
                        ...existing,
                        ...updateData,
                      };
                      mockPlaylists.set(targetId, updated);
                      return { data: updated, error: null };
                    },
                  };
                },
              };
              return builder;
            },
            delete() {
              let targetId: string | null = null;
              const builder = {
                eq(col: string, val: any) {
                  if (col === "id") targetId = val;
                  return builder;
                },
                then(resolve: any) {
                  if (targetId) {
                    mockPlaylists.delete(targetId);
                    mockPlaylistSongs.delete(targetId);
                  }
                  resolve({ data: null, error: null, count: 1 });
                },
              };
              return builder;
            },
          };
        }

        if (table === "playlist_songs") {
          return {
            select(columns = "*", options?: any) {
              let playlistIdFilter: string | null = null;
              let playlistIdsFilter: string[] | null = null;
              const isCountOnly = options?.count === "exact" && options?.head === true;

              const builder = {
                eq(col: string, val: any) {
                  if (col === "playlist_id") playlistIdFilter = val;
                  return builder;
                },
                in(col: string, vals: string[]) {
                  if (col === "playlist_id") playlistIdsFilter = vals;
                  return builder;
                },
                order(col: string, { ascending = true } = {}) {
                  return builder;
                },
                then(resolve: any) {
                  if (isCountOnly) {
                    const songs = playlistIdFilter ? mockPlaylistSongs.get(playlistIdFilter) || [] : [];
                    return resolve({ count: songs.length, data: null, error: null });
                  }

                  if (playlistIdsFilter) {
                    const res: { playlist_id: string }[] = [];
                    for (const pid of playlistIdsFilter) {
                      const songs = mockPlaylistSongs.get(pid) || [];
                      for (const s of songs) {
                        res.push({ playlist_id: s.playlist_id });
                      }
                    }
                    return resolve({ data: res, error: null });
                  }

                  if (playlistIdFilter) {
                    const songRows = mockPlaylistSongs.get(playlistIdFilter) || [];
                    const sorted = [...songRows].sort((a, b) => a.order_num - b.order_num);

                    // Join songs if requested in query
                    const joined = sorted.map((ps) => {
                      const song = mockSongs.get(ps.song_id) || null;
                      return {
                        order_num: ps.order_num,
                        songs: song,
                      };
                    });
                    return resolve({ data: joined, error: null });
                  }

                  resolve({ data: [], error: null });
                },
              };
              return builder;
            },
            insert(items: PlaylistSongRow[]) {
              const list = Array.isArray(items) ? items : [items];
              for (const item of list) {
                const existing = mockPlaylistSongs.get(item.playlist_id) || [];
                existing.push({
                  playlist_id: item.playlist_id,
                  song_id: item.song_id,
                  order_num: item.order_num ?? existing.length + 1,
                });
                mockPlaylistSongs.set(item.playlist_id, existing);
              }
              return {
                then(resolve: any) {
                  resolve({ data: items, error: null });
                },
              };
            },
            delete() {
              let targetPlaylistId: string | null = null;
              const builder = {
                eq(col: string, val: any) {
                  if (col === "playlist_id") targetPlaylistId = val;
                  return builder;
                },
                then(resolve: any) {
                  if (targetPlaylistId) {
                    mockPlaylistSongs.delete(targetPlaylistId);
                  }
                  resolve({ data: null, error: null });
                },
              };
              return builder;
            },
          };
        }

        if (table === "profiles") {
          return {
            select() {
              let idFilter: string | null = null;
              let inFilter: string[] | null = null;
              const builder = {
                eq(col: string, val: any) {
                  if (col === "id") idFilter = val;
                  return builder;
                },
                in(col: string, vals: string[]) {
                  if (col === "id") inFilter = vals;
                  return builder;
                },
                async maybeSingle() {
                  if (idFilter && mockProfiles.has(idFilter)) {
                    return { data: mockProfiles.get(idFilter), error: null };
                  }
                  return { data: null, error: null };
                },
                then(resolve: any) {
                  if (inFilter) {
                    const res = inFilter
                      .map((id) => mockProfiles.get(id))
                      .filter(Boolean);
                    return resolve({ data: res, error: null });
                  }
                  resolve({ data: Array.from(mockProfiles.values()), error: null });
                },
              };
              return builder;
            },
          };
        }

        if (table === "songs") {
          return {
            select() {
              let genreFilter: string | null = null;
              const builder = {
                eq(col: string, val: any) {
                  if (col === "genre_id") genreFilter = val;
                  return builder;
                },
                then(resolve: any) {
                  let songs = Array.from(mockSongs.values());
                  if (genreFilter) {
                    songs = songs.filter((s) => s.genre_id === genreFilter);
                  }
                  resolve({ data: songs, error: null });
                },
              };
              return builder;
            },
          };
        }

        throw new Error(`Unhandled table in mock: ${table}`);
      },
    };
  }

  // Inject mock client into services
  const mockClient = createMockDbClient();
  PlaylistService.setClient(mockClient);
  SongService.setDbClient(mockClient);

  // -----------------------------------------------------------------------------
  // Test 3: Playlist Creation and Song Assignment with Order Preservation
  // -----------------------------------------------------------------------------
  console.log("\nTest 3: Playlist creation and song assignment with order preservation...");

  const createInput: CreatePlaylistInput = {
    title: "  เพลงร็อคยุคบุกเบิก  ",
    description: "รวมเพลงร็อคไทยในตำนาน",
    isPublic: true,
    songIds: ["song-001", "song-003", "song-002"],
  };

  const createdPlaylist = await PlaylistService.createPlaylist("user-001", createInput);

  assert.ok(createdPlaylist.id, "Created playlist must have an ID");
  assert.strictEqual(createdPlaylist.userId, "user-001");
  assert.strictEqual(createdPlaylist.title, "เพลงร็อคยุคบุกเบิก", "Title must be trimmed");
  assert.strictEqual(createdPlaylist.description, "รวมเพลงร็อคไทยในตำนาน");
  assert.strictEqual(createdPlaylist.isPublic, true);
  assert.strictEqual(createdPlaylist.songCount, 3, "Song count should equal 3");
  assert.strictEqual(createdPlaylist.authorName, "แชมป์เปี้ยน");
  assert.strictEqual(createdPlaylist.authorAvatar, "🦊");

  // Verify getPlaylistById returns songs strictly in order_num sequence
  const fetchedResult = await PlaylistService.getPlaylistById(createdPlaylist.id);
  assert.ok(fetchedResult !== null, "Playlist must be found by ID");
  assert.strictEqual(fetchedResult.playlist.id, createdPlaylist.id);
  assert.strictEqual(fetchedResult.playlist.title, "เพลงร็อคยุคบุกเบิก");
  assert.strictEqual(fetchedResult.songs.length, 3);
  assert.strictEqual(fetchedResult.songs[0].id, "song-001", "1st song must match input sequence");
  assert.strictEqual(fetchedResult.songs[1].id, "song-003", "2nd song must match input sequence");
  assert.strictEqual(fetchedResult.songs[2].id, "song-002", "3rd song must match input sequence");

  // Test deduplication on creation
  const dupInput: CreatePlaylistInput = {
    title: "รวมเพลงฮิต (ซ้ำ)",
    songIds: ["song-001", "song-002", "song-001", "song-003"],
  };
  const deduplicatedPlaylist = await PlaylistService.createPlaylist("user-001", dupInput);
  assert.strictEqual(deduplicatedPlaylist.songCount, 3, "Duplicate song IDs should be deduplicated");
  const dedupResult = await PlaylistService.getPlaylistById(deduplicatedPlaylist.id);
  assert.strictEqual(dedupResult?.songs.length, 3);
  assert.deepStrictEqual(
    dedupResult?.songs.map((s) => s.id),
    ["song-001", "song-002", "song-003"]
  );

  console.log("✓ Passed: Playlist created, song assignments persisted, and order_num sequence preserved.");

  // -----------------------------------------------------------------------------
  // Test 4: Playlist Update, Authorization, and Deletion
  // -----------------------------------------------------------------------------
  console.log("\nTest 4: Playlist update, authorization enforcement, and deletion...");

  // Unauthorized update by non-owner rejected
  await assert.rejects(
    async () =>
      PlaylistService.updatePlaylist(createdPlaylist.id, "user-002", {
        title: "พยายามแอบแก้ของคนอื่น",
      }),
    /Unauthorized: you do not own this playlist/
  );

  // Authorized update by owner
  const updateInput: UpdatePlaylistInput = {
    title: "เพลงร็อคยุคบุกเบิก (ฉบับสมบูรณ์)",
    isPublic: false,
    songIds: ["song-004", "song-005"],
  };
  const updatedPlaylist = await PlaylistService.updatePlaylist(
    createdPlaylist.id,
    "user-001",
    updateInput
  );
  assert.strictEqual(updatedPlaylist.title, "เพลงร็อคยุคบุกเบิก (ฉบับสมบูรณ์)");
  assert.strictEqual(updatedPlaylist.isPublic, false);
  assert.strictEqual(updatedPlaylist.songCount, 2);

  // Verify song order in updated playlist
  const updatedFetch = await PlaylistService.getPlaylistById(createdPlaylist.id);
  assert.strictEqual(updatedFetch?.songs.length, 2);
  assert.strictEqual(updatedFetch?.songs[0].id, "song-004");
  assert.strictEqual(updatedFetch?.songs[1].id, "song-005");

  // Unauthorized deletion by non-owner rejected
  await assert.rejects(
    async () => PlaylistService.deletePlaylist(createdPlaylist.id, "user-002"),
    /Unauthorized: you do not own this playlist/
  );

  // Authorized deletion by owner
  const deleteSuccess = await PlaylistService.deletePlaylist(createdPlaylist.id, "user-001");
  assert.strictEqual(deleteSuccess, true, "Delete should return true");

  // Confirm playlist is gone
  const deletedFetch = await PlaylistService.getPlaylistById(createdPlaylist.id);
  assert.strictEqual(deletedFetch, null, "Deleted playlist must return null");

  console.log("✓ Passed: Owner authorization enforced on update/delete, and song sequence updated cleanly.");

  // -----------------------------------------------------------------------------
  // Test 5: Public vs Private Visibility Queries
  // -----------------------------------------------------------------------------
  console.log("\nTest 5: Public vs private visibility query behaviors...");

  // Clean up playlists map for isolation
  mockPlaylists.clear();
  mockPlaylistSongs.clear();

  // User 1 creates 1 public and 1 private playlist
  const u1Public = await PlaylistService.createPlaylist("user-001", {
    title: "User 1 Public Playlist",
    isPublic: true,
    songIds: ["song-001"],
  });
  const u1Private = await PlaylistService.createPlaylist("user-001", {
    title: "User 1 Private Playlist",
    isPublic: false,
    songIds: ["song-002"],
  });

  // User 2 creates 1 public playlist
  const u2Public = await PlaylistService.createPlaylist("user-002", {
    title: "User 2 Public Playlist",
    isPublic: true,
    songIds: ["song-003", "song-004"],
  });

  // 1. getPublicPlaylists should return only public playlists (u1Public, u2Public)
  const publicList = await PlaylistService.getPublicPlaylists();
  assert.strictEqual(publicList.length, 2, "Public list must only contain 2 public playlists");
  const publicIds = publicList.map((p) => p.id);
  assert.ok(publicIds.includes(u1Public.id), "Public list must include User 1 public playlist");
  assert.ok(publicIds.includes(u2Public.id), "Public list must include User 2 public playlist");
  assert.ok(!publicIds.includes(u1Private.id), "Public list MUST NOT include User 1 private playlist");

  // 2. getPublicPlaylists with limit
  const limitedPublicList = await PlaylistService.getPublicPlaylists(1);
  assert.strictEqual(limitedPublicList.length, 1, "Limit=1 must return exactly 1 playlist");

  // 3. getUserPlaylists for User 1 returns BOTH public and private for that user
  const u1List = await PlaylistService.getUserPlaylists("user-001");
  assert.strictEqual(u1List.length, 2, "User 1 list must contain both public and private playlists");
  const u1Ids = u1List.map((p) => p.id);
  assert.ok(u1Ids.includes(u1Public.id));
  assert.ok(u1Ids.includes(u1Private.id));
  assert.strictEqual(u1List[0].authorName, "แชมป์เปี้ยน", "Author attribution must match");

  // 4. getUserPlaylists for User 2 returns only User 2's playlist
  const u2List = await PlaylistService.getUserPlaylists("user-002");
  assert.strictEqual(u2List.length, 1);
  assert.strictEqual(u2List[0].id, u2Public.id);
  assert.strictEqual(u2List[0].authorName, "นักดนตรีพเนจร");

  console.log("✓ Passed: Public filtering, user playlist isolation, and author attribution verified.");

  // -----------------------------------------------------------------------------
  // Test 6: SongService.getRandomSongs with playlistId option
  // -----------------------------------------------------------------------------
  console.log("\nTest 6: SongService.getRandomSongs with playlistId option...");

  // Playlist with 3 songs: song-001, song-002, song-003
  const testGamePlaylist = await PlaylistService.createPlaylist("user-001", {
    title: "Game Test Playlist",
    isPublic: true,
    songIds: ["song-001", "song-002", "song-003"],
  });

  // 1. Query random songs from playlist
  const randomFromPlaylist = await SongService.getRandomSongs(2, {
    playlistId: testGamePlaylist.id,
  });
  assert.strictEqual(randomFromPlaylist.length, 2);
  for (const s of randomFromPlaylist) {
    assert.ok(
      ["song-001", "song-002", "song-003"].includes(s.id),
      `Selected song ${s.id} must be in game playlist`
    );
  }

  // 2. Query with excludeIds leaving 1 song
  const excludedSongs = await SongService.getRandomSongs(1, {
    playlistId: testGamePlaylist.id,
    excludeIds: ["song-001", "song-002"],
  });
  assert.strictEqual(excludedSongs.length, 1);
  assert.strictEqual(excludedSongs[0].id, "song-003", "Must pick the only unexcluded song");

  // 3. Query with all songs excluded -> recycles playlist songs
  const recycledSongs = await SongService.getRandomSongs(2, {
    playlistId: testGamePlaylist.id,
    excludeIds: ["song-001", "song-002", "song-003"], // all excluded
  });
  assert.strictEqual(recycledSongs.length, 2, "Recycled playlist should return requested count");
  for (const s of recycledSongs) {
    assert.ok(
      ["song-001", "song-002", "song-003"].includes(s.id),
      "Recycled songs must come from the playlist"
    );
  }

  // 4. Query empty playlist falls back to general catalog by default
  const emptyPlaylist = await PlaylistService.createPlaylist("user-001", {
    title: "Empty Playlist",
    isPublic: true,
    songIds: [],
  });

  const fallbackSongs = await SongService.getRandomSongs(2, {
    playlistId: emptyPlaylist.id,
  });
  assert.strictEqual(fallbackSongs.length, 2, "Should fallback to general catalog when playlist is empty");

  // 5. Query empty playlist with fallbackOnEmpty: false returns []
  const noFallbackSongs = await SongService.getRandomSongs(2, {
    playlistId: emptyPlaylist.id,
    fallbackOnEmpty: false,
  });
  assert.strictEqual(noFallbackSongs.length, 0, "Should return empty array when fallbackOnEmpty is false");

  // Reset test DB clients
  PlaylistService.resetClient();
  SongService.resetDbClient();

  console.log("✓ Passed: SongService.getRandomSongs supports playlistId, exclusion, recycling, and fallback.");

  console.log("\n==================================================");
  console.log("All Task 3 Verification Checks PASSED (100% Green)");
  console.log("==================================================");
}

runTests().catch((err) => {
  console.error("Test failed with error:", err);
  process.exit(1);
});
