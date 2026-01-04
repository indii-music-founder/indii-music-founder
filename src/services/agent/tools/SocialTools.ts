import { firebaseAI } from '@/services/ai/FirebaseAIService';
import { SocialService } from '@/services/social/SocialService';
import { AI_MODELS } from '@/core/config/ai-models';
import { wrapTool, toolSuccess } from '../utils/ToolUtils';
import type { AnyToolFunction } from '../types';

// ============================================================================
// SocialTools Implementation
// ============================================================================

export const SocialTools: Record<string, AnyToolFunction> = {
    generate_social_post: wrapTool('generate_social_post', async ({ platform, topic, tone }: { platform: string; topic: string; tone?: string }) => {
        const prompt = `Generate a ${tone || 'professional'} social media post for ${platform} about ${topic}. Include hashtags.`;

        const result = await firebaseAI.generateContent(
            prompt,
            AI_MODELS.TEXT.AGENT
        );
        const text = result.response.text();

        // Auto-persist using the robust SocialService
        let postId: string | null = null;
        let persistMessage = "Post generated but failed to save to feed.";

        try {
            postId = await SocialService.createPost(text);
            persistMessage = `Saved to Feed (ID: ${postId})`;
        } catch (persistError) {
            console.warn('Failed to persist social post:', persistError);
        }

        return toolSuccess({
            platform,
            content: text,
            postId
        }, `Generated Post for ${platform}:\n${text}\n\n${persistMessage}`);
    })
};

// Aliases
export const { generate_social_post } = SocialTools;
