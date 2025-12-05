import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { EndpointService } from './EndpointService';
import { env } from '@/config/env';

// Mock the environment
vi.mock('@/config/env', () => {
    return {
        env: {
            DEV: false,
            projectId: 'test-project',
            location: 'test-region',
            VITE_VERTEX_PROJECT_ID: 'test-project',
            VITE_VERTEX_LOCATION: 'test-region'
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
        expect(url).toBe('https://test-region-test-project.cloudfunctions.net/myFunction');
    });

    it('generates Emulator URL when DEV is true', () => {
        // Temporarily modify the mocked env
        (env as any).DEV = true;

        const url = endpointService.getFunctionUrl('myFunction');
        expect(url).toBe('http://127.0.0.1:5001/test-project/test-region/myFunction');
    });
});
