import { useEffect, useRef } from 'react';
import { useStore } from '@/core/store';
import { useShallow } from 'zustand/react/shallow';
import { auth, db } from '@/services/firebase';
import { doc, onSnapshot } from 'firebase/firestore';
import { logger } from '@/utils/logger';

/**
 * User-configurable sleep settings, persisted to
 * `users/{uid}/settings/remoteSettings`. The desktop reads them here; the
 * mobile remote Settings tab writes them. Shared type so both stay in sync.
 */
export interface RemoteSleepSettings {
    /** Master switch for auto-sleep. */
    sleepEnabled: boolean;
    /** Idle minutes before sleeping. <= 0 means "Never". */
    autoSleepMinutes: number;
}

export const DEFAULT_REMOTE_SLEEP_SETTINGS: RemoteSleepSettings = {
    sleepEnabled: true,
    autoSleepMinutes: 30,
};

/** Selectable timeouts in the mobile Settings tab (minutes). 0 = Never. */
export const AUTO_SLEEP_TIMEOUT_OPTIONS = [15, 30, 60, 0] as const;

const ACTIVITY_EVENTS = ['mousemove', 'mousedown', 'keydown', 'touchstart', 'wheel'] as const;
const CHECK_INTERVAL_MS = 30_000;

function isElectron(): boolean {
    return typeof window !== 'undefined' && !!window.electronAPI?.window;
}

/**
 * Auto-sleep timer for the Electron desktop. After a configurable idle stretch
 * with no user activity and no agent work, hides the window to the tray and
 * sets the shared `isSleeping` flag (which the relay heartbeat publishes so the
 * phone can show "Sleeping"). Wake is handled by useRemoteCommandListener.
 *
 * No-op in the web/PWA build (no electronAPI.window). Mount once in App.tsx.
 */
export function useAutoSleep() {
    const { user, isAgentProcessing, isSleeping, setIsSleeping } = useStore(
        useShallow(state => ({
            user: state.user,
            isAgentProcessing: state.isAgentProcessing,
            isSleeping: state.isSleeping,
            setIsSleeping: state.setIsSleeping,
        }))
    );

    const settingsRef = useRef<RemoteSleepSettings>(DEFAULT_REMOTE_SLEEP_SETTINGS);
    // Stamped on mount by the effect below (Date.now() must not run during render).
    const lastActivityRef = useRef<number>(0);
    const isAgentProcessingRef = useRef(isAgentProcessing);
    const isSleepingRef = useRef(isSleeping);

    useEffect(() => { isAgentProcessingRef.current = isAgentProcessing; }, [isAgentProcessing]);
    useEffect(() => { isSleepingRef.current = isSleeping; }, [isSleeping]);

    // Seed the idle clock once on mount.
    useEffect(() => { lastActivityRef.current = Date.now(); }, []);

    // Agent work counts as activity — never sleep mid-task, and reset the idle
    // clock once a task finishes so the timer starts fresh.
    useEffect(() => {
        if (isAgentProcessing) lastActivityRef.current = Date.now();
    }, [isAgentProcessing]);

    // Woke up (any path) — reset the idle clock so it doesn't immediately re-sleep.
    useEffect(() => {
        if (!isSleeping) lastActivityRef.current = Date.now();
    }, [isSleeping]);

    // Load settings reactively (the phone writes the same doc).
    useEffect(() => {
        if (!isElectron()) return;
        const uid = user?.uid || auth.currentUser?.uid;
        if (!uid) return;

        const ref = doc(db, 'users', uid, 'settings', 'remoteSettings');
        const unsub = onSnapshot(
            ref,
            (snap) => {
                const data = snap.data();
                settingsRef.current = {
                    sleepEnabled: typeof data?.sleepEnabled === 'boolean'
                        ? data.sleepEnabled
                        : DEFAULT_REMOTE_SLEEP_SETTINGS.sleepEnabled,
                    autoSleepMinutes: typeof data?.autoSleepMinutes === 'number'
                        ? data.autoSleepMinutes
                        : DEFAULT_REMOTE_SLEEP_SETTINGS.autoSleepMinutes,
                };
            },
            (err) => logger.warn('[AutoSleep] settings snapshot failed:', err)
        );
        return unsub;
    }, [user?.uid]);

    // Track user activity on the desktop window.
    useEffect(() => {
        if (!isElectron()) return;
        const onActivity = () => { lastActivityRef.current = Date.now(); };
        ACTIVITY_EVENTS.forEach(ev => window.addEventListener(ev, onActivity, { passive: true }));
        return () => ACTIVITY_EVENTS.forEach(ev => window.removeEventListener(ev, onActivity));
    }, []);

    // Idle check loop.
    useEffect(() => {
        if (!isElectron()) return;

        const id = setInterval(() => {
            const { sleepEnabled, autoSleepMinutes } = settingsRef.current;
            if (!sleepEnabled) return;
            if (autoSleepMinutes <= 0) return;        // "Never"
            if (isSleepingRef.current) return;        // already asleep
            if (isAgentProcessingRef.current) return; // never mid-task

            const idleMs = Date.now() - lastActivityRef.current;
            if (idleMs >= autoSleepMinutes * 60_000) {
                logger.info(`[AutoSleep] Idle ${Math.round(idleMs / 60_000)}m >= ${autoSleepMinutes}m — sleeping`);
                setIsSleeping(true);
                window.electronAPI?.window?.hide?.().catch((err: unknown) => {
                    logger.warn('[AutoSleep] window.hide failed:', err);
                });
            }
        }, CHECK_INTERVAL_MS);

        return () => clearInterval(id);
    }, [setIsSleeping]);
}
