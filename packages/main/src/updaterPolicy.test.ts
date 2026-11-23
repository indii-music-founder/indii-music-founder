import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { canInstallInPlace, isLocalUnsignedBuild, isNewerVersion, LOCAL_UNSIGNED_BUILD_MARKER, releaseDownloadUrl } from './updaterPolicy';

describe('updaterPolicy', () => {
    let resourcesPath: string;

    beforeEach(() => {
        resourcesPath = mkdtempSync(path.join(tmpdir(), 'indii-updater-policy-'));
    });

    afterEach(() => {
        rmSync(resourcesPath, { recursive: true, force: true });
    });

    it('disables public updates when the local unsigned marker exists', () => {
        writeFileSync(path.join(resourcesPath, LOCAL_UNSIGNED_BUILD_MARKER), '');

        expect(isLocalUnsignedBuild(resourcesPath)).toBe(true);
    });

    it('keeps public updates enabled for release bundles without the marker', () => {
        expect(isLocalUnsignedBuild(resourcesPath)).toBe(false);
    });

    it('sends unsigned macOS builds to the release page instead of installing in place', () => {
        expect(canInstallInPlace('darwin')).toBe(false);
        expect(canInstallInPlace('win32')).toBe(true);
        expect(canInstallInPlace('linux')).toBe(true);
    });

    it('links the exact release tag for a semver version', () => {
        expect(releaseDownloadUrl('2.0.0')).toBe('https://github.com/indii-music-founder/indii-music-founder/releases/tag/v2.0.0');
        expect(releaseDownloadUrl('v2.1.0-beta.1')).toBe('https://github.com/indii-music-founder/indii-music-founder/releases/tag/v2.1.0-beta.1');
    });

    it('falls back to the latest release for anything that is not a version', () => {
        expect(releaseDownloadUrl(undefined)).toBe('https://github.com/indii-music-founder/indii-music-founder/releases/latest');
        expect(releaseDownloadUrl('Unknown')).toBe('https://github.com/indii-music-founder/indii-music-founder/releases/latest');
        expect(releaseDownloadUrl('2.0.0/../../evil')).toBe('https://github.com/indii-music-founder/indii-music-founder/releases/latest');
    });

    it('treats only a higher version as an update', () => {
        expect(isNewerVersion('2.0.0', '1.83.0')).toBe(true);
        expect(isNewerVersion('v1.83.0', '1.80.1')).toBe(true);
        expect(isNewerVersion('2.0.0', '2.0.0')).toBe(false);
        expect(isNewerVersion('1.83.0', '2.0.0')).toBe(false);
    });
});
