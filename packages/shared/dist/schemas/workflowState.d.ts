import { z } from 'zod';
/**
 * Enum for Workflow Execution State
 * Drives the overarching state of a long-running workflow.
 */
export declare const WorkflowExecutionStatusEnum: z.ZodEnum<["PLANNED", "EXECUTING", "AWAITING_HUMAN", "AWAITING_EVALUATION", "COMPLETED", "FAILED", "CANCELLED"]>;
export type WorkflowExecutionStatus = z.infer<typeof WorkflowExecutionStatusEnum>;
export declare function normalizeWorkflowExecutionStatus(value: unknown): unknown;
/**
 * Enum for Individual Step Execution State
 */
export declare const WorkflowStepStatusEnum: z.ZodEnum<["PLANNED", "EXECUTING_GENERATION", "AWAITING_HUMAN", "AWAITING_EVALUATION", "STEP_COMPLETE", "SKIPPED", "FAILED", "CANCELLED"]>;
export type WorkflowStepStatus = z.infer<typeof WorkflowStepStatusEnum>;
export declare function normalizeWorkflowStepStatus(value: unknown): unknown;
export declare function normalizeTimestamp(value: unknown): unknown;
export declare const WorkflowStepExecutionSchema: z.ZodObject<{
    stepId: z.ZodString;
    agentId: z.ZodString;
    prompt: z.ZodOptional<z.ZodString>;
    status: z.ZodEffects<z.ZodEnum<["PLANNED", "EXECUTING_GENERATION", "AWAITING_HUMAN", "AWAITING_EVALUATION", "STEP_COMPLETE", "SKIPPED", "FAILED", "CANCELLED"]>, "PLANNED" | "AWAITING_HUMAN" | "AWAITING_EVALUATION" | "FAILED" | "CANCELLED" | "STEP_COMPLETE" | "SKIPPED" | "EXECUTING_GENERATION", unknown>;
    idempotencyKey: z.ZodString;
    startedAt: z.ZodOptional<z.ZodEffects<z.ZodOptional<z.ZodNumber>, number | undefined, unknown>>;
    completedAt: z.ZodOptional<z.ZodEffects<z.ZodOptional<z.ZodNumber>, number | undefined, unknown>>;
    result: z.ZodOptional<z.ZodString>;
    error: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    status: "PLANNED" | "AWAITING_HUMAN" | "AWAITING_EVALUATION" | "FAILED" | "CANCELLED" | "STEP_COMPLETE" | "SKIPPED" | "EXECUTING_GENERATION";
    stepId: string;
    agentId: string;
    idempotencyKey: string;
    error?: string | undefined;
    prompt?: string | undefined;
    startedAt?: number | undefined;
    completedAt?: number | undefined;
    result?: string | undefined;
}, {
    stepId: string;
    agentId: string;
    idempotencyKey: string;
    status?: unknown;
    error?: string | undefined;
    prompt?: string | undefined;
    startedAt?: unknown;
    completedAt?: unknown;
    result?: string | undefined;
}>;
export type WorkflowStepExecution = z.infer<typeof WorkflowStepExecutionSchema>;
export declare const WorkflowEdgeSchema: z.ZodObject<{
    from: z.ZodString;
    to: z.ZodString;
    label: z.ZodOptional<z.ZodString>;
    metadata: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
}, "strip", z.ZodTypeAny, {
    from: string;
    to: string;
    label?: string | undefined;
    metadata?: Record<string, unknown> | undefined;
}, {
    from: string;
    to: string;
    label?: string | undefined;
    metadata?: Record<string, unknown> | undefined;
}>;
export interface WorkflowEdge {
    from: string;
    to: string;
    condition?: (execution: WorkflowExecution) => boolean;
    label?: string;
    metadata?: Record<string, unknown>;
}
export interface WorkflowStep {
    id: string;
    agentId: string;
    prompt: string;
    priority: 'URGENT' | 'HIGH' | 'MEDIUM' | 'LOW';
    timeoutMs?: number;
    retryCount?: number;
}
export declare const WorkflowExecutionSchema: z.ZodObject<{
    id: z.ZodString;
    workflowId: z.ZodString;
    sessionId: z.ZodOptional<z.ZodString>;
    userId: z.ZodString;
    status: z.ZodEffects<z.ZodEnum<["PLANNED", "EXECUTING", "AWAITING_HUMAN", "AWAITING_EVALUATION", "COMPLETED", "FAILED", "CANCELLED"]>, "PLANNED" | "EXECUTING" | "AWAITING_HUMAN" | "AWAITING_EVALUATION" | "COMPLETED" | "FAILED" | "CANCELLED", unknown>;
    steps: z.ZodRecord<z.ZodString, z.ZodObject<{
        stepId: z.ZodString;
        agentId: z.ZodString;
        prompt: z.ZodOptional<z.ZodString>;
        status: z.ZodEffects<z.ZodEnum<["PLANNED", "EXECUTING_GENERATION", "AWAITING_HUMAN", "AWAITING_EVALUATION", "STEP_COMPLETE", "SKIPPED", "FAILED", "CANCELLED"]>, "PLANNED" | "AWAITING_HUMAN" | "AWAITING_EVALUATION" | "FAILED" | "CANCELLED" | "STEP_COMPLETE" | "SKIPPED" | "EXECUTING_GENERATION", unknown>;
        idempotencyKey: z.ZodString;
        startedAt: z.ZodOptional<z.ZodEffects<z.ZodOptional<z.ZodNumber>, number | undefined, unknown>>;
        completedAt: z.ZodOptional<z.ZodEffects<z.ZodOptional<z.ZodNumber>, number | undefined, unknown>>;
        result: z.ZodOptional<z.ZodString>;
        error: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        status: "PLANNED" | "AWAITING_HUMAN" | "AWAITING_EVALUATION" | "FAILED" | "CANCELLED" | "STEP_COMPLETE" | "SKIPPED" | "EXECUTING_GENERATION";
        stepId: string;
        agentId: string;
        idempotencyKey: string;
        error?: string | undefined;
        prompt?: string | undefined;
        startedAt?: number | undefined;
        completedAt?: number | undefined;
        result?: string | undefined;
    }, {
        stepId: string;
        agentId: string;
        idempotencyKey: string;
        status?: unknown;
        error?: string | undefined;
        prompt?: string | undefined;
        startedAt?: unknown;
        completedAt?: unknown;
        result?: string | undefined;
    }>>;
    edges: z.ZodDefault<z.ZodArray<z.ZodObject<{
        from: z.ZodString;
        to: z.ZodString;
        label: z.ZodOptional<z.ZodString>;
        metadata: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
    }, "strip", z.ZodTypeAny, {
        from: string;
        to: string;
        label?: string | undefined;
        metadata?: Record<string, unknown> | undefined;
    }, {
        from: string;
        to: string;
        label?: string | undefined;
        metadata?: Record<string, unknown> | undefined;
    }>, "many">>;
    createdAt: z.ZodEffects<z.ZodNumber, number, unknown>;
    updatedAt: z.ZodEffects<z.ZodNumber, number, unknown>;
    error: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    id: string;
    createdAt: number;
    updatedAt: number;
    status: "PLANNED" | "EXECUTING" | "AWAITING_HUMAN" | "AWAITING_EVALUATION" | "COMPLETED" | "FAILED" | "CANCELLED";
    userId: string;
    workflowId: string;
    steps: Record<string, {
        status: "PLANNED" | "AWAITING_HUMAN" | "AWAITING_EVALUATION" | "FAILED" | "CANCELLED" | "STEP_COMPLETE" | "SKIPPED" | "EXECUTING_GENERATION";
        stepId: string;
        agentId: string;
        idempotencyKey: string;
        error?: string | undefined;
        prompt?: string | undefined;
        startedAt?: number | undefined;
        completedAt?: number | undefined;
        result?: string | undefined;
    }>;
    edges: {
        from: string;
        to: string;
        label?: string | undefined;
        metadata?: Record<string, unknown> | undefined;
    }[];
    error?: string | undefined;
    sessionId?: string | undefined;
}, {
    id: string;
    userId: string;
    workflowId: string;
    steps: Record<string, {
        stepId: string;
        agentId: string;
        idempotencyKey: string;
        status?: unknown;
        error?: string | undefined;
        prompt?: string | undefined;
        startedAt?: unknown;
        completedAt?: unknown;
        result?: string | undefined;
    }>;
    createdAt?: unknown;
    updatedAt?: unknown;
    status?: unknown;
    error?: string | undefined;
    sessionId?: string | undefined;
    edges?: {
        from: string;
        to: string;
        label?: string | undefined;
        metadata?: Record<string, unknown> | undefined;
    }[] | undefined;
}>;
export interface WorkflowExecution extends z.infer<typeof WorkflowExecutionSchema> {
    edges: WorkflowEdge[];
}
//# sourceMappingURL=workflowState.d.ts.map