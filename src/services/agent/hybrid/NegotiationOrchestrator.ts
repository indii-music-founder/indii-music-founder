import { logger } from '@/utils/logger';
import { AgentConfig } from '../types';
import { firebaseAI } from '@/services/ai/FirebaseAIService';

/**
 * Requirement 116: Agent-to-Agent Negotiation
 * Enables multi-agent threads where two specialized agents (e.g., Legal and Finance)
 * can negotiate a payload (like contract terms) before presenting a final answer.
 */

export interface NegotiationResult {
    success: boolean;
    finalPayload: string;
    turns: number;
    log: Array<{
        agentId: string;
        message: string;
    }>;
}

export class NegotiationOrchestrator {

    /**
     * Executes a negotiation loop between two specialist agents.
     *
     * @param agentA The first negotiating agent (e.g., Legal)
     * @param agentB The second negotiating agent (e.g., Finance)
     * @param initialPayload The starting contract/terms to negotiate
     * @param objective What the negotiation is trying to resolve
     * @param maxTurns Maximum back-and-forth turns to prevent infinite loops (Default: 3)
     */
    async negotiate(
        agentA: AgentConfig,
        agentB: AgentConfig,
        initialPayload: string,
        objective: string,
        maxTurns: number = 3
    ): Promise<NegotiationResult> {

        logger.info(`[NegotiationOrchestrator] Starting negotiation between ${agentA.id} and ${agentB.id}`);

        const log: Array<{agentId: string; message: string}> = [];
        let currentPayload = initialPayload;
        let isAgreed = false;

        for (let turn = 1; turn <= maxTurns; turn++) {

            // --- Agent A Turn ---
            const promptA = `
You are the ${agentA.name}.
System Context: ${agentA.systemPrompt}

Current Negotiation Objective: ${objective}
Current Proposed Terms:
${currentPayload}

Review these terms from your specific department's perspective.
If you agree with these terms, reply EXACTLY with "AGREED".
If you do not agree, propose a REVISED set of terms, explaining your reasoning.
`;

            const responseA = await this.invokeAgent(agentA.id, promptA);
            log.push({ agentId: agentA.id, message: responseA });

            if (responseA.trim().toUpperCase().includes('AGREED')) {
                isAgreed = true;
                break;
            }
            currentPayload = responseA; // A's proposed revision

            // --- Agent B Turn ---
            const promptB = `
You are the ${agentB.name}.
System Context: ${agentB.systemPrompt}

Current Negotiation Objective: ${objective}
Current Proposed Terms from ${agentA.name}:
${currentPayload}

Review these terms from your specific department's perspective.
If you agree with these terms, reply EXACTLY with "AGREED".
If you do not agree, propose a REVISED set of terms, explaining your reasoning.
`;

            const responseB = await this.invokeAgent(agentB.id, promptB);
            log.push({ agentId: agentB.id, message: responseB });

            if (responseB.trim().toUpperCase().includes('AGREED')) {
                isAgreed = true;
                break;
            }
            currentPayload = responseB; // B's proposed revision
        }

        if (!isAgreed) {
            logger.warn(`[NegotiationOrchestrator] Negotiation timed out after ${maxTurns} turns without agreement.`);
        }

        return {
            success: isAgreed,
            finalPayload: currentPayload,
            turns: log.length,
            log
        };
    }

    private async invokeAgent(agentId: string, prompt: string): Promise<string> {
        // Direct call to standard LLM wrapper for the agent response
        // In a full implementation, this might pipe through ContextPipeline or HybridOrchestrator
        try {
            const result = await firebaseAI.generateContent(prompt);
            // FirebaseAIService returns an object wrapping the Gemini response
            return result.response?.text() || '';
        } catch (error) {
            logger.error(`[NegotiationOrchestrator] Agent ${agentId} failed during negotiation`, error);
            return `[Error from ${agentId}]`;
        }
    }
}

export const negotiationOrchestrator = new NegotiationOrchestrator();