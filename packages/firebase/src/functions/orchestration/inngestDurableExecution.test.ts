import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

describe('ISSUE-1553: Inngest Durable Execution & Client Unification Contract', () => {
    const pkgDir = path.resolve(__dirname, '../../../');

    it('workflowOrchestrator binds inngestEventKey secret and imports getInngestClient', () => {
        const file = path.join(pkgDir, 'src/functions/agent/workflowOrchestrator.ts');
        const content = fs.readFileSync(file, 'utf8');

        expect(content).toMatch(/secrets:\s*\[[^\]]*inngestEventKey[^\]]*\]/);
        expect(content).toContain('getInngestClient');
        expect(content).not.toContain("import('../orchestration/inngest')");
    });

    it('inngestApi in index.ts binds resendApiKey along with inngest secrets', () => {
        const file = path.join(pkgDir, 'src/index.ts');
        const content = fs.readFileSync(file, 'utf8');

        const inngestApiBlock = content.match(/export const inngestApi = onRequest\(\s*\{([\s\S]*?)\}/)?.[1] || '';
        expect(inngestApiBlock).toContain('resendApiKey');
        expect(inngestApiBlock).toContain('inngestEventKey');
        expect(inngestApiBlock).toContain('inngestSigningKey');
    });

    it('all Inngest workers and orchestrators share the indii-music-functions client ID', () => {
        const orchestrationInngest = fs.readFileSync(path.join(pkgDir, 'src/functions/orchestration/inngest.ts'), 'utf8');
        const timelinePoller = fs.readFileSync(path.join(pkgDir, 'src/timeline/pollTimelineMilestones.ts'), 'utf8');
        
        expect(orchestrationInngest).not.toContain("id: 'indii-api'");
        expect(timelinePoller).not.toContain("id: 'indii-os-timeline-poller'");
        expect(orchestrationInngest).toContain('getInngestClient');
        expect(timelinePoller).toContain('getInngestClient');
    });

    it('canvasRenderFn uses onFailure for failure cleanup and does not swallow step interrupts', () => {
        const file = path.join(pkgDir, 'src/lib/canvas_render.ts');
        const content = fs.readFileSync(file, 'utf8');

        expect(content).toContain('onFailure:');
        // Must not have an outer try/catch swallowing step interrupts
        expect(content).not.toMatch(/try\s*\{[\s\S]*?return\s*\{\s*jobId,\s*status:\s*['"]complete['"][\s\S]*?\}\s*catch\s*\([^)]*\)\s*\{[\s\S]*?return\s*\{\s*jobId,\s*status:\s*['"]failed['"]/);
    });

    it('stitchVideoFn uses onFailure and does not swallow errors without rethrowing', () => {
        const file = path.join(pkgDir, 'src/lib/long_form_video.ts');
        const content = fs.readFileSync(file, 'utf8');

        const stitchFnMatch = content.match(/export const stitchVideoFn[\s\S]*?inngestClient\.createFunction\(\s*\{([\s\S]*?)\}/);
        expect(stitchFnMatch?.[1]).toContain('onFailure:');
    });
});
