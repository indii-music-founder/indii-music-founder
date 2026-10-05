import fs from 'fs';
import path from 'path';
import os from 'os';
import { spawn } from 'child_process';
import { randomUUID } from 'crypto';
import { findBlenderExecutable } from './discovery.js';
import type { BlenderRenderOptions, BlenderRenderProgress } from './types.js';

export function parseBlenderFrameProgress(
    stdoutLine: string,
    totalFrames: number,
    startTimeMs: number
): Partial<BlenderRenderProgress> | null {
    // Blender frame output patterns: "Fra:12 Mem:45.2M..." or "render | Video append frame 12"
    const match = stdoutLine.match(/(?:Fra:|Video append frame\s+)(\d+)/i);
    if (!match) return null;

    const currentFrame = parseInt(match[1], 10);
    const percentage = totalFrames > 0 ? Math.min(100, Math.round((currentFrame / totalFrames) * 100)) : 0;
    const elapsedSeconds = Math.max(0, Math.round((Date.now() - startTimeMs) / 1000));

    let estimatedSecondsRemaining = 0;
    if (currentFrame > 0 && totalFrames > currentFrame) {
        const secPerFrame = elapsedSeconds / currentFrame;
        estimatedSecondsRemaining = Math.round(secPerFrame * (totalFrames - currentFrame));
    }

    return {
        currentFrame,
        totalFrames,
        percentage,
        elapsedSeconds,
        estimatedSecondsRemaining
    };
}

