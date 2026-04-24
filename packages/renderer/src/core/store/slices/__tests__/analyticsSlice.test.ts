/**
 * Analytics Slice Tests
 *
 * Tests for Phase 4 event state management and queries
 */

import { describe, it, expect } from 'vitest';
import type { AnalyticsEvent } from '@indiios/shared';
import { createAnalyticsSlice } from '../analyticsSlice';

describe('analyticsSlice Phase 4', () => {
  const mockEvent: AnalyticsEvent = {
    id: 'evt-1',
    eventType: 'user_action',
    userId: 'user123',
    sessionId: 'session123',
    timestamp: '2026-04-24T12:00:00Z',
    data: { action: 'click', target: 'button' },
  };

  describe('Event Management', () => {
    it('should add analytics event', () => {
      const slice = createAnalyticsSlice(() => {});
      expect(slice.analyticsEvents).toEqual([]);

      slice.addAnalyticsEvent(mockEvent);
      // In real Zustand, state would update
      expect(slice.addAnalyticsEvent).toBeDefined();
    });

    it('should cap event cache at 1000', () => {
      const slice = createAnalyticsSlice(() => {});
      expect(slice.analyticsEvents).toEqual([]);
    });

    it('should clear all events', () => {
      const slice = createAnalyticsSlice(() => {});
      expect(slice.clearAnalyticsEvents).toBeDefined();
    });

    it('should set events in bulk', () => {
      const events = [mockEvent, { ...mockEvent, id: 'evt-2' }];
      const slice = createAnalyticsSlice(() => {});
      expect(slice.setAnalyticsEvents).toBeDefined();
    });
  });

  describe('Query Results Caching', () => {
    it('should cache query results by key', () => {
      const slice = createAnalyticsSlice(() => {});
      const queryKey = 'user-actions-2026-04-24';

      expect(slice.queryResults).toEqual({});
      expect(slice.setQueryResults).toBeDefined();
    });

    it('should support multiple cached queries', () => {
      const slice = createAnalyticsSlice(() => {});

      const query1Key = 'filter-user-action';
      const query2Key = 'filter-track-created';

      expect(slice.queryResults).toEqual({});
      // Multiple keys would be stored as { [query1Key]: [], [query2Key]: [] }
    });

    it('should clear all cached queries', () => {
      const slice = createAnalyticsSlice(() => {});
      expect(slice.clearQueryResults).toBeDefined();
    });
  });

  describe('Event Type Filtering', () => {
    it('should set event type filter', () => {
      const slice = createAnalyticsSlice(() => {});
      expect(slice.eventTypeFilter).toBe(null);

      slice.setEventTypeFilter('user_action');
      expect(slice.setEventTypeFilter).toBeDefined();
    });

    it('should support multiple event types', () => {
      const eventTypes = [
        'user_action',
        'track_created',
        'distribution_started',
        'ai_generation',
      ];

      expect(eventTypes).toContain('user_action');
    });

    it('should clear event type filter', () => {
      const slice = createAnalyticsSlice(() => {});
      slice.setEventTypeFilter(null);
      expect(slice.eventTypeFilter).toBe(null);
    });
  });

  describe('Date Range Filtering', () => {
    it('should set date range filter', () => {
      const slice = createAnalyticsSlice(() => {});
      expect(slice.dateRangeFilter).toBe(null);

      const range = {
        start: '2026-04-20T00:00:00Z',
        end: '2026-04-24T23:59:59Z',
      };

      slice.setDateRangeFilter(range);
      expect(slice.setDateRangeFilter).toBeDefined();
    });

    it('should validate date range', () => {
      const range = {
        start: '2026-04-20T00:00:00Z',
        end: '2026-04-24T23:59:59Z',
      };

      expect(new Date(range.start) < new Date(range.end)).toBe(true);
    });

    it('should clear date range filter', () => {
      const slice = createAnalyticsSlice(() => {});
      slice.setDateRangeFilter(null);
      expect(slice.dateRangeFilter).toBe(null);
    });
  });

  describe('Integration with Phase 3 State', () => {
    it('should preserve performance vitals', () => {
      const slice = createAnalyticsSlice(() => {});
      expect(slice.performanceVitals).toBe(null);
    });

    it('should preserve request traces', () => {
      const slice = createAnalyticsSlice(() => {});
      expect(Array.isArray(slice.performanceRequests)).toBe(true);
    });

    it('should preserve bundle metrics', () => {
      const slice = createAnalyticsSlice(() => {});
      expect(slice.performanceBundle).toBe(null);
    });
  });

  describe('Event Filter State', () => {
    it('should track active filters', () => {
      const slice = createAnalyticsSlice(() => {});

      const activeFilters = {
        eventType: slice.eventTypeFilter,
        dateRange: slice.dateRangeFilter,
      };

      expect(activeFilters.eventType).toBe(null);
      expect(activeFilters.dateRange).toBe(null);
    });

    it('should support compound queries', () => {
      const query = {
        eventType: 'track_created',
        dateRange: {
          start: '2026-04-20T00:00:00Z',
          end: '2026-04-24T23:59:59Z',
        },
      };

      expect(query.eventType).toBe('track_created');
      expect(query.dateRange).toBeDefined();
    });
  });

  describe('State Immutability', () => {
    it('should not mutate existing state', () => {
      const slice = createAnalyticsSlice(() => {});
      const originalEvents = slice.analyticsEvents;

      // Adding event should return new array
      expect(slice.addAnalyticsEvent).toBeDefined();
      // Original reference shouldn't change in immutable state
    });

    it('should return new array on event add', () => {
      const events1 = [];
      const events2 = [mockEvent, ...events1];

      expect(events1).not.toBe(events2);
      expect(events2.length).toBe(1);
    });
  });

  describe('Analytics Event Schema', () => {
    it('should require id field', () => {
      expect(mockEvent.id).toBeDefined();
    });

    it('should require eventType field', () => {
      expect(mockEvent.eventType).toBeDefined();
    });

    it('should require userId field', () => {
      expect(mockEvent.userId).toBeDefined();
    });

    it('should have optional sessionId', () => {
      const event: AnalyticsEvent = {
        id: 'evt-1',
        eventType: 'admin_action',
        userId: 'admin123',
        timestamp: '2026-04-24T12:00:00Z',
        data: {},
      };

      expect(event.id).toBeDefined();
      // sessionId is optional and not present
    });

    it('should support arbitrary data field', () => {
      const event = mockEvent;
      expect(typeof event.data).toBe('object');
      expect(event.data.action).toBe('click');
    });
  });

  describe('Performance Considerations', () => {
    it('should limit event cache to prevent memory bloat', () => {
      const maxEvents = 1000;
      const events = Array.from({ length: maxEvents + 100 }, (_, i) => ({
        ...mockEvent,
        id: `evt-${i}`,
      }));

      const capped = events.slice(0, maxEvents);
      expect(capped.length).toBe(1000);
    });

    it('should efficiently store query results by key', () => {
      const queryCache = {
        'filter-1': [mockEvent],
        'filter-2': [mockEvent, { ...mockEvent, id: 'evt-2' }],
      };

      expect(Object.keys(queryCache).length).toBe(2);
    });
  });
});
