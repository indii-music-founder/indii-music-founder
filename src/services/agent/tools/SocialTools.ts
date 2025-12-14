import { useStore } from '@/core/store';
import type { ToolFunctionArgs } from '../types';

// ============================================================================
// Types for SocialTools
// ============================================================================

interface GenerateSocialPostArgs extends ToolFunctionArgs {
    platform: string;
    topic: string;
    tone?: string;
}

// ============================================================================
// Helper to extract error message
// ============================================================================

function getErrorMessage(error: unknown): string {
    if (error instanceof Error) {
        return error.message;
    }
    return 'An unknown error occurred';
}

// ============================================================================
// SocialTools Implementation
// ============================================================================

export const SocialTools = {
    generate_social_post: async (args: GenerateSocialPostArgs): Promise<string> => {
        try {
            const { AI } = await import('@/services/ai/AIService');
            const prompt = `Generate a ${args.tone || 'professional'} social media post for ${args.platform} about ${args.topic}. Include hashtags.`;
            const result = await AI.generateContent({
                model: 'gemini-3-pro-preview',
                contents: [{ role: 'user', parts: [{ text: prompt }] }]
            });
            const text = result.text();

            const { addToHistory, currentProjectId } = useStore.getState();
            addToHistory({
                id: crypto.randomUUID(),
                url: '',
                prompt: args.topic,
                type: 'text',
                timestamp: Date.now(),
                projectId: currentProjectId,
                meta: text
            });

            return `Generated Post for ${args.platform}:\n${text}`;
        } catch (e: unknown) {
            return `Social post generation failed: ${getErrorMessage(e)}`;
        }
    }
};
