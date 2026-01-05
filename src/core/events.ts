type EventCallback<T = unknown> = (data: T) => void;

export type EventType =
    | 'AGENT_ACTION'
    | 'DEPARTMENT_REQUEST'
    | 'SYSTEM_ALERT'
    | 'TASK_COMPLETED'
    | 'TASK_FAILED';

export interface AgentActionEvent {
    agentId: string;
    action: string;
    details: string;
}

export interface DepartmentRequestEvent {
    fromDept: string;
    toDept: string;
    request: string;
}

export interface SystemAlertEvent {
    level: 'info' | 'warning' | 'error';
    message: string;
}

class EventBus {
    private listeners: { [key in EventType]?: EventCallback[] } = {};

    on<T>(event: EventType, callback: EventCallback<T>): void {
        if (!this.listeners[event]) {
            this.listeners[event] = [];
        }
        this.listeners[event]?.push(callback as EventCallback<any>);
    }

    off<T>(event: EventType, callback: EventCallback<T>): void {
        if (!this.listeners[event]) return;
        this.listeners[event] = this.listeners[event]?.filter(cb => cb !== callback);
    }

    emit<T>(event: EventType, data: T): void {
        if (!this.listeners[event]) return;
        this.listeners[event]?.forEach(callback => callback(data));

        // Log all events for debugging (optional, can be removed in prod)
        // console.log(`[EventBus] ${event}:`, data);
    }
}

export const events = new EventBus();
