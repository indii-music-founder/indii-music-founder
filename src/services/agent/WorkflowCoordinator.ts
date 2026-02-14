
import { AgentContext } from './types';
import { firebaseAI } from '@/services/ai/FirebaseAIService';
import { AI_MODELS } from '@/core/config/ai-models';
import { fileSystemService } from '@/services/FileSystemService';

export type TaskComplexity = 'SIMPLE_GENERATION' | 'COMPLEX_ORCHESTRATION';

// Keywords implying simple generation (expanded for conversational queries)
const GENERATION_TRIGGERS = [
    'write a', 'draft a', 'generate a', 'create a',
    'joke', 'poem', 'caption', 'email', 'list',
    'explain', 'what is', 'what are', 'how do', 'how does',
    'tell me', 'help me understand', 'summarize', 'describe',
    'why is', 'why do', 'can you', 'could you'
];

// Precompile regex for word boundaries
const GENERATION_REGEXES = GENERATION_TRIGGERS.map(t => new RegExp(`\\b${t}\\b`, 'i'));

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

        if (complexityTriggers.some(t => lower.includes(t))) {
            return 'COMPLEX_ORCHESTRATION';
        }

        if (GENERATION_REGEXES.some(r => r.test(lower)) && !complexityTriggers.some(t => lower.includes(t))) {
            return 'SIMPLE_GENERATION';
        }

        // Default to Simple — the fast path handles most conversational queries well.
        // Complex orchestration should be explicitly triggered by complexity keywords.
        return 'SIMPLE_GENERATION';
    }

    private requiresTools(message: string): boolean {
        // If it looks like it needs tools (e.g. database access, memory, media generation), force Agent
        const lower = message.toLowerCase();

        // Media generation keywords - EXPANDED for better coverage
        const mediaKeywords = [
            'image', 'photo', 'picture', 'art', 'draw', 'video', 'movie', 'film', 'music', 'song', 'track',
            // Album/Cover related
            'cover', 'album', 'poster', 'artwork', 'thumbnail', 'banner',
            // Visual design terms
            'visual', 'graphic', 'design', 'illustration', 'render', 'scene',
            // Action verbs that imply image generation
            'visualize', 'depict', 'illustrate'
        ];
        if (mediaKeywords.some(w => lower.includes(w))) return true;

        // CRITICAL FIX: Detect implicit generation requests
        // "Generate a pink neon cybernetic tiger" implies image generation even without "image" keyword
        // Pattern: "generate" + descriptive subject (not "generate a list", "generate a caption")
        const textOnlyPatterns = ['list', 'caption', 'email', 'text', 'script', 'story', 'poem', 'joke', 'draft', 'outline', 'summary'];
        if (lower.includes('generate') || lower.includes('create') || lower.includes('make me')) {
            // If it contains a text-only pattern, it's NOT image generation
            const isTextOnly = textOnlyPatterns.some(p => lower.includes(p));
            if (!isTextOnly) {
                // Assume it's image generation if "generate/create" + NOT text-only
                return true;
            }
        }

        // Only require tools for explicit persistence/retrieval actions, NOT for possessive "my"
        // Note: 'save', 'find', 'search', 'upload' are already caught by complexityTriggers in determineComplexity,
        // so they will be routed to COMPLEX_ORCHESTRATION before reaching here (which only runs for SIMPLE_GENERATION).
        // 'download' is not in complexityTriggers, so we keep it here.
        // 'download' is not in complexityTriggers, so we keep it here.
        return lower.includes('download');
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
            // Ignore error if folder creation fails (might already exist)
        }
    }

    private async executeDirectGeneration(
        message: string,
        context: AgentContext,
        onStream?: (chunk: string) => void
    ): Promise<string> {
        // Direct call to FirebaseAI (Gemini) for fast response
        try {
            // Build persona-aware system prompt from context
            const artistName = context.userProfile?.displayName || '';
            const brandDesc = context.brandKit?.brandDescription || '';
            const genre = context.brandKit?.releaseDetails?.genre || '';

            let personaContext = '';
            if (artistName) {
                personaContext += `\nYou are working with the artist **${artistName}**.`;
                personaContext += ` ALWAYS use this exact name when referring to the artist. NEVER invent a different name.`;
            }
            if (brandDesc) personaContext += `\nBrand: ${brandDesc}`;
            if (genre) personaContext += `\nGenre: ${genre}`;

            const systemPrompt = `You are indii, a creative assistant for independent music artists and creators.${personaContext}

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
            console.error('[WorkflowCoordinator] Direct generation failed, delegating to agent:', e);
            return "DELEGATED_TO_AGENT";
        }
    }
}

export const coordinator = new WorkflowCoordinator();
