import { describe, it, expect, afterEach } from 'vitest';
import { BrowserAgentService } from './BrowserAgentService';

/**
 * ISSUE-972: real end-to-end desktop browser automation does not work in
 * any current build (phantom electronAPI.browserAgent reference, dev-only
 * IPC gating, and a coordinate-vs-selector action-model mismatch). The
 * service must report itself unconfigured rather than implying automatic
 * filing works today.
 */
describe('BrowserAgentService (ISSUE-972)', () => {
    afterEach(() => {
        delete (window as unknown as Record<string, unknown>).electronAPI;
    });

    it('reports unconfigured even when window.electronAPI is present', () => {
        (window as unknown as Record<string, unknown>).electronAPI = { agent: {} };
        const service = new BrowserAgentService();
        expect(service.isConfigured()).toBe(false);
    });

    it('reports unconfigured in a plain web context', () => {
        const service = new BrowserAgentService();
        expect(service.isConfigured()).toBe(false);
    });

    it('executeTask rejects immediately instead of attempting a phantom IPC call', async () => {
        (window as unknown as Record<string, unknown>).electronAPI = { agent: {} };
        const service = new BrowserAgentService();
        await expect(service.executeTask('MLC', 'register a work', 'https://portal.themlc.com'))
            .rejects.toThrow('Browser agent is not configured');
    });
});
