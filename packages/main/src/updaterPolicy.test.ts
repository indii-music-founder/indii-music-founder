import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { isLocalUnsignedBuild, LOCAL_UNSIGNED_BUILD_MARKER } from './updaterPolicy';

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
});
