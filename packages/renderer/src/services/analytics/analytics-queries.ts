/**
 * analytics-queries.ts
 * Pre-built analytics queries and helpers
 *
 * Provides common analytics operations:
 * - Event filtering
 * - Time-range queries
 * - Aggregations (count, unique users, etc.)
 */

import type { AnalyticsEvent } from '@indiios/shared';

export interface DateRange {
  startDate: Date;
  endDate: Date;
}

export interface EventFilter {
  eventType?: string;
  userId?: string;
  minTimestamp?: number;
  maxTimestamp?: number;
}

export interface AggregationResult {
  count: number;
  uniqueUsers: number;
  timeRange: DateRange;
}

export class AnalyticsQueries {
  /**
   * Filter events by criteria
   */
  static filterEvents(events: AnalyticsEvent[], filter: EventFilter): AnalyticsEvent[] {
    return events.filter(event => {
      if (filter.eventType && event.eventType !== filter.eventType) return false;
      if (filter.userId && event.userId !== filter.userId) return false;
      if (filter.minTimestamp && event.timestamp < filter.minTimestamp) return false;
      if (filter.maxTimestamp && event.timestamp > filter.maxTimestamp) return false;
      return true;
    });
  }

  /**
   * Get events within a time range
   */
  static getEventsInRange(events: AnalyticsEvent[], range: DateRange): AnalyticsEvent[] {
    const minTs = range.startDate.getTime();
    const maxTs = range.endDate.getTime();
    return events.filter(e => e.timestamp >= minTs && e.timestamp <= maxTs);
  }

  /**
   * Aggregate event metrics
   */
  static aggregate(events: AnalyticsEvent[], range: DateRange): AggregationResult {
    const uniqueUsers = new Set(events.map(e => e.userId)).size;
    return {
      count: events.length,
      uniqueUsers,
      timeRange: range,
    };
  }

  /**
   * Count events by type
   */
  static countByType(events: AnalyticsEvent[]): Record<string, number> {
    const counts: Record<string, number> = {};
    events.forEach(event => {
      counts[event.eventType] = (counts[event.eventType] ?? 0) + 1;
    });
    return counts;
  }

  /**
   * Get top N events by frequency
   */
  static getTopEventTypes(events: AnalyticsEvent[], limit: number = 10): Array<[string, number]> {
    const counts = this.countByType(events);
    return Object.entries(counts)
      .sort(([, a], [, b]) => b - a)
      .slice(0, limit);
  }

  /**
   * Calculate hourly event distribution
   */
  static getHourlyDistribution(events: AnalyticsEvent[]): Record<number, number> {
    const distribution: Record<number, number> = {};
    events.forEach(event => {
      const hour = new Date(event.timestamp).getHours();
      distribution[hour] = (distribution[hour] ?? 0) + 1;
    });
    return distribution;
  }

  /**
   * Calculate daily event distribution
   */
  static getDailyDistribution(events: AnalyticsEvent[]): Record<string, number> {
    const distribution: Record<string, number> = {};
    events.forEach(event => {
      const date = new Date(event.timestamp).toISOString().split('T')[0];
      if (date) {
        distribution[date] = (distribution[date] ?? 0) + 1;
      }
    });
    return distribution;
  }

  /**
   * Get events for a specific user
   */
  static getByUser(events: AnalyticsEvent[], userId: string): AnalyticsEvent[] {
    return events.filter(e => e.userId === userId);
  }

  /**
   * Get events for a specific event type
   */
  static getByType(events: AnalyticsEvent[], eventType: string): AnalyticsEvent[] {
    return events.filter(e => e.eventType === eventType);
  }

  /**
   * Get the most recent N events
   */
  static getRecent(events: AnalyticsEvent[], limit: number = 10): AnalyticsEvent[] {
    return events
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, limit);
  }
}
