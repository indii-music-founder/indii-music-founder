/* eslint-disable @typescript-eslint/no-explicit-any -- Utility/config types use any by design */
import { logger } from '@/utils/logger';
type EventCallback<T = unknown> = (data: T) => unknown;

export type EventType =
    | 'AGENT_ACTION'
    | 'DEPARTMENT_REQUEST'
    | 'SYSTEM_ALERT'
    | 'TASK_COMPLETED'
    | 'TASK_FAILED'
    | 'ASSET_FINALIZED'
    | 'DISTRIBUTION_RELAY_READY';

export interface AgentActionEvent {
    agentId: string;
    action: string;
    details: string;
    timestamp?: number;
    durationMs?: number;
    toolName?: string;
    targetContext?: string;
    errorMessage?: string;
    sessionId?: string;
    graphId?: string;
    executionId?: string;
    nodeId?: string;
}

export interface DepartmentRequestEvent {
    fromDept: string;
    toDept: string;
    request: string;
}

export interface SystemAlertEvent {
    level: 'info' | 'warning' | 'error' | 'success';
    message: string;
}

class EventBus {
    private listeners: { [key in EventType]?: EventCallback[] } = {};

    on<T>(event: EventType, callback: EventCallback<T>): () => void {
        if (!this.listeners[event]) {
            this.listeners[event] = [];
        }
        this.listeners[event]?.push(callback as EventCallback<any>);
        return () => this.off(event, callback);
    }

    off<T>(event: EventType, callback: EventCallback<T>): void {
        if (!this.listeners[event]) return;
        this.listeners[event] = this.listeners[event]?.filter(cb => cb !== callback);
    }

    emit<T>(event: EventType, data: T): void {
        if (!this.listeners[event]) return;
        const reportListenerFailure = (error: unknown) => {
            // Do not log the payload, which can contain private agent data.
            const errorType = error instanceof Error ? error.name : typeof error;
            logger.warn(`[EventBus] ${event} listener failed (${errorType})`);
        };
        for (const callback of [...(this.listeners[event] || [])]) {
            try {
                const result = callback(data);
                if (result && typeof result === 'object' && 'then' in result &&
                    typeof result.then === 'function') {
                    void Promise.resolve(result).catch(reportListenerFailure);
                }
            } catch (error) {
                // Subscribers are diagnostics/UI observers; one broken listener
                // must not prevent another listener or the caller from running.
                reportListenerFailure(error);
            }
        }

        // Log all events for debugging (optional, can be removed in prod)
        // logger.debug(`[EventBus] ${event}:`, data);
    }
}

export const events = new EventBus();
