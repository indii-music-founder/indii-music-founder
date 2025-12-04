import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Orchestrator } from './OrchestratorService';
import { AI } from '@/services/ai/AIService';

// Mock AI Service
vi.mock('@/services/ai/AIService', () => ({
    AI: {
        generateContent: vi.fn()
    }
}));

describe('OrchestratorService', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('should route "open project" to dashboard', async () => {
        // Mock AI response
        (AI.generateContent as any).mockResolvedValue({
            text: () => 'dashboard'
        });

        const route = await Orchestrator.routeRequest('open project "My Cool Project"');
        expect(route).toBe('dashboard');
    });

    it('should route "create project" to dashboard', async () => {
        (AI.generateContent as any).mockResolvedValue({
            text: () => 'dashboard'
        });

        const route = await Orchestrator.routeRequest('create a new project called Alpha');
        expect(route).toBe('dashboard');
    });

    it('should route "make a video" to video', async () => {
        // This hits the manual override in OrchestratorService
        const route = await Orchestrator.routeRequest('make a video of a cat');
        expect(route).toBe('video');
    });
});
