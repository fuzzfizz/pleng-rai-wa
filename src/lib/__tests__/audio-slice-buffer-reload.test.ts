import { describe, it, expect, vi } from "vitest";

describe("Audio Slice Buffer Clean Reload & Solo Safety", () => {
  it("cleans and reloads HTMLAudioElement when sliceUrl changes", () => {
    let loaded = false;
    let paused = false;
    let currentTime = 10;

    const mockAudio = {
      pause: vi.fn(() => {
        paused = true;
      }),
      load: vi.fn(() => {
        loaded = true;
      }),
      currentTime: 10,
    };

    // Helper representing the audio slice URL change effect
    function handleSliceUrlChange(
      currentSliceUrl: string,
      prevSliceUrl: string | undefined,
      audioEl: typeof mockAudio | null
    ): string {
      if (currentSliceUrl && currentSliceUrl !== prevSliceUrl) {
        if (audioEl) {
          audioEl.pause();
          audioEl.currentTime = 0;
          audioEl.load();
        }
        return currentSliceUrl;
      }
      return prevSliceUrl || currentSliceUrl;
    }

    const newUrl = "/api/audio/slice?id=song-2&start=20&duration=2";
    const prevUrl = "/api/audio/slice?id=song-1&start=10&duration=2";

    const updatedPrev = handleSliceUrlChange(newUrl, prevUrl, mockAudio);

    expect(updatedPrev).toBe(newUrl);
    expect(mockAudio.pause).toHaveBeenCalled();
    expect(mockAudio.currentTime).toBe(0);
    expect(mockAudio.load).toHaveBeenCalled();
  });

  it("does not replace active song in solo play if round is already active or audio has played", () => {
    function shouldUpdateSoloSongsPool(
      currentScore: number,
      currentSongIndex: number,
      isPlayingAudio: boolean,
      isRevealed: boolean
    ): boolean {
      // Only safe to swap pool if game is pristine untouched (score 0, index 0, not playing, not revealed)
      return currentScore === 0 && currentSongIndex === 0 && !isPlayingAudio && !isRevealed;
    }

    // Pristine: safe to update
    expect(shouldUpdateSoloSongsPool(0, 0, false, false)).toBe(true);

    // Audio already playing: NOT safe
    expect(shouldUpdateSoloSongsPool(0, 0, true, false)).toBe(false);

    // Round already advanced: NOT safe
    expect(shouldUpdateSoloSongsPool(0, 1, false, false)).toBe(false);

    // Round already revealed: NOT safe
    expect(shouldUpdateSoloSongsPool(10, 0, false, true)).toBe(false);
  });
});
