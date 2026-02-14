
import { AI } from '@/services/ai/AIService';
import { ModelRouter } from '../router/ModelRouter';
import type { AgentMessage } from '@/core/store';

export class CompactionService {
    /**
     * Compacts a list of chat messages into a concise summary string.
     * Uses Flash model for efficiency (mapped via ModelRouter 'analyze').
     */
    async compactChatHistory(history: AgentMessage[]): Promise<string> {
        if (!history || history.length === 0) return '';

        try {
            console.debug('[CompactionService] Compacting chat history...', history.length);

            // Triage with Flash
            const result = await AI.generateContent({
                model: ModelRouter.select('analyze'),
                contents: {
                    role: 'user',
                    parts: [{
                        text: `
Summarize the following conversation history into key points, decisions, and outcomes.
Focus on factual data (IDs, names, technical details) and user intent.
Keep it concise.

HISTORY:
${history.map(m => `${m.role.toUpperCase()}: ${m.text || ''}`).join('\n\n')}
                        `.trim()
                    }]
                }
            });

            return result.text() || '';
        } catch (error) {
            console.error('[CompactionService] Failed to compact history:', error);
            return ''; // Fail gracefully
        }
    }
}

export const compactionService = new CompactionService();
