import { StateCreator } from 'zustand';
import type { TrackReport, BreakoutAlert } from '@/services/analytics/types';
import type { VitalsReport, RequestTrace, BundleMetrics } from '@/services/observability';
import type { AnalyticsEvent } from '@indiios/shared';

export interface AnalyticsSlice {
    // Selected track for detail view
    analyticsSelectedTrackId: string | null;
    setAnalyticsSelectedTrackId: (id: string | null) => void;

    // Cached reports (keyed by trackId)
    analyticsReports: Record<string, TrackReport>;
    setAnalyticsReport: (trackId: string, report: TrackReport) => void;
    clearAnalyticsReports: () => void;

    // All active alerts (deduplicated)
    analyticsAlerts: BreakoutAlert[];
    addAnalyticsAlerts: (alerts: BreakoutAlert[]) => void;
    dismissAnalyticsAlert: (alertId: string) => void;

    // Loading state
    analyticsLoading: boolean;
    setAnalyticsLoading: (loading: boolean) => void;

    // Refresh timestamp (used to trigger re-fetches)
    analyticsLastRefresh: number | null;
    setAnalyticsLastRefresh: (ts: number) => void;

    // Phase 3: Performance monitoring metrics
    performanceVitals: VitalsReport | null;
    setPerformanceVitals: (vitals: VitalsReport | null) => void;

    performanceRequests: RequestTrace[];
    addPerformanceRequest: (request: RequestTrace) => void;
    clearPerformanceRequests: () => void;

    performanceBundle: BundleMetrics | null;
    setPerformanceBundle: (metrics: BundleMetrics | null) => void;

    // Phase 4: Analytics Events & Queries
    analyticsEvents: AnalyticsEvent[];
    addAnalyticsEvent: (event: AnalyticsEvent) => void;
    clearAnalyticsEvents: () => void;
    setAnalyticsEvents: (events: AnalyticsEvent[]) => void;

    // Cached query results
    queryResults: Record<string, AnalyticsEvent[]>;
    setQueryResults: (queryKey: string, results: AnalyticsEvent[]) => void;
    clearQueryResults: () => void;

    // Event filters state
    eventTypeFilter: string | null;
    setEventTypeFilter: (type: string | null) => void;
    dateRangeFilter: { start: string; end: string } | null;
    setDateRangeFilter: (range: { start: string; end: string } | null) => void;
}

export const createAnalyticsSlice: StateCreator<AnalyticsSlice> = (set) => ({
    analyticsSelectedTrackId: null,
    setAnalyticsSelectedTrackId: (id) => set({ analyticsSelectedTrackId: id }),

    analyticsReports: {},
    setAnalyticsReport: (trackId, report) =>
        set(state => ({ analyticsReports: { ...state.analyticsReports, [trackId]: report } })),
    clearAnalyticsReports: () => set({ analyticsReports: {} }),

    analyticsAlerts: [],
    addAnalyticsAlerts: (alerts) =>
        set(state => {
            const existingIds = new Set(state.analyticsAlerts.map(a => a.id));
            const newAlerts = alerts.filter(a => !existingIds.has(a.id));
            return { analyticsAlerts: [...newAlerts, ...state.analyticsAlerts].slice(0, 50) };
        }),
    dismissAnalyticsAlert: (alertId) =>
        set(state => ({ analyticsAlerts: state.analyticsAlerts.filter(a => a.id !== alertId) })),

    analyticsLoading: false,
    setAnalyticsLoading: (loading) => set({ analyticsLoading: loading }),

    analyticsLastRefresh: null,
    setAnalyticsLastRefresh: (ts) => set({ analyticsLastRefresh: ts }),

    performanceVitals: null,
    setPerformanceVitals: (vitals) => set({ performanceVitals: vitals }),

    performanceRequests: [],
    addPerformanceRequest: (request) =>
        set(state => ({ performanceRequests: [...state.performanceRequests, request].slice(-100) })),
    clearPerformanceRequests: () => set({ performanceRequests: [] }),

    performanceBundle: null,
    setPerformanceBundle: (metrics) => set({ performanceBundle: metrics }),

    // Phase 4: Analytics Events
    analyticsEvents: [],
    addAnalyticsEvent: (event) =>
        set(state => ({ analyticsEvents: [event, ...state.analyticsEvents].slice(0, 1000) })),
    clearAnalyticsEvents: () => set({ analyticsEvents: [] }),
    setAnalyticsEvents: (events) => set({ analyticsEvents: events }),

    // Query Results
    queryResults: {},
    setQueryResults: (queryKey, results) =>
        set(state => ({ queryResults: { ...state.queryResults, [queryKey]: results } })),
    clearQueryResults: () => set({ queryResults: {} }),

    // Filters
    eventTypeFilter: null,
    setEventTypeFilter: (type) => set({ eventTypeFilter: type }),
    dateRangeFilter: null,
    setDateRangeFilter: (range) => set({ dateRangeFilter: range }),
});
