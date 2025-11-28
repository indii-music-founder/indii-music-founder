
type EventCallback = (data: any) => void;

class EventBus {
    private listeners: { [key: string]: EventCallback[] } = {};

    on(event: string, callback: EventCallback) {
        if (!this.listeners[event]) {
            this.listeners[event] = [];
        }
        this.listeners[event].push(callback);
    }

    off(event: string, callback: EventCallback) {
        if (!this.listeners[event]) return;
        this.listeners[event] = this.listeners[event].filter(cb => cb !== callback);
    }

    emit(event: string, data?: any) {
        if (!this.listeners[event]) return;
        this.listeners[event].forEach(cb => cb(data));
    }
}

export const events = new EventBus();

// Core System Events
export const APP_EVENTS = {
    DB_READY: 'sys:db_ready',
    DOM_READY: 'sys:dom_ready',
    APP_READY: 'sys:app_ready',
    PROJECT_LOADED: 'sys:project_loaded',
    MODE_CHANGED: 'ui:mode_changed',
    STATE_CHANGED: 'state:changed',
    TOAST: 'ui:toast'
};
