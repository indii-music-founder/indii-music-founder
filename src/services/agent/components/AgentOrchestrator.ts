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
        1. You MUST return a JSON object with the following structure:
           {
             "targetAgentId": "string", // One of the available agent IDs
             "confidence": number, // 0.0 to 1.0
             "reasoning": "string" // Brief explanation of why this agent was chosen
           }
        2. If the request is about the current project's domain, prioritize that specialist.
        3. If the request requires looking up information, general reasoning, or falls outside specific domains, use "generalist".
        4. "legal" handles contracts, agreements, and splits.
        5. "music" handles audio analysis, lyrics, and production.
        6. "video" handles storyboards, treatments, and video editing.
        7. "marketing" handles social media, campaigns, and brand strategy.
        8. CRITICAL: Requests to GENERATE, CREATE, or MAKE new images, visuals, or album art must go to "generalist" (Agent Zero) or "director", NOT "merchandise". "merchandise" is ONLY for managing physical goods.
        `;

        try {
            const res = await AI.generateContent({
                model: AI_MODELS.TEXT.FAST,
                contents: { role: 'user', parts: [{ text: prompt }] },
                config: {
                    ...AI_CONFIG.THINKING.LOW,
                    responseMimeType: 'application/json'
                }
            });

            const textResponse = res.text() || '{}';
            let parsedResponse: { targetAgentId: string; confidence: number; reasoning: string };

            try {
                parsedResponse = JSON.parse(textResponse);
            } catch (parseError) {
                console.warn('[AgentOrchestrator] Failed to parse JSON response:', textResponse);
                await TraceService.addStep(traceId, 'routing', {
                    selectedAgent: 'generalist',
                    reasoning: 'JSON Parse Error, fallback to generalist',
                    rawResponse: textResponse
                });
                await TraceService.completeTrace(traceId, { selectedAgent: 'generalist' });
                return 'generalist';
            }

            const targetAgentId = parsedResponse.targetAgentId?.trim().toLowerCase();
            const confidence = parsedResponse.confidence;
            const reasoning = parsedResponse.reasoning;

            const validRoutes = AGENTS.map(a => a.id);
            let finalRoute = validRoutes.includes(targetAgentId) ? targetAgentId : 'generalist';

            // Confidence Threshold Check
            const CONFIDENCE_THRESHOLD = 0.7;
            if (confidence < CONFIDENCE_THRESHOLD) {
                console.info(`[AgentOrchestrator] Low confidence (${confidence}) for ${targetAgentId}, falling back to generalist.`);
                finalRoute = 'generalist';
            }

            // Log Step
            console.info(`[AgentOrchestrator] Routing: "${sanitizedQuery}" -> ${finalRoute} (original: ${targetAgentId}, conf: ${confidence})`);
            await TraceService.addStep(traceId, 'routing', {
                selectedAgent: finalRoute,
                confidence,
                reasoning,
                originalDecision: targetAgentId
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
