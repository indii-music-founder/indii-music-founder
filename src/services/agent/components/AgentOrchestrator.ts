import { AgentContext } from '../types';
import { AI } from '@/services/ai/AIService';
import { AI_MODELS, AI_CONFIG } from '@/core/config/ai-models';
import { TraceService } from '../observability/TraceService';
import { auth } from '@/services/firebase';

import { agentRegistry } from '../registry';

import { InputSanitizer } from '@/services/ai/utils/InputSanitizer';

export class AgentOrchestrator {
    async determineAgent(context: AgentContext, userQuery: string): Promise<string> {
        const userId = auth.currentUser?.uid || 'anonymous';

        // Start Trace
        const traceId = await TraceService.startTrace(userId, 'orchestrator', userQuery, {
            context: {
                module: context.activeModule,
                project: context.projectHandle?.name
            }
        });

        // 1. Validate Input
        const validation = InputSanitizer.validate(userQuery);
        if (!validation.valid) {
            console.warn('[AgentOrchestrator] Invalid user query:', validation.error);
            await TraceService.failTrace(traceId, `Invalid input: ${validation.error}`);
            return 'generalist';
        }

        // 2. Sanitize Input
        const sanitizedQuery = InputSanitizer.sanitize(userQuery);

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
        You are the Orchestrator for indiiOS, the operating system for independent artists.
        Your goal is to accurately route user requests to the most appropriate specialist agent.

        AVAILABLE AGENTS:
        ${AGENTS.map(a => `- "${a.id}" (${a.name}): ${a.description}`).join('\n')}

        CURRENT CONTEXT:
        - Active Module: ${context.activeModule || 'none'}
        - Project: ${context.projectHandle?.name || 'none'} (${context.projectHandle?.type || 'none'})

        USER REQUEST: "${sanitizedQuery}"

        ROUTING RULES:
        1. Return ONLY the agent ID (e.g., "legal", "video"). Do not explain.
        2. If the request is about the current project's domain, prioritize that specialist.
        3. If the request requires looking up information, general reasoning, or falls outside specific domains, use "generalist".
        4. "legal" handles contracts, agreements, and splits.
        5. "music" handles audio analysis, lyrics, and production.
        6. "video" handles storyboards, treatments, and video editing.
        7. "marketing" handles social media, campaigns, and brand strategy.

        EXAMPLES:
        "Draft a split sheet" -> legal
        "Make this bass punchier" -> music
        "Generate a storyboard for the verse" -> video
        "Post this to TikTok" -> marketing
        "How do I use this app?" -> generalist
        "What is the capital of France?" -> generalist
        `;

        try {
            const res = await AI.generateContent({
                model: AI_MODELS.TEXT.FAST,
                contents: { role: 'user', parts: [{ text: prompt }] },
                config: { ...AI_CONFIG.THINKING.LOW }
            });

            const route = (res.text() || 'generalist').trim().toLowerCase();
            const validRoutes = AGENTS.map(a => a.id);

            const finalRoute = validRoutes.includes(route) ? route : 'generalist';

            // Log Step
            await TraceService.addStep(traceId, 'routing', {
                selectedAgent: finalRoute,
                reasoning: 'AI Model Decision'
            });

            // Complete Trace
            await TraceService.completeTrace(traceId, { selectedAgent: finalRoute });

            return finalRoute;

        } catch (e: unknown) {
            console.error('[AgentOrchestrator] Routing failed, defaulting to generalist.', e);
            await TraceService.failTrace(traceId, e instanceof Error ? e.message : String(e));
            return 'generalist';
        }
    }
}
