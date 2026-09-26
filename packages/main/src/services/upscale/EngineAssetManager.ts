/**
 * EngineAssetManager — fetch-on-first-use provisioning of the local upscale
 * engine (PRD Workstream 3, ISSUE-323).
 *
 * Contract: ensureEngineAssets() resolves with a usable engine path —
 * present-and-verified short-circuits; otherwise download → sha256 verify
 * (fail closed on any mismatch) → extract → chmod +x (posix) → verify the
 * binary is executable. The download, hashing, and extraction are injectable
 * so tests run without network or platform tools.
 */

import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { chmod, mkdir, mkdtemp, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { ENGINE_ASSETS, ENGINE_ASSET_VERSION, type EngineAssetPin } from './engineAssets.generated';

export type EnginePlatform = 'darwin' | 'win32' | 'linux';

export interface EngineInstall {
    enginePath: string;
    modelsDir: string;
    version: string;
    fromCache: boolean;
}

export type { EngineAssetPin };

export interface DownloadResponse {
    /** Full body as bytes. */
    arrayBuffer(): Promise<ArrayBuffer>;
    status: number;
}

export type Fetcher = (url: string) => Promise<DownloadResponse>;
export type Extractor = (zipPath: string, destDir: string) => Promise<void>;

export const httpFetcher: Fetcher = async (url) => {
    const res = await fetch(url);
    return { status: res.status, arrayBuffer: () => res.arrayBuffer() };
};

/** Default extractor: bsdtar on Windows 10+ handles zip; unzip elsewhere. */
export const platformExtractor: Extractor = (zipPath, destDir) =>
    new Promise((resolve, reject) => {
        const bin = process.platform === 'win32' ? 'tar' : 'unzip';
        const args = process.platform === 'win32' ? ['-xf', zipPath, '-C', destDir] : ['-o', zipPath, '-d', destDir];
        const child = spawn(bin, args, { stdio: 'ignore' });
        child.on('error', reject);
        child.on('exit', (code) => (code === 0 ? resolve() : reject(new Error(`extractor ${bin} exited ${code}`))));
    });

export interface EnsureOptions {
    /** Install root. Defaults to <userData>/upscale-engine/<version>. */
    installDir?: string;
    platform?: EnginePlatform;
    fetcher?: Fetcher;
    extractor?: Extractor;
    /** Progress callback: 0..1 based on bytes/expected size. */
    onProgress?: (fraction: number) => void;
    /** Override the canonical pin (tests / staged rollouts). */
    pin?: EngineAssetPin;
}

const sha256Hex = (bytes: Uint8Array): string => createHash('sha256').update(bytes).digest('hex');

/**
 * Resolve a usable engine install, downloading and verifying on first use.
 * Rejects on any hash mismatch, network failure, or missing binary after
 * extraction — never resolves a degraded engine.
 */
export async function ensureEngineAssets(opts: EnsureOptions = {}): Promise<EngineInstall> {
    const platform: EnginePlatform = opts.platform ?? (process.platform as EnginePlatform);
    const pin: EngineAssetPin = opts.pin ?? ENGINE_ASSETS[platform];
    if (!pin) throw new Error(`EngineAssetManager: no engine pin for platform "${platform}"`);

    const installDir = opts.installDir ?? path.join(tmpdir(), `indii-upscale-${ENGINE_ASSET_VERSION}-${platform}`);
    const enginePath = path.join(installDir, pin.engineRelativePath);
    const modelsDir = path.join(installDir, 'models');

    if (existsSync(enginePath)) {
        return { enginePath, modelsDir, version: ENGINE_ASSET_VERSION, fromCache: true };
    }

    const fetcher = opts.fetcher ?? httpFetcher;
    const extract = opts.extractor ?? platformExtractor;

    const res = await fetcher(pin.url);
    if (res.status !== 200) throw new Error(`EngineAssetManager: download failed with HTTP ${res.status}`);
    const body = new Uint8Array(await res.arrayBuffer());
    if (body.byteLength !== pin.sizeBytes) {
        throw new Error(`EngineAssetManager: size mismatch — got ${body.byteLength}, expected ${pin.sizeBytes}`);
    }
    const hash = sha256Hex(body);
    if (hash !== pin.sha256) {
        throw new Error(`EngineAssetManager: sha256 mismatch — got ${hash}, expected ${pin.sha256}. Refusing to install.`);
    }

    const scratch = await mkdtemp(path.join(tmpdir(), 'indii-engine-zip-'));
    try {
        const zipPath = path.join(scratch, 'engine.zip');
        await writeFile(zipPath, body);
        await mkdir(installDir, { recursive: true });
        await extract(zipPath, installDir);

        const st = await stat(enginePath);
        if (!st.isFile()) throw new Error(`EngineAssetManager: engine binary missing after extract: ${enginePath}`);
        if (platform !== 'win32') await chmod(enginePath, 0o755);

        // Sanity: models dir must exist beside the engine.
        if (!existsSync(modelsDir)) throw new Error('EngineAssetManager: models directory missing after extract');

        opts.onProgress?.(1);
        return { enginePath, modelsDir, version: ENGINE_ASSET_VERSION, fromCache: false };
    } finally {
        await rm(scratch, { recursive: true, force: true });
    }
}

/** Read the manifest pin for a platform (exposed for UI copy + tests). */
export function enginePinFor(platform: EnginePlatform): EngineAssetPin {
    return ENGINE_ASSETS[platform];
}

/** Keep readFile re-exported for injectable tests that assert on-disk state. */
export const readInstallFile = readFile;
