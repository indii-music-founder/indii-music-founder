/**
 * Beat-Snapped Timeline & Frame-Chaining Math Engine (MIG-011)
 *
 * Provides deterministic timeline slicing, musical bar snapping,
 * and FFmpeg filter graph generation for multi-segment video stitching.
 */

import type { BeatSnappedTimelineSpec } from '@indii/shared';

export interface BeatSnapPlanInput {
    bpm: number;
    targetTotalSeconds?: number; // default 30
    segmentCount?: number; // default 3
    transitionDurationSeconds?: number; // default 1.0
    timeSignature?: [number, number]; // default [4, 4]
}

export interface BeatSnappedSegmentDuration {
    index: number;
    durationSeconds: number;
    timelineDropSeconds: number; // exact musical drop time on master timeline
    timelineStartSeconds: number;
    timelineEndSeconds: number;
}

export interface BeatSnappedTimelineResult {
    spec: BeatSnappedTimelineSpec;
    segmentDurations: BeatSnappedSegmentDuration[];
    totalMasterDurationSeconds: number;
    filterComplex: string;
}

/**
 * Calculates a musically coherent beat-snapped timeline where segment
 * transitions complete and hit 100% presence exactly on musical downbeats.
 */
export function calculateBeatSnappedTimeline(input: BeatSnapPlanInput): BeatSnappedTimelineResult {
    const bpm = input.bpm > 0 ? input.bpm : 120;
    const timeSig = input.timeSignature ?? [4, 4];
    const segmentCount = Math.max(2, input.segmentCount ?? 3);
    const transitionDuration = input.transitionDurationSeconds ?? 1.0;
    const targetTotal = input.targetTotalSeconds ?? 30.0;

    // Bar duration in seconds
    const beatsPerBar = timeSig[0];
    const secondsPerBeat = 60.0 / bpm;
    const barDurationSeconds = secondsPerBeat * beatsPerBar;

    // Calculate approximate segment duration before snapping
    const rawTargetPerSegment = (targetTotal + (segmentCount - 1) * transitionDuration) / segmentCount;

    // Snap segment visible durations to whole bars or half bars
    const segmentDurations: BeatSnappedSegmentDuration[] = [];
    const transientDrops: number[] = [];
    const transitionOffsets: number[] = [];

    let currentTimelineTime = 0;

    for (let i = 0; i < segmentCount; i++) {
        // Find nearest bar multiple for the visible segment
        const barsCount = Math.max(2, Math.round(rawTargetPerSegment / barDurationSeconds));
        let visibleDuration = barsCount * barDurationSeconds;

        // Raw duration includes the incoming crossfade overlap for segments > 0
        const isFirst = i === 0;
        const isLast = i === segmentCount - 1;
        const rawDuration = isFirst ? visibleDuration : visibleDuration + transitionDuration;

        const timelineStart = isFirst ? 0 : currentTimelineTime - transitionDuration;
        currentTimelineTime += visibleDuration;
        const timelineEnd = currentTimelineTime;

        if (!isLast) {
            transientDrops.push(timelineEnd);
            // xfade offset in ffmpeg timeline coordinates
            const offset = (isFirst ? visibleDuration : segmentDurations[i - 1].durationSeconds) - transitionDuration;
            // Cumulative offset
            const cumulative = transitionOffsets.length === 0
                ? offset
                : transitionOffsets[transitionOffsets.length - 1] + (rawDuration - transitionDuration);
            transitionOffsets.push(cumulative);
        }

        segmentDurations.push({
            index: i,
            durationSeconds: Math.round(rawDuration * 1000) / 1000,
            timelineDropSeconds: timelineEnd,
            timelineStartSeconds: timelineStart,
            timelineEndSeconds: timelineEnd,
        });
    }

    // Recalculate true cumulative offsets strictly
    const calculatedOffsets: number[] = [];
    for (let k = 0; k < segmentCount - 1; k++) {
        let sumPreceding = 0;
        for (let j = 0; j <= k; j++) {
            sumPreceding += segmentDurations[j].durationSeconds;
        }
        const offset = sumPreceding - (k + 1) * transitionDuration;
        calculatedOffsets.push(Math.round(offset * 1000) / 1000);
    }

    // Total master runtime
    const totalMasterDuration = segmentDurations.reduce((sum, s) => sum + s.durationSeconds, 0)
        - ((segmentCount - 1) * transitionDuration);

    const spec: BeatSnappedTimelineSpec = {
        bpm,
        timeSignature: timeSig,
        barDurationSeconds: Math.round(barDurationSeconds * 1000) / 1000,
        transientDropSeconds: transientDrops,
        transitionDurationSeconds: transitionDuration,
        transitionOffsets: calculatedOffsets,
        targetTotalDurationSeconds: Math.round(totalMasterDuration * 1000) / 1000,
    };

    const filterComplex = generateFfmpegFilterComplex(segmentCount, calculatedOffsets, transitionDuration);

    return {
        spec,
        segmentDurations,
        totalMasterDurationSeconds: spec.targetTotalDurationSeconds,
        filterComplex,
    };
}

