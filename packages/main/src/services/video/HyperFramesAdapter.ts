/**
 * HyperFramesAdapter — local composition-engine adapter behind the frozen
 * VideoRendererContract (MIG-006, ADR-001).
 *
 * Executes compositions by spawning the vendored `hyperframes` CLI against a
 * project directory supplied via config.inputProps.projectDir. Composition
 * COMPILATION (IndiiVideoProject → HTML) lands with MIG-008; this adapter is
 * the lifecycle seam only.
 *
 * Local-asset divergence (documented): completed receipts carry a `file://`
 * URL and a synthetic generation — the https/GCS shape is enforced by the
 * cloud transport layer, not this contract level.
 */

import { spawn } from 'node:child_process';
import type { ChildProcess } from 'node:child_process';
import { createRequire } from 'node:module';
import path from 'node:path';
import { randomUUID } from 'node:crypto';

import type {
    CompletedRenderReceipt,
    QueuedRenderReceipt,
    RenderResult,
    VideoRenderConfig,
    VideoRenderReceipt,
    VideoRendererContract,
} from '@indii/shared';

const IDENTIFIER = /^[A-Za-z0-9_-]{1,128}$/;
const POLL_DEFAULT_MS = 50;
const TIMEOUT_DEFAULT_MS = 15 * 60 * 1000;
/** Writable HOME for the CLI (its cache dirs must not hit read-only volumes). */
const CLI_HOME = process.env.HYPERFRAMES_HOME || '/tmp/hyperframes-home';

interface InternalJob {
    renderId: string;
    projectId: string;
    outputLocation: string;
    status: 'queued' | 'running' | 'completed' | 'failed';
    progress: number;
    phase?: string;
    error?: string;
    done?: Promise<void>;
    child?: ChildProcess;
}

// Anchor dependency resolution to this module, not process.cwd(). Packaged
// Electron apps can be launched from any working directory; the bundle still
// resolves its production dependencies from app.asar/node_modules.
const moduleRequire = createRequire(__filename);

const resolveCliEntry = (): string => {
    const pkgPath = moduleRequire.resolve('hyperframes/package.json');
    const pkg = moduleRequire('hyperframes/package.json') as { bin: Record<string, string> };
    return path.join(path.dirname(pkgPath), pkg.bin['hyperframes'] ?? 'bin/hyperframes.mjs');
};

/** Absolute path to the vendored CLI entry (shared with tooling/tests). */
export const resolveHyperFramesCliEntry = resolveCliEntry;

const mapPhaseToProgress = (phase: string | undefined, framesDone?: number, framesTotal?: number): number => {
    if (phase === 'capture' && framesTotal && framesTotal > 0 && framesDone !== undefined) {
        return Math.min(79, Math.round((framesDone / framesTotal) * 79));
    }
    switch (phase) {
        case 'encode': return 85;
        case 'assemble': return 95;
        default: return 5;
    }
};

export class HyperFramesAdapter implements VideoRendererContract {
    private readonly jobs = new Map<string, InternalJob>();

    async queueComposition(config: VideoRenderConfig): Promise<QueuedRenderReceipt> {
        if (!config.projectId || !IDENTIFIER.test(config.projectId)) {
            throw new Error('projectId is required for a hyperframes render.');
        }
        if (!config.organizationId || !IDENTIFIER.test(config.organizationId)) {
            throw new Error('organizationId is required for a hyperframes render.');
        }
        const projectDir = config.inputProps['projectDir'];
        if (typeof projectDir !== 'string' || projectDir.trim() === '') {
            throw new Error('inputProps.projectDir (composition directory) is required.');
        }

        const renderId = `hf_${randomUUID()}`;
        const job: InternalJob = {
            renderId,
            projectId: config.projectId,
            outputLocation: config.outputLocation,
            status: 'running',
            progress: 0,
            phase: 'capture',
        };
        this.jobs.set(renderId, job);
        job.done = this.run(projectDir.trim(), config, job);
        return { status: 'queued', renderId, projectId: job.projectId, progress: 0 };
    }

