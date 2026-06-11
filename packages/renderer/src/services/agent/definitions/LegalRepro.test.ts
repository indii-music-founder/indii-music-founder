import { describe, it, expect } from 'vitest';
import { agentRegistry } from '../registry';

describe('Legal Agent Load Repro', () => {
    it('should attempt to load the real legal agent and print the error', async () => {
        console.log('[REPRO] Attempting to load legal agent...');
        const agent = await agentRegistry.getAsync('legal');
        if (!agent) {
            console.error('[REPRO] Legal agent failed to load!');
            const loadError = agentRegistry.getLoadError('legal');
            console.error('[REPRO] Load error:', loadError);
            expect(agent).toBeDefined();
        } else {
            console.log('[REPRO] Legal agent loaded successfully! ID:', agent.id);
            console.log('[REPRO] Legal agent name:', agent.name);
            console.log('[REPRO] Legal agent system prompt length:', (agent as any).systemPrompt?.length);
            expect(agent).toBeDefined();
        }
    });
});
