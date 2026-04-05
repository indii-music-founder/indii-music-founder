import { StateCreator } from 'zustand';
import type { TrackReport, BreakoutAlert } from '@/services/analytics/types';

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
});
