#!/usr/bin/env node
import assert from 'node:assert/strict';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { build, loadConfigFromFile } from 'vite';

const root = fileURLToPath(new URL('../', import.meta.url));
const resolver = resolve(root, 'packages/renderer/src/modules/boardroom/components/boardroomBrowserEndpoint.ts');
const endpoint = 'wss://browser.example.com';

for (const configFile of ['electron.vite.config.ts', 'packages/renderer/vite.config.ts']) {
    test(`${configFile} compiles the hosted browser settings into the renderer`, async () => {
        const keys = ['VITE_APP_TARGET', 'VITE_BOARDROOM_BROWSER_ENABLED', 'VITE_BOARDROOM_BROWSER_URL'];
        const previous = new Map(keys.map(key => [key, process.env[key]]));
        const directory = await mkdtemp(join(tmpdir(), 'boardroom-env-build-'));
        try {
            process.env.VITE_APP_TARGET = 'web';
            process.env.VITE_BOARDROOM_BROWSER_URL = endpoint;
            const loaded = await loadConfigFromFile({ command: 'build', mode: 'production' }, resolve(root, configFile));
            assert.ok(loaded, 'The real renderer build configuration must load');
            const renderer = loaded.config.renderer ?? loaded.config;
            const entry = join(directory, 'entry.ts');
            await writeFile(entry, `
                import { resolveBoardroomBrowserEndpoint } from ${JSON.stringify(resolver)};
                export const enabled = import.meta.env.VITE_BOARDROOM_BROWSER_ENABLED === 'true';
                export const endpoint = resolveBoardroomBrowserEndpoint({
                    enabled,
                    configuredEndpoint: import.meta.env.VITE_BOARDROOM_BROWSER_URL,
                    isDev: import.meta.env.DEV,
                    hostname: 'app.indii.music',
                });
            `);
            for (const enabled of ['true', 'false']) {
                process.env.VITE_BOARDROOM_BROWSER_ENABLED = enabled;
                const result = await build({
                    configFile: false,
                    root: directory,
                    envPrefix: renderer.envPrefix,
                    define: renderer.define,
                    plugins: renderer.plugins.filter(plugin => plugin?.name === 'env-sanitizer'),
                    logLevel: 'silent',
                    build: { write: false, minify: false, lib: { entry, formats: ['es'] } },
                });
                const outputs = Array.isArray(result) ? result : [result];
                const entries = outputs.flatMap(output => 'output' in output ? output.output : [])
                    .filter(item => item.type === 'chunk' && item.isEntry);
                assert.equal(entries.length, 1, 'Exactly one renderer entry must compile');
                const [chunk] = entries;
                const compiled = await import(`data:text/javascript;base64,${Buffer.from(chunk.code).toString('base64')}`);
                assert.equal(compiled.enabled, enabled === 'true');
                assert.equal(compiled.endpoint, enabled === 'true' ? `${endpoint}/boardroom` : undefined);
            }
        } finally {
            for (const [key, value] of previous) {
                if (value === undefined) delete process.env[key];
                else process.env[key] = value;
            }
            await rm(directory, { recursive: true, force: true });
        }
    });
}
