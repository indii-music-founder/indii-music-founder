/**
 * CLI execution — spawns the vendored hyperframes CLI against a prepared
 * composition directory, mirroring the desktop adapter's lifecycle so local
 * and cloud renders stay behaviorally identical.
 */

import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import path from 'node:path';

const require = createRequire(import.meta.url);

const DEFAULT_TIMEOUT_MS = 20 * 60 * 1000;

export const resolveHyperFramesCliEntry = (): string => {
    const pkgPath = require.resolve('hyperframes/package.json');
    const pkg = require('hyperframes/package.json') as { bin: Record<string, string> };
    return path.join(path.dirname(pkgPath), pkg.bin['hyperframes'] ?? 'bin/hyperframes.mjs');
};

export interface RenderCliOptions {
    workDir: string;
    outputPath: string;
    fps?: number;
    timeoutMs?: number;
}

/** Resolves a renderer-usable home: caller-provided, else a workdir-scoped cache. */
const renderHome = (workDir: string): string =>
    process.env.HYPERFRAMES_HOME || path.join(workDir, '.hyperframes-home');

export async function runHyperFramesRender(options: RenderCliOptions): Promise<void> {
    const entry = resolveHyperFramesCliEntry();
    const home = renderHome(options.workDir);
    const env = {
        ...process.env,
        HOME: home,
        XDG_CACHE_HOME: path.join(home, '.cache'),
        // The container sets HYPERFRAMES_BROWSER_PATH (chromium); local runs
        // inherit the host's detection when it is unset.
        ...(process.env.HYPERFRAMES_BROWSER_PATH
            ? { HYPERFRAMES_BROWSER_PATH: process.env.HYPERFRAMES_BROWSER_PATH }
            : {}),
    };
    const args = ['render', '--output', options.outputPath];
    if (options.fps !== undefined) args.push('--fps', String(options.fps));

    await new Promise<void>((resolve, reject) => {
        const child = spawn(process.execPath, [entry, ...args], {
            cwd: options.workDir,
            env,
            stdio: ['ignore', 'pipe', 'pipe'],
        });
        let stderrTail = '';
        const timer = setTimeout(() => {
            child.kill('SIGKILL');
            reject(new Error(`hyperframes render timed out after ${options.timeoutMs ?? DEFAULT_TIMEOUT_MS}ms`));
        }, options.timeoutMs ?? DEFAULT_TIMEOUT_MS);
        child.stderr.on('data', chunk => {
            stderrTail = `${stderrTail}${String(chunk)}`.slice(-4_000);
        });
        child.on('error', err => {
            clearTimeout(timer);
            reject(err);
        });
        child.on('close', code => {
            clearTimeout(timer);
            if (code === 0) resolve();
            else reject(new Error(stderrTail.trim() || `hyperframes CLI exited ${code}`));
        });
    });
}
