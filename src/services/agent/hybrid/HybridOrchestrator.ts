import { AgentContext } from '../types';
import { GenAI } from '@/services/ai/GenAI';
import { AI_MODELS, AI_CONFIG } from '@/core/config/ai-models';
import { TraceService } from '../observability/TraceService';
import { auth } from '@/services/firebase';
import { agentRegistry } from '../registry';
import { InputSanitizer } from '@/services/ai/utils/InputSanitizer';
import { logger } from '@/utils/logger';

interface IAgentRunner {
    runAgent: (agentId: string, task: string, parentContext?: AgentContext, parentTraceId?: string) => Promise<{ text: string; thoughtSignature?: string }>;
}

/**
 * HybridOrchestrator: The "Best of Both Worlds" engine.
 * Merges system/browser integration with autonomous multi-turn reasoning — indii's native orchestration engine.
 */
export class HybridOrchestrator {
    private MAX_TURNS = 10;
    private MAX_RESULT_LENGTH = 3000;

    private truncate(text: unknown): string {
        if (!text) return '';
        const str = typeof text === 'string' ? text : JSON.stringify(text);
        if (str.length > this.MAX_RESULT_LENGTH) {
            return str.substring(0, this.MAX_RESULT_LENGTH) + '... [Result truncated]';
        }
        return str;
    }

