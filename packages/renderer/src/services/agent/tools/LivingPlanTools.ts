import { logger } from '@/utils/logger';
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { livingPlanService, PlanDraft, LivingPlan } from '../LivingPlanService';
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { useStore } from '@/core/store';
import { AgentContext, ToolFunctionResult } from '../types';
// eslint-disable-next-line @typescript-eslint/no-unused-vars
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
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    propose_plan: async (args: PlanDraft, context?: AgentContext, toolContext?: any): Promise<ToolFunctionResult> => {
        const { useStore } = await import('@/core/store');
        const state = useStore.getState();
        const projectId = toolContext?.get('currentProjectId') || context?.projectId || state.currentProjectId;
        const userId = context?.userId || state.user?.uid;

        if (!projectId) {
            return { success: true, error: 'No active project found. Cannot propose a plan.' };
        }
        if (!userId) {
            return { success: true, error: 'User not authenticated. Cannot propose a plan.' };
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
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        } catch (error: any) {
            logger.error('[LivingPlanTools] Error proposing plan:', error);
            return { success: false, error: error.message };
        }
    },

    /**
     * Refine an existing plan draft before it is approved.
     */
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    refine_plan: async (args: { planId: string; updates: Partial<PlanDraft> }, context?: AgentContext, toolContext?: any): Promise<ToolFunctionResult> => {
        const { useStore } = await import('@/core/store');
        const state = useStore.getState();
        const projectId = toolContext?.get('currentProjectId') || context?.projectId || state.currentProjectId;

        if (!projectId) {
            return { success: true, error: 'No active project found.' };
        }

        try {
            const plan = await livingPlanService.get(projectId, args.planId);
            if (!plan) {
                return { success: false, error: 'Plan not found.' };
            }

            const newDraft = { ...plan.draft, ...args.updates };
            await livingPlanService.updateDraft(projectId, args.planId, newDraft);
            return { success: true };
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        } catch (error: any) {
            logger.error('[LivingPlanTools] Error refining plan:', error);
            return { success: false, error: error.message };
        }
    },

    /**
     * Get the details of a specific plan.
     */
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    get_plan: async (args: { planId: string }, context?: AgentContext, toolContext?: any): Promise<ToolFunctionResult> => {
        const { useStore } = await import('@/core/store');
        const state = useStore.getState();
        const projectId = toolContext?.get('currentProjectId') || context?.projectId || state.currentProjectId;

        if (!projectId) {
            return { success: true, error: 'No active project found.' };
        }

        try {
            const plan = await livingPlanService.get(projectId, args.planId);
            if (!plan) {
                return { success: false, error: 'Plan not found.' };
            }
            return { success: true, data: plan };
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        } catch (error: any) {
            logger.error('[LivingPlanTools] Error getting plan:', error);
            return { success: false, error: error.message };
        }
    },

    /**
     * Cancel a plan in progress.
     */
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    cancel_plan: async (args: { planId: string }, context?: AgentContext, toolContext?: any): Promise<ToolFunctionResult> => {
        const { useStore } = await import('@/core/store');
        const state = useStore.getState();
        const projectId = toolContext?.get('currentProjectId') || context?.projectId || state.currentProjectId;

        if (!projectId) {
            return { success: true, error: 'No active project found.' };
        }

        try {
            await livingPlanService.cancel(projectId, args.planId);
            return { success: true };
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        } catch (error: any) {
            logger.error('[LivingPlanTools] Error cancelling plan:', error);
            return { success: false, error: error.message };
        }
    },

    /**
     * Mark a plan step as complete.
     */
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    complete_step: async (args: { planId: string; stepId: string; result?: any }, context?: AgentContext, toolContext?: any): Promise<ToolFunctionResult> => {
        const { useStore } = await import('@/core/store');
        const state = useStore.getState();
        const projectId = toolContext?.get('currentProjectId') || context?.projectId || state.currentProjectId;

        if (!projectId) {
            return { success: true, error: 'No active project found.' };
        }

        try {
            await livingPlanService.updateStepStatus(projectId, args.planId, args.stepId, 'complete', undefined, args.result);
            return { success: true };
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        } catch (error: any) {
            logger.error('[LivingPlanTools] Error completing step:', error);
            return { success: false, error: error.message };
        }
    },

    /**
     * Mark the plan as completed successfully.
     */
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    complete_plan: async (args: { planId: string }, context?: AgentContext, toolContext?: any): Promise<ToolFunctionResult> => {
        const { useStore } = await import('@/core/store');
        const state = useStore.getState();
        const projectId = toolContext?.get('currentProjectId') || context?.projectId || state.currentProjectId;

        if (!projectId) {
            return { success: true, error: 'No active project found.' };
        }

        try {
            await livingPlanService.complete(projectId, args.planId);
            return { success: true };
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        } catch (error: any) {
            logger.error('[LivingPlanTools] Error completing plan:', error);
            return { success: false, error: error.message };
        }
    }
};