    private async run(projectDir: string, config: VideoRenderConfig, job: InternalJob): Promise<void> {
        const entry = resolveCliEntry();
        await new Promise<void>(resolve => {
            const child = spawn(
                process.execPath,
                [entry, 'render', '--output', config.outputLocation],
                {
                    cwd: projectDir,
                    env: {
                        ...process.env,
                        // In a packaged app process.execPath is the Electron
                        // binary. This makes that binary execute the vendored
                        // CLI as Node instead of starting another GUI app.
                        ELECTRON_RUN_AS_NODE: '1',
                        HOME: CLI_HOME,
                        XDG_CACHE_HOME: `${CLI_HOME}/.cache`,
                    },
                    stdio: ['ignore', 'pipe', 'pipe'],
                },
            );
            job.child = child;
            let stderrTail = '';
            child.stdout.on('data', chunk => {
                for (const line of String(chunk).split('\n')) {
                    if (!line.includes('[Render:trace]')) continue;
                    const jsonStart = line.indexOf('{');
                    if (jsonStart < 0) continue;
                    try {
                        const trace = JSON.parse(line.slice(jsonStart)) as {
                            phase?: string; totalFrames?: number; framesCompleted?: number;
                        };
                        job.progress = Math.max(job.progress, mapPhaseToProgress(trace.phase, trace.framesCompleted, trace.totalFrames));
                        job.phase = trace.phase;
                    } catch { /* trace lines are best-effort */ }
                }
            });
            child.stderr.on('data', chunk => {
                stderrTail = `${stderrTail}${String(chunk)}`.slice(-2_000);
            });
            child.on('error', err => {
                job.status = 'failed';
                job.error = String(err);
                resolve();
            });
            child.on('close', code => {
                // Terminal-state precedence: an explicit failure/cancel is final.
                if (job.status === 'failed') return resolve();
                if (code === 0) {
                    job.status = 'completed';
                    job.progress = 100;
                    job.phase = undefined;
                } else {
                    job.status = 'failed';
                    job.error = stderrTail.trim() || `hyperframes CLI exited ${code}`;
                }
                resolve();
            });
        });
    }

    async getRenderReceipt(renderId: string): Promise<VideoRenderReceipt> {
        const job = this.jobs.get(renderId);
        if (!job) throw new Error(`Unknown render id: ${renderId}`);
        if (job.status === 'completed') {
            return {
                status: 'completed',
                renderId,
                projectId: job.projectId,
                progress: 100,
                asset: {
                    url: `file://${path.resolve(job.outputLocation)}`,
                    expiresAt: Date.now() + 24 * 60 * 60 * 1000,
                    generation: '1',
                    mimeType: 'video/mp4',
                },
            };
        }
        if (job.status === 'failed') {
            return {
                status: 'failed',
                renderId,
                projectId: job.projectId,
                progress: job.progress,
                error: job.error ?? 'hyperframes render failed',
            };
        }
        return {
            status: 'running',
            renderId,
            projectId: job.projectId,
            progress: job.progress,
            ...(job.phase ? { phase: job.phase } : {}),
        };
    }

    async waitForRender(
        renderId: string,
        onReceipt?: (receipt: VideoRenderReceipt) => void,
        options: { pollIntervalMs?: number; timeoutMs?: number } = {},
    ): Promise<CompletedRenderReceipt> {
        const job = this.jobs.get(renderId);
        if (!job) throw new Error(`Unknown render id: ${renderId}`);
        const pollIntervalMs = options.pollIntervalMs ?? POLL_DEFAULT_MS;
        const deadline = Date.now() + (options.timeoutMs ?? TIMEOUT_DEFAULT_MS);
        while (Date.now() <= deadline) {
            const receipt = await this.getRenderReceipt(renderId);
            onReceipt?.(receipt);
            if (receipt.status === 'completed') return receipt as CompletedRenderReceipt;
            if (receipt.status === 'failed') throw new Error((receipt as { error: string }).error);
            await new Promise(r => setTimeout(r, pollIntervalMs));
        }
        throw new Error('The hyperframes render is still running. Keep the job ID and retry status later.');
    }

    async renderCompositionCloud(
        config: VideoRenderConfig,
        onProgress?: (progress: number) => void,
    ): Promise<CompletedRenderReceipt> {
        const queued = await this.queueComposition(config);
        return this.waitForRender(queued.renderId, r => onProgress?.(r.progress));
    }

    async renderComposition(config: VideoRenderConfig): Promise<RenderResult> {
        if (config.useCloudQueue) return this.queueComposition(config);
        const receipt = await this.renderCompositionCloud(config);
        return receipt.asset.url;
    }

    /**
     * Force a job into a failed terminal state. Cancels the underlying CLI
     * process if one is running; terminal state is write-once (a later clean
     * exit cannot resurrect a cancelled render).
     * TEST HOOK + cancellation primitive.
     */
    _failJob(renderId: string, message: string): void {
        const job = this.jobs.get(renderId);
        if (!job) throw new Error(`Unknown render id: ${renderId}`);
        job.status = 'failed';
        job.error = message;
        if (job.child && job.child.exitCode == null) {
            job.child.kill('SIGKILL');
        }
    }
}
