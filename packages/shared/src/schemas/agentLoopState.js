"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AgentLoopExecutionSchema = exports.AgentLoopIterationSchema = exports.AgentLoopDefinitionSchema = exports.AgentLoopStatusEnum = exports.AgentLoopJudgeModeEnum = exports.AgentLoopTriggerEnum = void 0;
const zod_1 = require("zod");
exports.AgentLoopTriggerEnum = zod_1.z.enum([
    'MANUAL',
    'SCHEDULE',
    'ACTION'
]);
exports.AgentLoopJudgeModeEnum = zod_1.z.enum([
    'LLM_EVALUATION',
    'DETERMINISTIC_TEST'
]);
exports.AgentLoopStatusEnum = zod_1.z.enum([
    'IDLE',
    'EXECUTING',
    'EVALUATING',
    'COMPLETED',
    'FAILED'
]);
exports.AgentLoopDefinitionSchema = zod_1.z.object({
    id: zod_1.z.string(),
    trigger: exports.AgentLoopTriggerEnum,
    goal: zod_1.z.string(),
    verifiabilityCriteria: zod_1.z.string(),
    judgeMode: exports.AgentLoopJudgeModeEnum.default('LLM_EVALUATION'),
    maxIterations: zod_1.z.number().int().positive().default(3),
    createdAt: zod_1.z.number(),
    updatedAt: zod_1.z.number(),
});
exports.AgentLoopIterationSchema = zod_1.z.object({
    iteration: zod_1.z.number().int().positive(),
    prompt: zod_1.z.string(),
    output: zod_1.z.string().optional(),
    feedback: zod_1.z.string().optional(),
    passed: zod_1.z.boolean().optional(),
    timestamp: zod_1.z.number(),
});
exports.AgentLoopExecutionSchema = zod_1.z.object({
    id: zod_1.z.string(),
    loopId: zod_1.z.string(),
    status: exports.AgentLoopStatusEnum.default('IDLE'),
    currentIteration: zod_1.z.number().int().nonnegative().default(0),
    history: zod_1.z.array(exports.AgentLoopIterationSchema).default([]),
    createdAt: zod_1.z.number(),
    updatedAt: zod_1.z.number(),
});
//# sourceMappingURL=agentLoopState.js.map