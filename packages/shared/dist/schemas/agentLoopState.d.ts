import { z } from 'zod';
export declare const AgentLoopTriggerEnum: z.ZodEnum<["MANUAL", "SCHEDULE", "ACTION"]>;
export type AgentLoopTrigger = z.infer<typeof AgentLoopTriggerEnum>;
export declare const AgentLoopJudgeModeEnum: z.ZodEnum<["LLM_EVALUATION", "DETERMINISTIC_TEST"]>;
export type AgentLoopJudgeMode = z.infer<typeof AgentLoopJudgeModeEnum>;
export declare const AgentLoopStatusEnum: z.ZodEnum<["IDLE", "EXECUTING", "EVALUATING", "COMPLETED", "FAILED"]>;
export type AgentLoopStatus = z.infer<typeof AgentLoopStatusEnum>;
export declare const AgentLoopDefinitionSchema: z.ZodObject<{
    id: z.ZodString;
    trigger: z.ZodEnum<["MANUAL", "SCHEDULE", "ACTION"]>;
    goal: z.ZodString;
    verifiabilityCriteria: z.ZodString;
    judgeMode: z.ZodDefault<z.ZodEnum<["LLM_EVALUATION", "DETERMINISTIC_TEST"]>>;
    maxIterations: z.ZodDefault<z.ZodNumber>;
    createdAt: z.ZodNumber;
    updatedAt: z.ZodNumber;
}, "strip", z.ZodTypeAny, {
    id: string;
    createdAt: number;
    updatedAt: number;
    trigger: "MANUAL" | "SCHEDULE" | "ACTION";
    goal: string;
    verifiabilityCriteria: string;
    judgeMode: "LLM_EVALUATION" | "DETERMINISTIC_TEST";
    maxIterations: number;
}, {
    id: string;
    createdAt: number;
    updatedAt: number;
    trigger: "MANUAL" | "SCHEDULE" | "ACTION";
    goal: string;
    verifiabilityCriteria: string;
    judgeMode?: "LLM_EVALUATION" | "DETERMINISTIC_TEST" | undefined;
    maxIterations?: number | undefined;
}>;
export type AgentLoopDefinition = z.infer<typeof AgentLoopDefinitionSchema>;
export declare const AgentLoopIterationSchema: z.ZodObject<{
    iteration: z.ZodNumber;
    prompt: z.ZodString;
    output: z.ZodOptional<z.ZodString>;
    feedback: z.ZodOptional<z.ZodString>;
    passed: z.ZodOptional<z.ZodBoolean>;
    timestamp: z.ZodNumber;
}, "strip", z.ZodTypeAny, {
    timestamp: number;
    prompt: string;
    iteration: number;
    output?: string | undefined;
    feedback?: string | undefined;
    passed?: boolean | undefined;
}, {
    timestamp: number;
    prompt: string;
    iteration: number;
    output?: string | undefined;
    feedback?: string | undefined;
    passed?: boolean | undefined;
}>;
export type AgentLoopIteration = z.infer<typeof AgentLoopIterationSchema>;
export declare const AgentLoopExecutionSchema: z.ZodObject<{
    id: z.ZodString;
    loopId: z.ZodString;
    status: z.ZodDefault<z.ZodEnum<["IDLE", "EXECUTING", "EVALUATING", "COMPLETED", "FAILED"]>>;
    currentIteration: z.ZodDefault<z.ZodNumber>;
    history: z.ZodDefault<z.ZodArray<z.ZodObject<{
        iteration: z.ZodNumber;
        prompt: z.ZodString;
        output: z.ZodOptional<z.ZodString>;
        feedback: z.ZodOptional<z.ZodString>;
        passed: z.ZodOptional<z.ZodBoolean>;
        timestamp: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        timestamp: number;
        prompt: string;
        iteration: number;
        output?: string | undefined;
        feedback?: string | undefined;
        passed?: boolean | undefined;
    }, {
        timestamp: number;
        prompt: string;
        iteration: number;
        output?: string | undefined;
        feedback?: string | undefined;
        passed?: boolean | undefined;
    }>, "many">>;
    createdAt: z.ZodNumber;
    updatedAt: z.ZodNumber;
}, "strip", z.ZodTypeAny, {
    id: string;
    createdAt: number;
    updatedAt: number;
    status: "COMPLETED" | "FAILED" | "EXECUTING" | "IDLE" | "EVALUATING";
    loopId: string;
    currentIteration: number;
    history: {
        timestamp: number;
        prompt: string;
        iteration: number;
        output?: string | undefined;
        feedback?: string | undefined;
        passed?: boolean | undefined;
    }[];
}, {
    id: string;
    createdAt: number;
    updatedAt: number;
    loopId: string;
    status?: "COMPLETED" | "FAILED" | "EXECUTING" | "IDLE" | "EVALUATING" | undefined;
    currentIteration?: number | undefined;
    history?: {
        timestamp: number;
        prompt: string;
        iteration: number;
        output?: string | undefined;
        feedback?: string | undefined;
        passed?: boolean | undefined;
    }[] | undefined;
}>;
export type AgentLoopExecution = z.infer<typeof AgentLoopExecutionSchema>;
//# sourceMappingURL=agentLoopState.d.ts.map