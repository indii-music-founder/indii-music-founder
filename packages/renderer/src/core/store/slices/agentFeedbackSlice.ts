import { StateCreator } from 'zustand';
import { logger } from '@/utils/logger';
import { AgentFeedbackEvent, AgentActionContext, FeedbackRating } from '@/types/agent-feedback';
import { Timestamp } from 'firebase/firestore';
import { alwaysOnMemoryEngine } from '@/services/agent/memory/AlwaysOnMemoryEngine';
import { auth } from '@/services/firebase';

export interface AgentFeedbackSlice {
    // Data
    pendingFeedbackEvents: AgentFeedbackEvent[];

    // UI State
    isFeedbackWidgetOpen: boolean;
    currentFeedbackContext: AgentActionContext | null;

    // Actions
    openFeedbackWidget: (context: AgentActionContext) => void;
    closeFeedbackWidget: () => void;
    submitFeedback: (rating: FeedbackRating, comment?: string) => Promise<boolean>;
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

    submitFeedback: async (rating, comment) => {
        const { currentFeedbackContext } = get();
        if (!currentFeedbackContext) {
            logger.warn('[AgentFeedbackSlice] Cannot submit feedback without an active context.');
            return false;
        }
        const userId = auth.currentUser?.uid;
        if (!userId) return false;

        try {
            // Persist the feedback as a strategic rule in Always-On Memory
            const ruleText = comment
                ? `Strategic Feedback for ${currentFeedbackContext.actionType}: ${comment}`
                : `User ${rating === 'positive' ? 'approved' : 'rejected'} agent action: ${currentFeedbackContext.actionType}`;

            // Keep the widget open if the memory pipeline fails or skips the rule.
            await alwaysOnMemoryEngine.saveFeedback(userId, ruleText, rating);

            const newEvent: AgentFeedbackEvent = {
                id: crypto.randomUUID(),
                userId,
                createdAt: Timestamp.now(),
                actionContext: currentFeedbackContext,
                rating,
                comment,
                isProcessed: true,
                sharedGlobally: false,
            };

            set((state) => ({
                pendingFeedbackEvents: [...(state.pendingFeedbackEvents || []), newEvent],
                isFeedbackWidgetOpen: false,
                currentFeedbackContext: null,
            }));

            logger.info(`[AgentFeedbackSlice] Feedback submitted for action: ${currentFeedbackContext.actionType}`);
            return true;
        } catch (error: unknown) {
            logger.error('[AgentFeedbackSlice] Failed to submit feedback:', error);
            return false;
        }
    },
});
