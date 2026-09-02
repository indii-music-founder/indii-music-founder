import { describe, expect, it } from 'vitest';
import {
    calculateBeatSnappedTimeline,
    generateFfmpegFilterComplex,
    buildTerminalFrameExtractionCommand
} from './beatSnapTimeline.js';

describe('BeatSnapTimeline Engine', () => {
    it('calculates beat-snapped timeline with downbeats aligned to musical bars', () => {
        const result = calculateBeatSnappedTimeline({
            bpm: 120, // 2.0s per bar
            segmentCount: 3,
            transitionDurationSeconds: 1.0,
            targetTotalSeconds: 30.0
        });

        expect(result.spec.bpm).toBe(120);
        expect(result.spec.barDurationSeconds).toBe(2.0);
        expect(result.segmentDurations).toHaveLength(3);

        // Segment 0: 10s (5 bars)
        expect(result.segmentDurations[0].durationSeconds).toBe(10);
        expect(result.segmentDurations[0].timelineDropSeconds).toBe(10);

        // Segment 1: 11s (10s visible + 1s overlap)
        expect(result.segmentDurations[1].durationSeconds).toBe(11);
        expect(result.segmentDurations[1].timelineDropSeconds).toBe(20);

        // Segment 2: 11s (10s visible + 1s overlap)
        expect(result.segmentDurations[2].durationSeconds).toBe(11);

        // Transition offsets: Cut 1 starts at 9s, Cut 2 starts at 19s
        expect(result.spec.transitionOffsets).toEqual([9, 19]);

        // Total master duration must equal 10 + 11 + 11 - 2 = 30s
        expect(result.totalMasterDurationSeconds).toBe(30);
    });

    it('generates valid FFmpeg filter complex string with xfade and acrossfade', () => {
        const filterStr = generateFfmpegFilterComplex(3, [9, 19], 1.0, 'fade');

        // Check PTS normalization
        expect(filterStr).toContain('[0:v]setpts=PTS-STARTPTS[v0];');
        expect(filterStr).toContain('[1:v]setpts=PTS-STARTPTS[v1];');
        expect(filterStr).toContain('[2:v]setpts=PTS-STARTPTS[v2];');

        // Check audio PTS normalization
        expect(filterStr).toContain('[0:a]asetpts=PTS-STARTPTS[a0];');

        // Check video xfade cascade
        expect(filterStr).toContain('[v0][v1]xfade=transition=fade:duration=1:offset=9[vx0];');
        expect(filterStr).toContain('[vx0][v2]xfade=transition=fade:duration=1:offset=19[vout];');

        // Check audio acrossfade cascade
        expect(filterStr).toContain('[a0][a1]acrossfade=d=1:c1=tri:c2=tri[ax0];');
        expect(filterStr).toContain('[ax0][a2]acrossfade=d=1:c1=tri:c2=tri[aout]');
    });

    it('builds terminal frame extraction command enforcing BT.709 color clamping', () => {
        const cmd = buildTerminalFrameExtractionCommand('input.mp4', 'output_Flast.png');

        expect(cmd).toContain('ffmpeg -y');
        expect(cmd).toContain('-sseof -0.05 -i "input.mp4"');
        expect(cmd).toContain('-vf "format=rgb24,scale=in_color_matrix=bt709:out_color_matrix=bt709"');
        expect(cmd).toContain('-vframes 1');
        expect(cmd).toContain('"output_Flast.png"');
    });
});
