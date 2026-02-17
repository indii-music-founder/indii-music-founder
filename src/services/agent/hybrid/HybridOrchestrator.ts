import { AgentContext } from '../types';
import { AI } from '@/services/ai/AIService';
import { AI_MODELS, AI_CONFIG } from '@/core/config/ai-models';
import { TraceService } from '../observability/TraceService';
import { auth } from '@/services/firebase';
import { agentRegistry } from '../registry';
import { InputSanitizer } from '@/services/ai/utils/InputSanitizer';
import type { AgentService } from '../AgentService';

const pruneResult = (value: unknown, maxLen: number = 3000): string => {
    const text = typeof value === 'string' ? value : JSON.stringify(value ?? '') ?? '';
    if (!text) return '';
    return text.length <= maxLen ? text : `${text.slice(0, maxLen)}…`;
};

/**
 * HybridOrchestrator: The "Best of Both Worlds" engine.
 * Merges OpenClaw's system/browser integration with Agent Zero's autonomous multi-turn reasoning.
 */
export class HybridOrchestrator {
    private MAX_TURNS = 10;
    private MAX_RESULT_LENGTH = 3000;

    private truncate(text: any): string {
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
     * @param service - Optional AgentService for delegating to specialists.
     * @returns The final answer or progress report to the user.
     */
    async execute(context: AgentContext, userQuery: string, service?: AgentService): Promise<string> {
        const userId = auth.currentUser?.uid || 'anonymous';
        const traceId = await TraceService.startTrace(userId, 'hybrid-orchestrator', userQuery);

        let currentTurn = 0;
        let isTaskComplete = false;
        let lastAgentResponse = "";
        const history: any[] = [];

        // Helper to prune tool/agent results to stay within context window
        const pruneResult = (input: any, maxLen: number = 3000): string => {
            if (input === null || input === undefined) return "";
            const text = typeof input === 'string' ? input : JSON.stringify(input);
            if (text.length <= maxLen) return text;
            const truncated = text.slice(0, maxLen);
            return `${truncated}\n\n[... Result truncated by Orchestrator for context window efficiency. Total length: ${text.length} characters ...]`;
        };

        // 1. Sanitize
        const sanitizedQuery = InputSanitizer.sanitize(userQuery);

        while (currentTurn < this.MAX_TURNS && !isTaskComplete) {
            currentTurn++;
            console.info(`[indii:Hybrid] Turn ${currentTurn}/${this.MAX_TURNS}...`);

            const AGENTS = agentRegistry.getAll().map(a => ({
                id: a.id,
                name: a.name,
                description: a.description
            }));

            const prompt = `
            You are the Hybrid indii Orchestrator (A0). 
            You combine the autonomous multi-step reasoning of Agent Zero with the system tools of OpenClaw.

            GOAL: Resolve the user's request by coordinating specialists or using system tools.
            USER REQUEST: "${sanitizedQuery}"
            
            TURN: ${currentTurn}
            HISTORY OF ACTIONS: ${JSON.stringify(history)}

            AVAILABLE SPECIALISTS:
            ${AGENTS.map(a => `- "${a.id}": ${a.description}`).join('\n')}

            SYSTEM TOOLS (OpenClaw DNA):
            - "browser_control": Navigate websites, fill forms (Library of Congress, PROs).
            - "knowledge_base": Query the artist's personal files/contracts.
            - "agent_zero_deep": Delegate complex technical/creative generation tasks to the Agent Zero container.

            INSTRUCTIONS:
            1. If you can answer directly, do so and set "complete": true.
            2. If you need a specialist, call them by ID using "callAgentId".
            3. If you need to "do" something on the web, use "useTool": "browser_control".
            4. If you need to search the artist's files, use "useTool": "knowledge_base".
            5. If you need a deep autonomous agent to run code, generate images/video, or browse the web extensively, use "useTool": "agent_zero_deep".
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
                const res = await AI.generateContent({
                    model: AI_MODELS.TEXT.AGENT, // Uses the Thinking model
                    contents: { role: 'user', parts: [{ text: prompt }] },
                    config: {
                        ...AI_CONFIG.THINKING.LOW,
                        responseMimeType: 'application/json'
                    }
                });

                const decision = JSON.parse(res.text() || '{}');
                lastAgentResponse = decision.answer || lastAgentResponse;

                await TraceService.addStep(traceId, 'routing', { turn: `turn-${currentTurn}`, ...decision });
                history.push({ turn: currentTurn, thought: decision.thought, action: decision.callAgentId || decision.useTool });



                // Specialists Invocation
                if (decision.callAgentId && decision.task) {
                    console.info(`[indii:Hybrid] Delegating to specialist: ${decision.callAgentId}`);
                    try {
                        if (!service) throw new Error('AgentService instance not provided for delegation');
                        const result = await service.runAgent(decision.callAgentId, decision.task, context, traceId);
                        history.push({ turn: currentTurn, agent: decision.callAgentId, result: this.truncate(result.text) });
                        history.push({
                            turn: currentTurn,
                            agent: decision.callAgentId,
                            result: pruneResult(result.text, 5000) // Larger limit for specialist feedback
                        });
                        history.push({ turn: currentTurn, agent: decision.callAgentId, result: pruneResult(result.text, 5000) });
                        lastAgentResponse = result.text;
                    } catch (agentErr: any) {
                        console.error(`[indii:Hybrid] Specialist ${decision.callAgentId} failed:`, agentErr);
                        history.push({ turn: currentTurn, agent: decision.callAgentId, error: String(agentErr) });
                    }
                }

                // System Tools Invocation
                if (decision.useTool === 'knowledge_base') {
                    console.info(`[indii:Hybrid] Using system tool: knowledge_base`);
                    try {
                        const { KnowledgeTools } = await import('../tools/KnowledgeTools');
                        const result = await KnowledgeTools.search_knowledge({ query: decision.args?.query || sanitizedQuery }, context);
                        history.push({ turn: currentTurn, tool: 'knowledge_base', result: this.truncate(result.data?.answer) });
                        history.push({
                            turn: currentTurn,
                            tool: 'knowledge_base',
                            result: pruneResult(result.data?.answer || '')
                        });
                        history.push({ turn: currentTurn, tool: 'knowledge_base', result: pruneResult(result.data?.answer, 3000) });
                        lastAgentResponse = result.data?.answer;
                    } catch (toolErr) {
                        console.error(`[indii:Hybrid] Tool knowledge_base failed:`, toolErr);
                        history.push({ turn: currentTurn, tool: 'knowledge_base', error: String(toolErr) });
                    }
                }

                if (decision.useTool === 'browser_control') {
                    console.info(`[indii:Hybrid] Using system tool: browser_control`);
                    try {
                        const { BrowserTools } = await import('../tools/BrowserTools');
                        let result;

                        if (decision.args?.url) {
                            result = await BrowserTools.browser_navigate({ url: decision.args.url }, context);
                        } else if (decision.args?.action) {
                            result = await BrowserTools.browser_action({
                                action: decision.args.action,
                                selector: decision.args.selector,
                                text: decision.args.text
                            }, context);
                        } else {
                            result = await BrowserTools.browser_snapshot({}, context);
                        }

                        history.push({ turn: currentTurn, tool: 'browser_control', result: this.truncate(result.data || result.message) });
                        lastAgentResponse = result.message || '';
                    } catch (toolErr) {
                        console.error(`[indii:Hybrid] Tool browser_control failed:`, toolErr);
                        history.push({ turn: currentTurn, tool: 'browser_control', error: String(toolErr) });
                    }
                }

                // Agent Zero Container Invocation
                if (decision.useTool === 'agent_zero_deep') {
                    console.info(`[indii:Hybrid] Delegating deep task to Agent Zero Container...`);
                    try {
                        const { agentZeroService } = await import('../AgentZeroService');
                        const result = await agentZeroService.sendMessage(decision.task || decision.args?.query || sanitizedQuery);
                        history.push({ turn: currentTurn, tool: 'agent_zero_deep', result: this.truncate(result.message) });
                        history.push({
                            turn: currentTurn,
                            tool: 'agent_zero_deep',
                            result: pruneResult(result.message)
                        });
                        history.push({ turn: currentTurn, tool: 'agent_zero_deep', result: pruneResult(result.message, 3000) });
                        lastAgentResponse = result.message;
                    } catch (azErr) {
                        console.error(`[indii:Hybrid] Agent Zero Container failed:`, azErr);
                        history.push({ turn: currentTurn, tool: 'agent_zero_deep', error: String(azErr) });
                    }
                }

                if (decision.complete) {
                    isTaskComplete = true;
                } else if (!decision.callAgentId && !decision.useTool) {
                    // LLM provided a thought but no action, force completion if it looks like an answer
                    if (decision.answer) isTaskComplete = true;
                    else break;
                }

            } catch (e: any) {
                console.error(`[indii:Hybrid] Turn ${currentTurn} failed:`, e?.message || e);
                console.error(`[indii:Hybrid] Error details:`, e?.stack || 'No stack');
                lastAgentResponse = `I encountered an issue: ${e?.message?.slice?.(0, 100) || 'Unknown error'}`;
                break;
            }
        }

        await TraceService.completeTrace(traceId, { finalResponse: lastAgentResponse });
        return lastAgentResponse || "I encountered an issue while orchestrating your request. Let's try a different approach.";
    }
}
