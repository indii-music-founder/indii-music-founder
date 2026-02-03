import { AgentContext } from '../types';
import { AI } from '@/services/ai/AIService';
import { AI_MODELS, AI_CONFIG } from '@/core/config/ai-models';
import { TraceService } from '../observability/TraceService';
import { auth } from '@/services/firebase';
import { agentRegistry } from '../registry';
import { InputSanitizer } from '@/services/ai/utils/InputSanitizer';
import { agentService } from '../AgentService';

/**
 * HybridOrchestrator: The "Best of Both Worlds" engine.
 * Merges OpenClaw's system/browser integration with Agent Zero's autonomous multi-turn reasoning.
 */
export class HybridOrchestrator {
    private MAX_TURNS = 10;

    async execute(context: AgentContext, userQuery: string): Promise<string> {
        const userId = auth.currentUser?.uid || 'anonymous';
        const traceId = await TraceService.startTrace(userId, 'hybrid-orchestrator', userQuery);

        let currentTurn = 0;
        let isTaskComplete = false;
        let lastAgentResponse = "";
        const history: any[] = [];

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

                if (decision.complete) {
                    isTaskComplete = true;
                    break;
                }

                // Specialists Invocation
                if (decision.callAgentId && decision.task) {
                    console.info(`[indii:Hybrid] Delegating to specialist: ${decision.callAgentId}`);
                    try {
                        const result = await agentService.runAgent(decision.callAgentId, decision.task, context, traceId);
                        history.push({ turn: currentTurn, agent: decision.callAgentId, result: result.text });
                        lastAgentResponse = result.text;
                    } catch (agentErr) {
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
                        history.push({ turn: currentTurn, tool: 'knowledge_base', result: result.data?.answer });
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

                        history.push({ turn: currentTurn, tool: 'browser_control', result: result.data || result.message });
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
                        history.push({ turn: currentTurn, tool: 'agent_zero_deep', result: result.message });
                        lastAgentResponse = result.message;
                    } catch (azErr) {
                        console.error(`[indii:Hybrid] Agent Zero Container failed:`, azErr);
                        history.push({ turn: currentTurn, tool: 'agent_zero_deep', error: String(azErr) });
                    }
                }

                if (!decision.callAgentId && !decision.useTool && !decision.complete) {
                    // LLM provided a thought but no action, force completion if it looks like an answer
                    if (decision.answer) isTaskComplete = true;
                    else break;
                }

            } catch (e) {
                console.error(`[indii:Hybrid] Turn ${currentTurn} failed:`, e);
                break;
            }
        }

        await TraceService.completeTrace(traceId, { finalResponse: lastAgentResponse });
        return lastAgentResponse || "I encountered an issue while orchestrating your request. Let's try a different approach.";
    }
}
