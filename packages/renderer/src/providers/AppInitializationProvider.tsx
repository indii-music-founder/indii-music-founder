import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { resetStoreForAccountBoundary, useStore } from '@/core/store';
import { useAuthHealth } from '@/hooks/useAuthHealth';
import { logger } from '@/utils/logger';

/**
 * Auth-only bootstrap for signed-out Studio routes. Public pages and the
 * standalone Controller intentionally do not mount authenticated Studio
 * initialization or its account-owned background services.
 */
export const AuthInitializationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const { initializeAuthListener, user } = useStore(
        useShallow(state => ({
            initializeAuthListener: state.initializeAuthListener,
            user: state.user,
        }))
    );
    const previousAccountIdRef = useRef<string | null | undefined>(undefined);

    // The auth shell owns the synchronous in-memory identity boundary so it
    // remains active while the signed-in Studio initializer mounts/unmounts.
    useLayoutEffect(() => {
        const accountId = user?.uid ?? null;
        if (previousAccountIdRef.current === accountId) return;

        const hadEstablishedAccount = previousAccountIdRef.current !== undefined;
        previousAccountIdRef.current = accountId;
        resetStoreForAccountBoundary(user ?? null);

        if (hadEstablishedAccount) {
            void import('@/services/email/EmailService')
                .then(({ EmailService }) => EmailService.clearSession())
                .catch(err => logger.error('[AuthInit] Failed to clear email session cache:', err));
        }

        // Signed-out users must be able to reach authentication even if a
        // browser cache refuses cleanup. A subsequent authenticated Studio
        // mount still enforces the same boundary fail-closed before rendering.
        if (!accountId) {
            void import('@/services/auth/AccountBoundaryCleanup')
                .then(({ enforceAccountBoundaryCleanup }) => enforceAccountBoundaryCleanup(null))
                .catch(err => logger.error('[AuthInit] Signed-out cache cleanup failed:', err));
        }
    }, [user]);

    useEffect(() => {
        const unsubscribe = initializeAuthListener();
        return () => unsubscribe();
    }, [initializeAuthListener]);

    useAuthHealth();
    return <>{children}</>;
};

/**
 * AppInitializationProvider — Core Application Lifecycle Orchestrator
 *
 * This provider extracts the heavy initialization logic from App.tsx, handling:
 * - Firebase Auth listeners
 * - User profile loading
 * - Application data hydration (Projects, History)
 * - Background services (Proactive, AssetObserver, MemoryEngine, Handoff)
 * - Push notification listeners
 * - Electron-specific sync (Update channels)
 */
