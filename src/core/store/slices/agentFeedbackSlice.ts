import { StateCreator } from 'zustand';
import { logger } from '@/utils/logger';
import { AgentFeedbackEvent, AgentActionContext, FeedbackRating } from '@/types/agent-feedback';
import { Timestamp } from 'firebase/firestore';

export interface AgentFeedbackSlice {
    // Data
    pendingFeedbackEvents: AgentFeedbackEvent[];

    // UI State
    isFeedbackWidgetOpen: boolean;
    currentFeedbackContext: AgentActionContext | null;

    // Actions
    openFeedbackWidget: (context: AgentActionContext) => void;
    closeFeedbackWidget: () => void;
    submitFeedback: (userId: string, rating: FeedbackRating, comment?: string, sharedGlobally?: boolean) => Promise<void>;
}

export const createAgentFeedbackSlice: StateCreator<AgentFeedbackSlice> = (set, get) => ({
    pendingFeedbackEvents: [],
    isFeedbackWidgetOpen: false,
    currentFeedbackContext: null,

    openFeedbackWidget: (context) => {
        set({
            isFeedbackWidgetOpen: true,
            currentFeedbackContext: context,
        });
    },

    closeFeedbackWidget: () => {
        set({
            isFeedbackWidgetOpen: false,
            currentFeedbackContext: null,
        });
    },

    submitFeedback: async (userId, rating, comment, sharedGlobally = false) => {
        const { currentFeedbackContext } = get();
        if (!currentFeedbackContext) {
            logger.warn('[AgentFeedbackSlice] Cannot submit feedback without an active context.');
            return;
        }

        try {
            // In a full implementation, this calls AgentFeedbackService to persist to Firestore
            const newEvent: AgentFeedbackEvent = {
                id: crypto.randomUUID(),
                userId,
                createdAt: Timestamp.now(),
                actionContext: currentFeedbackContext,
                rating,
                comment,
                isProcessed: false,
                sharedGlobally,
            };

            set((state) => ({
                pendingFeedbackEvents: [...(state.pendingFeedbackEvents || []), newEvent],
                isFeedbackWidgetOpen: false,
                currentFeedbackContext: null,
            }));

            logger.info(`[AgentFeedbackSlice] Feedback submitted for action: ${currentFeedbackContext.actionType}`);

            // TODO: Hook into MemoryAgent to parse this event into a UserMemory rule.
        } catch (error) {
            logger.error('[AgentFeedbackSlice] Failed to submit feedback:', error);
        }
    },
});
