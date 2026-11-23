import { existsSync } from 'node:fs';
import path from 'node:path';

export const LOCAL_UNSIGNED_BUILD_MARKER = '.indii-local-unsigned-build';

export const RELEASES_REPO = 'indii-music-founder/indii-music-founder';

export function isLocalUnsignedBuild(resourcesPath: string): boolean {
    return existsSync(path.join(resourcesPath, LOCAL_UNSIGNED_BUILD_MARKER));
}

/**
 * macOS builds ship unsigned (electron-builder `mac.identity: null`), and
 * Squirrel.Mac refuses to swap in an update that has no code signature. On
 * macOS the app therefore opens the release page so the artist downloads the
 * new installer; other platforms download and install in place.
 */
export function canInstallInPlace(platform: NodeJS.Platform): boolean {
    return platform !== 'darwin';
}

/** Release page for a version, or the latest release when the version is not plain semver. */
export function releaseDownloadUrl(version: string | undefined): string {
    const clean = (version ?? '').trim().replace(/^v/, '');
    if (/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/.test(clean)) {
        return `https://github.com/${RELEASES_REPO}/releases/tag/v${clean}`;
    }
    return `https://github.com/${RELEASES_REPO}/releases/latest`;
}

/** True when `remote` is a higher major.minor.patch than `current` (pre-release tags ignored). */
export function isNewerVersion(remote: string, current: string): boolean {
    const parse = (v: string) => v.replace(/^v/, '').split('-')[0].split('.').map(n => parseInt(n, 10) || 0);
    const r = parse(remote);
    const c = parse(current);
    for (let i = 0; i < Math.max(r.length, c.length); i++) {
        const rPart = r[i] ?? 0;
        const cPart = c[i] ?? 0;
        if (rPart > cPart) return true;
        if (rPart < cPart) return false;
    }
    return false;
}
