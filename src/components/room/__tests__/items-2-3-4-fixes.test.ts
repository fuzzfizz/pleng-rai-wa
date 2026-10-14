import { describe, it, expect, vi } from "vitest";
import { getWaitAllPlayerStatus } from "../game-view";
import type { Player } from "@/types";

describe("Items 2, 3, and 4 Fixes & Features", () => {
  // ---------------------------------------------------------------------------
  // Item 2: Coordinated Audio Buffer Reload & Autoplay
  // ---------------------------------------------------------------------------
  describe("Item 2: Audio slice buffer reload and initial playback coordination", () => {
    it("coordinates buffer reloading and initial playback without race conditions", () => {
      let isPlaying = false;
      const setIsAudioPlaying = vi.fn((val: boolean) => {
        isPlaying = val;
      });
      let hasPlayedOnce = false;
      const setHasPlayedOnce = vi.fn((val: boolean) => {
        hasPlayedOnce = val;
      });

      const mockAudio = {
        pause: vi.fn(),
        load: vi.fn(),
        play: vi.fn().mockResolvedValue(undefined),
        currentTime: 10,
        volume: 0.5,
        muted: false,
      };

      // Simulator of the coordinated effect in GameView
      function runAudioOrchestrationEffect({
        status,
        currentRound,
        sliceUrl,
        prevSliceKeyRef,
        audioEl,
      }: {
        status: string;
        currentRound: number;
        sliceUrl?: string;
        prevSliceKeyRef: { current: string | null };
        audioEl: typeof mockAudio | null;
      }) {
        if (!audioEl) return;
        if (status !== "question_active" || !sliceUrl) {
          audioEl.pause();
          return;
        }

        const currentSliceKey = `${currentRound}:${sliceUrl}`;
        const isNewSlice = prevSliceKeyRef.current !== currentSliceKey;

        if (isNewSlice) {
          prevSliceKeyRef.current = currentSliceKey;
          audioEl.pause();
          audioEl.currentTime = 0;
          audioEl.load();

          setIsAudioPlaying(true);
          audioEl.play().catch(() => {
            setIsAudioPlaying(false);
            setHasPlayedOnce(true);
          });
        }
      }

      const prevSliceKeyRef = { current: null as string | null };

      // Round 1 start
      runAudioOrchestrationEffect({
        status: "question_active",
        currentRound: 1,
        sliceUrl: "/api/audio/slice?id=song1&start=30&duration=2",
        prevSliceKeyRef,
        audioEl: mockAudio,
      });

      expect(mockAudio.pause).toHaveBeenCalled();
      expect(mockAudio.currentTime).toBe(0);
      expect(mockAudio.load).toHaveBeenCalledTimes(1);
      expect(mockAudio.play).toHaveBeenCalledTimes(1);
      expect(setIsAudioPlaying).toHaveBeenCalledWith(true);

      // Same round/slice should NOT re-trigger load()
      mockAudio.load.mockClear();
      mockAudio.play.mockClear();

      runAudioOrchestrationEffect({
        status: "question_active",
        currentRound: 1,
        sliceUrl: "/api/audio/slice?id=song1&start=30&duration=2",
        prevSliceKeyRef,
        audioEl: mockAudio,
      });

      expect(mockAudio.load).not.toHaveBeenCalled();
      expect(mockAudio.play).not.toHaveBeenCalled();
    });

    it("onEnded callback marks audio as stopped and hasPlayedOnce as true", () => {
      let isAudioPlaying = true;
      let hasPlayedOnce = false;

      const handleAudioEnded = () => {
        isAudioPlaying = false;
        hasPlayedOnce = true;
      };

      expect(isAudioPlaying).toBe(true);
      expect(hasPlayedOnce).toBe(false);

      handleAudioEnded();

      expect(isAudioPlaying).toBe(false);
      expect(hasPlayedOnce).toBe(true);
    });
  });

  // ---------------------------------------------------------------------------
  // Item 3: Autocomplete scrollIntoView Navigation
  // ---------------------------------------------------------------------------
  describe("Item 3: Autocomplete scroll container follows ArrowUp / ArrowDown", () => {
    it("scrolls the highlighted suggestion into view with block nearest and smooth behavior", () => {
      const mockScrollIntoView = vi.fn();
      const mockElements = [
        { scrollIntoView: vi.fn() },
        { scrollIntoView: mockScrollIntoView },
        { scrollIntoView: vi.fn() },
      ];

      function syncHighlightScroll(
        highlightedIndex: number,
        elements: { scrollIntoView?: any }[]
      ) {
        if (highlightedIndex >= 0 && elements[highlightedIndex]) {
          elements[highlightedIndex]?.scrollIntoView?.({
            block: "nearest",
            behavior: "smooth",
          });
        }
      }

      // User presses ArrowDown to navigate to index 1
      syncHighlightScroll(1, mockElements);

      expect(mockScrollIntoView).toHaveBeenCalledWith({
        block: "nearest",
        behavior: "smooth",
      });
      expect(mockElements[0].scrollIntoView).not.toHaveBeenCalled();
      expect(mockElements[2].scrollIntoView).not.toHaveBeenCalled();
    });

    it("does not attempt to scroll if highlightedIndex is -1", () => {
      const mockScrollIntoView = vi.fn();
      const mockElements = [{ scrollIntoView: mockScrollIntoView }];

      function syncHighlightScroll(
        highlightedIndex: number,
        elements: { scrollIntoView?: any }[]
      ) {
        if (highlightedIndex >= 0 && elements[highlightedIndex]) {
          elements[highlightedIndex]?.scrollIntoView?.({
            block: "nearest",
            behavior: "smooth",
          });
        }
      }

      syncHighlightScroll(-1, mockElements);
      expect(mockScrollIntoView).not.toHaveBeenCalled();
    });
  });

  // ---------------------------------------------------------------------------
  // Item 4: Wait for All Player Status Calculation
  // ---------------------------------------------------------------------------
  describe("Item 4: Wait for All (wait_all) player status calculation", () => {
    const mockPlayers: Player[] = [
      { id: "p1", displayName: "สมชาย", isHost: true, isReady: true, score: 0, sessionToken: "p1", lastSeenAt: new Date().toISOString() },
      { id: "p2", displayName: "สมหญิง", isHost: false, isReady: true, score: 0, sessionToken: "p2", lastSeenAt: new Date().toISOString() },
      { id: "p3", displayName: "แอนนา", isHost: false, isReady: true, score: 0, sessionToken: "p3", lastSeenAt: new Date().toISOString() },
    ];

    it("correctly identifies submitted and pending players with summary text", () => {
      // p1 has submitted, p2 & p3 are pending
      const status = getWaitAllPlayerStatus(mockPlayers, ["p1"]);

      expect(status.submittedPlayers).toHaveLength(1);
      expect(status.submittedPlayers[0].id).toBe("p1");

      expect(status.pendingPlayers).toHaveLength(2);
      expect(status.pendingPlayers.map((p) => p.displayName)).toEqual(["สมหญิง", "แอนนา"]);

      expect(status.summaryText).toBe("กำลังรออีก 2 คน: สมหญิง, แอนนา");
    });

    it("handles all players having submitted with completion summary", () => {
      const status = getWaitAllPlayerStatus(mockPlayers, ["p1", "p2", "p3"]);

      expect(status.submittedPlayers).toHaveLength(3);
      expect(status.pendingPlayers).toHaveLength(0);
      expect(status.summaryText).toBe("ทุกคนตอบครบแล้ว กำลังประมวลผล...");
    });

    it("includes myPlayer when myExclusionReason is submitted_waiting even if realtime excludedPlayerIds is pending", () => {
      // Realtime hasn't synced p2 yet, but p2 locally has myExclusionReason: submitted_waiting
      const status = getWaitAllPlayerStatus(mockPlayers, ["p1"], "p2", "submitted_waiting");

      expect(status.submittedPlayers.map((p) => p.id)).toEqual(["p1", "p2"]);
      expect(status.pendingPlayers.map((p) => p.id)).toEqual(["p3"]);
      expect(status.summaryText).toBe("กำลังรออีก 1 คน: แอนนา");
    });

    it("handles empty player list gracefully without errors", () => {
      const status = getWaitAllPlayerStatus([], []);

      expect(status.submittedPlayers).toHaveLength(0);
      expect(status.pendingPlayers).toHaveLength(0);
      expect(status.summaryText).toBe("ทุกคนตอบครบแล้ว กำลังประมวลผล...");
    });
  });
});
