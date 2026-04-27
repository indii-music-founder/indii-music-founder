import { logger } from '@/utils/logger';
import { livingPlanService, PlanDraft, LivingPlan } from '../LivingPlanService';
import { useStore } from '@/core/store';
import { AgentContext, ToolFunctionResult } from '../types';
import { z } from 'zod';

/**
 * Tools for interacting with Living Plans.
 * These are registered with agents to allow them to propose and manage plans.
 */
export const LivingPlanTools = {
    /**
     * Propose a new structured plan to the user.
     * This creates a 'Draft' plan in Firestore and returns the ID.
     */
    propose_plan: async (args: PlanDraft, context?: AgentContext): Promise<ToolFunctionResult> => {
        const { currentProjectId, user } = useStore.getState();
        const projectId = context?.projectId || currentProjectId;
        const userId = context?.userId || user?.uid;

        if (!projectId) {
            return { success: false, error: 'No active project found. Cannot propose a plan.' };
        }
        if (!userId) {
            return { success: false, error: 'User not authenticated. Cannot propose a plan.' };
        }

        logger.debug('[LivingPlanTools] Proposing plan:', args.summary);
        
        try {
            const plan = await livingPlanService.create(userId, projectId, args.summary, args);
            return {
                success: true,
                data: {
                    planId: plan.id,
                    status: 'proposed'
                }
            };
        } catch (error: any) {
            logger.error('[LivingPlanTools] Error proposing plan:', error);
            return { success: false, error: error.message };
        }
    },

    /**
     * Refine an existing plan draft before it is approved.
     */
    refine_plan: async (args: { planId: string; updates: Partial<PlanDraft> }, context?: AgentContext): Promise<ToolFunctionResult> => {
        const { currentProjectId } = useStore.getState();
        const projectId = context?.projectId || currentProjectId;

        if (!projectId) {
            return { success: false, error: 'No active project found.' };
        }

        try {
            const plan = await livingPlanService.get(projectId, args.planId);
            if (!plan) {
                return { success: false, error: 'Plan not found.' };
            }

            const newDraft = { ...plan.draft, ...args.updates };
            await livingPlanService.updateDraft(projectId, args.planId, newDraft);
            return { success: true };
        } catch (error: any) {
            logger.error('[LivingPlanTools] Error refining plan:', error);
            return { success: false, error: error.message };
        }
    },

    /**
     * Get the details of a specific plan.
     */
    get_plan: async (args: { planId: string }, context?: AgentContext): Promise<ToolFunctionResult> => {
        const { currentProjectId } = useStore.getState();
        const projectId = context?.projectId || currentProjectId;

        if (!projectId) {
            return { success: false, error: 'No active project found.' };
        }

        try {
            const plan = await livingPlanService.get(projectId, args.planId);
            if (!plan) {
                return { success: false, error: 'Plan not found.' };
            }
            return { success: true, data: plan };
        } catch (error: any) {
            logger.error('[LivingPlanTools] Error getting plan:', error);
            return { success: false, error: error.message };
        }
    },

    /**
     * Cancel a plan in progress.
     */
    cancel_plan: async (args: { planId: string }, context?: AgentContext): Promise<ToolFunctionResult> => {
        const { currentProjectId } = useStore.getState();
        const projectId = context?.projectId || currentProjectId;

        if (!projectId) {
            return { success: false, error: 'No active project found.' };
        }

        try {
            await livingPlanService.cancel(projectId, args.planId);
            return { success: true };
        } catch (error: any) {
            logger.error('[LivingPlanTools] Error cancelling plan:', error);
            return { success: false, error: error.message };
        }
    },

    /**
     * Mark a plan step as complete.
     */
    complete_step: async (args: { planId: string; stepId: string; result?: any }, context?: AgentContext): Promise<ToolFunctionResult> => {
        const { currentProjectId } = useStore.getState();
        const projectId = context?.projectId || currentProjectId;

        if (!projectId) {
            return { success: false, error: 'No active project found.' };
        }

        try {
            await livingPlanService.updateStepStatus(projectId, args.planId, args.stepId, 'complete', undefined, args.result);
            return { success: true };
        } catch (error: any) {
            logger.error('[LivingPlanTools] Error completing step:', error);
            return { success: false, error: error.message };
        }
    },

    /**
     * Mark the plan as completed successfully.
     */
    complete_plan: async (args: { planId: string }, context?: AgentContext): Promise<ToolFunctionResult> => {
        const { currentProjectId } = useStore.getState();
        const projectId = context?.projectId || currentProjectId;

        if (!projectId) {
            return { success: false, error: 'No active project found.' };
        }

        try {
            await livingPlanService.complete(projectId, args.planId);
            return { success: true };
        } catch (error: any) {
            logger.error('[LivingPlanTools] Error completing plan:', error);
            return { success: false, error: error.message };
        }
    }
};
