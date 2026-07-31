import { StateCreator } from 'zustand';
import { collection, doc, getDoc, limit, onSnapshot, orderBy, query, setDoc } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';

import { auth, db, functions } from '@/services/firebase';
import { logger } from '@/utils/logger';

/**
 * Swarm Command Center state.
 *
 * Two very different sources feed this slice, and the split is deliberate:
 *
 *  - **Agent logs** stream live from Firestore. The artist is watching agents
 *    spend their money; a polling delay between "agent paused a losing ad" and
 *    seeing it is the wrong experience, so this is a snapshot subscription.
 *
 *  - **Campaign metrics** are pulled on demand from ClickHouse via
 *    `marketingGetCampaignMetrics`. They change on Airbyte's sync cadence, not
 *    per second, and the warehouse is not something the browser may query
 *    directly.
 */

// ============================================================================
// Types
// ============================================================================

export type AgentActionType =
    | 'launched_ad'
    | 'paused_ad'
    | 'generated_creative'
    | 'vision_qc_failed';

export interface AgentActionLog {
    id: string;
    agentName: string;
    actionType: AgentActionType;
    message: string;
    /** ISO 8601. */
    timestamp: string;
    status: 'success' | 'pending' | 'failed';
}

export interface CampaignMetrics {
    /** YYYY-MM-DD. */
    date: string;
    total_spend: number;
    total_revenue: number;
    total_clicks: number;
    total_conversions: number;
}

export interface AgentSwarmSlice {
    agentLogs: AgentActionLog[];
    campaignMetrics: CampaignMetrics[];
    isSwarmActive: boolean;

    /** Non-null while the metrics request is in flight. */
    swarmMetricsLoading: boolean;
    /** Set when metrics could not be loaded; surfaced in the UI, not swallowed. */
    swarmMetricsError: string | null;
    /** Set when the log subscription could not be established. */
    swarmLogsError: string | null;
    /** Set when the halt switch could not be persisted — the switch then lies. */
    swarmStatusError: string | null;

    /**
     * Opens the live log subscription. Returns an unsubscribe function; call it
     * on unmount or the listener outlives the dashboard and keeps billing reads.
     */
    subscribeAgentLogs: () => () => void;
    fetchCampaignMetrics: (rangeDays?: number) => Promise<void>;
    /** Reads the persisted halt state so the toggle reflects server truth on load. */
    loadSwarmStatus: () => Promise<void>;
    toggleSwarmStatus: (status: boolean) => Promise<void>;
}

// ============================================================================
// Constants
// ============================================================================

/** Newest actions only — the full audit trail lives in `timelineExecutionLogs`. */
const LOG_PAGE_SIZE = 50;
const DEFAULT_RANGE_DAYS = 30;

/**
 * `users/{uid}/settings/marketingSwarm`. The ad executor reads the same doc
 * before every write, which is what makes the Halt button a real kill switch.
 */
const SWARM_SETTING_ID = 'marketingSwarm';

const VALID_ACTION_TYPES: readonly AgentActionType[] = [
    'launched_ad', 'paused_ad', 'generated_creative', 'vision_qc_failed',
];
const VALID_STATUSES: readonly AgentActionLog['status'][] = ['success', 'pending', 'failed'];

// ============================================================================
// Helpers
// ============================================================================

/**
 * Firestore documents are written by Cloud Functions, so the shape is trusted
 * but not guaranteed across deploys. Unknown enum values are normalized rather
 * than rendered raw, so a future action type cannot break the log list.
 */
function toAgentActionLog(id: string, data: Record<string, unknown>): AgentActionLog {
    const actionType = VALID_ACTION_TYPES.includes(data.actionType as AgentActionType)
        ? data.actionType as AgentActionType
        : 'generated_creative';
    const status = VALID_STATUSES.includes(data.status as AgentActionLog['status'])
        ? data.status as AgentActionLog['status']
        : 'pending';

    return {
        id,
        agentName: typeof data.agentName === 'string' ? data.agentName : 'Swarm',
        actionType,
        message: typeof data.message === 'string' ? data.message : '',
        timestamp: typeof data.timestamp === 'string' ? data.timestamp : new Date().toISOString(),
        status,
    };
}

function errorMessage(error: unknown, fallback: string): string {
    return error instanceof Error && error.message ? error.message : fallback;
}

