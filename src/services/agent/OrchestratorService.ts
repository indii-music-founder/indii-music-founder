import { AI } from '@/services/ai/AIService';
import { useStore } from '@/core/store';
import { AI_MODELS, AI_CONFIG } from '@/core/config/ai-models';

export const ORCHESTRATOR_PROMPT = `
You are the Orchestrator (Chief of Staff) for Rndr-AI.
Your goal is to route user requests to the correct department.

DEPARTMENTS:
1. "creative" - Image generation, video editing, visual design, canvas work.
2. "legal" - Contracts, compliance, NDAs, legal review.
3. "music" - Composition, songwriting, audio production.
4. "marketing" - Ad copy, social media, branding (Coming Soon).

TASK:
Analyze the user's input and determine the best department.
OUTPUT:
Return ONLY the department ID (e.g., "legal") as a lowercase string.
If unsure, default to "creative".
`;

class OrchestratorService {
    async routeRequest(query: string): Promise<string> {
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
            const validRoutes = ['creative', 'legal', 'music', 'marketing'];
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
        useStore.getState().setModule(targetModule as any);
        return targetModule;
    }
}

export const Orchestrator = new OrchestratorService();
