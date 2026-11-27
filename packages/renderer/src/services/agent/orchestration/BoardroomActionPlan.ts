import type { AgentContext, AgentGraph, AgentResponse, ToolFunctionResult } from '@/services/agent/types';
import { DEPARTMENTS, getDepartmentOf, isHead } from '@/services/agent/departments';
import { isCapabilityQuestion } from '@/services/agent/capabilityTruth';

const SHORT_CONFIRMATION_PATTERN = /^(?:yes|yep|yeah|sure|ok|okay|go ahead|do it|proceed|approve|approved|continue|start|sounds good|looks good|let['’]s do it)[.!?, ]*$/i;
const PLACEHOLDER_MODEL_TEXT_PATTERN = /^(?:\*\((?:Reviewing|Understanding)[^)]*\)\*|Indii is coordinating \d+ participant)/i;

/** Returns true when `query` is a brief affirmative reply confirming an earlier proposal. */
export function isShortConfirmationUtterance(query: string): boolean {
    return SHORT_CONFIRMATION_PATTERN.test(query.trim());
}

/**
 * Extracts the immediately preceding substantive model proposal from
 * conversation history when the user sends a short confirmation ("go ahead",
 * "yes", "do it") so routers and action planners know what is being approved
 * even in multi-seat Boardroom turns (ISSUE-1670).
 */
export function extractConfirmedProposalContext(context: Pick<AgentContext, 'chatHistory' | 'chatHistoryString'>, userQuery: string): string | undefined {
    if (!isShortConfirmationUtterance(userQuery)) return undefined;

    if (Array.isArray(context.chatHistory) && context.chatHistory.length > 0) {
        const trimmedQuery = userQuery.trim();
        for (let i = context.chatHistory.length - 1; i >= 0; i--) {
            const msg = context.chatHistory[i];
            if (!msg) continue;
            const text = typeof msg.text === 'string' ? msg.text.trim() : '';
            if (!text) continue;
            if (i === context.chatHistory.length - 1 && msg.role === 'user' && text === trimmedQuery) continue;
            if (msg.role === 'model' && !PLACEHOLDER_MODEL_TEXT_PATTERN.test(text)) {
                return text.slice(0, 1500);
            }
        }
    }

    if (typeof context.chatHistoryString === 'string' && context.chatHistoryString.trim()) {
        const lines = context.chatHistoryString.trim().split('\n');
        for (let i = lines.length - 1; i >= 0; i--) {
            const line = lines[i]?.trim() ?? '';
            const match = line.match(/^(?:Assistant|\[[^\]]+\]):\s*(.+)$/);
            if (match?.[1] && !PLACEHOLDER_MODEL_TEXT_PATTERN.test(match[1].trim())) {
                return match[1].trim().slice(0, 1500);
            }
        }
    }

    return undefined;
}

/** Exact IDs win; the longest unique label avoids confusing a variant with its parent. */
export function boardroomRequestedSourceId(query: string, sources: ReadonlyArray<{ id: string; alias?: string; name?: string }>): string | undefined {
    const normalize = (value: string) => value.normalize('NFKC').toLowerCase();
    const text = normalize(query);
    const references = new Set(text.split(/[^a-z0-9_-]+/));
    const explicit = sources.filter(source => references.has(normalize(source.id)) ||
        Boolean(source.alias && references.has(normalize(source.alias))));
    if (explicit.length) {
        const ids = [...new Set(explicit.map(source => source.id))];
        return ids.length === 1 ? ids[0] : undefined;
    }
    const named = sources.filter(source => source.name && source.name.length >= 8 && text.includes(normalize(source.name)));
    const longest = Math.max(0, ...named.map(source => source.name!.length));
    const matches = named.filter(source => source.name!.length === longest);
    const ids = [...new Set(matches.map(source => source.id))];
    return ids.length === 1 ? ids[0] : undefined;
}

/** Polite execution requests must not become read-only capability reports. */
export function isBoardroomCapabilityOnly(query: string): boolean {
    return isCapabilityQuestion(query) &&
        !/^\s*(?:can|could)\s+(?:you|indii)\s+(?:generate|create|make|render)\b/i.test(query);
}

/** Role words people append to a department name when addressing it ("Creative Director"). */
const ADDRESS_ROLE_SUFFIX = /\s+(?:director|manager|agent|department|dept\.?|team|lead|head|specialist)$/;

/**
 * Department heads the user addresses by name at the start of a request
 * ("Creative and Video, let's …" → ['creative', 'video']). Only a leading
 * address list counts — comma/colon-separated segments made solely of
 * department names — so domain words in the body ("a marketing visual") never do.
 */
export function boardroomAddressedAgents(query: string): string[] {
    const byName = new Map<string, string>();
    for (const dept of Object.values(DEPARTMENTS)) {
        byName.set(dept.headId.toLowerCase(), dept.headId);
        byName.set(dept.displayName.toLowerCase(), dept.headId);
    }
    const resolve = (raw: string) => {
        const name = raw.trim().toLowerCase();
        return byName.get(name) ?? byName.get(name.replace(ADDRESS_ROLE_SUFFIX, ''));
    };
    // Segments before the request body: "Creative Director, Road & Finance: go."
    const segments = query.normalize('NFKC').slice(0, 240).split(/[,:]/);
    const addressed: string[] = [];
    for (const segment of segments.slice(0, -1)) {
        const names = segment.split(/\s*(?:&|\band\b)\s*/i).filter(name => name.trim());
        const agentIds = names.map(resolve);
        if (!names.length || agentIds.some(id => !id)) break;
        for (const agentId of agentIds as string[]) if (!addressed.includes(agentId)) addressed.push(agentId);
    }
    return addressed;
}