// ============================================================================
// Slice
// ============================================================================

export const createAgentSwarmSlice: StateCreator<AgentSwarmSlice> = (set, get) => ({
    agentLogs: [],
    campaignMetrics: [],
    isSwarmActive: true,
    swarmMetricsLoading: false,
    swarmMetricsError: null,
    swarmLogsError: null,
    swarmStatusError: null,

    subscribeAgentLogs: () => {
        const uid = auth.currentUser?.uid;
        if (!uid) {
            set({ swarmLogsError: 'Sign in to see agent activity.' });
            return () => { /* nothing subscribed */ };
        }

        try {
            const logsQuery = query(
                collection(db, 'users', uid, 'marketingAgentLogs'),
                orderBy('createdAt', 'desc'),
                limit(LOG_PAGE_SIZE),
            );

            return onSnapshot(
                logsQuery,
                snapshot => {
                    set({
                        agentLogs: snapshot.docs.map(entry => toAgentActionLog(entry.id, entry.data())),
                        swarmLogsError: null,
                    });
                },
                error => {
                    logger.error('[agentSwarmSlice] Log subscription failed:', error);
                    set({ swarmLogsError: errorMessage(error, 'Could not load agent activity.') });
                },
            );
        } catch (error) {
            logger.error('[agentSwarmSlice] Could not open log subscription:', error);
            set({ swarmLogsError: errorMessage(error, 'Could not load agent activity.') });
            return () => { /* nothing subscribed */ };
        }
    },

    fetchCampaignMetrics: async (rangeDays = DEFAULT_RANGE_DAYS) => {
        set({ swarmMetricsLoading: true, swarmMetricsError: null });
        try {
            const getMetrics = httpsCallable<
                { rangeDays: number },
                { ok: boolean; metrics: CampaignMetrics[] }
            >(functions, 'marketingGetCampaignMetrics');

            const response = await getMetrics({ rangeDays });
            set({
                campaignMetrics: response.data?.metrics ?? [],
                swarmMetricsLoading: false,
            });
        } catch (error) {
            logger.error('[agentSwarmSlice] Campaign metrics fetch failed:', error);
            set({
                swarmMetricsLoading: false,
                // Left empty rather than stale: a chart showing last week's spend
                // as if it were current is worse than an explicit error.
                campaignMetrics: [],
                swarmMetricsError: errorMessage(error, 'Could not load campaign metrics.'),
            });
        }
    },

    loadSwarmStatus: async () => {
        const uid = auth.currentUser?.uid;
        if (!uid) return;
        try {
            const snapshot = await getDoc(doc(db, 'users', uid, 'settings', SWARM_SETTING_ID));
            const isActive = snapshot.data()?.isActive;
            // Absent document means never configured — the swarm ships enabled.
            set({ isSwarmActive: typeof isActive === 'boolean' ? isActive : true });
        } catch (error) {
            logger.error('[agentSwarmSlice] Could not read swarm status:', error);
        }
    },

    /**
     * Persists the halt state, because this is a kill switch over real ad spend.
     * A browser-local boolean would leave the artist believing they had stopped
     * their agents while the backend kept buying — so the write happens first,
     * and the toggle only moves if it succeeds.
     */
    toggleSwarmStatus: async (status) => {
        const uid = auth.currentUser?.uid;
        if (!uid) {
            set({ swarmStatusError: 'Sign in to control the swarm.' });
            return;
        }

        const previous = get().isSwarmActive;
        set({ isSwarmActive: status, swarmStatusError: null });

        try {
            await setDoc(
                doc(db, 'users', uid, 'settings', SWARM_SETTING_ID),
                { isActive: status, updatedAt: new Date().toISOString() },
                { merge: true },
            );
        } catch (error) {
            logger.error('[agentSwarmSlice] Could not persist swarm status:', error);
            // The consequence leads, not the SDK's message: "offline" does not
            // tell an artist that their agents may still be spending. The raw
            // detail is appended for support, never substituted for the warning.
            const consequence = status
                ? 'Could not activate the swarm. Agents remain halted.'
                : 'Could not halt the swarm. Agents may still be running — retry.';
            const detail = error instanceof Error && error.message ? ` (${error.message})` : '';

            set({
                isSwarmActive: previous,
                swarmStatusError: `${consequence}${detail}`,
            });
        }
    },
});
