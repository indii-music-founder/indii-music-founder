import { useEffect, useRef } from 'react';
import { auth } from '@/services/firebase';
import { activityValueService } from './ActivityValueService';
import { saveBusinessActivityEvent, saveBusinessCostLine } from './HarnessStorage';
import type { BusinessActivityEvent } from './types';
import { logger } from '@/utils/logger';

const MIN_PERSISTED_MINUTES = 1;
const DEFAULT_HOURLY_RATE = 35;

export function BusinessActivityTracker({ userId, currentModule }: { userId?: string; currentModule: string }) {
  const activeEventId = useRef<string | null>(null);
  const idleStartedAt = useRef<number | null>(null);
  const accumulatedIdleMinutes = useRef(0);

  useEffect(() => {
    const markActive = () => {
      if (idleStartedAt.current) {
        accumulatedIdleMinutes.current += Math.round((Date.now() - idleStartedAt.current) / 60000);
        idleStartedAt.current = null;
      }
    };
    const markIdle = () => {
      if (!idleStartedAt.current) idleStartedAt.current = Date.now();
    };
    const handleVisibility = () => {
      if (document.hidden) markIdle();
      else markActive();
    };
    window.addEventListener('mousemove', markActive, { passive: true });
    window.addEventListener('keydown', markActive);
    window.addEventListener('focus', markActive);
    window.addEventListener('blur', markIdle);
    document.addEventListener('visibilitychange', handleVisibility);
    return () => {
      window.removeEventListener('mousemove', markActive);
      window.removeEventListener('keydown', markActive);
      window.removeEventListener('focus', markActive);
      window.removeEventListener('blur', markIdle);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, []);

  useEffect(() => {
    if (!userId) return;
    const started = activityValueService.startSession({
      userId,
      eventType: 'module_focus',
      module: currentModule,
      hourlyRate: DEFAULT_HOURLY_RATE,
      source: 'automatic',
      notes: `Focused app time in ${currentModule}.`,
    });
    activeEventId.current = started.id;
    accumulatedIdleMinutes.current = 0;

    return () => {
      const eventId = activeEventId.current;
      if (!eventId) return;
      if (idleStartedAt.current) {
        accumulatedIdleMinutes.current += Math.round((Date.now() - idleStartedAt.current) / 60000);
        idleStartedAt.current = null;
      }
      const finished = activityValueService.finishSession(eventId, new Date().toISOString(), accumulatedIdleMinutes.current);
      activeEventId.current = null;
      if (finished) void persistFinishedSession(finished);
    };
  }, [currentModule, userId]);

  return null;
}

async function persistFinishedSession(event: BusinessActivityEvent): Promise<void> {
  if (!auth.currentUser || event.activeMinutes < MIN_PERSISTED_MINUTES) return;
  try {
    await saveBusinessActivityEvent(event);
    await saveBusinessCostLine(activityValueService.buildTimeValueCostLine(event));
  } catch (error: unknown) {
    logger.warn('[BusinessActivityTracker] Failed to persist activity event:', error);
  }
}