    /**
     * Executes a multi-turn reasoning loop (Indii Fusion Engine).
     * Combines Specialist Agents with System Tools (Browser, Knowledge Base).
     * 
     * @param context - The current agent context.
     * @param userQuery - The original user request.
     * @param service - Optional IAgentRunner for delegating to specialists.
     * @returns The final answer or progress report to the user.
     */
    async execute(context: AgentContext, userQuery: string, service?: IAgentRunner): Promise<string> {
        const userId = auth.currentUser?.uid || 'anonymous';
        const traceId = await TraceService.startTrace(userId, 'hybrid-orchestrator', userQuery);

        let currentTurn = 0;
        let isTaskComplete = false;
        let lastAgentResponse = "";
        const history: Record<string, unknown>[] = [];

        // Helper to prune tool/agent results to stay within context window
        const pruneResult = (input: unknown, maxLen: number = 3000): string => {
            if (input === null || input === undefined) return "";
            const text = typeof input === 'string' ? input : JSON.stringify(input);
            if (text.length <= maxLen) return text;
            const truncated = text.slice(0, maxLen);
            return `${truncated}\n\n[... Result truncated by Orchestrator for context window efficiency. Total length: ${text.length} characters ...]`;
        };

        // 1. Security check — block injection attempts before entering the reasoning loop
        const security = InputSanitizer.securityCheck(userQuery);
        if (security.shouldBlock) {
            logger.warn('[indii:Hybrid] Input blocked:', security.analysis.detectedPatterns);
            await TraceService.failTrace(traceId, 'Blocked: injection pattern detected');
            return "I can't process that request. Please rephrase and try again.";
        }

        // 2. Sanitize
        const sanitizedQuery = InputSanitizer.sanitize(userQuery);

        while (currentTurn < this.MAX_TURNS && !isTaskComplete) {
            currentTurn++;
            logger.info(`[indii:Hybrid] Turn ${currentTurn}/${this.MAX_TURNS}...`);

            const AGENTS = agentRegistry.getAll().map(a => ({
                id: a.id,
                name: a.name,
                description: a.description
            }));

            const prompt = `
            You are the Hybrid indii Orchestrator (A0). 
            You are the indii Conductor, combining autonomous multi-step reasoning with system tools.

            GOAL: Resolve the user's request by coordinating specialists or using system tools.
            USER REQUEST: "${sanitizedQuery}"
            
            TURN: ${currentTurn}
            HISTORY OF ACTIONS: ${JSON.stringify(history)}

            AVAILABLE SPECIALISTS:
            ${AGENTS.map(a => `- "${a.id}": ${a.description}`).join('\n')}

            SYSTEM TOOLS:
            - "browser_control": Navigate websites, fill forms (Library of Congress, PROs).
            - "knowledge_base": Query the artist's personal files/contracts.

            INSTRUCTIONS:
            1. If you can answer directly, do so and set "complete": true.
            2. If you need a specialist, call them by ID using "callAgentId".
            3. If you need to "do" something on the web, use "useTool": "browser_control".
            4. If you need to search the artist's files, use "useTool": "knowledge_base".
            5. For complex generation tasks (images, video, deep analysis), delegate to the appropriate specialist agent.
            6. If a specialist fails or times out, you MUST attempt a different path or self-correct.
            7. When calling a specialist, provide the "task" they should perform.

            RESPONSE FORMAT (JSON):
            {
                "thought": "Internal reasoning step",
                "callAgentId": "agent_id_or_null",
                "task": "task_for_specialist_or_null",
                "useTool": "tool_name_or_null",
                "args": {},
                "answer": "Progress report or final response to user",
                "complete": boolean
            }`;

            try {
                const res = await GenAI.generateContent(
                    [{ role: 'user', parts: [{ text: prompt }] }],
                    AI_MODELS.TEXT.AGENT,
                    {
                        ...AI_CONFIG.THINKING.LOW,
                        responseMimeType: 'application/json'
                    }
                );

                const decision = JSON.parse(res.response.text() || '{}');
                lastAgentResponse = decision.answer || lastAgentResponse;

                await TraceService.addStep(traceId, 'routing', { turn: `turn-${currentTurn}`, ...decision });
                history.push({ turn: currentTurn, thought: decision.thought, action: decision.callAgentId || decision.useTool });

                // Specialists Invocation
                if (decision.callAgentId && decision.task) {
                    logger.info(`[indii:Hybrid] Delegating to specialist: ${decision.callAgentId}`);
                    try {
                        if (!service) throw new Error('AgentService instance not provided for delegation');
                        const result = await service.runAgent(decision.callAgentId, decision.task, context, traceId);

                        history.push({
                            turn: currentTurn,
                            agent: decision.callAgentId,
                            result: pruneResult(result.text, 5000)
                        });
                        lastAgentResponse = result.text;
                    } catch (agentErr: unknown) {
                        logger.error(`[indii:Hybrid] Specialist ${decision.callAgentId} failed:`, agentErr);
                        history.push({ turn: currentTurn, agent: decision.callAgentId, error: String(agentErr) });
                    }
                }

                // System Tools Invocation
                if (decision.useTool === 'knowledge_base') {
                    logger.info(`[indii:Hybrid] Using system tool: knowledge_base`);
                    try {
                        const { KnowledgeTools } = await import('../tools/KnowledgeTools');
                        if (!KnowledgeTools.search_knowledge) throw new Error('search_knowledge not available');
                        const result = await KnowledgeTools.search_knowledge({ query: decision.args?.query || sanitizedQuery }, context);

                        history.push({
                            turn: currentTurn,
                            tool: 'knowledge_base',
                            result: pruneResult(result.data?.answer || '', 3000)
                        });
                        lastAgentResponse = result.data?.answer ?? '';
                    } catch (toolErr: unknown) {
                        logger.error(`[indii:Hybrid] Tool knowledge_base failed:`, toolErr);
                        history.push({ turn: currentTurn, tool: 'knowledge_base', error: String(toolErr) });
                    }
                }

                if (decision.useTool === 'browser_control') {
                    logger.info(`[indii:Hybrid] Using system tool: browser_control`);
                    try {
                        const { BrowserTools } = await import('../tools/BrowserTools');
                        let result;

                        if (decision.args?.url) {
                            if (!BrowserTools.browser_navigate) throw new Error('browser_navigate not available');
                            result = await BrowserTools.browser_navigate({ url: decision.args.url }, context);
                        } else if (decision.args?.action) {
                            if (!BrowserTools.browser_action) throw new Error('browser_action not available');
                            result = await BrowserTools.browser_action({
                                action: decision.args.action,
                                selector: decision.args.selector,
                                text: decision.args.text
                            }, context);
                        } else {
                            if (!BrowserTools.browser_snapshot) throw new Error('browser_snapshot not available');
                            result = await BrowserTools.browser_snapshot({}, context);
                        }

                        history.push({ turn: currentTurn, tool: 'browser_control', result: pruneResult(result.data || result.message, 3000) });
                        lastAgentResponse = result.message || '';
                    } catch (toolErr: unknown) {
                        logger.error(`[indii:Hybrid] Tool browser_control failed:`, toolErr);
                        history.push({ turn: currentTurn, tool: 'browser_control', error: String(toolErr) });
                    }
                }


                if (decision.complete) {
                    isTaskComplete = true;
                } else if (!decision.callAgentId && !decision.useTool) {
                    // LLM provided a thought but no action, force completion if it looks like an answer
                    if (decision.answer) isTaskComplete = true;
                    else break;
                }

            } catch (e: unknown) {
                const msg = e instanceof Error ? e.message : String(e);
                const stack = e instanceof Error ? e.stack : 'No stack';
                logger.error(`[indii:Hybrid] Turn ${currentTurn} failed:`, msg);
                logger.error(`[indii:Hybrid] Error details:`, stack);
                lastAgentResponse = `I encountered an issue: ${msg.slice(0, 100)}`;
                break;
            }
        }

        await TraceService.completeTrace(traceId, { finalResponse: lastAgentResponse });
        return lastAgentResponse || "I encountered an issue while orchestrating your request. Let's try a different approach.";
    }
}
