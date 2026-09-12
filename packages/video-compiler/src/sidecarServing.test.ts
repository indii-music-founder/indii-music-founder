/**
 * Sidecar serving guard (browser live compiled preview).
 *
 * The compiled composition references its GSAP runtime as
 * `<script src="./gsap.min.js"></script>`. Executors materialize that sidecar:
 * desktop render copies it into the temp dir, the web player serves it from
 * `packages/renderer/public/`. These copies MUST stay byte-identical — a
 * drifted copy means the editor preview plays animations the renderer (or
 * vice versa) never reproduces.
 *
 * The HyperFrames runtime served to the web player
 * (`packages/renderer/public/hyperframe.runtime.iife.js`) must likewise be the
 * exact `@hyperframes/core` build the installed `@hyperframes/player` pins.
 */

import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const pkgRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const repoRoot = resolve(pkgRoot, '..', '..');

const read = (relativePath: string): Buffer =>
    readFileSync(resolve(repoRoot, relativePath));

const COMPILER_SIDECAR = 'packages/video-compiler/src/__fixtures__/gsap.min.js';
const DESKTOP_SIDECAR = 'packages/main/src/services/video/hyperframes/__fixtures__/gsap.min.js';
const WEB_SIDECAR = 'packages/renderer/public/gsap.min.js';
const WEB_RUNTIME = 'packages/renderer/public/hyperframe.runtime.iife.js';
const CORE_RUNTIME = 'node_modules/@hyperframes/core/dist/hyperframe.runtime.iife.js';

describe('gsap.min.js sidecar copies stay byte-identical', () => {
    it('web-served sidecar matches the compiler fixture', () => {
        expect(read(WEB_SIDECAR).equals(read(COMPILER_SIDECAR))).toBe(true);
    });

    it('desktop render sidecar matches the compiler fixture', () => {
        expect(read(DESKTOP_SIDECAR).equals(read(COMPILER_SIDECAR))).toBe(true);
    });
});

describe('hyperframes runtime served to the web player', () => {
    it('is byte-identical to the @hyperframes/core dist the player pins', () => {
        expect(read(WEB_RUNTIME).equals(read(CORE_RUNTIME))).toBe(true);
    });

    it('matches the @hyperframes/core version declared by the installed player', () => {
        const player = JSON.parse(read('node_modules/@hyperframes/player/package.json').toString('utf8')) as {
            version: string;
            dependencies: Record<string, string>;
        };
        const core = JSON.parse(read('node_modules/@hyperframes/core/package.json').toString('utf8')) as {
            version: string;
        };

        expect(player.dependencies['@hyperframes/core']).toBe(core.version);
        // If the player was upgraded without refreshing public/hyperframe.runtime.iife.js
        // (and the byte-identical check above), this is the reminder to re-copy it.
        expect(player.version).toBeDefined();
    });
});
