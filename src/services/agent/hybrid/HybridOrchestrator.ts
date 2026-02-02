import { AgentContext } from '../types';
import { AI } from '@/services/ai/AIService';
import { AI_MODELS, AI_CONFIG } from '@/core/config/ai-models';
import { TraceService } from '../observability/TraceService';
import { auth } from '@/services/firebase';
import { agentRegistry } from '../registry';
import { InputSanitizer } from '@/services/ai/utils/InputSanitizer';

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
            LAST RESPONSE: "${lastAgentResponse || 'None'}"

            AVAILABLE SPECIALISTS:
            ${AGENTS.map(a => `- "${a.id}": ${a.description}`).join('\n')}

            SYSTEM TOOLS (OpenClaw DNA):
            - "browser_control": Navigate websites, fill forms (Library of Congress, PROs).
            - "knowledge_base": Query the artist's personal files/contracts.

            INSTRUCTIONS:
            1. If you can answer directly, do so and set "complete": true.
            2. If you need a specialist, call them by ID.
            3. If you need to "do" something on the web, use "browser_control".
            4. If a specialist fails or times out, you MUST attempt a different path or self-correct.

            RESPONSE FORMAT (JSON):
            {
                "thought": "Internal reasoning step",
                "callAgentId": "agent_id_or_null",
                "useTool": "tool_name_or_null",
                "answer": "Final or intermediate response to user",
                "complete": boolean
            }`;

            try {
                const res = await AI.generateContent({
                    model: AI_MODELS.TEXT.AGENT, // Uses the Thinking model
                    contents: { role: 'user', parts: [{ text: prompt }] },
                    config: { responseMimeType: 'application/json' }
                });

                const decision = JSON.parse(res.text() || '{}');
                lastAgentResponse = decision.answer || "";
                
                await TraceService.addStep(traceId, `turn-${currentTurn}`, decision);

                if (decision.complete) {
                    isTaskComplete = true;
                    break;
                }

                // TODO: Implement actual tool/specialist invocation here
                // For the "DNA Graft" we are simulating the loop until logic is bridged
                if (!decision.callAgentId && !decision.useTool) {
                    isTaskComplete = true; 
                }

            } catch (e) {
                console.error(`[indii:Hybrid] Turn ${currentTurn} failed:`, e);
                // Self-Correction: On failure, fallback to simple routing or attempt a different model
                break;
            }
        }

        await TraceService.completeTrace(traceId, { finalResponse: lastAgentResponse });
        return lastAgentResponse || "I encountered an issue while orchestrating your request. Let's try a different approach.";
    }
}
