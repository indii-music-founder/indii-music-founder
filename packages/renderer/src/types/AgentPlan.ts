/**
 * AgentPlan Types — Structured Progress Updates
 *
 * Defines the event model for multi-step agent task plans, enabling
 * real-time step-by-step progress visibility in the UI during long-running
 * Conductor orchestrations.
 *
 * Inspired by OpenClaw v2026.4.5 "structured plan updates and structured
 * execution item events."
 */

/** Status of a single step within an agent plan. */
export type PlanStepStatus = 'pending' | 'running' | 'done' | 'failed' | 'skipped';

/** A single step in a multi-step agent execution plan. */
export interface PlanStep {
    /** Unique identifier for this step. */
    id: string;
    /** Human-readable label, e.g. "Distributing to Spotify via DistroKid". */
    label: string;
    /** Current execution status. */
    status: PlanStepStatus;
    /** Optional specialist agent handling this step. */
    agentId?: string;
    /** Timestamp when the step started executing. */
    startedAt?: number;
    /** Timestamp when the step completed (success or failure). */
    completedAt?: number;
    /** Error message if status === 'failed'. */
    error?: string;
    /** Optional progress percentage (0-100) for long-running steps. */
    progress?: number;
}

/** A complete agent execution plan emitted by the Conductor. */
export interface AgentPlanEvent {
    /** Unique identifier for this plan. */
    planId: string;
    /** Human-readable title, e.g. "Distributing Your New Release". */
    title: string;
    /** Ordered list of steps to execute. */
    steps: PlanStep[];
    /** Timestamp when the plan was created. */
    createdAt: number;
    /** Timestamp of the last step update. */
    updatedAt: number;
}
