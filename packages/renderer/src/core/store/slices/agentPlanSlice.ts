import { StateCreator } from 'zustand';
import { logger } from '@/utils/logger';
import type { AgentPlanEvent, PlanStepStatus } from '@/types/AgentPlan';

/**
 * AgentPlanSlice — Structured Progress Updates
 *
 * Manages the active execution plan emitted by the Conductor during
 * multi-step agent operations. The UI subscribes to `activePlan` to
 * render a real-time step-by-step task list (TaskPlanWidget).
 */
export interface AgentPlanSlice {
    /** The currently executing plan, or null if no plan is active. */
    activePlan: AgentPlanEvent | null;
    /** History of completed plans for the current session. */
    planHistory: AgentPlanEvent[];

    /** Create or replace the active plan. */
    setPlan: (plan: AgentPlanEvent) => void;
    /** Update a single step's status within the active plan. */
    updatePlanStep: (planId: string, stepId: string, status: PlanStepStatus, error?: string) => void;
    /** Dismiss the active plan (moves it to history if completed). */
    clearPlan: () => void;
}

export const createAgentPlanSlice: StateCreator<AgentPlanSlice> = (set, get) => ({
    activePlan: null,
    planHistory: [],

    setPlan: (plan) => {
        logger.info(`[AgentPlanSlice] New plan: "${plan.title}" with ${plan.steps.length} steps`);
        set({ activePlan: plan });
    },

    updatePlanStep: (planId, stepId, status, error) => {
        const { activePlan } = get();
        if (!activePlan || activePlan.planId !== planId) {
            logger.warn(`[AgentPlanSlice] Cannot update step — plan "${planId}" is not active`);
            return;
        }

        const now = Date.now();
        const updatedSteps = activePlan.steps.map((step) => {
            if (step.id !== stepId) return step;
            return {
                ...step,
                status,
                ...(status === 'running' && !step.startedAt ? { startedAt: now } : {}),
                ...(status === 'done' || status === 'failed' ? { completedAt: now } : {}),
                ...(error ? { error } : {}),
            };
        });

        const updatedPlan: AgentPlanEvent = {
            ...activePlan,
            steps: updatedSteps,
            updatedAt: now,
        };

        // Check if all steps are terminal (done/failed/skipped)
        const allTerminal = updatedSteps.every(
            (s) => s.status === 'done' || s.status === 'failed' || s.status === 'skipped'
        );

        if (allTerminal) {
            logger.info(`[AgentPlanSlice] Plan "${activePlan.title}" completed — all steps terminal`);
            set((state) => ({
                activePlan: updatedPlan,
                planHistory: [...state.planHistory, updatedPlan],
            }));
        } else {
            set({ activePlan: updatedPlan });
        }
    },

    clearPlan: () => {
        const { activePlan, planHistory } = get();
        if (activePlan) {
            logger.info(`[AgentPlanSlice] Clearing plan: "${activePlan.title}"`);
            // Move to history if not already there
            const alreadyInHistory = planHistory.some((p) => p.planId === activePlan.planId);
            set({
                activePlan: null,
                ...(alreadyInHistory ? {} : { planHistory: [...planHistory, activePlan] }),
            });
        } else {
            set({ activePlan: null });
        }
    },
});
