import { AgentContext } from './ContextResolver';
import { AI } from '@/services/ai/AIService';
import { AI_MODELS, AI_CONFIG } from '@/core/config/ai-models';

import { agentRegistry } from '../registry';

export class AgentOrchestrator {
    async determineAgent(context: AgentContext, userQuery: string): Promise<string> {
        const specializedAgents = agentRegistry.getAll().map(a => ({
            id: a.id,
            name: a.name,
            description: a.description
        }));

        const AGENTS = [
            ...specializedAgents,
            { id: 'generalist', name: 'Agent Zero', description: 'General assistance, complex reasoning, fallback.' }
        ];

        const prompt = `
        You are the Orchestrator. Your job is to route the user's request to the best suited agent.

        AGENTS:
        ${AGENTS.map(a => `- "${a.id}" (${a.name}): ${a.description}`).join('\n')}

        CONTEXT:
        Current Module: ${context.currentModule || 'none'}
        Current Project: ${context.projectHandle?.name || 'none'} (${context.projectHandle?.type || 'none'})

        USER REQUEST: "${userQuery}"

        INSTRUCTIONS:
        - Return ONLY the agent ID (e.g., "legal").
        - If the request is ambiguous, default to "generalist".
        - If the request is about the current project's domain, prefer that specialist.

        EXAMPLES:
        User: "Draft a recording contract for my new artist."
        Agent: legal

        User: "I need a music video concept for this track."
        Agent: video

        User: "Create a 30-day rollout plan for Instagram."
        Agent: marketing

        User: "This mix sounds muddy, can you analyze the EQ?"
        Agent: music

        User: "How do I create a new project?"
        Agent: generalist

        User: "What's the weather like?"
        Agent: generalist
        `;

        try {
            const res = await AI.generateContent({
                model: AI_MODELS.TEXT.FAST,
                contents: { role: 'user', parts: [{ text: prompt }] },
                config: { ...AI_CONFIG.THINKING.LOW }
            });

            const route = (res.text() || 'generalist').trim().toLowerCase();
            const validRoutes = AGENTS.map(a => a.id);

            if (validRoutes.includes(route)) {
                return route;
            }
            return 'generalist';
        } catch (e) {
            console.error('[AgentOrchestrator] Routing failed, defaulting to generalist.', e);
            return 'generalist';
        }
    }
}
