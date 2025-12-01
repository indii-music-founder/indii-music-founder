import { AI } from '@/services/ai/AIService';
import { useStore } from '@/core/store';
import { AI_MODELS, AI_CONFIG } from '@/core/config/ai-models';

export const ORCHESTRATOR_PROMPT = `
You are indii, the Chief of Staff for indiiOS.
Your goal is to route user requests to the correct department.

DEPARTMENTS:
1. "creative" - Image generation, visual design, canvas work.
2. "video" - Video generation, animation, motion brush, keyframing.
3. "legal" - Contracts, compliance, NDAs, legal review.
4. "music" - Composition, songwriting, audio production.
5. "marketing" - Ad copy, social media, branding.
6. "dashboard" - Project management, file uploads, general overview.
7. "workflow" - Research, RAG, complex multi-step workflows.

TASK:
Analyze the user's input and determine the best department.
If the user asks to "create a project" or "upload a file", route to "dashboard".
If the user asks about "research" or "knowledge base", route to "workflow".
If the user asks about "video", "animation", or "motion", route to "video".

OUTPUT:
Return ONLY the department ID (e.g., "legal") as a lowercase string.
If unsure, default to "creative".
`;

class OrchestratorService {
    async routeRequest(query: string): Promise<string> {
        // Manual overrides for specific keywords to ensure reliability
        const lowerQuery = query.toLowerCase();
        if (lowerQuery.includes('video') || lowerQuery.includes('animate') || lowerQuery.includes('motion') || lowerQuery.includes('movie')) {
            return 'video';
        }

        const prompt = `
        ${ORCHESTRATOR_PROMPT}
        
        USER INPUT: "${query}"
        
        TARGET DEPARTMENT:
        `;

        try {
            const res = await AI.generateContent({
                model: AI_MODELS.TEXT.FAST,
                contents: { parts: [{ text: prompt }] },
                config: {
                    ...AI_CONFIG.THINKING.LOW
                }
            });

            const route = (res.text || 'creative').trim().toLowerCase();

            // Validate route
            const validRoutes = ['creative', 'video', 'legal', 'music', 'marketing', 'dashboard', 'workflow'];
            if (validRoutes.includes(route)) {
                return route;
            }
            return 'creative';
        } catch (e) {
            console.error("Orchestrator routing failed:", e);
            return 'creative'; // Fallback
        }
    }

    async executeRouting(query: string) {
        const targetModule = await this.routeRequest(query);
        useStore.getState().setPendingPrompt(query);
        useStore.getState().setModule(targetModule as any);
        return targetModule;
    }
}

export const Orchestrator = new OrchestratorService();
