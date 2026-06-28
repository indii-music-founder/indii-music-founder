"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.WorkflowExecutionSchema = exports.WorkflowEdgeSchema = exports.WorkflowStepExecutionSchema = exports.WorkflowStepStatusEnum = exports.WorkflowExecutionStatusEnum = void 0;
exports.normalizeWorkflowExecutionStatus = normalizeWorkflowExecutionStatus;
exports.normalizeWorkflowStepStatus = normalizeWorkflowStepStatus;
exports.normalizeTimestamp = normalizeTimestamp;
const zod_1 = require("zod");
/**
 * Enum for Workflow Execution State
 * Drives the overarching state of a long-running workflow.
 */
exports.WorkflowExecutionStatusEnum = zod_1.z.enum([
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
function normalizeWorkflowExecutionStatus(value) {
    if (typeof value !== 'string')
        return value;
    return EXECUTION_STATUS_ALIASES[value.trim().toUpperCase()];
}
/**
 * Enum for Individual Step Execution State
 */
exports.WorkflowStepStatusEnum = zod_1.z.enum([
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
function normalizeWorkflowStepStatus(value) {
    if (typeof value !== 'string')
        return value;
    return STEP_STATUS_ALIASES[value.trim().toUpperCase()];
}
function normalizeTimestamp(value) {
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
exports.WorkflowStepExecutionSchema = zod_1.z.object({
    stepId: zod_1.z.string(),
    agentId: zod_1.z.string(),
    prompt: zod_1.z.string().optional(),
    status: zod_1.z.preprocess(normalizeWorkflowStepStatus, exports.WorkflowStepStatusEnum),
    idempotencyKey: zod_1.z.string(),
    startedAt: zod_1.z.preprocess(normalizeTimestamp, zod_1.z.number().optional()).optional(),
    completedAt: zod_1.z.preprocess(normalizeTimestamp, zod_1.z.number().optional()).optional(),
    result: zod_1.z.string().optional(),
    error: zod_1.z.string().optional()
});
exports.WorkflowEdgeSchema = zod_1.z.object({
    from: zod_1.z.string(),
    to: zod_1.z.string(),
    label: zod_1.z.string().optional(),
    metadata: zod_1.z.record(zod_1.z.string(), zod_1.z.unknown()).optional()
});
exports.WorkflowExecutionSchema = zod_1.z.object({
    id: zod_1.z.string(),
    workflowId: zod_1.z.string(),
    sessionId: zod_1.z.string().optional(),
    userId: zod_1.z.string(),
    status: zod_1.z.preprocess(normalizeWorkflowExecutionStatus, exports.WorkflowExecutionStatusEnum),
    steps: zod_1.z.record(zod_1.z.string(), exports.WorkflowStepExecutionSchema),
    edges: zod_1.z.array(exports.WorkflowEdgeSchema).default([]),
    createdAt: zod_1.z.preprocess(normalizeTimestamp, zod_1.z.number()),
    updatedAt: zod_1.z.preprocess(normalizeTimestamp, zod_1.z.number()),
    error: zod_1.z.string().optional()
});
//# sourceMappingURL=workflowState.js.map