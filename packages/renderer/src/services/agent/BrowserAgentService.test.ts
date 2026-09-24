import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_ARTIST_OPERATING_PROFILE } from '@indii/shared';

const { getProfile } = vi.hoisted(() => ({ getProfile: vi.fn() }));
vi.mock('./governance/ArtistOperatingProfileService', () => ({
    artistOperatingProfileService: { getProfile },
}));

import { BrowserAgentService } from './BrowserAgentService';

/**
 * ISSUE-972: real end-to-end desktop browser automation does not work in
 * any current build (phantom electronAPI.browserAgent reference, dev-only
 * IPC gating, and a coordinate-vs-selector action-model mismatch). The
 * service must report itself unconfigured rather than implying automatic
 * filing works today.
 */
describe('BrowserAgentService (ISSUE-972)', () => {
    beforeEach(() => {
        getProfile.mockReset().mockResolvedValue(DEFAULT_ARTIST_OPERATING_PROFILE);
    });

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

    it('fails closed on missing AOP authorization before checking or attempting browser execution', async () => {
        (window as unknown as Record<string, unknown>).electronAPI = { agent: {} };
        const service = new BrowserAgentService();

        const isConfigured = vi.spyOn(service, 'isConfigured');
        await expect(service.executeTask('MLC', 'register a work', 'https://portal.themlc.com'))
            .rejects.toThrow(/Autonomous Computer Control.*enabled/i);
        expect(isConfigured).not.toHaveBeenCalled();
    });

    it('still refuses execution when AOP allows it but the browser executor is unconfigured', async () => {
        getProfile.mockResolvedValue({
            ...DEFAULT_ARTIST_OPERATING_PROFILE,
            permissions: { ...DEFAULT_ARTIST_OPERATING_PROFILE.permissions, autonomousComputerControl: true },
        });
        const service = new BrowserAgentService();
        await expect(service.executeTask('MLC', 'register a work', 'https://portal.themlc.com'))
            .rejects.toThrow('Browser agent is not configured');
    });
});
