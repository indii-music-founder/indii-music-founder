/**
 * EventBusService — Collects and dispatches events throughout the application
 *
 * Event types:
 * - user_action: User interactions (clicks, uploads, etc.)
 * - track_created: New track/project created
 * - track_updated: Track metadata updated
 * - distribution_started: Release distribution initiated
 * - ai_generation_started: AI task started
 * - ai_generation_completed: AI task completed
 * - error_occurred: Application error
 * - performance_metric: Performance data
 */

export interface Event {
  eventId: string;
  eventType: string;
  userId: string;
  sessionId: string;
  timestamp: number;
  data: Record<string, unknown>;
  context: {
    url: string;
    userAgent: string;
    locale: string;
  };
}

export type EventListener = (event: Event) => void | Promise<void>;

export class EventBusService {
  private listeners = new Map<string, EventListener[]>();
  private sessionId: string;
  private eventCounter = 0;

  constructor(private userId: string) {
    this.sessionId = this._generateSessionId();
  }

  private _generateSessionId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  private _generateEventId(): string {
    const timestamp = Date.now();
    const counter = ++this.eventCounter;
    return `${timestamp}-${counter}-${Math.random().toString(36).substr(2, 9)}`;
  }

  publish(eventType: string, data: Record<string, unknown>): Event {
    const event: Event = {
      eventId: this._generateEventId(),
      eventType,
      userId: this.userId,
      sessionId: this.sessionId,
      timestamp: Date.now(),
      data,
      context: {
        url: typeof window !== 'undefined' ? window.location.href : '',
        userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : '',
        locale: typeof navigator !== 'undefined' ? navigator.language : 'en-US',
      },
    };

    this._dispatch(event);
    return event;
  }

  subscribe(eventType: string, listener: EventListener): () => void {
    if (!this.listeners.has(eventType)) {
      this.listeners.set(eventType, []);
    }
    this.listeners.get(eventType)!.push(listener);

    return () => {
      const list = this.listeners.get(eventType);
      if (list) {
        const idx = list.indexOf(listener);
        if (idx > -1) list.splice(idx, 1);
      }
    };
  }

  subscribeToAll(listener: EventListener): () => void {
    return this.subscribe('*', listener);
  }

  private _dispatch(event: Event): void {
    const handlers = this.listeners.get(event.eventType) || [];
    const allHandlers = this.listeners.get('*') || [];
    const combined = [...handlers, ...allHandlers];

    combined.forEach(handler => {
      try {
        Promise.resolve(handler(event)).catch(err => {
          console.error(`[EventBus] Handler error for ${event.eventType}:`, err);
        });
      } catch (err) {
        console.error(`[EventBus] Error dispatching ${event.eventType}:`, err);
      }
    });
  }

  getSessionId(): string {
    return this.sessionId;
  }

  getStats(): { listenerCount: number; eventTypes: string[] } {
    return {
      listenerCount: Array.from(this.listeners.values()).reduce((sum, arr) => sum + arr.length, 0),
      eventTypes: Array.from(this.listeners.keys()),
    };
  }
}

let eventBusInstance: EventBusService | null = null;

export const initializeEventBus = (userId: string): EventBusService => {
  eventBusInstance = new EventBusService(userId);
  return eventBusInstance;
};

export const getEventBus = (): EventBusService => {
  if (!eventBusInstance) {
    throw new Error('EventBus not initialized. Call initializeEventBus(userId) first.');
  }
  return eventBusInstance;
};
