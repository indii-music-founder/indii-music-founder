import { describe, it, expect, vi } from 'vitest';
import { parseInspirationSuggestions, WhiskService } from './WhiskService';
import { WhiskState } from '@/core/store/slices/creative';
import { firebaseConfig } from '@/config/env';
import { fetchAsBase64 } from '@/services/storage/safeStorageFetch';

// Mock the firebase/env module
vi.mock('@/config/env', () => ({
    firebaseConfig: {
        apiKey: 'test-api-key',
    },
    env: {
        DEV: true,
        appCheckDebugToken: 'mock-debug-token'
    }
}));

vi.mock('@/services/storage/safeStorageFetch', () => ({
    fetchAsBase64: vi.fn(),
}));

describe('WhiskService', () => {
    it('should be defined', () => {
        expect(WhiskService).toBeDefined();
    });

    it('should synthesize whisk prompt correctly', () => {
        const mockState: WhiskState = {
            subjects: [{ id: '1', type: 'text', content: 'A cool cat', checked: true, category: 'subject' }],
            scenes: [],
            styles: [],
            motion: [],
            preciseReference: false,
            targetMedia: 'image'
        };

        const prompt = WhiskService.synthesizeWhiskPrompt('playing guitar', mockState);
        expect(prompt).toContain('A cool cat');
        expect(prompt).toContain('playing guitar');
    });

    it('should have correct firebase config import', async () => {
        // This test mainly verifies that the file can be imported without error
        expect(firebaseConfig.apiKey).toBe('test-api-key');
    });

    describe('parseInspirationSuggestions', () => {
        it('accepts and trims a bounded array from fenced model output', () => {
            expect(parseInspirationSuggestions('```json\n["  First idea  ", "Second idea"]\n```'))
                .toEqual(['First idea', 'Second idea']);
        });

        it.each([
            '"not an array"',
            '[]',
            '["one", "two", "three", "four", "five"]',
            '["valid", 2]',
            '[""]',
            JSON.stringify(['x'.repeat(161)]),
        ])('rejects invalid structured output: %s', (response) => {
            expect(() => parseInspirationSuggestions(response)).toThrow();
        });
    });

    it('resolves durable precise-reference URLs to validated image bytes', async () => {
        vi.mocked(fetchAsBase64).mockResolvedValueOnce({ base64: 'resolved-bytes', mimeType: 'image/webp' });
        const state: WhiskState = {
            subjects: [{ id: 'url-ref', type: 'image', content: 'gs://bucket/reference.webp', checked: true, category: 'subject' }],
            scenes: [],
            styles: [],
            motion: [],
            preciseReference: true,
            targetMedia: 'image',
        };

        await expect(WhiskService.getSourceMedia(state)).resolves.toEqual([
            { mimeType: 'image/webp', data: 'resolved-bytes' },
        ]);
        expect(fetchAsBase64).toHaveBeenCalledWith('gs://bucket/reference.webp');
    });

    it('keeps readable references when one precise-reference URL is unavailable', async () => {
        vi.mocked(fetchAsBase64)
            .mockResolvedValueOnce({ base64: 'good-bytes', mimeType: 'image/png' })
            .mockRejectedValueOnce(new Error('storage object missing'));
        const state: WhiskState = {
            subjects: [
                { id: 'good', type: 'image', content: 'gs://bucket/good.png', checked: true, category: 'subject' },
                { id: 'missing', type: 'image', content: 'gs://bucket/missing.png', checked: true, category: 'subject' },
            ],
            scenes: [], styles: [], motion: [], preciseReference: true, targetMedia: 'image',
        };

        await expect(WhiskService.getSourceMedia(state)).resolves.toEqual([
            { mimeType: 'image/png', data: 'good-bytes' },
        ]);
    });

    it('fails honestly when every selected precise reference is unreadable', async () => {
        vi.mocked(fetchAsBase64).mockRejectedValueOnce(new Error('storage object missing'));
        const state: WhiskState = {
            subjects: [{ id: 'missing', type: 'image', content: 'gs://bucket/missing.png', checked: true, category: 'subject' }],
            scenes: [], styles: [], motion: [], preciseReference: true, targetMedia: 'image',
        };
        await expect(WhiskService.getSourceMedia(state)).rejects.toThrow(/None of the selected/);
    });
});
