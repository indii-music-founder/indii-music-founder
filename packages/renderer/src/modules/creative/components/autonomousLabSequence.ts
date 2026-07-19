export type SequenceDurationItem = {
    type: 'seconds' | 'beats';
    value: number;
};

const MAX_SEQUENCE_SECONDS = 60;

export function getValidatedSequenceDurations(
    items: SequenceDurationItem[],
    bpm: number,
): number[] | null {
    if (items.length === 0 || !Number.isFinite(bpm) || bpm <= 0) return null;

    const durations = items.map((item) => (
        item.type === 'seconds' ? item.value : (item.value * 60) / bpm
    ));

    if (durations.some((duration) => !Number.isFinite(duration) || duration <= 0)) {
        return null;
    }

    const totalDuration = durations.reduce((total, duration) => total + duration, 0);
    if (!Number.isFinite(totalDuration) || totalDuration > MAX_SEQUENCE_SECONDS) {
        return null;
    }

    return durations;
}
