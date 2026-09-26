/**
 * Upscale IPC handlers (ISSUE-323).
 *
 * Bridge between the renderer facade and the local engine. The renderer never
 * touches file paths: it sends a data URL and receives a data URL. All bytes
 * land in temp files inside the main process, the engine runs on them, and
 * the result comes back base64-encoded.
 */

import { ipcMain } from 'electron';
import { z } from 'zod';
import { validateSender } from '../utils/ipc-security';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { runUpscale, probeEngine } from '../services/upscale/UpscaleExecutor';
import { ensureEngineAssets, type EngineInstall } from '../services/upscale/EngineAssetManager';
import { ENGINE_ASSET_VERSION } from '../services/upscale/engineAssets.generated';

const MAX_INPUT_BYTES = 64 * 1024 * 1024; // 4096² PNG can reach ~30MB

const ALLOWED_MODELS = [
    'realesrgan-x4plus',
    'realesrgan-x4plus-anime',
    'realesr-animevideov3-x2',
    'realesr-animevideov3-x3',
    'realesr-animevideov3-x4',
] as const;

const UpscaleRunSchema = z.object({
    requestId: z.string().min(6).max(64),
    dataUrl: z.string().regex(/^data:image\/(png|jpeg);base64,/).max(MAX_INPUT_BYTES * 2),
    scale: z.union([z.literal(2), z.literal(4)]),
    model: z.enum(ALLOWED_MODELS).optional(),
    tilePx: z.number().int().min(128).max(2048).optional(),
});

const decodeDataUrl = (dataUrl: string): Uint8Array => {
    const commaIdx = dataUrl.indexOf(',');
    const b64 = dataUrl.slice(commaIdx + 1);
    const buffer = Buffer.from(b64, 'base64');
    if (buffer.byteLength === 0) throw new Error('upscale: empty image payload');
    if (buffer.byteLength > MAX_INPUT_BYTES) throw new Error(`upscale: image payload exceeds ${MAX_INPUT_BYTES} bytes`);
    return new Uint8Array(buffer);
};

const encodeDataUrl = (bytes: Buffer, ext: string): string =>
    `data:image/${ext === 'jpg' ? 'jpeg' : 'png'};base64,${bytes.toString('base64')}`;

/** Install dir persists across sessions inside the Electron user-data tree. */
const installDir = (): string => path.join(tmpdir(), `indii-upscale-${ENGINE_ASSET_VERSION}`);

let engineReady: Promise<EngineInstall> | null = null;

const ensureEngine = async (): Promise<EngineInstall> => {
    engineReady ??= ensureEngineAssets({ installDir: installDir() });
    return engineReady;
};

/** Test hook: resets the cached provisioning promise. */
export const resetEngineCache = (): void => {
    engineReady = null;
};

export const registerUpscaleHandlers = (): void => {
    ipcMain.handle('upscale:ensure-engine', async (event) => {
        try {
            validateSender(event);
            const install = await ensureEngine();
            return { enginePath: install.enginePath, version: install.version, fromCache: install.fromCache };
        } catch (error) {
            engineReady = null; // allow a clean retry after a failed provision
            throw error;
        }
    });

    ipcMain.handle('upscale:probe', async (event) => {
        validateSender(event);
        const { enginePath } = await ensureEngine();
        return probeEngine({ engine: enginePath });
    });

    ipcMain.handle('upscale:run', async (event, raw: unknown) => {
        let scratch: string | null = null;
        try {
            validateSender(event);
            const req = UpscaleRunSchema.parse(raw);
            const { enginePath } = await ensureEngine();

            const inputBytes = decodeDataUrl(req.dataUrl);
            scratch = await mkdtemp(path.join(tmpdir(), 'indii-upscale-run-'));
            const ext = req.dataUrl.startsWith('data:image/jpeg') ? 'jpg' : 'png';
            const inputPath = path.join(scratch, `in.${ext}`);
            const outputPath = path.join(scratch, `out.${ext}`);
            await writeFile(inputPath, inputBytes);

            const outcome = await runUpscale(
                {
                    inputPath,
                    outputPath,
                    scale: req.scale,
                    model: req.model,
                    tilePx: req.tilePx,
                    signal: undefined,
                    onProgress: (fraction) => {
                        if (!event.sender.isDestroyed()) {
                            event.sender.send('upscale:progress', { requestId: req.requestId, fraction });
                        }
                    },
                },
                { engine: enginePath },
            );

            if (!existsSync(outcome.outputPath)) throw new Error('upscale: output missing after run');
            const outputBytes = await readFile(outcome.outputPath);
            return {
                outputDataUrl: encodeDataUrl(outputBytes, ext),
                durationMs: outcome.durationMs,
            };
        } finally {
            if (scratch) await rm(scratch, { recursive: true, force: true }).catch(() => {});
        }
    });
};
