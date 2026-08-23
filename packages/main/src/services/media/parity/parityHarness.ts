/**
 * Parity run orchestration + report writing (MIG-007).
 *
 * The harness is engine-agnostic: callers inject two render callbacks (LEGACY
 * and NEW paths) and get back a judged, persisted comparison. Sign-off
 * tracking lives in docs/video/remotion-migration/PARITY_SIGNOFF.md and is
 * updated from these reports — never auto-written by tests.
 */

import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

import type { ProbeSummary } from '../MediaOps.js';
import { compareFrameSets, computeSsim, extractFrameSamples, judge } from './frameCompare.js';
import type { FrameComparison, ParityThresholds, ParityVerdict, SsimResult } from './frameCompare.js';

export interface RenderedSide {
    label: string;
    videoPath: string;
    probe: ProbeSummary;
}

export interface ParityRunInput {
    fixtureId: string;
    /** LEGACY path renderer (Remotion today). */
    renderA: () => Promise<RenderedSide>;
    /** NEW path renderer (composition engine behind our contract). */
    renderB: () => Promise<RenderedSide>;
    workDir: string;
    thresholds?: Partial<ParityThresholds>;
    sampleFps?: number;
}

export interface ParityResult {
    fixtureId: string;
    ranAtIso: string;
    verdict: ParityVerdict;
    thresholds: ParityThresholds;
    sideA: RenderedSide;
    sideB: RenderedSide;
    metadataDelta: {
        durationUsDelta: number;
        dimensionsMatch: boolean;
        fpsMatch: boolean;
        videoPresenceMatch: boolean;
        audioPresenceMatch: boolean;
        audioDurationUsDelta?: number;
        structuralPass: boolean;
    };
    frames: FrameComparison;
    /** Present when minSsim threshold was set — the cross-engine perceptual measure. */
    ssim?: SsimResult;
}

/** Structural sanity first; frame sampling second; perceptual + judgment last. */
export const runParityComparison = async (input: ParityRunInput): Promise<ParityResult> => {
    const thresholds: ParityThresholds = {
        minIdentityRatio: input.thresholds?.minIdentityRatio ?? 1.0,
        maxDurationDeltaUs: input.thresholds?.maxDurationDeltaUs ?? 50_000,
        requireAudioMatch: input.thresholds?.requireAudioMatch ?? true,
        ...(input.thresholds?.minSsim !== undefined ? { minSsim: input.thresholds.minSsim } : {}),
    };
    const [a, b] = await Promise.all([input.renderA(), input.renderB()]);

    const sampleA = path.join(input.workDir, 'frames-a');
    const sampleB = path.join(input.workDir, 'frames-b');
    await mkdir(sampleA, { recursive: true });
    await mkdir(sampleB, { recursive: true });
    const opts = { sampleFps: input.sampleFps ?? 6 };
    const [framesA, framesB] = await Promise.all([
        extractFrameSamples(a.videoPath, sampleA, opts),
        extractFrameSamples(b.videoPath, sampleB, opts),
    ]);

    const frames = compareFrameSets(framesA, framesB);
    const ssim = thresholds.minSsim !== undefined
        ? await computeSsim(a.videoPath, b.videoPath)
        : undefined;

    const durationUsDelta = Math.abs(a.probe.durationUs - b.probe.durationUs);
    const dimensionsMatch = a.probe.width === b.probe.width && a.probe.height === b.probe.height;
    const fpsMatch = a.probe.fps === b.probe.fps;
    const videoPresenceMatch = a.probe.hasVideo === b.probe.hasVideo && a.probe.hasVideo;
    const audioPresenceMatch = a.probe.hasAudio === b.probe.hasAudio;
    const audioDurationUsDelta = a.probe.audioDurationUs !== undefined && b.probe.audioDurationUs !== undefined
        ? Math.abs(a.probe.audioDurationUs - b.probe.audioDurationUs)
        : undefined;
    const maxDurationDeltaUs = thresholds.maxDurationDeltaUs ?? 50_000;
    const structuralPass = durationUsDelta <= maxDurationDeltaUs
        && dimensionsMatch
        && fpsMatch
        && videoPresenceMatch
        && (thresholds.requireAudioMatch === false || audioPresenceMatch)
        && (audioDurationUsDelta === undefined || audioDurationUsDelta <= maxDurationDeltaUs);

    // Cross-engine SSIM supersedes byte identity only for the visual component.
    // Structural and audio gates remain mandatory and can always force mismatch.
    let verdict: ParityVerdict;
    if (ssim) {
        verdict = ssim.score >= (thresholds.minSsim ?? 0) ? 'within-threshold' : 'mismatch';
        if (ssim.score >= 0.9999 && frames.identityRatio === 1) verdict = 'identical';
    } else {
        verdict = judge(frames, thresholds);
    }
    if (!structuralPass) verdict = 'mismatch';

    return {
        fixtureId: input.fixtureId,
        ranAtIso: new Date().toISOString(),
        verdict,
        thresholds,
        sideA: a,
        sideB: b,
        metadataDelta: {
            durationUsDelta,
            dimensionsMatch,
            fpsMatch,
            videoPresenceMatch,
            audioPresenceMatch,
            ...(audioDurationUsDelta !== undefined ? { audioDurationUsDelta } : {}),
            structuralPass,
        },
        frames,
        ...(ssim ? { ssim } : {}),
    };
};

