import { StateCreator } from 'zustand';
import { logger } from '@/utils/logger';
import { AgentFeedbackEvent, AgentActionContext, FeedbackRating } from '@/types/agent-feedback';
import { Timestamp } from 'firebase/firestore';
import { userMemoryService } from '@/services/agent/UserMemoryService';

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
            let memoryId: string | undefined;

            // Persist the feedback as a strategic rule in UserMemory
            const ruleText = comment
                ? `Rule for ${currentFeedbackContext.actionType}: ${comment}`
                : `User ${rating === 'positive' ? 'approved' : 'rejected'} action: ${currentFeedbackContext.actionType}`;

            try {
                memoryId = await userMemoryService.saveMemory(
                    userId,
                    ruleText,
                    'feedback',
                    'high',
                    {
                        tags: ['agent-feedback', currentFeedbackContext.agentId],
                        sourceSessionId: currentFeedbackContext.promptId
                    }
                );
                logger.info(`[AgentFeedbackSlice] Successfully saved strategic rule to UserMemory for user ${userId}`);
            } catch (memoryError: unknown) {
                logger.error('[AgentFeedbackSlice] Failed to save rule to UserMemory (non-blocking):', memoryError);
            }

            const newEvent: AgentFeedbackEvent = {
                id: crypto.randomUUID(),
                userId,
                createdAt: Timestamp.now(),
                actionContext: currentFeedbackContext,
                rating,
                comment,
                isProcessed: true,
                resultingMemoryId: memoryId,
                sharedGlobally,
            };

            set((state) => ({
                pendingFeedbackEvents: [...(state.pendingFeedbackEvents || []), newEvent],
                isFeedbackWidgetOpen: false,
                currentFeedbackContext: null,
            }));

            logger.info(`[AgentFeedbackSlice] Feedback submitted for action: ${currentFeedbackContext.actionType}`);
        } catch (error: unknown) {
            logger.error('[AgentFeedbackSlice] Failed to submit feedback:', error);
        }
    },
});
