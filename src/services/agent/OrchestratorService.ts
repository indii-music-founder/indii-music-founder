import { AI } from '@/services/ai/AIService';
import { useStore } from '@/core/store';
import { AI_MODELS, AI_CONFIG } from '@/core/config/ai-models';

export const ORCHESTRATOR_PROMPT = `
You are indii, the Chief of Staff for indiiOS.
Your goal is to route user requests to the correct department.

DEPARTMENTS:
1. "creative" - Image generation, visual design, canvas work, "make an image of...", "draw a...".
2. "video" - Video generation, animation, motion brush, keyframing, "animate this", "make a video".
3. "legal" - Contracts, compliance, NDAs, legal review, "review this contract", "draft an NDA".
4. "music" - Audio analysis, track selection, "analyze this song", "find a track".
5. "campaign" - Ad copy, social media, branding, "write a tweet", "marketing plan", "campaign strategy".
6. "dashboard" - Project management, file uploads, general overview, "create project", "home".
7. "workflow" - Research, RAG, complex multi-step workflows, "research this topic", "find info on...".
8. "brand" - Brand consistency, style guide checks, "is this on brand?", "check tone", "brand voice".
9. "road" - Logistics, scheduling, tour management, "plan a tour", "schedule a meeting", "itinerary".

TASK:
Analyze the user's input and determine the best department.
- "create a project" -> "dashboard"
- "open project", "switch project", "go to project" -> "dashboard"
- "upload a file" -> "dashboard"
- "research" or "knowledge base" -> "workflow"
- "video", "animation", "motion" -> "video"
- "song", "audio", "music", "analyze" -> "music"
- "contract", "legal", "lawyer" -> "legal"
- "image", "picture", "photo" -> "creative"
- "brand", "style", "tone" -> "brand"
- "tour", "schedule", "logistics" -> "road"
- "marketing", "campaign", "social media" -> "campaign"

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
                contents: { role: 'user', parts: [{ text: prompt }] },
                config: {
                    ...AI_CONFIG.THINKING.LOW
                }
            });

            const route = (res.text() || 'creative').trim().toLowerCase();

            // Validate route
            const validRoutes = ['creative', 'video', 'legal', 'music', 'campaign', 'dashboard', 'workflow', 'brand', 'road'];
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
