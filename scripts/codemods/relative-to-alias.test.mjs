#!/usr/bin/env node
import test from 'node:test';
import assert from 'node:assert/strict';
import { rewriteSource, resolveRelativeSpecifier } from './relative-to-alias.mjs';

function makeFs(files) {
    const set = new Set(files);
    return (_root, p) => set.has(p);
}

test('rewrites static from, export from, bare import, dynamic import, and vi.mock/doMock/importActual', () => {
    const fileExists = makeFs([
        'packages/renderer/src/modules/foo/helper.ts',
        'packages/renderer/src/core/store/index.ts',
        'packages/renderer/src/index.css',
        'packages/shared/src/types/music.ts',
    ]);

    const input = [
        "import { a } from './helper';",
        "export { b } from '../../core/store';",
        "import '../../index.css';",
        "import type { Track } from '../../../../shared/src/types/music';",
        "const mod = await import('./helper');",
        "vi.mock('../../core/store', () => ({}));",
        "vi.doMock('./helper', () => ({}));",
        "const actual = await vi.importActual<typeof import('./helper')>('./helper');",
        "// import { ignored } from './helper';",
        "const worker = new Worker(new URL('./helper', import.meta.url));",
        "const glob = import.meta.glob('./*.md');",
    ].join('\n');

    const res = rewriteSource(input, 'packages/renderer/src/modules/foo/Bar.tsx', { fileExists });

    assert.equal(res.changed, true);
    assert.equal(res.unresolved.length, 0);
    assert.equal(res.crossPackage.length, 0);
    assert.equal(res.rewritten.length, 9);

    const lines = res.code.split('\n');
    assert.equal(lines[0], "import { a } from '@/modules/foo/helper';");
    assert.equal(lines[1], "export { b } from '@/core/store';");
    assert.equal(lines[2], "import '@/index.css';");
    assert.equal(lines[3], "import type { Track } from '@shared/types/music';");
    assert.equal(lines[4], "const mod = await import('@/modules/foo/helper');");
    assert.equal(lines[5], "vi.mock('@/core/store', () => ({}));");
    assert.equal(lines[6], "vi.doMock('@/modules/foo/helper', () => ({}));");
    assert.equal(lines[7], "const actual = await vi.importActual<typeof import('@/modules/foo/helper')>('@/modules/foo/helper');");
    // Comment, new URL, and import.meta.glob MUST remain untouched
    assert.equal(lines[8], "// import { ignored } from './helper';");
    assert.equal(lines[9], "const worker = new Worker(new URL('./helper', import.meta.url));");
    assert.equal(lines[10], "const glob = import.meta.glob('./*.md');");
});

test('reports cross-package and unresolved specifiers without mutating them', () => {
    const fileExists = makeFs([
        'packages/main/src/utils/AgentSupervisor.ts',
    ]);

    const input = [
        "const { AgentSupervisor } = await import('../../../../main/src/utils/AgentSupervisor');",
        "vi.mock('./doesNotExist', () => ({}));",
    ].join('\n');

    const res = rewriteSource(input, 'packages/renderer/src/features/audio/AudioFidelityFeature.ts', { fileExists });

    assert.equal(res.changed, false);
    assert.equal(res.code, input);
    assert.equal(res.crossPackage.length, 1);
    assert.equal(res.crossPackage[0].resolved, 'packages/main/src/utils/AgentSupervisor');
    assert.equal(res.unresolved.length, 1);
    assert.equal(res.unresolved[0].specifier, './doesNotExist');
});

test('preserves Vite query suffixes like ?raw', () => {
    const fileExists = makeFs(['packages/renderer/src/prompts/sys.md']);
    const res = resolveRelativeSpecifier(
        'packages/renderer/src/prompts/loader.ts',
        './sys.md?raw',
        { fileExists },
    );
    assert.deepEqual(res, { status: 'rewritten', replacement: '@/prompts/sys.md?raw' });
});
