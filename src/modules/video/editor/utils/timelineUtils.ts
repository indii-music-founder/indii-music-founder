import { VideoClip } from '../../store/videoEditorStore';
import { PIXELS_PER_FRAME } from '../constants';

export const groupClipsByTrack = (clips: VideoClip[]): Record<string, VideoClip[]> => {
    const grouped: Record<string, VideoClip[]> = {};
    for (const clip of clips) {
        if (!grouped[clip.trackId]) grouped[clip.trackId] = [];
        grouped[clip.trackId].push(clip);
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
