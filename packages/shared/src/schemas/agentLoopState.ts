import { z } from 'zod';

export const AgentLoopTriggerEnum = z.enum([
    'MANUAL',
    'SCHEDULE',
    'ACTION'
]);
export type AgentLoopTrigger = z.infer<typeof AgentLoopTriggerEnum>;

export const AgentLoopJudgeModeEnum = z.enum([
    'LLM_EVALUATION',
    'DETERMINISTIC_TEST'
]);
export type AgentLoopJudgeMode = z.infer<typeof AgentLoopJudgeModeEnum>;

export const AgentLoopStatusEnum = z.enum([
    'IDLE',
    'EXECUTING',
    'EVALUATING',
    'COMPLETED',
    'FAILED'
]);
export type AgentLoopStatus = z.infer<typeof AgentLoopStatusEnum>;

export const AgentLoopDefinitionSchema = z.object({
    id: z.string(),
    trigger: AgentLoopTriggerEnum,
    goal: z.string(),
    verifiabilityCriteria: z.string(),
    judgeMode: AgentLoopJudgeModeEnum.default('LLM_EVALUATION'),
    maxIterations: z.number().int().positive().default(3),
    createdAt: z.number(),
    updatedAt: z.number(),
});
export type AgentLoopDefinition = z.infer<typeof AgentLoopDefinitionSchema>;

export const AgentLoopDefinitionSnapshotSchema = AgentLoopDefinitionSchema.pick({
    id: true,
    trigger: true,
    goal: true,
    verifiabilityCriteria: true,
    judgeMode: true,
    maxIterations: true,
});
export type AgentLoopDefinitionSnapshot = z.infer<typeof AgentLoopDefinitionSnapshotSchema>;

export const AgentLoopIterationSchema = z.object({
    iteration: z.number().int().positive(),
    prompt: z.string(),
    output: z.string().optional(),
    feedback: z.string().optional(),
    passed: z.boolean().optional(),
    timestamp: z.number(),
});
export type AgentLoopIteration = z.infer<typeof AgentLoopIterationSchema>;

export const AgentLoopExecutionSchema = z.object({
    id: z.string(),
    loopId: z.string(),
    // Older checkpoints have no snapshot and cannot be resumed safely.
    definitionSnapshot: AgentLoopDefinitionSnapshotSchema.optional(),
    status: AgentLoopStatusEnum.default('IDLE'),
    currentIteration: z.number().int().nonnegative().default(0),
    history: z.array(AgentLoopIterationSchema).default([]),
    createdAt: z.number(),
    updatedAt: z.number(),
});
export type AgentLoopExecution = z.infer<typeof AgentLoopExecutionSchema>;
