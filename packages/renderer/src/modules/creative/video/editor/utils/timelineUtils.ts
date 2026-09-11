import { VideoClip } from '../../store/videoEditorStore';
import { PIXELS_PER_FRAME } from '../constants';

export const groupClipsByTrack = (clips: VideoClip[]): Record<string, VideoClip[]> => {
    const grouped: Record<string, VideoClip[]> = {};
    for (const clip of clips) {
        if (!grouped[clip.trackId]) grouped[clip.trackId] = [];
        grouped[clip.trackId]!.push(clip);
    }
    return grouped;
};

export interface TimeRulerMark {
    second: number;
    label: string;
    position: number;
}

export const generateTimeRulerMarks = (durationInFrames: number, fps: number = 30): TimeRulerMark[] => {
    const totalSeconds = Math.ceil(durationInFrames / fps);
    return Array.from({ length: totalSeconds + 1 }, (_, i) => ({
        second: i,
        label: `${Math.floor(i / 60)}:${(i % 60).toString().padStart(2, '0')}`,
        position: i * fps * PIXELS_PER_FRAME
    }));
};

/**
 * Formats a frame count into a SMPTE-style timecode string.
 * Default output: MM:SS:FF (or HH:MM:SS:FF when hours > 0 or showHours is true).
 */
export function formatTimecode(frame: number, fps: number = 30, showHours: boolean = false): string {
    const safeFps = fps > 0 ? fps : 30;
    const safeFrame = Math.max(0, Math.floor(Number.isFinite(frame) ? frame : 0));
    const totalSeconds = Math.floor(safeFrame / safeFps);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    const frames = safeFrame % safeFps;

    const pad = (n: number) => String(n).padStart(2, '0');

    if (showHours || hours > 0) {
        return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}:${pad(frames)}`;
    }
    return `${pad(minutes)}:${pad(seconds)}:${pad(frames)}`;
}

/**
 * Verifies track compatibility for a clip when moving between tracks:
 * - Audio clips ('audio') can ONLY be placed on audio tracks ('audio').
 * - Audio tracks ('audio') NEVER accept visual clips ('video', 'image', 'text').
 * - Visual clips ('video', 'image', 'text') can move to compatible visual tracks.
 * - Locked tracks (isLocked === true) never accept clips.
 */
export function isClipCompatibleWithTrack(
    clip: { type: string },
    track: { type: string; isLocked?: boolean }
): boolean {
    if (track.isLocked) return false;
    if (clip.type === 'audio') {
        return track.type === 'audio';
    }
    // Audio tracks never accept non-audio clips
    if (track.type === 'audio') {
        return false;
    }
    // Text tracks only accept text clips
    if (track.type === 'text') {
        return clip.type === 'text';
    }
    // Video tracks accept video, image, and text clips (compositor tracks)
    if (track.type === 'video') {
        return clip.type === 'video' || clip.type === 'image' || clip.type === 'text';
    }
    // Image tracks accept image and video clips
    if (track.type === 'image') {
        return clip.type === 'image' || clip.type === 'video';
    }
    return clip.type === track.type;
}
