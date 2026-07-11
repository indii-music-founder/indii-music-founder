export const MAX_STORYBOARD_SCENE_SECONDS = 60;
export const MAX_STORYBOARD_TOTAL_SECONDS = 600;

export function isValidStoryboardSceneDuration(duration: number): boolean {
    return Number.isFinite(duration)
        && Number.isInteger(duration)
        && duration >= 1
        && duration <= MAX_STORYBOARD_SCENE_SECONDS;
}

export function getStoryboardTimingError(durations: number[]): string | null {
    if (durations.length === 0) return 'Add at least one storyboard scene before continuing.';
    const invalidIndex = durations.findIndex((duration) => !isValidStoryboardSceneDuration(duration));
    if (invalidIndex >= 0) {
        return `Scene ${invalidIndex + 1} must be a whole number between 1 and ${MAX_STORYBOARD_SCENE_SECONDS} seconds.`;
    }
    const total = durations.reduce((sum, duration) => sum + duration, 0);
    if (total > MAX_STORYBOARD_TOTAL_SECONDS) {
        return `Storyboard duration cannot exceed ${MAX_STORYBOARD_TOTAL_SECONDS} seconds.`;
    }
    return null;
}
