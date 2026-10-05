import assert from 'node:assert/strict';
import { cp, mkdtemp, access, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

// Real processes and real MCP messages, outside the checkout: missing runtime
// dependencies cannot be borrowed from the repository's node_modules. This is
// package/protocol verification, not customer authentication or render proof.
export async function verifyBundledMcp(packages = {
    local: path.join(root, 'dist/bundled-mcp/local'),
    harness: path.join(root, 'dist/bundled-mcp/harness'),
}) {
    const isolated = await mkdtemp(path.join(os.tmpdir(), 'indii-bundled-mcp-'));
    try {
        for (const name of ['local', 'harness']) {
            const destination = path.join(isolated, name);
            await cp(packages[name], destination, { recursive: true });
            const client = new Client({ name: 'indii-package-verifier', version: '1.0.0' }, { capabilities: {} });
            let timer;
            try {
                const verify = async () => {
                    await client.connect(new StdioClientTransport({
                        command: process.execPath,
                        args: [path.join(destination, 'dist/index.js')],
                        cwd: isolated,
                        env: { PATH: process.env.PATH || '', ELECTRON_RUN_AS_NODE: '1' },
                        stderr: 'pipe',
                    }));
                    const tools = (await client.listTools()).tools.map(tool => tool.name);
                    if (name === 'local') {
                        for (const tool of ['blender_get_status', 'blender_list_templates',
                            'blender_render_music_video', 'blender_live_command']) assert(tools.includes(tool));
                        const status = await client.callTool({ name: 'blender_get_status', arguments: {} });
                        assert(!status.isError);
                        const parsed = JSON.parse(status.content[0].text);
                        assert.equal(typeof parsed.installed, 'boolean');
                        assert.equal(typeof parsed.liveConnected, 'boolean');
                        const templates = await client.callTool({ name: 'blender_list_templates', arguments: {} });
                        assert(!templates.isError);
                        assert.equal(JSON.parse(templates.content[0].text).length, 5);
                        for (const script of ['runner.py', 'audio_baker.py',
                            'templates/audio_tunnel.py', 'templates/vinyl_turntable.py',
                            'templates/chrome_text.py', 'templates/spectrum_bars.py', 'templates/concert_stage.py']) {
                            await access(path.join(destination, 'dist/python', script));
                        }
                    } else {
                        assert(tools.includes('list_harness_catalog'));
                        const catalog = await client.callTool({ name: 'list_harness_catalog', arguments: {} });
                        assert(!catalog.isError);
                        assert(catalog.content[0].text.length > 0);
                    }
                };
                await Promise.race([verify(), new Promise((_, reject) => {
                    timer = setTimeout(() => reject(new Error(`${name} package verification timed out`)), 20_000);
                })]);
                console.log(`Verified isolated ${name} MCP package and actual tool responses.`);
            } finally {
                clearTimeout(timer);
                await client.close();
            }
        }
    } finally {
        await rm(isolated, { recursive: true, force: true });
    }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
    await verifyBundledMcp();
}