export async function executeBlenderRender(
    options: BlenderRenderOptions,
    onProgress?: (progress: BlenderRenderProgress) => void,
    signal?: AbortSignal
): Promise<{ success: boolean; outputPath: string; error?: string }> {
    signal?.throwIfAborted();
    const audio = await fs.promises.stat(options.audioFilePath).catch(() => null);
    if (!audio?.isFile() || audio.size === 0) {
        throw new Error('Select an existing, non-empty music file before rendering.');
    }
    await fs.promises.access(options.audioFilePath, fs.constants.R_OK);
    const executablePath = await findBlenderExecutable();
    if (!executablePath) {
        throw new Error(
            'Blender executable not found. Please install Blender from https://www.blender.org or set BLENDER_PATH.'
        );
    }

    const durationSeconds = options.durationSeconds ?? 30;
    const fps = options.fps ?? 30;
    const totalFrames = Math.round(durationSeconds * fps);
    const jobId = `blender_render_${randomUUID()}`;
    const startTimeMs = Date.now();

    // Prepare temp config JSON
    const tempConfigDir = fs.mkdtempSync(path.join(os.tmpdir(), 'indii_blender_'));
    fs.chmodSync(tempConfigDir, 0o700);
    const tempConfigFile = path.join(tempConfigDir, `render_config_${jobId}.json`);

    fs.writeFileSync(tempConfigFile, JSON.stringify(options, null, 2), { encoding: 'utf-8', mode: 0o600 });

    const runnerScriptPath = path.resolve(__dirname, 'python', 'runner.py');
    if (!fs.existsSync(runnerScriptPath)) {
        fs.rmSync(tempConfigDir, { recursive: true, force: true });
        throw new Error(`Blender runner script not found at: ${runnerScriptPath}`);
    }

    try {
        const output = fs.openSync(options.outputVideoPath, 'wx', 0o600);
        fs.closeSync(output);
    } catch (error) {
        fs.rmSync(tempConfigDir, { recursive: true, force: true });
        throw error;
    }
    const deletePartialOutput = () => {
        try { fs.unlinkSync(options.outputVideoPath); } catch { /* Already absent. */ }
    };

    const args = [
        '-b', // Headless background mode
        '--factory-startup', // Skip user addons/preferences for deterministic rendering
        '--python-exit-code', '1', // Treat runner failures as failed renders.
        '-P', runnerScriptPath,
        '--',
        '--config', tempConfigFile
    ];

    if (onProgress) {
        onProgress({
            jobId,
            status: 'initializing',
            currentFrame: 0,
            totalFrames,
            percentage: 0,
            elapsedSeconds: 0,
            estimatedSecondsRemaining: 0,
            message: 'Initializing Blender headless runner...'
        });
    }

    return new Promise((resolve, reject) => {
        const child = spawn(executablePath, args, {
            stdio: ['ignore', 'pipe', 'pipe']
        });

        let stderrBuffer = '';
        let stopped = false;
        let killTimer: ReturnType<typeof setTimeout> | undefined;
        const stop = () => {
            if (stopped) return;
            stopped = true;
            child.kill('SIGTERM');
            killTimer = setTimeout(() => { if (child.exitCode === null) child.kill('SIGKILL'); }, 2000);
        };
        const deadline = setTimeout(stop, 2 * 60 * 60 * 1000);
        signal?.addEventListener('abort', stop, { once: true });
        if (signal?.aborted) stop();
        const cleanup = () => {
            clearTimeout(deadline);
            clearTimeout(killTimer);
            signal?.removeEventListener('abort', stop);
            fs.rmSync(tempConfigDir, { recursive: true, force: true });
        };
        let stdoutRemainder = '';

        child.stdout?.on('data', (chunk: Buffer) => {
            stdoutRemainder += chunk.toString();
            const lines = stdoutRemainder.split(/[\r\n]+/);
            stdoutRemainder = lines.pop() || '';
            for (const line of lines) {
                const prog = parseBlenderFrameProgress(line, totalFrames, startTimeMs);
                if (prog && onProgress) {
                    onProgress({
                        jobId,
                        status: 'rendering',
                        currentFrame: prog.currentFrame ?? 0,
                        totalFrames: prog.totalFrames ?? totalFrames,
                        percentage: prog.percentage ?? 0,
                        elapsedSeconds: prog.elapsedSeconds ?? 0,
                        estimatedSecondsRemaining: prog.estimatedSecondsRemaining ?? 0,
                        message: `Rendering frame ${prog.currentFrame}/${totalFrames}`
                    });
                }
            }
        });

        child.stderr?.on('data', (chunk: Buffer) => {
            stderrBuffer = (stderrBuffer + chunk.toString()).slice(-16000);
        });

        child.on('error', (err) => {
            cleanup();
            deletePartialOutput();
            if (onProgress) {
                onProgress({
                    jobId,
                    status: 'failed',
                    currentFrame: 0,
                    totalFrames,
                    percentage: 0,
                    elapsedSeconds: Math.round((Date.now() - startTimeMs) / 1000),
                    estimatedSecondsRemaining: 0,
                    message: `Process error: ${err.message}`
                });
            }
            reject(new Error(`Failed to start Blender process: ${err.message}`));
        });

        child.on('close', (code) => {
            cleanup();
            const elapsed = Math.round((Date.now() - startTimeMs) / 1000);

            if (stopped) {
                deletePartialOutput();
                resolve({ success: false, outputPath: options.outputVideoPath,
                    error: signal?.aborted ? 'Render cancelled. No completed video was saved.' : 'Render exceeded the two-hour limit.' });
                return;
            }
            const fileExists = fs.existsSync(options.outputVideoPath) && fs.statSync(options.outputVideoPath).size > 0;
            if (code === 0 && fileExists) {
                if (onProgress) {
                    onProgress({
                        jobId,
                        status: 'completed',
                        currentFrame: totalFrames,
                        totalFrames,
                        percentage: 100,
                        elapsedSeconds: elapsed,
                        estimatedSecondsRemaining: 0,
                        message: 'Render finished successfully.'
                    });
                }
                resolve({ success: true, outputPath: options.outputVideoPath });
            } else {
                const errMsg = fileExists
                    ? `Blender exited with code ${code}: ${stderrBuffer.slice(-500)}`
                    : `Blender render failed: output file not generated. ${stderrBuffer.slice(-500)}`;
                deletePartialOutput();
                if (onProgress) {
                    onProgress({
                        jobId,
                        status: 'failed',
                        currentFrame: 0,
                        totalFrames,
                        percentage: 0,
                        elapsedSeconds: elapsed,
                        estimatedSecondsRemaining: 0,
                        message: errMsg
                    });
                }
                resolve({ success: false, outputPath: options.outputVideoPath, error: errMsg });
            }
        });
    });
}
