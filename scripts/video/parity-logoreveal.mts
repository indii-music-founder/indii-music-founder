/**
 * Compare the current LogoReveal port against an immutable pre-migration MP4.
 * The retired renderer is not a dependency and cannot be invoked here.
 *
 * Run: npx tsx scripts/video/parity-logoreveal.mts --baseline=/absolute/baseline.mp4
 */

import { copyFile, mkdir, mkdtemp, rm } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

const REPO = path.resolve(import.meta.dirname ?? '.', '..', '..');

const requiredBaseline = (): string => {
    const value = process.argv.find(arg => arg.startsWith('--baseline='))?.slice('--baseline='.length);
    if (!value) throw new Error('Pass --baseline=/absolute/path/to/the/frozen-pre-migration.mp4');
    const resolved = path.resolve(value);
    if (!existsSync(resolved)) throw new Error(`Baseline artifact does not exist: ${resolved}`);
    return resolved;
};

async function main(): Promise<void> {
    const baselinePath = requiredBaseline();
    const { HyperFramesAdapter } = await import('../../packages/main/src/services/video/HyperFramesAdapter.js');
    const { probeMedia } = await import('../../packages/main/src/services/media/MediaOps.js');
    const { runParityComparison, writeParityReports } = await import('../../packages/main/src/services/media/parity/parityHarness.js');
    const workDir = await mkdtemp(path.join(tmpdir(), 'parity-logo-'));
    const outDir = path.join(REPO, 'docs/video/remotion-migration/parity');

    try {
        const compositionDir = path.join(workDir, 'composition');
        await mkdir(compositionDir, { recursive: true });
        await copyFile(
            path.join(REPO, 'packages/main/src/services/video/hyperframes/ports/LogoReveal.html'),
            path.join(compositionDir, 'index.html'),
        );
        await copyFile(
            path.join(REPO, 'packages/main/src/services/video/hyperframes/__fixtures__/gsap.min.js'),
            path.join(compositionDir, 'gsap.min.js'),
        );

        const currentPath = path.join(workDir, 'current.mp4');
        const adapter = new HyperFramesAdapter();
        await adapter.renderCompositionCloud({
            compositionId: 'logoreveal',
            outputLocation: currentPath,
            projectId: 'proj-parity-logo',
            organizationId: 'org-parity-logo',
            inputProps: { projectDir: compositionDir },
        });

        const result = await runParityComparison({
            fixtureId: 'crossengine-logoreveal-001',
            workDir,
            // The committed legacy artifact's AAC stream is digital silence
            // (FFmpeg volumedetect max/mean -91 dB). Its extra 56 ms is AAC
            // container padding, not composition timing, so this fixture may
            // ignore audio presence and tolerate that measured padding.
            thresholds: { minSsim: 0.90, requireAudioMatch: false, maxDurationDeltaUs: 60_000 },
            sampleFps: 6,
            renderA: async () => ({ label: 'FROZEN_BASELINE', videoPath: baselinePath, probe: await probeMedia(baselinePath) }),
            renderB: async () => ({ label: 'CURRENT(HyperFrames)', videoPath: currentPath, probe: await probeMedia(currentPath) }),
        });
        const { markdownPath } = await writeParityReports(result, outDir);
        console.log(`verdict=${result.verdict} ssim=${result.ssim?.score.toFixed(5) ?? 'n/a'} structural=${result.metadataDelta.structuralPass}`);
        console.log('report:', markdownPath);
        if (result.verdict === 'mismatch') process.exitCode = 1;
    } finally {
        await rm(workDir, { recursive: true, force: true });
    }
}

main().catch(error => {
    console.error('PARITY FAILED:', error);
    process.exit(1);
});
