/**
 * Local video coordinator.
 *
 * RenderPlanner runs before either executor is loaded: direct-media projects
 * stay in FFmpeg, while composed projects compile to HyperFrames and cross the
 * frozen VideoRendererContract boundary.
 */

import { copyFile, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

import log from 'electron-log';
import type { IndiiVideoProject } from '@indii/shared';
import { planRenderRoute } from '@indii/shared';

export interface LocalRenderConfig {
    project?: IndiiVideoProject;
    inputProps?: { project?: IndiiVideoProject };
    outputLocation: string;
}

const resolveProject = (config: LocalRenderConfig): IndiiVideoProject | undefined =>
    config.inputProps?.project ?? config.project;

const localMediaInput = (source: string): string => {
    if (!source.startsWith('file://')) return source;
    try {
        return fileURLToPath(source);
    } catch {
        throw new Error('Local render received an invalid file URL.');
    }
};

/** Candidates cover source checkout, built app, and packaged app.asar layouts. */
export const gsapAssetCandidates = (): string[] => [
    ...(process.env.INDII_GSAP_PATH ? [process.env.INDII_GSAP_PATH] : []),
    path.resolve(process.cwd(), 'packages/main/src/services/video/hyperframes/__fixtures__/gsap.min.js'),
    path.resolve(__dirname, 'gsap.min.js'),
    path.resolve(__dirname, '../gsap.min.js'),
    path.resolve(process.resourcesPath ?? '', 'app.asar/dist/main/gsap.min.js'),
];

const copyGsapAsset = async (destination: string): Promise<void> => {
    const attempted: string[] = [];
    for (const candidate of gsapAssetCandidates()) {
        attempted.push(candidate);
        try {
            await copyFile(candidate, destination);
            return;
        } catch {
            // Try the next deterministic app/source layout.
        }
    }
    throw new Error(`Local render could not resolve the bundled GSAP runtime. Tried: ${attempted.join(', ')}`);
};

const readGsapAsset = async (): Promise<string> => {
    const attempted: string[] = [];
    for (const candidate of gsapAssetCandidates()) {
        attempted.push(candidate);
        try {
            return await readFile(candidate, 'utf8');
        } catch {
            // Try the next deterministic app/source layout.
        }
    }
    throw new Error(`Preview could not resolve the bundled GSAP runtime. Tried: ${attempted.join(', ')}`);
};

export const electronRenderService = {
    async compilePreview(project: IndiiVideoProject): Promise<string> {
        if (!project || typeof project !== 'object' || !Array.isArray(project.clips) || !Array.isArray(project.tracks)) {
            throw new Error('Preview compilation requires an IndiiVideoProject.');
        }
        const [{ compileProjectToHyperFrames }, gsapSource] = await Promise.all([
            import('./video/hyperframes/compiler'),
            readGsapAsset(),
        ]);
        const compiled = compileProjectToHyperFrames(project);
        return compiled.html.replace(
            '<script src="./gsap.min.js"></script>',
            `<script>${gsapSource.replace(/<\/script/gi, '<\\/script')}</script>`,
        );
    },

    async render(config: LocalRenderConfig): Promise<string> {
        const project = resolveProject(config);
        if (!project || typeof project !== 'object' || !Array.isArray(project.clips) || !Array.isArray(project.tracks)) {
            throw new Error('Local render requires inputProps.project (IndiiVideoProject).');
        }

        const decision = planRenderRoute({ project });
        log.info('[ElectronRenderService] Route selected:', decision.route, decision.reason);

        if (decision.route === 'direct_media') {
            const clip = project.clips.find(candidate => candidate.type === 'video');
            const audioClip = project.clips.find(candidate => candidate.type === 'audio');
            if (!clip || !clip.src) {
                throw new Error('Direct local rendering requires one video source.');
            }
            if (decision.op === 'audio_replace' && !audioClip?.src) {
                throw new Error('Direct audio replacement requires one audio source.');
            }
            // Dynamic import is deliberate: a direct job must not load or touch
            // any composition-engine module.
            const { executeDirectMediaJob } = await import('./media/MediaJobExecutor');
            await executeDirectMediaJob(decision, {
                input: localMediaInput(clip.src),
                output: config.outputLocation,
                ...(decision.op === 'trim' ? {
                    startUs: clip.sourceInUs,
                    endUs: clip.sourceOutUs,
                } : decision.op === 'audio_replace' ? {
                    audioInput: localMediaInput(audioClip!.src!),
                } : {
                    width: project.width,
                    height: project.height,
                    fps: project.fps,
                }),
            });
            return config.outputLocation;
        }

        // These imports happen only after a composed route is proven.
        const [adapterModule, compilerModule, mediaModule] = await Promise.all([
            import('./video/HyperFramesAdapter'),
            import('./video/hyperframes/compiler'),
            import('./media/MediaOps'),
        ]);

        log.info('[ElectronRenderService] Rendering composition:', project.id);
        const workDir = await mkdtemp(path.join('/tmp', 'indii-render-'));
        const projectDir = path.join(workDir, 'comp');
        try {
            await mkdir(projectDir, { recursive: true });

            const probedProject: IndiiVideoProject = {
                ...project,
                clips: await Promise.all(project.clips.map(async clip => {
                    if (clip.type !== 'video' || !clip.src) return clip;
                    try {
                        const probe = await mediaModule.probeMedia(localMediaInput(clip.src));
                        return { ...clip, hasAudio: probe.hasAudio };
                    } catch (error) {
                        throw new Error(
                            `Local render could not inspect video clip ${clip.id}: ${error instanceof Error ? error.message : String(error)}`,
                        );
                    }
                })),
            };
            const compiled = compilerModule.compileProjectToHyperFrames(probedProject);
            await writeFile(path.join(projectDir, 'index.html'), compiled.html, 'utf8');
            await copyGsapAsset(path.join(projectDir, 'gsap.min.js'));

            const adapter = new adapterModule.HyperFramesAdapter();
            const receipt = await adapter.renderCompositionCloud({
                compositionId: compiled.compositionId,
                outputLocation: config.outputLocation,
                projectId: 'local',
                organizationId: 'local',
                inputProps: { projectDir },
            });

            log.info('[ElectronRenderService] Render complete:', receipt.asset.url);
            return receipt.asset.url.replace(/^file:\/\//, '');
        } finally {
            await rm(workDir, { recursive: true, force: true });
        }
    },
};
