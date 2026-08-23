/**
 * Compare the current text composition against an immutable pre-migration
 * baseline artifact. The retired engine is intentionally not executable from
 * this repository; auditors must supply the preserved MP4 explicitly.
 *
 * Run: npx tsx scripts/video/parity-crossengine.mts --baseline=/absolute/baseline.mp4
 */

import { copyFile, mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
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
    const { compileProjectToHyperFrames } = await import('../../packages/main/src/services/video/hyperframes/compiler.js');
    const { probeMedia } = await import('../../packages/main/src/services/media/MediaOps.js');
    const { runParityComparison, writeParityReports } = await import('../../packages/main/src/services/media/parity/parityHarness.js');

    const project = {
        id: 'parity-text-001',
        name: 'Cross-engine parity: text',
        fps: 30,
        durationInFrames: 300,
        width: 1920,
        height: 1080,
        tracks: [{ id: 't1', name: 'TXT', type: 'text' as const }],
        clips: [{
            id: 'title', type: 'text' as const, text: 'indii', name: 'title',
            startFrame: 30, durationInFrames: 240, trackId: 't1',
            textColor: '#ffffff', fontSize: 96, fontWeight: '700' as const, textAlign: 'center' as const,
        }],
    };

    const workDir = await mkdtemp(path.join(tmpdir(), 'parity-cross-'));
    const outDir = path.join(REPO, 'docs/video/remotion-migration/parity');
    await mkdir(outDir, { recursive: true });
    try {
        const compiled = compileProjectToHyperFrames(project);
        const compositionDir = path.join(workDir, 'composition');
        await mkdir(compositionDir, { recursive: true });
        await writeFile(path.join(compositionDir, 'index.html'), compiled.html, 'utf8');
        await copyFile(
            path.join(REPO, 'packages/main/src/services/video/hyperframes/__fixtures__/gsap.min.js'),
            path.join(compositionDir, 'gsap.min.js'),
        );

        const currentPath = path.join(workDir, 'current.mp4');
        const adapter = new HyperFramesAdapter();
        await adapter.renderCompositionCloud({
            compositionId: compiled.compositionId,
            outputLocation: currentPath,
            projectId: 'proj-parity-x',
            organizationId: 'org-parity-x',
            inputProps: { projectDir: compositionDir },
        });

        const result = await runParityComparison({
            fixtureId: 'crossengine-text-001',
            workDir,
            thresholds: { minSsim: 0.90 },
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
    console.error('CROSS-ENGINE PARITY FAILED:', error);
    process.exit(1);
});
