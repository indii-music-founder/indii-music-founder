import { useStore } from '@/core/store';
import { logger } from '@/utils/logger';

export interface ParkedIdea {
    id: string;
    text: string;
    source: string; // agent ID that offered it
    timestamp: number;
    accepted?: boolean;
}

/**
 * v1.5 idea tracking: when agent offers unsolicited ideas, they use this tool
 * (future v2: renders as tappable suggestion chips in UI)
 */
export class IdeaParkingService {
    static readonly IDEA_ACCEPTANCE_THRESHOLD = 5;
    static readonly AMBITION_PROMPT_COOLDOWN_MS = 1000 * 60 * 60 * 24; // 24h

    /**
     * Agent calls this when offering an idea (v2: UI renders as chip)
     * v1.5: just logs for tracking; no UI change
     */
    static offerIdea(text: string, sourceAgentId: string): ParkedIdea {
        const idea: ParkedIdea = {
            id: `idea-${Date.now()}-${Math.random().toString(36).slice(2)}`,
            text,
            source: sourceAgentId,
            timestamp: Date.now()
        };
        logger.debug('[IdeaParking] Offered idea:', idea);
        return idea;
    }

    /**
     * Call when user acts on a parked idea (accepts it)
     * Increments counter; may trigger ambition-dial promotion prompt
     */
    static acceptIdea(): void {
        const { userProfile, updatePreferences } = useStore.getState();
        if (!userProfile) return;

        const current = userProfile.preferences?.ideaAcceptanceCount ?? 0;
        const lastPrompt = userProfile.preferences?.lastAmbitionPromptTime ?? 0;
        const now = Date.now();

        updatePreferences({
            ideaAcceptanceCount: current + 1,
            // Trigger prompt check on next agent call if threshold hit and cooldown passed
        });

        logger.debug(`[IdeaParking] Idea accepted. Count: ${current + 1}/${IdeaParkingService.IDEA_ACCEPTANCE_THRESHOLD}`);

        // Check if we should offer dial upgrade
        if (current + 1 >= IdeaParkingService.IDEA_ACCEPTANCE_THRESHOLD &&
            (now - lastPrompt) > IdeaParkingService.AMBITION_PROMPT_COOLDOWN_MS) {
            IdeaParkingService.scheduleAmbitionPrompt();
        }
    }

    /**
     * Schedules the agent to ask for dial upgrade consent on next message.
     * Sets the flag so ContextPipeline can inject the prompt.
     */
    static scheduleAmbitionPrompt(): void {
        const { updatePreferences } = useStore.getState();
        updatePreferences({
            lastAmbitionPromptTime: Date.now()
        });
        logger.info('[IdeaParking] Ambition-dial promotion prompt scheduled');
    }

    /**
     * Checks if ambition prompt should be injected into agent context
     * (called by ContextPipeline before each agent call)
     */
    static shouldAskForDialUpgrade(): boolean {
        const { userProfile } = useStore.getState();
        if (!userProfile?.preferences) return false;

        const count = userProfile.preferences.ideaAcceptanceCount ?? 0;
        const lastPrompt = userProfile.preferences.lastAmbitionPromptTime ?? 0;
        const now = Date.now();

        return count >= IdeaParkingService.IDEA_ACCEPTANCE_THRESHOLD &&
               (now - lastPrompt) < 5000; // Within 5s of scheduling (one window to ask)
    }

    /**
     * Resets the prompt flag after question is asked
     */
    static clearAmbitionPromptFlag(): void {
        const { updatePreferences } = useStore.getState();
        updatePreferences({
            lastAmbitionPromptTime: Date.now() + IdeaParkingService.AMBITION_PROMPT_COOLDOWN_MS
        });
    }
}
