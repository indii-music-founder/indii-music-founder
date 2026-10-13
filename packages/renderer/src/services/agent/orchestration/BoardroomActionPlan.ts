import type { AgentGraph, AgentResponse, ToolFunctionResult } from '../types';
import { isHead } from '../departments';
import { isCapabilityQuestion } from '../capabilityTruth';

/** Polite execution requests must not become read-only capability reports. */
export function isBoardroomCapabilityOnly(query: string): boolean {
    return isCapabilityQuestion(query) &&
        !/^\s*(?:can|could)\s+(?:you|indii)\s+(?:generate|create|make|render)\b/i.test(query);
}

export interface BoardroomActionStep {
    id: string;
    agentId: string;
    task: string;
    dependencies: string[];
    requiresApproval?: boolean;
}

export type BoardroomStepStatus = 'completed' | 'response' | 'pending' | 'partial' | 'failed' | 'skipped';
export interface BoardroomStepReceipt {
    stepId: string;
    agentId: string;
    status: BoardroomStepStatus;
    response: AgentResponse;
}

export function validateBoardroomSteps(steps: BoardroomActionStep[]): void {
    if (!steps.length || steps.length > 6) throw new Error('A Boardroom action must have between one and six steps.');
    const ids = new Set(steps.map(step => step.id));
    if (ids.size !== steps.length) throw new Error('Boardroom step IDs must be unique.');
    for (const step of steps) {
        if ((!isHead(step.agentId) && step.agentId !== 'generalist') || !step.task.trim()) {
            throw new Error('Each Boardroom step needs a registered department owner and a task.');
        }
        if (step.dependencies.some(id => !ids.has(id) || id === step.id)) throw new Error('Invalid Boardroom dependency.');
    }
    const remaining = new Set(ids);
    while (remaining.size) {
        const ready = steps.filter(step => remaining.has(step.id) && step.dependencies.every(id => !remaining.has(id)));
        if (!ready.length) throw new Error('Boardroom action dependencies contain a cycle.');
        ready.forEach(step => remaining.delete(step.id));
    }
}

export function stepsFromBoardroomGraph(graph: AgentGraph): BoardroomActionStep[] {
    // Conditional/mapped graphs retain their own graph runner. Do not silently
    // reinterpret a condition as an unconditional action.
    if (graph.nodes.some(node => node.waitCondition !== 'all') || graph.edges.some(edge => edge.condition || Object.keys(edge.inputMapping ?? {}).length)) {
        throw new Error('This Boardroom request needs an explicit dependency plan without conditional branches.');
    }
    const steps = graph.nodes.map(node => ({
        id: node.id, agentId: node.agentId, task: node.taskTemplate,
        dependencies: graph.edges.filter(edge => edge.targetId === node.id).map(edge => edge.sourceId),
        requiresApproval: node.requiresApproval,
    }));
    validateBoardroomSteps(steps);
    return steps;
}

function toolResult(value: ToolFunctionResult | string): ToolFunctionResult | null {
    if (typeof value !== 'string') return value;
    try { const parsed = JSON.parse(value); return typeof parsed?.success === 'boolean' ? parsed : null; }
    catch { return null; }
}

/** Tool data remains addressable after the specialist's prose is summarized. */
export function boardroomDependencyField(response: AgentResponse, path?: string): unknown {
    const lastResult = [...(response.toolCalls ?? [])].reverse().map(call => toolResult(call.result))
        .find(result => result?.success && result.data !== undefined);
    let value: unknown = { ...response, data: lastResult?.data ?? response.data };
    for (const key of (path ?? '').split('.').filter(Boolean)) {
        if (['__proto__', 'prototype', 'constructor'].includes(key)) return undefined;
        value = value && typeof value === 'object' ? (value as Record<string, unknown>)[key] : undefined;
    }
    return value;
}

/** Classify real receipts, never a model's claim that it finished something. */
export function receiptForBoardroomStep(step: BoardroomActionStep, response: AgentResponse): BoardroomStepReceipt {
    const results = (response.toolCalls ?? []).map(call => toolResult(call.result));
    const pending = results.some(result => {
        const status = String(result?.status ?? result?.data?.status ?? '').toLowerCase();
        return /awaiting|pending|queued|running|processing|enqueued/.test(status);
    }) || /AWAITING_.*APPROVAL/.test(response.error ?? '');
    const failed = Boolean(response.error) || results.some(result => !result || !result.success);
    const persistenceWarning = results.some(result => result?.data?.gallerySaved === false || result?.data?.versionRecorded === false);
    const status: BoardroomStepStatus = pending ? 'pending'
        : failed ? results.some(result => result?.success) ? 'partial' : 'failed'
        : persistenceWarning ? 'partial'
        : results.length ? 'completed' : 'response';
    return { stepId: step.id, agentId: step.agentId, status, response };
}

export function readyBoardroomSteps(steps: BoardroomActionStep[], receipts: BoardroomStepReceipt[]): BoardroomActionStep[] {
    const byId = new Map(receipts.map(receipt => [receipt.stepId, receipt]));
    return steps.filter(step => !byId.has(step.id) && step.dependencies.every(id => {
        const status = byId.get(id)?.status;
        return status === 'completed' || status === 'response';
    }));
}

/** Human-readable summary is built from tool evidence, without another model run. */
export function formatBoardroomReceipt(receipt: BoardroomStepReceipt, founderDiagnostics = false): string {
    const labels: Record<BoardroomStepStatus, string> = {
        completed: 'Tool results received', response: 'Response prepared; no external action verified',
        pending: 'Waiting; work is not complete', partial: 'Partially completed', failed: 'Step failed', skipped: 'Not executed',
    };
    const details = (receipt.response.toolCalls ?? []).map(call => {
        const result = toolResult(call.result);
        if (!result?.success) return founderDiagnostics ? `${call.name}: ${result?.error ?? 'No verifiable result'}` : 'An action could not be completed.';
        return result.message || `${call.name}: tool returned a result.`;
    });
    if (receipt.status === 'response') details.push(receipt.response.text);
    if (receipt.status === 'pending' && /AWAITING_.*APPROVAL/.test(receipt.response.error ?? '')) {
        details.push('Review the request in the Approvals panel. The action has not run.');
    }
    if (receipt.response.error && founderDiagnostics) details.push(receipt.response.error);
    return `${labels[receipt.status]}${details.length ? `\n${details.join('\n')}` : ''}`;
}
