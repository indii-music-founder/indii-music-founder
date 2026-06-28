import { z } from 'zod';
export const AgentLoopTriggerEnum = z.enum([
    'MANUAL',
    'SCHEDULE',
    'ACTION'
]);
export const AgentLoopJudgeModeEnum = z.enum([
    'LLM_EVALUATION',
    'DETERMINISTIC_TEST'
]);
export const AgentLoopStatusEnum = z.enum([
    'IDLE',
    'EXECUTING',
    'EVALUATING',
    'COMPLETED',
    'FAILED'
]);
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
export const AgentLoopIterationSchema = z.object({
    iteration: z.number().int().positive(),
    prompt: z.string(),
    output: z.string().optional(),
    feedback: z.string().optional(),
    passed: z.boolean().optional(),
    timestamp: z.number(),
});
export const AgentLoopExecutionSchema = z.object({
    id: z.string(),
    loopId: z.string(),
    status: AgentLoopStatusEnum.default('IDLE'),
    currentIteration: z.number().int().nonnegative().default(0),
    history: z.array(AgentLoopIterationSchema).default([]),
    createdAt: z.number(),
    updatedAt: z.number(),
});
