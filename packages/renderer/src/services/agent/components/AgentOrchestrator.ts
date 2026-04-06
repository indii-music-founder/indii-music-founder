import { AgentContext } from '../types';
import { GenAI as AI } from '@/services/ai/GenAI';
import { AI_MODELS, AI_CONFIG } from '@/core/config/ai-models';
import { TraceService } from '../observability/TraceService';
import { auth } from '@/services/firebase';

import { agentRegistry } from '../registry';

import { InputSanitizer } from '@/services/ai/utils/InputSanitizer';
import { logger } from '@/utils/logger';

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
            logger.warn('[indii:Orchestrator] Invalid user query:', validation.error);
            await TraceService.failTrace(traceId, `Invalid input: ${validation.error}`);
            return 'generalist';
        }

        // 2. Security check — block injection attempts before any AI processing
        const security = InputSanitizer.securityCheck(userQuery);
        if (security.shouldBlock) {
            logger.warn('[indii:Orchestrator] Input blocked:', security.analysis.detectedPatterns);
            await TraceService.failTrace(traceId, 'Blocked: injection pattern detected');
            throw new Error('Request blocked by security filter.');
        }

        // 3. Sanitize Input
        const sanitizedQuery = InputSanitizer.sanitize(userQuery);

        const specializedAgents = agentRegistry.getAll().map(a => ({
            id: a.id,
            name: a.name,
            description: a.description
        }));

        const AGENTS = [
            ...specializedAgents,
            { id: 'generalist', name: 'indii Conductor', description: 'General assistance, complex reasoning, fallback.' }
        ];

        const prompt = `
        You are indii, the AI agent orchestration system for indiiOS (the operating system for independent artists).
        Your goal is to accurately route user requests to the most appropriate specialist agent and determine the most relevant knowledge base corpus to query.

        AVAILABLE AGENTS:
        ${AGENTS.map(a => `- "${a.id}" (${a.name}): ${a.description}`).join('\n')}

        AVAILABLE RAG CORPORA:
        ["royalties", "deals", "publishing", "licensing", "contracts", "touring", "marketing", "finance", "merchandise", "production", "visual", "career", "registration", "general"]

        CURRENT CONTEXT:
        - Active Module: ${context.activeModule || 'none'}
        - Project: ${context.projectHandle?.name || 'none'} (${context.projectHandle?.type || 'none'})

        USER REQUEST: "${sanitizedQuery}"

        ROUTING RULES:
        1. You MUST return a JSON object with the following structure:
           {
             "targetAgentId": "string", // One of the available agent IDs
             "ragCorpus": "string", // One of the AVAILABLE RAG CORPORA based on intent detection
             "confidence": number, // 0.0 to 1.0
             "reasoning": "string", // Brief explanation of the choices
             "registrationIntent": "loc" | "ascap" | "bmi" | "sesac" | "soundexchange" | "mlc" | "pro" | null // Detected registration target
           }
        2. "legal" -> contracts, agreements, splits.
        3. "music" -> audio analysis, lyrics, production.
        4. "video" -> storyboards, treatments, video editing.
        5. "marketing" -> social media, campaigns, brand strategy.
        6. REGISTRATION INTENTS — route to "legal" agent with ragCorpus "registration":
           - Library of Congress / copyright office / eCO portal / register copyright / register my songs / protect my music / USCO / copyright my music -> registrationIntent: "loc"
           - ASCAP / register with ASCAP / ASCAP registration -> registrationIntent: "ascap"
           - BMI / register with BMI / BMI registration -> registrationIntent: "bmi"
           - SESAC / register with SESAC -> registrationIntent: "sesac"
           - SoundExchange / digital performance royalties / satellite radio royalties -> registrationIntent: "soundexchange"
           - MLC / mechanical licensing collective / mechanical royalties -> registrationIntent: "mlc"
           - performing rights / PRO registration / sign up for royalties / performance royalties (no specific PRO named) -> registrationIntent: "pro"
           - register my catalog / rights registration / register my music (general) -> registrationIntent: "pro"
        7. Use "general" for ragCorpus if no specific domain applies.
        8. If registrationIntent is null, omit the field or return null.
        `;

        try {
            const res = await AI.generateContent(
                [{ role: 'user', parts: [{ text: prompt }] }],
                AI_MODELS.TEXT.FAST,
                {
                    ...AI_CONFIG.THINKING.LOW,
                    responseMimeType: 'application/json'
                }
            );

            const textResponse = res.response.text() || '{}';
            let parsedResponse: { targetAgentId: string; ragCorpus: string; confidence: number; reasoning: string };

            try {
                parsedResponse = JSON.parse(textResponse);
            } catch (_parseError: unknown) {
                logger.warn('[indii:Orchestrator] Failed to parse JSON response:', textResponse);
                await TraceService.addStep(traceId, 'routing', {
                    selectedAgent: 'generalist',
                    ragCorpus: 'general',
                    reasoning: 'JSON Parse Error, fallback to generalist',
                    rawResponse: textResponse
                });
                await TraceService.completeTrace(traceId, { selectedAgent: 'generalist' });
                return 'generalist';
            }

            const targetAgentId = parsedResponse.targetAgentId?.trim().toLowerCase();
            const ragCorpus = parsedResponse.ragCorpus?.trim().toLowerCase();
            const confidence = parsedResponse.confidence;
            const reasoning = parsedResponse.reasoning;
            const registrationIntent = (parsedResponse as Record<string, unknown>).registrationIntent as string | null | undefined;

            // Optional enhancement: if a corpus was detected, attach it to context directly here.
            if (ragCorpus && ragCorpus !== 'general') {
                context.ragCorpus = ragCorpus;
                logger.info(`[AgentOrchestrator] Detected intent bound to RAG corpus: ${ragCorpus}`);
            }

            // Registration intent: fire navigate_to to open Registration Center
            if (registrationIntent && registrationIntent !== 'null') {
                const validOrgIds = ['loc', 'ascap', 'bmi', 'sesac', 'soundexchange', 'mlc'];
                const orgId = validOrgIds.includes(registrationIntent) ? registrationIntent : null;
                logger.info(`[AgentOrchestrator] Registration intent detected: ${registrationIntent} → opening Registration Center`);
                import('@/core/store').then(({ useStore }) => {
                    const store = useStore.getState();
                    store.setModule('registration');
                    if (orgId) {
                        store.setRegistrationFocus({ orgId: orgId as import('@/modules/registration/types').OrgId, trackId: null });
                        store.setRegistrationAIMessage(
                            `I'll help you register with ${registrationIntent.toUpperCase()}. Let me pull your catalog info and pre-fill what I know…`
                        );
                    }
                }).catch(err => logger.warn('[AgentOrchestrator] Failed to open Registration Center:', err));
            }

            const validRoutes = AGENTS.map(a => a.id);
            let finalRoute = validRoutes.includes(targetAgentId) ? targetAgentId : 'generalist';

            // Confidence Threshold Check
            const CONFIDENCE_THRESHOLD = 0.7;
            if (confidence < CONFIDENCE_THRESHOLD) {
                logger.info(`[AgentOrchestrator] Low confidence (${confidence}) for ${targetAgentId}, falling back to generalist.`);
                finalRoute = 'generalist';
            }

            // Log Step
            logger.info(`[AgentOrchestrator] Routing: "${sanitizedQuery}" -> ${finalRoute} (original: ${targetAgentId}, conf: ${confidence})`);
            await TraceService.addStep(traceId, 'routing', {
                selectedAgent: finalRoute,
                ragCorpus: ragCorpus || 'general',
                confidence,
                reasoning,
                originalDecision: targetAgentId
            });

            // Complete Trace
            await TraceService.completeTrace(traceId, { selectedAgent: finalRoute, ragCorpus });

            return finalRoute;

        } catch (e: unknown) {
            logger.error('[indii:Orchestrator] Routing failed, defaulting to generalist.', e);
            await TraceService.failTrace(traceId, e instanceof Error ? e.message : String(e));
            return 'generalist';
        }
    }

    /**
     * Item 402: Multi-agent parallel task fan-out.
     * Determines whether a user request can be decomposed into independent subtasks
     * that should execute simultaneously across multiple specialist agents.
     *
     * Returns a list of { agentId, subtask } pairs. If only one agent is needed,
     * returns a single-item array (callers use Promise.all regardless).
     */
    async determineFanOut(
        context: AgentContext,
        userQuery: string
    ): Promise<Array<{ agentId: string; subtask: string }>> {
        const validation = InputSanitizer.validate(userQuery);
        if (!validation.valid) return [{ agentId: 'generalist', subtask: userQuery }];

        const specializedAgents = agentRegistry.getAll().map(a => ({
            id: a.id,
            name: a.name,
            description: a.description
        }));

        const prompt = `
        You are indii, the AI orchestration system for indiiOS.
        Analyze this user request and determine if it contains INDEPENDENT subtasks
        that can be executed simultaneously by different specialist agents.

        AVAILABLE AGENTS:
        ${specializedAgents.map(a => `- "${a.id}" (${a.name}): ${a.description}`).join('\n')}

        USER REQUEST: "${InputSanitizer.sanitize(userQuery)}"

        Return a JSON array of subtasks. If the request is for a single agent, return one item.
        For requests that span multiple domains (e.g. "generate press release + social posts + campaign brief"),
        decompose into independent tasks.

        Output format:
        [
          { "agentId": "string", "subtask": "specific instruction for this agent" },
          ...
        ]

        Rules:
        - Only fan out when subtasks are TRULY independent (no data dependency between them).
        - Maximum 4 parallel tasks to control cost.
        - Prefer fewer tasks if uncertain.
        `;

        try {
            const res = await AI.generateContent(
                [{ role: 'user', parts: [{ text: prompt }] }],
                AI_MODELS.TEXT.FAST,
                { ...AI_CONFIG.THINKING.LOW, responseMimeType: 'application/json' }
            );

            const textResponse = res.response.text() || '[]';
            const parsed = JSON.parse(textResponse) as Array<{ agentId: string; subtask: string }>;

            if (!Array.isArray(parsed) || parsed.length === 0) {
                return [{ agentId: 'generalist', subtask: userQuery }];
            }

            const validAgentIds = new Set([...specializedAgents.map(a => a.id), 'generalist']);
            const validated = parsed
                .slice(0, 4) // Cap at 4 parallel tasks
                .map(item => ({
                    agentId: validAgentIds.has(item.agentId) ? item.agentId : 'generalist',
                    subtask: typeof item.subtask === 'string' ? item.subtask : userQuery,
                }));

            logger.info(`[AgentOrchestrator] Fan-out: ${validated.length} parallel tasks`, validated.map(v => v.agentId));
            return validated;

        } catch (e: unknown) {
            logger.warn('[indii:Orchestrator] Fan-out decomposition failed, single agent fallback.', e);
            return [{ agentId: 'generalist', subtask: userQuery }];
        }
    }
}
