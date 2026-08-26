/**
 * Job execution — advances one videoRenderJobs document through the protocol:
 * queued → running → completed | failed. All side effects happen through
 * injected dependencies so the full lifecycle is unit-testable without
 * Firestore, GCS, or a browser.
 */

import { mkdir, mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

import type { IndiiVideoProject } from '@indii/shared';

import { prepareComposition } from './composition';
import { runHyperFramesRender } from './render';
import { stageMedia, type MediaFetcher } from './stage';

export interface RenderJobRecord {
    status: 'queued' | 'running' | 'completed' | 'failed';
    projectId: string;
    userId: string;
    outputName?: string;
}

export interface JobStore {
    getJob(jobPath: string): Promise<{ data: RenderJobRecord; project: IndiiVideoProject }>;
    setRunning(jobPath: string): Promise<void>;
    setCompleted(jobPath: string, artifactUrl: string, generation: string): Promise<void>;
    setFailed(jobPath: string, error: string): Promise<void>;
}

export interface ArtifactUploader {
    (localPath: string, jobPath: string, outputName: string): Promise<{ url: string; generation: string }>;
}

export interface ExecuteJobDependencies {
    store: JobStore;
    fetchToFile: MediaFetcher;
    uploadArtifact: ArtifactUploader;
    runRender?: typeof runHyperFramesRender;
}

const REQUIRED_TRANSITIONS = {
    running: ['queued'],
    completed: ['running'],
    failed: ['running'],
} as const;

export async function executeRenderJob(jobPath: string, deps: ExecuteJobDependencies): Promise<{ url: string }> {
    const { data, project } = await deps.store.getJob(jobPath);
    if (!REQUIRED_TRANSITIONS.running.includes(data.status as never)) {
        throw new Error(`job ${jobPath} is ${data.status}; only queued jobs can be executed`);
    }

    await deps.store.setRunning(jobPath);
    const workDir = await mkdtemp(path.join(tmpdir(), 'indii-cloud-render-'));
    try {
        // Media and the composition share ONE directory: the CLI resolves
        // clip src values relative to the project root (index.html).
        const compositionDir = path.join(workDir, 'comp');
        await mkdir(compositionDir, { recursive: true });
        const staged = await stageMedia(project, compositionDir, deps.fetchToFile);
        await prepareComposition(staged, compositionDir);
        const outputPath = path.join(workDir, 'output.mp4');
        await (deps.runRender ?? runHyperFramesRender)({ workDir: compositionDir, outputPath });
        await readFile(outputPath); // fail closed: a claimed completion must exist on disk

        const artifact = await deps.uploadArtifact(outputPath, jobPath, data.outputName ?? 'render.mp4');
        await deps.store.setCompleted(jobPath, artifact.url, artifact.generation);
        return { url: artifact.url };
    } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        await deps.store.setFailed(jobPath, message).catch(() => undefined);
        throw error;
    } finally {
        await rm(workDir, { recursive: true, force: true }).catch(() => undefined);
    }
}
