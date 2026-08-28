/**
 * HyperFramesAdapter contract compliance (MIG-006).
 * Runs the SHARED suite against the real local engine — tiny fixture
 * composition rendered for real, byte-level outputs asserted elsewhere.
 */

import { existsSync } from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { afterEach, beforeEach, describe, expect } from 'vitest';

import { runVideoRendererContractSuite } from '@shared/testing/videoRendererSuite';
import type { RendererContractScenario } from '@shared/testing/videoRendererSuite';

import { HyperFramesAdapter } from './HyperFramesAdapter';

const MINIMAL_INDEX = (title: string): string => `<!doctype html>
<html lang="en"><head><meta charset="UTF-8" />
<meta name="viewport" content="width=640, height=360" />
<script src="./gsap.min.js"></script>
<style>
  body { margin:0; background:#0b0f14; color:#fff; font-family:sans-serif; }
  #root { position:relative; width:640px; height:360px; overflow:hidden; }
  .clip { position:absolute; inset:0; display:grid; place-items:center; }
</style></head>
<body><div id="root" data-composition-id="main" data-start="0"
  data-width="640" data-height="360" data-duration="2">
  <section id="card" class="clip" data-start="0" data-duration="2" data-track-index="1">
    <h1 id="t">${title}</h1>
  </section>
</div>
<script>
  window.__timelines = window.__timelines || {};
  const tl = gsap.timeline({ paused: true });
  tl.from("#t", { opacity: 0, duration: 0.4 }, 0.1);
  window.__timelines["main"] = tl;
</script></body></html>`;

describe('HyperFramesAdapter', () => {
    let dir: string;
    let projectDir: string;

    beforeEach(async () => {
        dir = await mkdtemp(path.join(tmpdir(), 'hf-adapter-'));
        projectDir = path.join(dir, 'comp');
        await mkdir(projectDir);
        await writeFile(path.join(projectDir, 'index.html'), MINIMAL_INDEX('suite'));
    }, 30_000);

    afterEach(async () => {
        if (dir) await rm(dir, { recursive: true, force: true });
    });

    runVideoRendererContractSuite('HyperFramesAdapter (local engine)', (): RendererContractScenario => {
        const adapter = new HyperFramesAdapter();
        let seq = 0;
        return {
            makeAdapter: () => adapter,
            baseConfig: () => {
                seq += 1;
                return {
                    compositionId: 'main',
                    outputLocation: path.join(dir, `out-${seq}.mp4`),
                    projectId: 'proj-1',
                    organizationId: 'org-1',
                    inputProps: { projectDir },
                };
            },
            complete: async (renderId) => {
                // Real engine: wait until the CLI process reaches a terminal state.
                const deadline = Date.now() + 120_000;
                while (Date.now() < deadline) {
                    const receipt = await adapter.getRenderReceipt(renderId);
                    if (receipt.status === 'completed' || receipt.status === 'failed') return;
                    await new Promise(r => setTimeout(r, 100));
                }
                throw new Error('hyperframes render did not finish in time');
            },
            fail: async (renderId, message) => {
                adapter._failJob(renderId, message);
            },
            dispose: async () => undefined,
        };
    });

    it('writes a real playable artifact on completion', async () => {
        const adapter = new HyperFramesAdapter();
        const out = path.join(dir, 'artifact.mp4');
        const done = await adapter.renderCompositionCloud({
            compositionId: 'main',
            outputLocation: out,
            projectId: 'proj-1',
            organizationId: 'org-1',
            inputProps: { projectDir },
        });
        expect(done.status).toBe('completed');
        expect(existsSync(out)).toBe(true);
    }, 120_000);
});
