import type { AgentExecutionFailure, AgentResponse, ToolFunctionResult } from './types';

/** A permission denial is terminal for this execution, independent of model wording. */
export function unauthorizedToolFailure(agentId: string, toolName: string): AgentExecutionFailure {
    return { code: 'TOOL_NOT_AUTHORIZED', retryable: false, agentId, toolName, recovery: 'choose_authorized_agent' };
}

/** Delegation completion does not mean the child action succeeded. Preserve its outcome. */
export function delegatedAgentResult(agentId: string, response: AgentResponse): ToolFunctionResult {
    if (response.error || response.failure) {
        return {
            success: false,
            data: response,
            error: response.error || response.text,
            message: response.text,
            failure: response.failure ?? { code: 'AGENT_EXECUTION_FAILED', retryable: false, agentId, recovery: 'review_failure' },
        };
    }
    return {
        success: true, data: response,
        message: `Delegated to ${agentId}. Result: ${response.text.substring(0, 500)}${response.text.length > 500 ? '...' : ''}`,
    };
}

/** String-only graph adapters must reject child failures rather than return error prose as output. */
export function delegatedAgentText(response: AgentResponse): string {
    if (response.error || response.failure) {
        const error = new Error(response.error || response.text);
        Object.assign(error, { code: response.failure?.code || 'AGENT_EXECUTION_FAILED', failure: response.failure });
        throw error;
    }
    return response.text;
}

/** Carry failure identity across transport without copying private tool args or large asset data. */
export function delegatedTransportResponse(agentId: string, response: AgentResponse) {
    return {
        text: response.text, agentId,
        ...(response.error ? { error: response.error } : {}),
        ...(response.failure ? { failure: response.failure } : {}),
    };
}
