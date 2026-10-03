import fs from 'fs';
import path from 'path';
import os from 'os';
import { spawn } from 'child_process';
import { findBlenderExecutable } from './discovery.js';
import type { BlenderRenderOptions, BlenderRenderProgress } from './types.js';

export function parseBlenderFrameProgress(
    stdoutLine: string,
    totalFrames: number,
    startTimeMs: number
): Partial<BlenderRenderProgress> | null {
    // Blender frame output pattern: "Fra:12 Mem:45.2M (Peak 48.0M) | Time:00:01.23 | Remaining:00:15.45 | ..."
    const match = stdoutLine.match(/Fra:(\d+)/i);
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
    onProgress?: (progress: BlenderRenderProgress) => void
): Promise<{ success: boolean; outputPath: string; error?: string }> {
    const executablePath = await findBlenderExecutable();
    if (!executablePath) {
        throw new Error(
            'Blender executable not found. Please install Blender from https://www.blender.org or set BLENDER_PATH.'
        );
    }

    const durationSeconds = options.durationSeconds ?? 30;
    const fps = options.fps ?? 30;
    const totalFrames = Math.round(durationSeconds * fps);
    const jobId = `blender_render_${Date.now()}`;
    const startTimeMs = Date.now();

    // Prepare temp config JSON
    const tempConfigDir = path.join(os.tmpdir(), 'indii_blender');
    fs.mkdirSync(tempConfigDir, { recursive: true });
    const tempConfigFile = path.join(tempConfigDir, `render_config_${jobId}.json`);

    fs.writeFileSync(tempConfigFile, JSON.stringify(options, null, 2), 'utf-8');

    const runnerScriptPath = path.resolve(__dirname, 'python', 'runner.py');
    if (!fs.existsSync(runnerScriptPath)) {
        throw new Error(`Blender runner script not found at: ${runnerScriptPath}`);
    }

    const args = [
        '-b', // Headless background mode
        '--factory-startup', // Skip user addons/preferences for deterministic rendering
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

        child.stdout?.on('data', (chunk: Buffer) => {
            const text = chunk.toString();
            const lines = text.split('\n');
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
            stderrBuffer += chunk.toString();
        });

        child.on('error', (err) => {
            try { fs.unlinkSync(tempConfigFile); } catch { /* ignore */ }
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
            try { fs.unlinkSync(tempConfigFile); } catch { /* ignore */ }
            const elapsed = Math.round((Date.now() - startTimeMs) / 1000);

            if (code === 0) {
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
                const errMsg = `Blender exited with code ${code}: ${stderrBuffer.slice(-500)}`;
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
