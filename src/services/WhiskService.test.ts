import { describe, it, expect, vi } from 'vitest';
import { WhiskService } from './WhiskService';
import { WhiskState } from '@/core/store/slices/creativeSlice';
import { firebaseConfig } from '@/config/env';

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

describe('WhiskService', () => {
    it('should be defined', () => {
        expect(WhiskService).toBeDefined();
    });

    it('should synthesize whisk prompt correctly', () => {
        const mockState: WhiskState = {
            subjects: [{ id: '1', type: 'text', content: 'A cool cat', checked: true, category: 'subject' }],
            scenes: [],
            styles: [],
            preciseReference: false
        };

        const prompt = WhiskService.synthesizeWhiskPrompt('playing guitar', mockState);
        expect(prompt).toContain('A cool cat');
        expect(prompt).toContain('playing guitar');
    });

    it('should have correct firebase config import', async () => {
        // This test mainly verifies that the file can be imported without error
        expect(firebaseConfig.apiKey).toBe('test-api-key');
    });
});