export const AppInitializationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const { loadUserProfile, user, authLoading, userProfile, initializeHistory, loadProjects, loadNotesFromCloud, currentOrganizationId } = useStore(
        useShallow(state => ({
            loadUserProfile: state.loadUserProfile,
            user: state.user,
            authLoading: state.authLoading,
            userProfile: state.userProfile,
            initializeHistory: state.initializeHistory,
            loadProjects: state.loadProjects,
            loadNotesFromCloud: state.loadNotesFromCloud,
            currentOrganizationId: state.currentOrganizationId
        }))
    );
    const cleanedAccountIdRef = useRef<string | null | undefined>(undefined);
    const [isAccountBoundaryReady, setIsAccountBoundaryReady] = useState(false);
    const [accountBoundaryError, setAccountBoundaryError] = useState(false);
    const [accountBoundaryAttempt, setAccountBoundaryAttempt] = useState(0);

    useLayoutEffect(() => {
        if (authLoading) return;
        const accountId = user?.uid ?? null;
        if (cleanedAccountIdRef.current === accountId) {
            setIsAccountBoundaryReady(true);
            return;
        }

        let cancelled = false;
        setIsAccountBoundaryReady(false);
        setAccountBoundaryError(false);
        void import('@/services/auth/AccountBoundaryCleanup')
            .then(({ enforceAccountBoundaryCleanup }) => enforceAccountBoundaryCleanup(accountId))
            .then(() => {
                if (!cancelled) {
                    cleanedAccountIdRef.current = accountId;
                    setIsAccountBoundaryReady(true);
                }
            })
            .catch(err => {
                logger.error('[AppInit] Failed to enforce account cache boundary:', err);
                if (!cancelled) setAccountBoundaryError(true);
            });

        return () => {
            cancelled = true;
        };
    }, [accountBoundaryAttempt, authLoading, user]);

    // 1. Load User Profile when User is Authenticated (skip for anonymous/demo)
    useEffect(() => {
        if (isAccountBoundaryReady && user?.uid && !user.isAnonymous && user.uid !== 'demo') {
            loadUserProfile(user.uid);
        }
    }, [isAccountBoundaryReady, user, loadUserProfile]);

    // 2. Load Application Data (Projects, History) when Profile is ready (skip for anonymous/demo)
    useEffect(() => {
        if (isAccountBoundaryReady && user && !user.isAnonymous && user.uid !== 'demo') {
            let isMounted = true;

            // ISSUE-772: rescope legacy 'org-default' docs to 'personal' BEFORE the
            // history subscription attaches, so migrated items land in the first
            // snapshot. Never blocks boot — failures retry on next login.
            import('@/services/LegacyOrgMigrationService')
                .then(({ LegacyOrgMigrationService }) => LegacyOrgMigrationService.run())
                .catch(err => logger.error('[AppInit] Legacy org migration failed:', err))
                .finally(() => {
                    if (isMounted) initializeHistory();
                });
            loadProjects();
            loadNotesFromCloud();

            // Re-enable Agent if needed, but keep closed by default
            useStore.setState({ isAgentOpen: false });

            // Initialize Proactive Service (Start Polling) — requires auth
            import('@/services/agent/ProactiveService').then(({ proactiveService }) => {
                if (isMounted) proactiveService.start();
            }).catch(err => logger.error('Failed to load ProactiveService', err));

            // Initialize Asset Observer — requires auth for Firestore subscriptions
            import('@/services/agent/AssetObserver').then(({ assetObserver }) => {
                if (isMounted) assetObserver.initialize();
            }).catch(err => logger.error('Failed to load AssetObserver', err));

            // Initialize Always-On Memory Engine — starts background consolidation
            import('@/services/agent/memory/AlwaysOnMemoryEngine').then(({ alwaysOnMemoryEngine }) => {
                if (isMounted) alwaysOnMemoryEngine.start(user.uid);
            }).catch(err => logger.error('Failed to load AlwaysOnMemoryEngine', err));

            // Initialize Push Notification foreground listener
            let pushUnsub: (() => void) | null = null;
            import('@/services/notifications/PushNotificationService').then(({ pushNotificationService }) => {
                if (isMounted) {
                    pushUnsub = pushNotificationService.onForegroundMessage((payload) => {
                        logger.info('[AppInit] Push notification received in foreground:', payload?.notification?.title);
                    });
                }
            }).catch(err => logger.warn('Push notifications unavailable:', err));

            // Initialize Cross-Device Handoff — syncs active route to Firestore
            let handoffUnsub: (() => void) | null = null;
            import('@/services/collaboration/HandoffService').then(({ handoffService }) => {
                if (isMounted) {
                    // Sync initial state
                    const currentModule = useStore.getState().currentModule;
                    handoffService.syncState({ activeRoute: currentModule });

                    // Listen for remote handoff from another device
                    handoffUnsub = handoffService.listenForRemoteHandoff((state) => {
                        logger.info('[AppInit] Remote handoff detected:', state.activeRoute);
                    });
                }
            }).catch(err => logger.warn('Handoff service unavailable:', err));

            return () => {
                isMounted = false;
                if (pushUnsub) pushUnsub();
                if (handoffUnsub) handoffUnsub();
                import('@/services/agent/ProactiveService').then(({ proactiveService }) => {
                    proactiveService.dispose();
                }).catch(() => { /* module already unloaded */ });
                import('@/services/agent/AssetObserver').then(({ assetObserver }) => {
                    assetObserver.stop();
                }).catch(() => { /* module already unloaded */ });
                import('@/services/agent/memory/AlwaysOnMemoryEngine').then(({ alwaysOnMemoryEngine }) => {
                    alwaysOnMemoryEngine.stop();
                }).catch(() => { /* module already unloaded */ });
            };
        }
    }, [isAccountBoundaryReady, user, currentOrganizationId, initializeHistory, loadProjects, loadNotesFromCloud]);

    // 3. Electron-specific synchronization
    useEffect(() => {
        if (isAccountBoundaryReady && userProfile?.preferences && window.electronAPI?.updater?.setChannel) {
            const channel = userProfile.preferences.updateChannel || 'stable';
            window.electronAPI.updater.setChannel(channel);
            logger.debug('[AppInit] Synced update channel to Electron:', channel);
        }
    }, [isAccountBoundaryReady, userProfile]);

    if (accountBoundaryError) {
        return (
            <main className="min-h-screen bg-[#08090b] text-white flex items-center justify-center p-6">
                <section role="alert" className="w-full max-w-md rounded-2xl border border-red-500/30 bg-red-500/10 p-6 text-center">
                    <h1 className="text-xl font-semibold">Secure session cleanup failed</h1>
                    <p className="mt-3 text-sm text-gray-300">
                        Studio kept your workspace locked because private data from the previous session could not be cleared.
                    </p>
                    <button
                        type="button"
                        className="mt-5 rounded-lg bg-white px-4 py-2 text-sm font-semibold text-black"
                        onClick={() => setAccountBoundaryAttempt(attempt => attempt + 1)}
                    >
                        Retry secure cleanup
                    </button>
                </section>
            </main>
        );
    }

    return isAccountBoundaryReady ? <>{children}</> : null;
};
