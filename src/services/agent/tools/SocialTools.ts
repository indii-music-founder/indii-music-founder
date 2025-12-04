import { useStore } from '@/core/store';

export const SocialTools = {
    generate_social_post: async (args: { platform: string, topic: string, tone?: string }) => {
        try {
            const { AI } = await import('@/services/ai/AIService');
            const prompt = `Generate a ${args.tone || 'professional'} social media post for ${args.platform} about ${args.topic}. Include hashtags.`;
            const result = await AI.generateContent({
                model: 'gemini-2.0-flash-exp',
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
        } catch (e: any) {
            return `Social post generation failed: ${e.message}`;
        }
    }
};
