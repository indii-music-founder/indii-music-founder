import { z } from 'zod';
/**
 * Enum for Workflow Execution State
 * Drives the overarching state of a long-running workflow.
 */
export const WorkflowExecutionStatusEnum = z.enum([
    'PLANNED', // Initial state, workflow is queued but hasn't started
    'EXECUTING', // Workflow is actively running steps
    'AWAITING_HUMAN', // Workflow is paused, waiting for human input/approval
    'AWAITING_EVALUATION', // Workflow is paused, waiting for an Evaluator agent
    'COMPLETED', // Workflow finished successfully
    'FAILED', // Workflow encountered a terminal error
    'CANCELLED', // Workflow was manually aborted
]);
const EXECUTION_STATUS_ALIASES = {
    PLANNED: 'PLANNED',
    EXECUTING: 'EXECUTING',
    AWAITING_HUMAN: 'AWAITING_HUMAN',
    AWAITING_APPROVAL: 'AWAITING_HUMAN',
    AWAITING_EVALUATION: 'AWAITING_EVALUATION',
    COMPLETED: 'COMPLETED',
    STEP_COMPLETE: 'COMPLETED',
    SKIPPED: 'COMPLETED',
    FAILED: 'FAILED',
    CANCELLED: 'CANCELLED',
};
export function normalizeWorkflowExecutionStatus(value) {
    if (typeof value !== 'string')
        return value;
    return EXECUTION_STATUS_ALIASES[value.trim().toUpperCase()];
}
/**
 * Enum for Individual Step Execution State
 */
export const WorkflowStepStatusEnum = z.enum([
    'PLANNED', // Step is queued
    'EXECUTING_GENERATION', // Step is being processed by the Generator agent
    'AWAITING_HUMAN', // Step is paused, waiting for human input/approval
    'AWAITING_EVALUATION', // Step output is being evaluated
    'STEP_COMPLETE', // Step finished successfully
    'SKIPPED', // Step was skipped due to conditions
    'FAILED', // Step encountered an error
    'CANCELLED', // Step was aborted
]);
const STEP_STATUS_ALIASES = {
    PLANNED: 'PLANNED',
    EXECUTING: 'EXECUTING_GENERATION',
    EXECUTING_GENERATION: 'EXECUTING_GENERATION',
    AWAITING_HUMAN: 'AWAITING_HUMAN',
    AWAITING_APPROVAL: 'AWAITING_HUMAN',
    AWAITING_EVALUATION: 'AWAITING_EVALUATION',
    STEP_COMPLETE: 'STEP_COMPLETE',
    COMPLETED: 'STEP_COMPLETE',
    SKIPPED: 'SKIPPED',
    FAILED: 'FAILED',
    CANCELLED: 'CANCELLED',
};
export function normalizeWorkflowStepStatus(value) {
    if (typeof value !== 'string')
        return value;
    return STEP_STATUS_ALIASES[value.trim().toUpperCase()];
}
export function normalizeTimestamp(value) {
    if (value && typeof value === 'object') {
        const obj = value;
        if ('toMillis' in obj && typeof obj.toMillis === 'function') {
            return obj.toMillis();
        }
        if (value instanceof Date) {
            return value.getTime();
        }
        if ('seconds' in obj && typeof obj.seconds === 'number') {
            return obj.seconds * 1000;
        }
    }
    return value;
}
export const WorkflowStepExecutionSchema = z.object({
    stepId: z.string(),
    agentId: z.string(),
    prompt: z.string().optional(),
    status: z.preprocess(normalizeWorkflowStepStatus, WorkflowStepStatusEnum),
    idempotencyKey: z.string(),
    startedAt: z.preprocess(normalizeTimestamp, z.number().optional()).optional(),
    completedAt: z.preprocess(normalizeTimestamp, z.number().optional()).optional(),
    result: z.string().optional(),
    error: z.string().optional()
});
export const WorkflowEdgeSchema = z.object({
    from: z.string(),
    to: z.string(),
    label: z.string().optional(),
    metadata: z.record(z.string(), z.unknown()).optional()
});
export const WorkflowExecutionSchema = z.object({
    id: z.string(),
    workflowId: z.string(),
    sessionId: z.string().optional(),
    userId: z.string(),
    status: z.preprocess(normalizeWorkflowExecutionStatus, WorkflowExecutionStatusEnum),
    steps: z.record(z.string(), WorkflowStepExecutionSchema),
    edges: z.array(WorkflowEdgeSchema).default([]),
    createdAt: z.preprocess(normalizeTimestamp, z.number()),
    updatedAt: z.preprocess(normalizeTimestamp, z.number()),
    error: z.string().optional()
});
