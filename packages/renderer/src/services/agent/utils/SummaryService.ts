import { AutonomousIntelligence as AI } from '../../intelligence/AutonomousIntelligence';
import { INTELLIGENCE_MODELS, INTELLIGENCE_CONFIG } from '@/core/config/intelligence-models';
import { Logger } from '@/core/logger/Logger';

/**
 * SummaryService: Compresses long conversation histories using Gemini 3 Flash.
 * Part of the "Memory & Hybrid Architecture" (Indii Tier 2).
 */
export class SummaryService {
    /**
     * Summarizes a block of conversation history.
     * Uses Gemini 3 Flash to compress context while preserving user preferences and facts.
     * 
     * @param text - The conversation history text to summarize.
     * @returns A concise markdown-formatted summary of the conversation.
     */
    static async summarize(text: string): Promise<string> {
        if (!text || text.length < 500) return text; // Don't summarize tiny snippets

        Logger.info('SummaryService', 'Compressing conversation history...');

        try {
            const prompt = `
            You are the Indii Memory Summarizer.
            Your task is to compress the following conversation history into a concise but high-fidelity summary.
            
            GOALS:
            1. Preserve specific user preferences (e.g., "I like red", "Use Spotify for distribution").
            2. Preserve current task progress (e.g., "Working on the album cover", "Just finished master track").
            3. Preserve established facts about the brand/artist.
            4. Remove repetitive "Hello", "How can I help", and boilerplate turns.
            
            FORMAT:
            - One or two sentences for general context.
            - Bullet points for key facts, preferences, and progress.
            - Keep it under 200 words.
            
            CONVERSATION TO SUMMARIZE:
            """
            ${text}
            """
            
            SUMMARY:`;

            const response = await AI.generateContent(
                [{ role: 'user', parts: [{ text: prompt }] }],
                INTELLIGENCE_MODELS.TEXT.FAST,
                {
                    ...INTELLIGENCE_CONFIG.THINKING.LOW,
                    maxOutputTokens: 512
                }
            );

            if (!response || !response.response) {
                throw new Error('Invalid response structure from AutonomousIntelligence');
            }
            const rawText = typeof response.response.text === 'function'
                ? response.response.text()
                : (response.response.text as unknown as string || '');
            const summary = rawText.trim();
            Logger.info('SummaryService', 'Summary generated successfully.');
            return summary;
        } catch (error: unknown) {
            Logger.error('SummaryService', 'Failed to generate summary:', error);
            // Fallback: return truncated original text if summarization fails
            return `[Truncated History] ... ${text.slice(-500)}`;
        }
    }
}
