/**
 * WebAudio waveform peaks — engine-free waveform source (post-Remotion removal). Returns the same shape the waveform
 * component has always consumed: per-channel sample arrays + duration.
 *
 * Decoded via the shared AudioContext; results cached per URL.
 */

let ctx: AudioContext | null = null;

const audioContext = (): AudioContext => {
    if (!ctx) {
        const Ctor = window.AudioContext
            ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
        ctx = new Ctor();
    }
    return ctx;
};

export interface AudioPeaks {
    /** Float32 samples per channel (first channel drives visualization). */
    channelWaveforms: Float32Array[];
    durationInSeconds: number;
    sampleRate: number;
}

const cache = new Map<string, AudioPeaks>();

export const fetchAudioData = async (src: string): Promise<AudioPeaks> => {
    const hit = cache.get(src);
    if (hit) return hit;

    const response = await fetch(src);
    if (!response.ok) throw new Error(`audio fetch failed: ${response.status}`);
    const buffer = await response.arrayBuffer();
    const decoded = await audioContext().decodeAudioData(buffer);

    const peaks: AudioPeaks = {
        channelWaveforms: Array.from(
            { length: decoded.numberOfChannels },
            (_, ch) => decoded.getChannelData(ch).slice(),
        ),
        durationInSeconds: decoded.duration,
        sampleRate: decoded.sampleRate,
    };
    cache.set(src, peaks);
    return peaks;
};
