/**
 * UpscaleExecutor — local super-resolution engine runner (PRD Workstream 3,
 * ISSUE-323).
 *
 * Follows the DIRECT MEDIA contract (MediaOps, MIG-003 / ADR-001): pure
 * functions with injectable binary paths, spawn with hard timeout, fail
 * closed with the tail of stderr. The engine is the standalone
 * realesrgan-ncnn-vulkan binary — no Python, no daemon.
 *
 * Deterministic and unit-testable without a GPU: tests inject fake engine
 * scripts and assert the spawn contract, not model quality.
 */

import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import path from 'node:path';

const DEFAULT_TIMEOUT_MS = 10 * 60 * 1000;
const STDERR_TAIL_KEEP = 8_000;
const STDERR_TAIL_MAX = 16_000;

export interface UpscaleBinaries {
    /** Path to the realesrgan-ncnn-vulkan engine binary. */
    engine: string;
}

/**
 * Engine binary location. Packaging bundles it under resources; the
 * environment override exists for development and tests.
 */
export const defaultEngineBins = (): UpscaleBinaries => ({
    engine: process.env.INDII_UPSCALE_ENGINE || 'realesrgan-ncnn-vulkan',
});

export interface UpscaleRequest {
    inputPath: string;
    outputPath: string;
    /** Upscale factor — the engine ships 2× and 4× models. */
    scale: 2 | 4;
    /** Engine model name. Default targets photographic/illustrative artwork. */
    model?: string;
    /** Optional tile size (px) to bound GPU memory. */
    tilePx?: number;
    timeoutMs?: number;
    /** Abort signal from the facade — kills the engine process. */
    signal?: AbortSignal;
    /** Progress callback: engine reports 0..100 on stderr while tiles complete. */
    onProgress?: (fraction: number) => void;
}

export interface UpscaleOutcome {
    outputPath: string;
    stderrTail: string;
    durationMs: number;
}

export interface EngineProbe {
    /** Engine binary was found and executed. */
    enginePresent: boolean;
    /** Engine ran and reported no Vulkan/device failure. */
    gpuReady: boolean;
    detail: string;
}

interface RunResult {
    code: number | null;
    stderrTail: string;
    killed: boolean;
}

/** Parse an engine progress percentage (0..100) from a stderr line, if present. */
export function parseProgressLine(line: string): number | null {
    const match = /(\d{1,3}(?:\.\d+)?)\s*%/.exec(line);
    if (!match) return null;
    const value = Number.parseFloat(match[1]);
    return Number.isFinite(value) && value >= 0 && value <= 100 ? value / 100 : null;
}

function runEngine(
    bins: UpscaleBinaries,
    args: string[],
    timeoutMs: number,
    signal?: AbortSignal,
    onProgress?: (fraction: number) => void,
): Promise<RunResult> {
    return new Promise((resolve, reject) => {
        let stderr = '';
        let killed = false;
        let lastProgress = -1;

        let child;
        try {
            child = spawn(bins.engine, args, { stdio: ['ignore', 'ignore', 'pipe'] });
        } catch (err) {
            reject(err);
            return;
        }

        const timer = setTimeout(() => {
            killed = true;
            child.kill('SIGKILL');
        }, timeoutMs);

        const onAbort = () => {
            killed = true;
            child.kill('SIGKILL');
        };
        signal?.addEventListener('abort', onAbort, { once: true });

        child.stderr?.on('data', (chunk: Buffer) => {
            stderr += String(chunk);
            if (stderr.length > STDERR_TAIL_MAX) stderr = stderr.slice(-STDERR_TAIL_KEEP);
            if (onProgress) {
                for (const line of stderr.split('\n')) {
                    const fraction = parseProgressLine(line);
                    if (fraction !== null && fraction > lastProgress) {
                        lastProgress = fraction;
                        onProgress(fraction);
                    }
                }
            }
        });
        child.on('error', (err: Error) => {
            clearTimeout(timer);
            signal?.removeEventListener('abort', onAbort);
            reject(err);
        });
        // Resolve on 'exit', not 'close': 'close' waits for stdio pipes to
        // drain, and engines that spawn helper processes (or shells whose
        // children inherit the pipe) keep those pipes open long after the
        // engine itself is dead — which would hang timeouts and aborts.
        child.on('exit', (code: number | null) => {
            clearTimeout(timer);
            signal?.removeEventListener('abort', onAbort);
            resolve({ code, stderrTail: stderr.trim().slice(-STDERR_TAIL_KEEP), killed });
        });
    });
}

/**
 * Run one upscale pass. Resolves only when the engine exited 0 AND the
 * output file exists — everything else rejects (fail closed).
 */
export async function runUpscale(
    req: UpscaleRequest,
    bins: UpscaleBinaries = defaultEngineBins(),
): Promise<UpscaleOutcome> {
    if (!req.inputPath || !req.outputPath) throw new Error('UpscaleExecutor: input and output paths are required');
    if (req.scale !== 2 && req.scale !== 4) throw new Error('UpscaleExecutor: scale must be 2 or 4');
    if (!existsSync(req.inputPath)) throw new Error(`UpscaleExecutor: input not found: ${req.inputPath}`);

    const args = [
        '-i', req.inputPath,
        '-o', req.outputPath,
        '-n', req.model ?? 'realesrgan-x4plus-anime',
        '-s', String(req.scale),
    ];
    if (req.tilePx && req.tilePx > 0) args.push('-t', String(req.tilePx));
    args.push('-f', path.extname(req.outputPath).replace('.', '') || 'png');

    const started = Date.now();
    const result = await runEngine(bins, args, req.timeoutMs ?? DEFAULT_TIMEOUT_MS, req.signal, req.onProgress);
    const durationMs = Date.now() - started;

    if (result.killed && req.signal?.aborted) {
        throw new Error('UpscaleExecutor: aborted by caller');
    }
    if (result.killed) {
        throw new Error(`UpscaleExecutor: engine timed out after ${req.timeoutMs ?? DEFAULT_TIMEOUT_MS}ms: ${result.stderrTail}`);
    }
    if (result.code !== 0) {
        throw new Error(`UpscaleExecutor: engine exited ${result.code}: ${result.stderrTail}`);
    }
    if (!existsSync(req.outputPath)) {
        throw new Error(`UpscaleExecutor: engine reported success but produced no output: ${result.stderrTail}`);
    }
    return { outputPath: req.outputPath, stderrTail: result.stderrTail, durationMs };
}

const VULKAN_FAILURE = /vkEnumeratePhysicalDevices|no vulkan device|failed to create vulkan|vkCreateInstance.*failed/i;
const USAGE_HINT = /(^|\s)-i\s|usage|input path|output path/i;

/**
 * Probe the engine: present? GPU path healthy? Runs the engine's help/usage
 * path — cheap, no image work.
 */
export async function probeEngine(bins: UpscaleBinaries = defaultEngineBins()): Promise<EngineProbe> {
    try {
        const result = await runEngine(bins, ['-h'], 15_000);
        const combined = result.stderrTail;
        if (VULKAN_FAILURE.test(combined)) {
            return { enginePresent: true, gpuReady: false, detail: combined.slice(0, 300) };
        }
        if (USAGE_HINT.test(combined)) {
            return { enginePresent: true, gpuReady: true, detail: 'engine responded with usage' };
        }
        return {
            enginePresent: true,
            gpuReady: false,
            detail: `unrecognised engine output: ${combined.slice(0, 200) || '(empty)'}`,
        };
    } catch (err) {
        return { enginePresent: false, gpuReady: false, detail: err instanceof Error ? err.message : String(err) };
    }
}
