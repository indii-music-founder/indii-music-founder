import { z } from 'zod';

/**
 * Enum for Workflow Execution State
 * Drives the overarching state of a long-running workflow.
 */
export const WorkflowExecutionStatusEnum = z.enum([
    'PLANNED',              // Initial state, workflow is queued but hasn't started
    'EXECUTING',            // Workflow is actively running steps
    'AWAITING_HUMAN',       // Workflow is paused, waiting for human input/approval
    'AWAITING_EVALUATION',  // Workflow is paused, waiting for an Evaluator agent
    'COMPLETED',            // Workflow finished successfully
    'FAILED',               // Workflow encountered a terminal error
    'CANCELLED',            // Workflow was manually aborted
    // Backwards compatibility with legacy records and legacy types
    'planned', 'executing', 'step_complete', 'awaiting_approval', 'completed', 'failed', 'cancelled', 'skipped'
]);

export type WorkflowExecutionStatus = z.infer<typeof WorkflowExecutionStatusEnum>;

/**
 * Enum for Individual Step Execution State
 */
export const WorkflowStepStatusEnum = z.enum([
    'PLANNED',              // Step is queued
    'EXECUTING_GENERATION', // Step is being processed by the Generator agent
    'AWAITING_EVALUATION',  // Step output is being evaluated
    'STEP_COMPLETE',        // Step finished successfully
    'SKIPPED',              // Step was skipped due to conditions
    'FAILED',               // Step encountered an error
    'CANCELLED',            // Step was aborted
    // Backwards compatibility with legacy records and legacy types
    'planned', 'executing', 'step_complete', 'awaiting_approval', 'completed', 'failed', 'cancelled', 'skipped'
]);

export type WorkflowStepStatus = z.infer<typeof WorkflowStepStatusEnum>;

export const WorkflowStepExecutionSchema = z.object({
    stepId: z.string(),
    agentId: z.string(),
    prompt: z.string().optional(),
    status: WorkflowStepStatusEnum,
    idempotencyKey: z.string(),
    startedAt: z.number().optional(),
    completedAt: z.number().optional(),
    result: z.string().optional(),
    error: z.string().optional()
});

export type WorkflowStepExecution = z.infer<typeof WorkflowStepExecutionSchema>;

export interface WorkflowEdge {
    from: string;
    to: string;
    // condition is excluded from strict serialization
    condition?: (execution: WorkflowExecution) => boolean; 
    label?: string; 
    metadata?: Record<string, any>; 
}

export interface WorkflowStep {
    id: string; 
    agentId: string;
    prompt: string;
    priority: 'URGENT' | 'HIGH' | 'MEDIUM' | 'LOW';
    timeoutMs?: number; 
    retryCount?: number; 
}

export const WorkflowExecutionSchema = z.object({
    id: z.string(),
    workflowId: z.string(),
    sessionId: z.string().optional(),
    userId: z.string(),
    status: WorkflowExecutionStatusEnum,
    steps: z.record(z.string(), WorkflowStepExecutionSchema),
    createdAt: z.number(),
    updatedAt: z.number(),
    error: z.string().optional()
});

export interface WorkflowExecution extends z.infer<typeof WorkflowExecutionSchema> {
    edges: WorkflowEdge[];
}