const renderMarkdownReport = (r: ParityResult): string => {
    const lines: string[] = [
        `# Parity Report — ${r.fixtureId}`,
        '',
        `- **Ran at:** ${r.ranAtIso}`,
        `- **Verdict:** \`${r.verdict.toUpperCase()}\``,
        `- **Threshold:** identityRatio ≥ ${r.thresholds.minIdentityRatio}`,
        `- **Duration tolerance:** ≤ ${r.thresholds.maxDurationDeltaUs ?? 50_000}µs`,
        '',
        '## Sides',
        '',
        `| | ${r.sideA.label} | ${r.sideB.label} |`,
        '|---|---|---|',
        `| video | \`${path.basename(r.sideA.videoPath)}\` | \`${path.basename(r.sideB.videoPath)}\` |`,
        `| durationUs | ${r.sideA.probe.durationUs} | ${r.sideB.probe.durationUs} |`,
        `| dims | ${r.sideA.probe.width}×${r.sideA.probe.height} | ${r.sideB.probe.width}×${r.sideB.probe.height} |`,
        `| fps | ${r.sideA.probe.fps ?? '—'} | ${r.sideB.probe.fps ?? '—'} |`,
        `| audio | ${r.sideA.probe.hasAudio ? 'yes' : 'no'} | ${r.sideB.probe.hasAudio ? 'yes' : 'no'} |`,
        '',
        '## Metadata delta',
        '',
        `- durationUsΔ: ${r.metadataDelta.durationUsDelta}`,
        `- dimensions match: ${r.metadataDelta.dimensionsMatch}`,
        `- fps match: ${r.metadataDelta.fpsMatch}`,
        `- video presence match: ${r.metadataDelta.videoPresenceMatch}`,
        `- audio presence match: ${r.metadataDelta.audioPresenceMatch}`,
        `- audio durationUsΔ: ${r.metadataDelta.audioDurationUsDelta ?? 'not available'}`,
        `- structural gate: ${r.metadataDelta.structuralPass ? 'PASS' : 'FAIL'}`,
        '',
        '## Frames',
        '',
        `- sampled: ${r.frames.totalCompared}`,
        `- matched: ${r.frames.matchedFrames}`,
        `- identityRatio: ${r.frames.identityRatio.toFixed(4)}`,
        `- mismatched indexes: ${r.frames.mismatchedIndexes.length ? r.frames.mismatchedIndexes.join(', ') : 'none'}`,
        `- alignment gaps: ${r.frames.missingAlignment}`,
        '',
        r.ssim ? `## Perceptual (cross-engine)\n\n- SSIM: ${r.ssim.score.toFixed(5)}${r.ssim.rawLine ? `\n- raw: \`${r.ssim.rawLine.trim()}\`` : ''}\n` : '',
    ].filter(Boolean);
    return lines.join('\n');
};

/** Persist a human report + machine JSON next to it. Returns the markdown path. */
export const writeParityReports = async (
    result: ParityResult,
    outDir: string,
): Promise<{ markdownPath: string; jsonPath: string }> => {
    await mkdir(outDir, { recursive: true });
    const stamp = result.ranAtIso.replace(/[:.]/g, '-');
    const markdownPath = path.join(outDir, `${result.fixtureId}-${stamp}.md`);
    const jsonPath = path.join(outDir, `${result.fixtureId}-${stamp}.json`);
    await writeFile(markdownPath, renderMarkdownReport(result), 'utf8');
    await writeFile(jsonPath, JSON.stringify(result, null, 2), 'utf8');
    return { markdownPath, jsonPath };
};