/**
 * When routing already handed the request to specialists, a specialist the user
 * addressed by name must not be silently left out: append a step for each one
 * (within the step budget). Conductor-routed plans are left alone — roster
 * changes ("Marketing, you're excused") belong to the Conductor.
 */
export function withAddressedBoardroomSteps(steps: BoardroomActionStep[], addressed: readonly string[], task: string, maxSteps = 6): BoardroomActionStep[] {
    if (!addressed.length || steps.some(step => step.agentId === 'generalist')) return steps;
    const merged = [...steps];
    const ids = new Set(merged.map(step => step.id));
    for (const agentId of addressed) {
        if (merged.length >= maxSteps) break;
        if (merged.some(step => step.agentId === agentId)) continue;
        let id = `addressed-${agentId}`;
        for (let n = 2; ids.has(id); n++) id = `addressed-${agentId}-${n}`;
        ids.add(id);
        merged.push({ id, agentId, task, dependencies: [] });
    }
    return merged;
}

export interface BoardroomActionStep {
    id: string;
    agentId: string;
    task: string;
    dependencies: string[];
    requiresApproval?: boolean;
}

export type BoardroomStepStatus = 'completed' | 'response' | 'pending' | 'partial' | 'failed' | 'uncertain' | 'skipped';
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

/**
 * Normalizes Boardroom steps by mapping worker agent IDs to their owning
 * department head (`getDepartmentOf`), falling back cleanly to a single-step
 * generalist plan instead of throwing when a step lacks a valid owner (ISSUE-1671).
 */
export function normalizeBoardroomSteps(
    steps: BoardroomActionStep[],
    fallbackTask: string,
): BoardroomActionStep[] {
    const safeTask = fallbackTask.trim() || 'Handle request';
    const mapped = steps.map(step => {
        if (step.agentId === 'generalist' || isHead(step.agentId)) return step;
        const deptHeadId = getDepartmentOf(step.agentId)?.headId;
        return {
            ...step,
            agentId: deptHeadId ?? 'generalist',
        };
    });
    try {
        validateBoardroomSteps(mapped);
        return mapped;
    } catch {
        return [{ id: 'step-0', agentId: 'generalist', task: safeTask, dependencies: [] }];
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

function canonicalToolArgs(value: unknown): unknown {
    if (Array.isArray(value)) return value.map(canonicalToolArgs);
    if (value && typeof value === 'object') return Object.fromEntries(
        Object.entries(value).sort(([a], [b]) => a.localeCompare(b)).map(([key, item]) => [key, canonicalToolArgs(item)]),
    );
    return value;
}

/** Reuse only a completed identical action in this execution, never a queued or partial receipt. */
export function completedBoardroomToolResult(name: string, args: unknown, calls: NonNullable<AgentResponse['toolCalls']>): ToolFunctionResult | null {
    const key = JSON.stringify(canonicalToolArgs(args));
    for (const call of [...calls].reverse()) {
        if (call.name !== name || JSON.stringify(canonicalToolArgs(call.args)) !== key) continue;
        const result = toolResult(call.result);
        if (!result?.success || /awaiting|pending|queued|running|processing|enqueued/i.test(String(result.status ?? result.data?.status ?? '')) ||
            result.data?.gallerySaved === false || result.data?.versionRecorded === false) continue;
        return result;
    }
    return null;
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
export function receiptForBoardroomStep(step: BoardroomActionStep, response: AgentResponse, outcomeUncertain = false): BoardroomStepReceipt {
    const results = (response.toolCalls ?? []).map(call => toolResult(call.result));
    const pending = results.some(result => {
        const status = String(result?.status ?? result?.data?.status ?? '').toLowerCase();
        return /awaiting|pending|queued|running|processing|enqueued/.test(status);
    }) || /AWAITING_.*APPROVAL/.test(response.error ?? '');
    const failed = Boolean(response.error) || results.some(result => !result || !result.success);
    const persistenceWarning = results.some(result => result?.data?.gallerySaved === false || result?.data?.versionRecorded === false);
    const status: BoardroomStepStatus = outcomeUncertain ? 'uncertain'
        : pending ? 'pending'
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
        pending: 'Waiting; work is not complete', partial: 'Partially completed', failed: 'Step failed',
        uncertain: 'Action outcome unknown; check its effect before retrying', skipped: 'Not executed',
    };
    const details = (receipt.response.toolCalls ?? []).map(call => {
        const result = toolResult(call.result);
        if (!result?.success) return founderDiagnostics ? `${call.name}: ${result?.error ?? 'No verifiable result'}` : 'An action could not be completed.';
        return result.message || `${call.name}: tool returned a result.`;
    });
    if (receipt.status === 'response') details.push(receipt.response.text);
    // ISSUE-1660: when every tool result is verified, the agent's own write-up
    // is the deliverable (a pitch, a summary). It used to be dropped, so the
    // artist saw only "Tool results received". Partial and pending steps still
    // leave prose out, so it cannot claim more than the tools verified.
    if (receipt.status === 'completed' && receipt.response.text.trim()) details.push(receipt.response.text.trim());
    if (receipt.status === 'pending' && /AWAITING_.*APPROVAL/.test(receipt.response.error ?? '')) {
        details.push('Review the pending request in the Approvals panel before further work.');
    }
    if (receipt.response.error && founderDiagnostics) details.push(receipt.response.error);
    return `${labels[receipt.status]}${details.length ? `\n${details.join('\n')}` : ''}`;
}
