
import { AgentContext } from './types';
import { agentService } from './AgentService';
import { firebaseAI } from '@/services/ai/FirebaseAIService';
import { AI_MODELS } from '@/core/config/ai-models';
import { fileSystemService } from '@/services/FileSystemService';

export type TaskComplexity = 'SIMPLE_GENERATION' | 'COMPLEX_ORCHESTRATION';

export class WorkflowCoordinator {

    /**
     * Main entry point for user requests.
     * Decisions:
     * 1. Is this a simple generation task? (Direct AI)
     * 2. Is this a complex orchestration task? (Agent Zero)
     */
    async handleUserRequest(
        userMessage: string,
        context: AgentContext,
        onStream?: (chunk: string) => void
    ): Promise<string> {
        // Ensure workspace is ready (auto-create folders if needed)
        await this.prepareWorkspace(context);

        const mode = this.determineComplexity(userMessage);

        if (mode === 'SIMPLE_GENERATION' && !this.requiresTools(userMessage)) {
            return this.executeDirectGeneration(userMessage, context, onStream);
        } else {
            // Default to Agent Orchestration for safety and tool access
            // return agentService.sendMessage(userMessage) - wait, AgentService.sendMessage returns void and handles store. 
            // We might need to refactor AgentService or just call it.
            // For now, let's assume we call AgentService and it handles the UI updates.
            // actually AgentService.sendMessage manages the whole flow including store updates.
            // So we might need to intercept *before* AgentService.sendMessage is called, 
            // OR make AgentService use this Coordinator.

            // Let's assume we are integrating INTO AgentService.
            // So this function might just return the Decision.
            return "DELEGATED_TO_AGENT";
        }
    }

    /**
     * Heuristic-based routing.
     * Can be upgraded to LLM-based classification later.
     */
    determineComplexity(message: string): TaskComplexity {
        const lower = message.toLowerCase();

        // Keywords implying complex workflow or tool use
        const complexityTriggers = [
            'plan', 'strategy', 'campaign', 'schedule', 'research',
            'analyze', 'review', 'audit', 'manage', 'coordinate',
            'find', 'search', 'upload', 'save', 'remember'
        ];

        // Keywords implying simple generation
        const generationTriggers = [
            'write a', 'draft a', 'generate a', 'create a',
            'joke', 'poem', 'caption', 'email', 'list'
        ];

        if (complexityTriggers.some(t => lower.includes(t))) {
            return 'COMPLEX_ORCHESTRATION';
        }

        if (generationTriggers.some(t => lower.includes(t)) && !complexityTriggers.some(t => lower.includes(t))) {
            return 'SIMPLE_GENERATION';
        }

        // Default to Complex to be safe (Agent can handle simple stuff too)
        return 'COMPLEX_ORCHESTRATION';
    }

    private requiresTools(message: string): boolean {
        // If it looks like it needs tools (e.g. database access, memory, media generation), force Agent
        const lower = message.toLowerCase();

        // Media generation keywords
        const mediaKeywords = ['image', 'photo', 'picture', 'art', 'draw', 'video', 'movie', 'film', 'music', 'song', 'track'];
        if (mediaKeywords.some(w => lower.includes(w))) return true;

        return lower.includes('my') || lower.includes('save') || lower.includes('find');
    }

    /**
     * Ensures the workspace has necessary structure for the Agent.
     * e.g. "Campaigns" folder for marketing tasks.
     */
    private async prepareWorkspace(context: AgentContext): Promise<void> {
        if (!context.projectId || !context.userId) return;

        try {
            // Check for "Campaign Assets" folder
            const nodes = await fileSystemService.getProjectNodes(context.projectId);
            const campaignFolder = nodes.find(n => n.name === 'Campaign Assets' && n.type === 'folder');

            if (!campaignFolder) {

                await fileSystemService.createNode({
                    name: 'Campaign Assets',
                    type: 'folder',
                    parentId: null,
                    projectId: context.projectId,
                    userId: context.userId
                });
            }
        } catch (e) {
        }
    }

    private async executeDirectGeneration(
        message: string,
        context: AgentContext,
        onStream?: (chunk: string) => void
    ): Promise<string> {
        // Direct call to FirebaseAI (Gemini) for fast response
        try {
            // Prepare a simple system prompt
            const systemPrompt = `You are indii, a creative assistant. 
            The user has asked for a quick content generation. 
            Be direct, creative, and concise. Do not use tools.`;

            // We use generating content directly with the FAST model
            const response = await firebaseAI.generateContent(
                [
                    { role: 'model', parts: [{ text: systemPrompt }] },
                    { role: 'user', parts: [{ text: message }] }
                ],
                AI_MODELS.TEXT.FAST
            );

            const text = response.response.text() || "";
            if (onStream) onStream(text);
            return text;

        } catch (e) {
            return "DELEGATED_TO_AGENT";
        }
    }
}

export const coordinator = new WorkflowCoordinator();
