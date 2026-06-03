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
            VITE_VERTEX_PROJECT_ID: 'test-project',
            VITE_VERTEX_LOCATION: 'global',
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

    it('always generates Production URL (emulator support disabled)', () => {
        // Note: Emulator URL generation is intentionally disabled in EndpointService
        // See comment in EndpointService.ts - emulator code is commented out
        // Setting DEV=true should NOT change the URL behavior
        (env as any).DEV = true;

        const url = endpointService.getFunctionUrl('myFunction');
        // Still returns production URL since emulator support is disabled
        expect(url).toBe('https://us-central1-test-project.cloudfunctions.net/myFunction');
    });
});
