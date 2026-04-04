import { events } from '@/core/events';

/**
 * Valid Agentic Event Types
 */
export type AgentEventType =
    | 'AGENT_SESSION_STARTED'
    | 'AGENT_SESSION_COMPLETED'
    | 'AGENT_SESSION_FAILED'
    | 'TOOL_EXECUTION_START'
    | 'TOOL_EXECUTION_COMPLETE'
    | 'TOOL_EXECUTION_FAILED'
    | 'BUDGET_THRESHOLD_WARNING'
    | 'CONTEXT_COMPACTION_TRIGGERED';

/**
 * Payload Interfaces
 */
export interface ToolExecutionEvent {
    agentId: string;
    toolName: string;
    targetContext?: string;
    timestamp: number;
    durationMs?: number;
    errorMessage?: string;
}

export interface AgentSessionEvent {
    agentId: string;
    sessionId: string;
    reason?: string;
    durationMs?: number;
}

/**
 * AgentEventBus — Structured Observability
 * Implements Agentic Harness Primitive #6: Structured Streaming Events
 * 
 * Provides a typed interface over the global event bus specifically
 * for tracking agentic lifecycle events, tool usage, and state changes.
 * Essential for upstream visualization (e.g., Langfuse/LangWatch).
 */
export class AgentEventBus {
    /**
     * Announces a tool execution lifecycle event
     */
    static emitToolEvent(
        type: 'TOOL_EXECUTION_START' | 'TOOL_EXECUTION_COMPLETE' | 'TOOL_EXECUTION_FAILED',
        payload: ToolExecutionEvent
    ): void {
        events.emit('AGENT_ACTION', {
            agentId: payload.agentId,
            action: type,
            details: `Tool: ${payload.toolName}${payload.durationMs ? ` (${payload.durationMs}ms)` : ''}`
        });

        // This acts as a shim for existing systems to consume, while
        // maintaining the rich payload for future observability platforms.
        // In a full LangWatch integration, this is where the trace would be appended.
    }

    /**
     * Announces an agent session lifecycle event
     */
    static emitSessionEvent(
        type: 'AGENT_SESSION_STARTED' | 'AGENT_SESSION_COMPLETED' | 'AGENT_SESSION_FAILED',
        payload: AgentSessionEvent
    ): void {
        events.emit('AGENT_ACTION', {
            agentId: payload.agentId,
            action: type,
            details: `Session: ${payload.sessionId} ${payload.reason ? ` - ${payload.reason}` : ''}`
        });
    }

    /**
     * System-level agentic events
     */
    static emitSystemEvent(
        type: 'BUDGET_THRESHOLD_WARNING' | 'CONTEXT_COMPACTION_TRIGGERED',
        details: string
    ): void {
        events.emit('SYSTEM_ALERT', {
            level: type === 'BUDGET_THRESHOLD_WARNING' ? 'warning' : 'info',
            message: `[Agent System] ${type}: ${details}`
        });
    }
}
