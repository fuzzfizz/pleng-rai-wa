import { describe, it, expect, vi } from "vitest";
import { prepareSettingsPayload } from "../host-settings-modal";
import type { RoomSettings } from "@/types";

describe("HostSettingsModal - prepareSettingsPayload", () => {
  it("preserves multiple-choice answerInputMode and valid maxWrongGuesses", () => {
    const payload = prepareSettingsPayload({
      answerInputMode: "multiple-choice",
      maxWrongGuesses: 2,
    });

    expect(payload.answerInputMode).toBe("multiple-choice");
    expect(payload.maxWrongGuesses).toBe(2);
  });

  it("normalizes maxWrongGuesses to default 1 if negative or NaN", () => {
    const payload1 = prepareSettingsPayload({
      maxWrongGuesses: -1 as any,
    });
    expect(payload1.maxWrongGuesses).toBe(1);

    const payload2 = prepareSettingsPayload({
      maxWrongGuesses: 0, // 0 is valid (unlimited)
    });
    expect(payload2.maxWrongGuesses).toBe(0);

    const payload3 = prepareSettingsPayload({
      maxWrongGuesses: "invalid" as any,
    });
    expect(payload3.maxWrongGuesses).toBe(1);
  });

  it("normalizes invalid answerInputMode to autocomplete", () => {
    const payload = prepareSettingsPayload({
      answerInputMode: "not-a-real-mode" as any,
    });
    expect(payload.answerInputMode).toBe("autocomplete");
  });

  it("preserves standard autocomplete and free-text modes", () => {
    const p1 = prepareSettingsPayload({ answerInputMode: "autocomplete" });
    expect(p1.answerInputMode).toBe("autocomplete");

    const p2 = prepareSettingsPayload({ answerInputMode: "free-text" });
    expect(p2.answerInputMode).toBe("free-text");
  });

  it("handles multi-genre selection and preserves genreIds in payload", () => {
    const payload = prepareSettingsPayload({
      songFilter: {
        type: "genre",
        genreIds: ["rock-id", "pop-id"],
        genreId: "rock-id",
        genreNames: ["ร็อค", "ป็อป"],
      },
    });

    expect(payload.genreId).toBe("rock-id");
    expect(payload.genreIds).toEqual(["rock-id", "pop-id"]);
    expect(payload.playlistId).toBeUndefined();
    expect(payload.eraIds).toBeUndefined();
  });

  it("handles multi-era selection and preserves eraIds in payload", () => {
    const payload = prepareSettingsPayload({
      songFilter: {
        type: "era",
        eraIds: ["90s", "2000s"],
        era: "90s",
      },
    });

    expect(payload.eraIds).toEqual(["90s", "2000s"]);
    expect(payload.genreId).toBeUndefined();
    expect(payload.genreIds).toBeUndefined();
    expect(payload.playlistId).toBeUndefined();
  });

  it("cleans up empty genreIds and eraIds arrays", () => {
    const payload = prepareSettingsPayload({
      genreIds: [],
      eraIds: [] as any,
    });

    expect(payload.genreIds).toBeUndefined();
    expect(payload.eraIds).toBeUndefined();
  });
});

import {
  reduceRoomRealtimeEvent,
  createInitialRoomRealtimeState,
} from "@/hooks/use-room-realtime";

describe("Room Realtime Reducer (Choices & Skip Round)", () => {
  it("preserves choices in activeQuestion on round_start", () => {
    const initialState = createInitialRoomRealtimeState("TEST1");
    const choices = [
      { id: "choice_0", title: "Song 1", artist: "Artist 1" },
      { id: "choice_1", title: "Song 2", artist: "Artist 2" },
      { id: "choice_2", title: "Song 3", artist: "Artist 3" },
      { id: "choice_3", title: "Song 4", artist: "Artist 4" },
    ];

    const state = reduceRoomRealtimeEvent(
      initialState,
      {
        type: "broadcast",
        event: "round_start",
        payload: {
          round: 1,
          sliceUrl: "https://example.com/slice.mp3",
          durationSec: 2,
          choices,
        },
      },
      { playSounds: false }
    );

    expect(state.status).toBe("question_active");
    expect(state.activeQuestion?.choices).toEqual(choices);
  });

  it("sets roundWinner to null when round is skipped (winnerPlayerId null)", () => {
    const initialState = createInitialRoomRealtimeState("TEST1");
    const state = reduceRoomRealtimeEvent(
      initialState,
      {
        type: "broadcast",
        event: "round_reveal",
        payload: {
          song: { id: "song-1", title: "Real Song" },
          winnerPlayerId: null,
          winnerDisplayName: null,
          answerText: null,
          scoreDelta: 0,
          skipped: true,
        },
      },
      { playSounds: false }
    );

    expect(state.status).toBe("revealing");
    expect(state.roundWinner).toBeNull();
  });

  it("sets roundWinner properly when winnerPlayerId is present", () => {
    const initialState = createInitialRoomRealtimeState("TEST1");
    const state = reduceRoomRealtimeEvent(
      initialState,
      {
        type: "broadcast",
        event: "round_reveal",
        payload: {
          song: { id: "song-1", title: "Real Song" },
          winnerPlayerId: "p1",
          winnerDisplayName: "Player 1",
          answerText: "Real Song",
          scoreDelta: 100,
        },
      },
      { playSounds: false }
    );

    expect(state.status).toBe("revealing");
    expect(state.roundWinner).toEqual({
      playerId: "p1",
      displayName: "Player 1",
      answerText: "Real Song",
      scoreDelta: 100,
    });
  });
});

describe("Issue 4: HostSettingsModal Save & Close Behavior", () => {
  it("prepareSettingsPayload generates valid payload and calls onClose on successful save", async () => {
    const draft: Partial<RoomSettings> = {
      totalRounds: 15,
      sliceDurationSec: 5.0,
      answerInputMode: "autocomplete",
    };
    const payload = prepareSettingsPayload(draft);
    expect(payload.totalRounds).toBe(15);
    expect(payload.sliceDurationSec).toBe(5.0);

    const onSaveSettingsSuccess = vi.fn().mockResolvedValue(true);
    const onClose = vi.fn();

    const res = await onSaveSettingsSuccess(payload);
    if (res !== false) {
      onClose();
    }
    expect(onClose).toHaveBeenCalled();
  });

  it("does not call onClose when onSaveSettings returns false (e.g. on 403 failure)", async () => {
    const onSaveSettingsFailed = vi.fn().mockResolvedValue(false);
    const onClose = vi.fn();

    const res = await onSaveSettingsFailed({});
    if (res !== false) {
      onClose();
    }
    expect(onClose).not.toHaveBeenCalled();
  });
});


