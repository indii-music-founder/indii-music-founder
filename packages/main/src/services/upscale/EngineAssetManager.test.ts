/**
 * EngineAssetManager tests (ISSUE-323).
 *
 * Download, extraction, and platform are injectable — no network, no real
 * upstream dependency. The canonical manifest pins are NOT exercised here
 * (they describe 45–52MB upstream artifacts); the CONTRACT under test is
 * cache short-circuit, verify-fail-closed, and correct install layout.
 */

import { chmod, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';

import {
    ensureEngineAssets,
    enginePinFor,
    type DownloadResponse,
    type EngineAssetPin,
    type Extractor,
    type Fetcher,
} from './EngineAssetManager';

let dir: string;

const FIXTURE = Uint8Array.from([0x50, 0x4b, 0x03, 0x04, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
const FIXTURE_SHA = createHash('sha256').update(FIXTURE).digest('hex');

function fixturePin(): EngineAssetPin {
    return {
        url: 'https://example.test/engine.zip',
        sizeBytes: FIXTURE.byteLength,
        sha256: FIXTURE_SHA,
        engineRelativePath: 'realesrgan-ncnn-vulkan',
    };
}

function okFetcher(): Fetcher {
    return vi.fn(async (): Promise<DownloadResponse> => ({
        status: 200,
        arrayBuffer: async () => FIXTURE.buffer.slice(FIXTURE.byteOffset, FIXTURE.byteOffset + FIXTURE.byteLength),
    }));
}

/** Simulated extraction: reads the verified zip bytes and lays out the bundle. */
function fakeExtractor(mutateBody?: (bytes: Uint8Array) => Uint8Array): Extractor {
    return async (zipPath, destDir) => {
        let body: Uint8Array = new Uint8Array(await readFile(zipPath));
        if (mutateBody) body = mutateBody(body);
        await mkdir(path.join(destDir, 'models'), { recursive: true });
        await writeFile(path.join(destDir, 'realesrgan-ncnn-vulkan'), body);
        await writeFile(path.join(destDir, 'models', 'realesrgan-x4plus-anime.bin'), Buffer.alloc(4));
    };
}

beforeEach(async () => {
    dir = await mkdtemp(path.join(tmpdir(), 'engine-assets-test-'));
});

afterAll(async () => {
    await rm(dir, { recursive: true, force: true });
});

describe('ensureEngineAssets', () => {
    it('short-circuits to cache when the engine binary already exists', async () => {
        const installDir = path.join(dir, 'cached');
        await mkdir(path.join(installDir, 'models'), { recursive: true });
        await writeFile(path.join(installDir, 'realesrgan-ncnn-vulkan'), Buffer.alloc(2));

        const fetcher = vi.fn(okFetcher());
        const install = await ensureEngineAssets({ installDir, fetcher, pin: fixturePin() });

        expect(install.fromCache).toBe(true);
        expect(install.enginePath).toBe(path.join(installDir, 'realesrgan-ncnn-vulkan'));
        expect(fetcher).not.toHaveBeenCalled();
    });

    it('downloads, verifies, extracts, and lays out the install', async () => {
        const installDir = path.join(dir, 'fresh');
        const install = await ensureEngineAssets({
            installDir,
            fetcher: okFetcher(),
            extractor: fakeExtractor(),
            pin: fixturePin(),
        });

        expect(install.fromCache).toBe(false);
        expect(install.version).toBeTruthy();
        expect(existsSync(install.enginePath)).toBe(true);
        expect(existsSync(install.modelsDir)).toBe(true);
        // chmod +x applied on posix
        if (process.platform !== 'win32') {
            const st = await readFile(install.enginePath);
            expect(st.equals(Buffer.from(FIXTURE))).toBe(true);
        }
    });

    it('rejects on size mismatch and installs nothing', async () => {
        const pin = { ...fixturePin(), sizeBytes: FIXTURE.byteLength + 1 };
        await expect(ensureEngineAssets({
            installDir: path.join(dir, 'bad-size'),
            fetcher: okFetcher(),
            extractor: fakeExtractor(),
            pin,
        })).rejects.toThrow(/size mismatch/);
        expect(existsSync(path.join(dir, 'bad-size'))).toBe(false);
    });

    it('rejects on sha256 mismatch and installs nothing', async () => {
        const pin = { ...fixturePin(), sha256: 'f'.repeat(64) };
        await expect(ensureEngineAssets({
            installDir: path.join(dir, 'bad-hash'),
            fetcher: okFetcher(),
            extractor: fakeExtractor(),
            pin,
        })).rejects.toThrow(/sha256 mismatch/);
        expect(existsSync(path.join(dir, 'bad-hash'))).toBe(false);
    });

    it('rejects on non-200 download', async () => {
        const fetcher: Fetcher = vi.fn(async (): Promise<DownloadResponse> => ({ status: 404, arrayBuffer: async () => new ArrayBuffer(0) }));
        await expect(ensureEngineAssets({
            installDir: path.join(dir, 'http404'),
            fetcher,
            extractor: fakeExtractor(),
            pin: fixturePin(),
        })).rejects.toThrow(/HTTP 404/);
    });

    it('rejects when extraction yields no models directory', async () => {
        const incomplete: Extractor = async (zipPath, destDir) => {
            const body = new Uint8Array(await readFile(zipPath));
            await writeFile(path.join(destDir, 'realesrgan-ncnn-vulkan'), body);
        };
        await expect(ensureEngineAssets({
            installDir: path.join(dir, 'no-models'),
            fetcher: okFetcher(),
            extractor: incomplete,
            pin: fixturePin(),
        })).rejects.toThrow(/models directory missing/);
    });
});

describe('canonical manifest', () => {
    it('pins exist for all three desktop platforms with matching hash format', () => {
        for (const platform of ['darwin', 'win32', 'linux'] as const) {
            const pin = enginePinFor(platform);
            expect(pin.url).toMatch(/^https:\/\/github\.com\//);
            expect(pin.sha256).toMatch(/^[0-9a-f]{64}$/);
            expect(pin.sizeBytes).toBeGreaterThan(40_000_000);
            expect(pin.engineRelativePath).toMatch(/^realesrgan-ncnn-vulkan(\.exe)?$/);
        }
    });
});
