import React, { useEffect } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useStore } from '@/core/store';
import { useAuthHealth } from '@/hooks/useAuthHealth';
import { logger } from '@/utils/logger';

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
    const { initializeAuthListener, loadUserProfile, user, userProfile, initializeHistory, loadProjects } = useStore(
        useShallow(state => ({
            initializeAuthListener: state.initializeAuthListener,
            loadUserProfile: state.loadUserProfile,
            user: state.user,
            userProfile: state.userProfile,
            initializeHistory: state.initializeHistory,
            loadProjects: state.loadProjects
        }))
    );

    // 1. Initialize Auth Listener (Firebase)
    useEffect(() => {
        const unsubscribe = initializeAuthListener();
        return () => {
            unsubscribe();
        };
    }, [initializeAuthListener]);

    // Auth session health: periodically refreshes the ID token
    useAuthHealth();

    // 2. Load User Profile when User is Authenticated
    useEffect(() => {
        if (user?.uid) {
            loadUserProfile(user.uid);
        }
    }, [user, loadUserProfile]);

    // 3. Load Application Data (Projects, History) when Profile is ready
    useEffect(() => {
        if (user) {
            let isMounted = true;

            initializeHistory();
            loadProjects();

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
            import('@/services/agent/AlwaysOnMemoryEngine').then(({ alwaysOnMemoryEngine }) => {
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
            };
        }
    }, [user, initializeHistory, loadProjects]);

    // 4. Electron-specific synchronization
    useEffect(() => {
        if (userProfile?.preferences && window.electronAPI?.updater?.setChannel) {
            const channel = userProfile.preferences.updateChannel || 'stable';
            window.electronAPI.updater.setChannel(channel);
            logger.debug('[AppInit] Synced update channel to Electron:', channel);
        }
    }, [userProfile]);

    return <>{children}</>;
};
