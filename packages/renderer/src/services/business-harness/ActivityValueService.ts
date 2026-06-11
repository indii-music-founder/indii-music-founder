import type { BusinessActivityEvent, HarnessCostLine } from './types';

export interface ActivitySessionDraft {
  userId: string;
  sessionId?: string;
  eventType: BusinessActivityEvent['eventType'];
  module?: string;
  projectId?: string;
  releaseId?: string;
  tourId?: string;
  category?: BusinessActivityEvent['category'];
  hourlyRate?: number;
  source?: BusinessActivityEvent['source'];
  notes?: string;
  startedAt?: string;
}

const DEFAULT_HOURLY_RATE = 35;

export class ActivityValueService {
  private activeSessions = new Map<string, BusinessActivityEvent>();

  startSession(input: ActivitySessionDraft): BusinessActivityEvent {
    const startedAt = input.startedAt ?? new Date().toISOString();
    const event: BusinessActivityEvent = {
      id: `activity_${Date.now()}_${crypto.randomUUID().split('-')[0]}`,
      userId: input.userId,
      sessionId: input.sessionId ?? `session_${Date.now()}`,
      eventType: input.eventType,
      module: input.module,
      projectId: input.projectId,
      releaseId: input.releaseId,
      tourId: input.tourId,
      category: input.category ?? inferCategory(input.eventType, input.module),
      startedAt,
      durationMinutes: 0,
      activeMinutes: 0,
      idleMinutes: 0,
      hourlyRate: input.hourlyRate ?? DEFAULT_HOURLY_RATE,
      notes: input.notes,
      source: input.source ?? 'automatic',
    };
    this.activeSessions.set(event.id, event);
    return event;
  }

  finishSession(eventId: string, endedAt = new Date().toISOString(), idleMinutes = 0): BusinessActivityEvent | null {
    const event = this.activeSessions.get(eventId);
    if (!event) return null;
    this.activeSessions.delete(eventId);
    const durationMinutes = Math.max(0, Math.round((new Date(endedAt).getTime() - new Date(event.startedAt).getTime()) / 60000));
    return {
      ...event,
      endedAt,
      durationMinutes,
      idleMinutes: Math.min(idleMinutes, durationMinutes),
      activeMinutes: Math.max(0, durationMinutes - idleMinutes),
    };
  }

  buildTimeValueCostLine(event: BusinessActivityEvent): HarnessCostLine {
    const amount = roundCurrency((event.activeMinutes / 60) * event.hourlyRate);
    return {
      id: `cost_${event.id}`,
      userId: event.userId,
      amount,
      currency: 'USD',
      category: event.category,
      costType: 'time_value',
      sourceDomain: 'activity_time_value',
      projectId: event.projectId,
      releaseId: event.releaseId,
      tourId: event.tourId,
      activityEventId: event.id,
      taxTreatment: 'artist_labor_value_tracking',
      reimbursable: false,
      confidence: event.source === 'manual' ? 'high' : 'medium',
      notes: event.notes ?? `${event.activeMinutes} active minutes valued at $${event.hourlyRate}/hr. This is business investment value, not revenue.`,
      createdAt: new Date().toISOString(),
    };
  }
}

export const activityValueService = new ActivityValueService();

function inferCategory(eventType: BusinessActivityEvent['eventType'], module?: string): BusinessActivityEvent['category'] {
  if (eventType === 'travel') return 'travel_labor';
  if (module === 'legal') return 'legal_labor';
  if (module === 'marketing' || module === 'social' || module === 'publicist') return 'marketing_labor';
  if (module === 'creative' || module === 'music' || module === 'video') return 'creative_labor';
  if (module === 'curriculum') return 'learning';
  return 'admin_labor';
}

function roundCurrency(value: number): number {
  return Math.round(value * 100) / 100;
}

