import { FunctionDeclaration } from '../types';
import { Content } from '@/shared/types/ai.dto';
import { logger } from '@/utils/logger';

export interface TokenEstimate {
    inputTokens: number;
    projectedOutputTokens: number;
    totalProjected: number;
    remainingBudget: number;
    willExceed: boolean;
}

/**
 * TokenEstimator — Governance and Budget Projection
 * Implements Agentic Harness Primitive #5: Token Budgeting
 * 
 * Calculates projected token usage before an API call is made.
 * Prevents agents from starting tasks that are mathematically 
 * guaranteed to fail mid-execution due to budget constraints.
 */
export class TokenEstimator {
    // Gemini token ratio heuristic: ~4 characters per token
    private static readonly CHARS_PER_TOKEN = 4;
    // Base intrinsic cost per tool (descriptions, schemas)
    private static readonly TOOL_BASE_TOKENS = 15;

    /**
     * Quickly estimate token usage linearly without a network call.
     */
    static estimate(
        prompt: string | Content[],
        systemInstruction: string | undefined,
        tools: FunctionDeclaration[],
        remainingBudget: number,
        expectedOutputTokens: number = 1000
    ): TokenEstimate {
        let inputTokens = 0;

        // 1. System Instruction
        if (systemInstruction) {
            inputTokens += Math.ceil(systemInstruction.length / this.CHARS_PER_TOKEN);
        }

        // 2. Prompt & Conversation History
        if (typeof prompt === 'string') {
            inputTokens += Math.ceil(prompt.length / this.CHARS_PER_TOKEN);
        } else if (Array.isArray(prompt)) {
            for (const content of prompt) {
                if (!content.parts) continue;
                for (const part of content.parts) {
                    if ('text' in part && typeof part.text === 'string') {
                        inputTokens += Math.ceil(part.text.length / this.CHARS_PER_TOKEN);
                    }
                    if ('inlineData' in part) {
                        // Image approximation (Gemini charges ~258 tokens per standard image)
                        inputTokens += 258;
                    }
                    if ('functionCall' in part) {
                        inputTokens += 20;
                    }
                    if ('functionResponse' in part) {
                        const respStr = JSON.stringify(part);
                        inputTokens += Math.ceil(respStr.length / this.CHARS_PER_TOKEN);
                    }
                }
            }
        }

        // 3. Available Tools
        for (const tool of tools) {
            let toolStr = tool.name + (tool.description || '');
            if (tool.parameters) {
                toolStr += JSON.stringify(tool.parameters);
            }
            inputTokens += this.TOOL_BASE_TOKENS + Math.ceil(toolStr.length / this.CHARS_PER_TOKEN);
        }

        const totalProjected = inputTokens + expectedOutputTokens;
        const willExceed = totalProjected > remainingBudget;

        if (willExceed) {
            logger.warn(`[TokenEstimator] Execution Blocked: Projected usage (${totalProjected}) exceeds remaining budget (${remainingBudget}). Input Tokens: ${inputTokens}, Tool Count: ${tools.length}`);
        }

        return {
            inputTokens,
            projectedOutputTokens: expectedOutputTokens,
            totalProjected,
            remainingBudget,
            willExceed
        };
    }
}
