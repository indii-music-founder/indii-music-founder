// EndpointService Test Suite
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { EndpointService } from './EndpointService';
import { env } from '@/config/env';

// Mock the environment
vi.mock('@/config/env', () => {
    return {
        env: {
            DEV: false,
            projectId: 'test-project',
            location: 'global',
            functionsRegion: 'us-central1',
            VITE_FUNCTIONS_REGION: 'us-central1',
        }
    };
});

describe('EndpointService', () => {
    let endpointService: EndpointService;

    beforeEach(() => {
        vi.resetModules();
        endpointService = new EndpointService();
    });

    it('generates Production URL by default', () => {
        const url = endpointService.getFunctionUrl('myFunction');
        expect(url).toBe('https://us-central1-test-project.cloudfunctions.net/myFunction');
    });

    it('generates Emulator URL when DEV is true and emulator flag is true', () => {
        (env as any).DEV = true;
        (env as any).VITE_USE_FUNCTIONS_EMULATOR = 'true';

        const url = endpointService.getFunctionUrl('myFunction');
        expect(url).toBe('http://127.0.0.1:5001/test-project/us-central1/myFunction');
    });
});