/**
 * Generates an FFmpeg -filter_complex chain performing PTS normalization,
 * xfade video crossfades, and acrossfade audio transitions.
 */
export function generateFfmpegFilterComplex(
    segmentCount: number,
    transitionOffsets: number[],
    transitionDuration: number = 1.0,
    transitionType: string = 'fade'
): string {
    const filterInputs = Array.from({ length: segmentCount }, (_, i) => `[${i}:v]setpts=PTS-STARTPTS[v${i}];`).join(' ');
    const audioInputs = Array.from({ length: segmentCount }, (_, i) => `[${i}:a]asetpts=PTS-STARTPTS[a${i}];`).join(' ');

    let vFilter = '';
    let aFilter = '';

    if (segmentCount === 2) {
        vFilter = `[v0][v1]xfade=transition=${transitionType}:duration=${transitionDuration}:offset=${transitionOffsets[0]}[vout]`;
        aFilter = `[a0][a1]acrossfade=d=${transitionDuration}:c1=tri:c2=tri[aout]`;
    } else {
        // Multi-segment cascade
        vFilter += `[v0][v1]xfade=transition=${transitionType}:duration=${transitionDuration}:offset=${transitionOffsets[0]}[vx0]; `;
        aFilter += `[a0][a1]acrossfade=d=${transitionDuration}:c1=tri:c2=tri[ax0]; `;

        for (let i = 1; i < segmentCount - 1; i++) {
            const prevV = `vx${i - 1}`;
            const nextV = `v${i + 1}`;
            const outV = i === segmentCount - 2 ? 'vout' : `vx${i}`;
            vFilter += `[${prevV}][${nextV}]xfade=transition=${transitionType}:duration=${transitionDuration}:offset=${transitionOffsets[i]}[${outV}]; `;

            const prevA = `ax${i - 1}`;
            const nextA = `a${i + 1}`;
            const outA = i === segmentCount - 2 ? 'aout' : `ax${i}`;
            aFilter += `[${prevA}][${nextA}]acrossfade=d=${transitionDuration}:c1=tri:c2=tri[${outA}]; `;
        }
    }

    return `${filterInputs} ${audioInputs} ${vFilter.trim()} ${aFilter.trim()}`.replace(/;$/, '');
}

/**
 * Builds the exact FFmpeg command string to extract the terminal frame (F_last)
 * with strict BT.709 color clamping to prevent generation-to-generation color drift.
 */
export function buildTerminalFrameExtractionCommand(
    videoInputPath: string,
    outputImagePath: string
): string {
    return [
        'ffmpeg -y',
        `-sseof -0.05 -i "${videoInputPath}"`,
        '-vsync 0',
        '-vf "format=rgb24,scale=in_color_matrix=bt709:out_color_matrix=bt709"',
        '-vframes 1',
        `"${outputImagePath}"`
    ].join(' ');
}
