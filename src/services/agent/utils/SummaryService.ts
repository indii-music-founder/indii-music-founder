import { AI } from '../../ai/AIService';
import { AI_MODELS, AI_CONFIG } from '@/core/config/ai-models';
import { Logger } from '@/core/logger/Logger';

/**
 * SummaryService: Compresses long conversation histories using Gemini 3 Flash.
 * Part of the "Memory & Hybrid Architecture" (Indii Tier 2).
 */
export class SummaryService {
    /**
     * Summarizes a block of conversation history.
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

            const response = await AI.generateContent({
                model: AI_MODELS.TEXT.FAST,
                contents: { role: 'user', parts: [{ text: prompt }] },
                config: {
                    ...AI_CONFIG.THINKING.LOW,
                    maxOutputTokens: 512
                }
            });

            const summary = response.text().trim();
            Logger.info('SummaryService', 'Summary generated successfully.');
            return summary;
        } catch (error) {
            Logger.error('SummaryService', 'Failed to generate summary:', error);
            // Fallback: return truncated original text if summarization fails
            return `[Truncated History] ... ${text.slice(-500)}`;
        }
    }
}
