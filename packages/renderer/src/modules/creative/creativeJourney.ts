export const CREATIVE_JOURNEY_LIMITS = Object.freeze({
    musicVideoSuggestedMinSeconds: 180,
    musicVideoMaxSeconds: 420,
    socialClipDefaultSeconds: 30,
});
export function validateMusicVideoDuration(seconds: number): void {
    if (!Number.isFinite(seconds) || seconds <= 0) throw new Error('The song needs a readable, positive duration.');
    if (seconds > CREATIVE_JOURNEY_LIMITS.musicVideoMaxSeconds) throw new Error(`This music-video flow supports songs up to ${CREATIVE_JOURNEY_LIMITS.musicVideoMaxSeconds / 60} minutes. Choose a shorter song or use the timeline editor. Your original is unchanged.`);
}
