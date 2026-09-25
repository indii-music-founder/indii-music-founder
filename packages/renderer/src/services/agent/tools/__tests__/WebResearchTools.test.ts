import { beforeEach, describe, expect, it, vi } from 'vitest';
import { WebResearchTools } from '../WebResearchTools';

describe('WebResearchTools.web_extract', () => {
    const extractWebPage = vi.fn();

    beforeEach(() => {
        vi.clearAllMocks();
        (window as unknown as { electronAPI: unknown }).electronAPI = {
            agent: { extractWebPage },
        };
    });

    it('returns bounded public page data on success', async () => {
        extractWebPage.mockResolvedValue({
            success: true,
            data: { finalUrl: 'https://public.example', title: 'Page', text: 'Body', fetchedAt: 'now' },
        });

        const result = await WebResearchTools.web_extract({ url: 'https://public.example' }, {} as never);

        expect(result.success).toBe(true);
        expect(result.data.text).toBe('Body');
    });

    it('does not convert an IPC failure to tool success', async () => {
        extractWebPage.mockResolvedValue({ success: false, error: 'Private destinations are blocked.' });

        const result = await WebResearchTools.web_extract({ url: 'http://127.0.0.1' }, {} as never);

        expect(result.success).toBe(false);
        expect(result.error).toContain('Private destinations are blocked.');
    });
});
