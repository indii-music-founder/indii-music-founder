/**
 * Engine Asset Manifest — CANONICAL, GENERATED FILE (ISSUE-323).
 *
 * Single source of truth for the local upscale engine distribution
 * (realesrgan-ncnn-vulkan, BSD-3-Clause; ncnn runtime, MIT — commercial use OK).
 * The zip bundles the engine binary plus all models (x4plus, x4plus-anime,
 * realesr-animevideov3-x2/x3/x4).
 *
 * REGEN COMMAND (after choosing a new upstream release — update version,
 * sizes, and hashes from the ACTUAL downloaded artifacts, never from a page):
 *
 *   curl -sL -o /tmp/ea/<asset>.zip \
 *     https://github.com/xinntao/Real-ESRGAN/releases/download/<tag>/<asset>.zip \
 *     && shasum -a 256 /tmp/ea/<asset>.zip && stat -f%z /tmp/ea/<asset>.zip
 *
 * Pinned release: xinntao/Real-ESRGAN tag v0.2.5.0 (20220424 builds).
 * Hashes below were computed from the real artifacts on 2026-09-26.
 */

export interface EngineAssetPin {
    url: string;
    sizeBytes: number;
    sha256: string;
    /** Engine binary path INSIDE the extracted bundle. */
    engineRelativePath: string;
}

export const ENGINE_ASSET_VERSION = 'v0.2.5.0';

export const ENGINE_ASSETS: Record<'darwin' | 'win32' | 'linux', EngineAssetPin> = {
    darwin: {
        url: 'https://github.com/xinntao/Real-ESRGAN/releases/download/v0.2.5.0/realesrgan-ncnn-vulkan-20220424-macos.zip',
        sizeBytes: 51817124,
        sha256: 'e0ad05580abfeb25f8d8fb55aaf7bedf552c375b5b4d9bd3c8d59764d2cc333a',
        engineRelativePath: 'realesrgan-ncnn-vulkan',
    },
    win32: {
        url: 'https://github.com/xinntao/Real-ESRGAN/releases/download/v0.2.5.0/realesrgan-ncnn-vulkan-20220424-windows.zip',
        sizeBytes: 45474481,
        sha256: 'abc02804e17982a3be33675e4d471e91ea374e65b70167abc09e31acb412802d',
        engineRelativePath: 'realesrgan-ncnn-vulkan.exe',
    },
    linux: {
        url: 'https://github.com/xinntao/Real-ESRGAN/releases/download/v0.2.5.0/realesrgan-ncnn-vulkan-20220424-ubuntu.zip',
        sizeBytes: 46931474,
        sha256: 'e5aa6eb131234b87c0c51f82b89390f5e3e642b7b70f2b9bbe95b6a285a40c96',
        engineRelativePath: 'realesrgan-ncnn-vulkan',
    },
};
