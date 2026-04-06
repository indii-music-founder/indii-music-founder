/* eslint-disable @typescript-eslint/no-explicit-any -- Core infrastructure types */
import { lazy, Suspense, useEffect, useMemo } from 'react';
import { MotionConfig } from 'framer-motion';
import { initSentry, setSentryUser, clearSentryUser } from '@/services/observability/SentryService';

// Item 388: Initialize Sentry before any rendering — captures mount-phase errors
initSentry();
import { useShallow } from 'zustand/react/shallow';
import { useStore } from './store';
import Sidebar from './components/Sidebar';
import RightPanel from './components/RightPanel';
import CommandBar from './components/CommandBar';
import { ToastProvider } from './context/ToastContext';
import { VoiceProvider } from './context/VoiceContext';
import { ThemeProvider } from './context/ThemeContext';
import { ErrorBoundary } from './components/ErrorBoundary';
import { ModuleErrorBoundary } from './components/ModuleErrorBoundary';
import { ModuleAmbientBackground } from './components/ModuleAmbientBackground';
import { MobileTabBar } from './components/MobileTabBar';
import { MobileHeader } from './components/MobileHeader';
import LoginForm from './components/auth/LoginForm';

import { ApprovalModal } from './components/ApprovalModal';
import { BiometricGate } from './components/auth/BiometricGate';
import { OfflineBanner } from './components/OfflineBanner';
import { ShareTargetHandler } from '@/core/components/ShareTargetHandler';
import { ApprovalManager } from '@/components/instruments/InstrumentApprovalModal';
import { useRemoteCommandListener } from '@/hooks/useRemoteCommandListener';
import { BoardroomModule } from '@/modules/boardroom/BoardroomModule';

import { PWAInstallPrompt } from '@/components/PWAInstallPrompt';
import { TransmissionMonitor } from '@/modules/distribution/components/TransmissionMonitor';
import { SessionTimeoutOverlay } from '@/components/shared/SessionTimeoutOverlay';
import { STANDALONE_MODULES, type ModuleId } from './constants';
import { getGatedModuleIds } from '@/config/featureFlags';
import { GatedModuleFallback } from '@/core/components/GatedModuleFallback';
import { env } from '@/config/env';
import { useURLSync } from '@/hooks/useURLSync';
import { useLocation } from 'react-router-dom';
import { useMediaQuery } from '@/hooks/useMediaQuery';
import { useMobile } from '@/hooks/useMobile';
import { GlobalKeyboardShortcuts, useGlobalShortcutsModal } from '@/components/shared/GlobalKeyboardShortcuts';
import { UnifiedCommandMenu } from '@/components/shared/UnifiedCommandMenu';
import { GlobalDropZone } from '@/components/shared/GlobalDropZone';
import { UploadQueueMonitor } from '@/components/shared/UploadQueueMonitor';
import { BackgroundJobMonitor } from '@/components/shared/BackgroundJobMonitor';
import AudioPIPPlayer from '@/components/shared/AudioPIPPlayer';
import { LoadingFallback } from '@/core/components/LoadingFallbacks';

import { cleanupLocalStorage } from '@/lib/storageHealth';
import { UpdaterMonitor } from './components/UpdaterMonitor';
import { CookieConsentBanner } from '@/components/shared/CookieConsentBanner';
import { logger } from '@/utils/logger';
import '@/core/i18n'; // Initialize i18next — must run before any component renders
import { FirstRunTour } from '@/components/shared/FirstRunTour';
import { AgentFeedbackWidget } from '@/components/ui/AgentFeedbackWidget';
import { TaskPlanWidget } from './components/TaskPlanWidget';
import { AgentCanvasPanel } from './components/AgentCanvasPanel';

// ============================================================================
// Lazy-loaded Module Components
// ============================================================================

const CreativeStudio = lazy(() => import('../modules/creative/CreativeStudio'));
const LegalDashboard = lazy(() => import('../modules/legal/LegalDashboard'));
const MarketingDashboard = lazy(() => import('../modules/marketing/MarketingDashboard'));
const VideoStudio = lazy(() => import('../modules/video/VideoStudioContainer'));
const WorkflowLab = lazy(() => import('../modules/workflow/WorkflowLab'));
const Dashboard = lazy(() => import('../modules/dashboard/Dashboard'));
const KnowledgeBase = lazy(() => import('../modules/knowledge/KnowledgeBase'));
const RoadManager = lazy(() => import('../modules/touring/RoadManager'));
const SocialDashboard = lazy(() => import('../modules/social/SocialDashboard'));
const BrandManager = lazy(() => import('../modules/marketing/components/BrandManager'));
const CampaignDashboard = lazy(() => import('../modules/marketing/components/CampaignDashboard'));
const PublicistDashboard = lazy(() => import('../modules/publicist/PublicistDashboard'));
const PublishingDashboard = lazy(() => import('../modules/publishing/PublishingDashboard'));
const FinanceDashboard = lazy(() => import('../modules/finance/FinanceDashboard'));
const LicensingDashboard = lazy(() => import('../modules/licensing/LicensingDashboard'));
const OnboardingPage = lazy(() => import('../modules/onboarding/pages/OnboardingPage'));
// Showroom integrated into Merchandise
const AgentDashboard = lazy(() => import('../modules/agent/components/AgentDashboard'));
const DistributionDashboard = lazy(() => import('../modules/distribution/DistributionDashboard'));

const FileDashboard = lazy(() => import('../modules/files/FileDashboard'));
const MerchStudio = lazy(() => import('../modules/merchandise/MerchStudio'));
const AudioAnalyzer = lazy(() => import('../modules/tools/AudioAnalyzer'));
const ObserverabilityDashboard = lazy(() => import('../modules/observability/ObservabilityDashboard'));
const HistoryDashboard = lazy(() => import('../modules/history/HistoryDashboard'));
const MultimodalGauntlet = lazy(() => import('../modules/debug/MultimodalGauntlet'));
const InvestorPortal = lazy(() => import('../modules/investor/InvestorPortal'));
const GhostCapture = lazy(() => import('../modules/capture/GhostCapture'));
const MemoryDashboard = lazy(() => import('../modules/memory/MemoryDashboard'));
const MarketplaceModule = lazy(() => import('../modules/marketplace'));
const SelectOrg = lazy(() => import('../modules/select-org/SelectOrg'));
const SettingsPanel = lazy(() => import('../modules/settings/SettingsPanel'));
const MobileRemote = lazy(() => import('../modules/mobile-remote/MobileRemote'));
const GrowthIntelligenceDashboard = lazy(() => import('../modules/analytics/GrowthIntelligenceDashboard'));
const DesktopDashboard = lazy(() => import('../modules/desktop/DesktopDashboard'));
const FoundersCheckout = lazy(() => import('../modules/founders/FoundersCheckout'));
const VideoPopout = lazy(() => import('../modules/video/editor/VideoPopout'));
const RegistrationCenter = lazy(() => import('../modules/registration/RegistrationCenter'));

// ============================================================================
// Module Router - Maps module IDs to components
// ============================================================================

// Use flexible type to accommodate different component prop signatures
const MODULE_COMPONENTS: Partial<Record<ModuleId, React.LazyExoticComponent<React.ComponentType<any>>>> = {
    'dashboard': Dashboard,
    'creative': CreativeStudio,
    'video': VideoStudio,
    'legal': LegalDashboard,
    'marketing': MarketingDashboard,
    'workflow': WorkflowLab,
    'knowledge': KnowledgeBase,
    'road': RoadManager,
    'social': SocialDashboard,
    'brand': BrandManager,
    'campaign': CampaignDashboard,
    'publicist': PublicistDashboard,
    'publishing': PublishingDashboard,
    'finance': FinanceDashboard,
    'licensing': LicensingDashboard,
    // 'showroom': Showroom, // Removed
    'onboarding': OnboardingPage,
    'agent': AgentDashboard,
    'files': FileDashboard,
    'distribution': DistributionDashboard,
    'merch': MerchStudio,
    'marketplace': MarketplaceModule,
    'audio-analyzer': AudioAnalyzer,
    'observability': ObserverabilityDashboard,
    'select-org': SelectOrg,
    'history': HistoryDashboard,
    'debug': MultimodalGauntlet,
    'investor': InvestorPortal,
    'capture': GhostCapture,
    'memory': MemoryDashboard,
    'settings': SettingsPanel,
    'mobile-remote': MobileRemote,
    'analytics': GrowthIntelligenceDashboard,
    'desktop': DesktopDashboard,
    'founders-checkout': FoundersCheckout,
    'video-popout': VideoPopout,
    'registration': RegistrationCenter,
};

// ============================================================================
// Helper Components
// ============================================================================

// Replaced inline LoadingFallback with external module-specific fallbacks


function DevPortWarning() {
    const port = window.location.port;
    if (!import.meta.env.DEV || port === '4242') return null;

    return (
        <div className="fixed bottom-4 right-4 z-[9999] bg-red-600 text-white px-3 py-2 rounded-lg shadow-lg text-xs font-bold border border-red-400 animate-pulse">
            Wrong Port: {port}
            <br />
            <span className="font-normal opacity-80">Use :4242 for Studio</span>
        </div>
    );
}

// ============================================================================
// Custom Hooks
// ============================================================================

function useAppInitialization() {
    // ⚡ Bolt Optimization: useShallow
    const { initializeAuthListener, loadUserProfile, user, initializeHistory, loadProjects } = useStore(
        useShallow(state => ({
            initializeAuthListener: state.initializeAuthListener,
            loadUserProfile: state.loadUserProfile,
            user: state.user,
            initializeHistory: state.initializeHistory,
            loadProjects: state.loadProjects
        }))
    );

    // 1. Initialize Auth Listener (Firebase)
    useEffect(() => {
        // Log removed (Platinum Polish)
        const unsubscribe = initializeAuthListener();

        return () => {
            unsubscribe();
        };
    }, [initializeAuthListener]);


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

            // Initialize Push Notification foreground listener — shows toasts for incoming push messages
            let pushUnsub: (() => void) | null = null;
            import('@/services/notifications/PushNotificationService').then(({ pushNotificationService }) => {
                if (isMounted) {
                    pushUnsub = pushNotificationService.onForegroundMessage((payload) => {
                        logger.info('[App] Push notification received in foreground:', payload?.notification?.title);
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
                        logger.info('[App] Remote handoff detected:', state.activeRoute);
                        // Could show a toast here to let user resume from another device
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

    // 4. Sidecar Health Listener (Electron only)
    useEffect(() => {
        const { setSidecarStatus } = useStore.getState();

        // window.electronAPI is only available in the Electron environment
        if (window.electronAPI?.sidecar?.onStatusUpdate) {
            const removeListener = window.electronAPI.sidecar.onStatusUpdate((status) => {
                setSidecarStatus(status as import('@/core/store/slices/sidecarSlice').SidecarStatus);
            });
            return () => removeListener();
        }
    }, []);

    // 5. Network Status Listener
    useEffect(() => {
        const { setIsOffline } = useStore.getState();
        const handleOnline = () => setIsOffline(false);
        const handleOffline = () => setIsOffline(true);

        window.addEventListener('online', handleOnline);
        window.addEventListener('offline', handleOffline);

        return () => {
            window.removeEventListener('online', handleOnline);
            window.removeEventListener('offline', handleOffline);
        };
    }, []);
}


// Modules that require a verified (non-anonymous) account
const COMMERCIAL_MODULES = new Set<ModuleId>([
    'distribution', 'finance', 'licensing', 'merch', 'publishing',
]);

function useOnboardingRedirect() {
    const { user, authLoading, currentModule, setModule, userProfile } = useStore(
        useShallow(s => ({
            user: s.user,
            authLoading: s.authLoading,
            currentModule: s.currentModule,
            setModule: s.setModule,
            userProfile: s.userProfile,
        }))
    );

    useEffect(() => {
        // Item 388: Set/clear Sentry user context on auth state change
        if (user) {
            setSentryUser(user.uid, user.email ?? undefined);
        } else if (!authLoading) {
            clearSentryUser();
        }
    }, [user, authLoading]);

    useEffect(() => {
        if (authLoading || !user) return;

        // Already on onboarding — no redirect needed
        if (currentModule === 'onboarding') return;

        // Never intercept standalone modules (indiiREMOTE, investor, capture, etc.)
        // Users navigating directly to /mobile-remote should land there, not onboarding
        if (STANDALONE_MODULES.includes(currentModule as ModuleId)) return;

        // Honor env var bypass (dev convenience)
        if (env.skipOnboarding) return;

        // Redirect anonymous users away from commercial modules — show GuestGate instead.
        // IMPORTANT: Do NOT redirect anon users to onboarding for non-commercial modules.
        // This was the root cause of BUG-003: the old code redirected anon users
        // to onboarding from modules like Audio Analyzer, Workflow, Social, etc.
        if (user.isAnonymous && COMMERCIAL_MODULES.has(currentModule as ModuleId)) {
            // GuestGate is rendered by ModuleRenderer, no redirect needed
            return;
        }

        // Anonymous/guest users should NEVER be redirected to onboarding for
        // the pending-profile check. They don't have persistent Firestore profiles,
        // so `id === 'pending'` may persist indefinitely. Let them explore freely.
        if (user.isAnonymous) return;

        // Only redirect genuinely new *authenticated* users whose profile hasn't loaded
        // from Firestore yet. Once the profile resolves (id !== 'pending'), the user
        // is a returning user — never trap them.
        // The localStorage escape hatch prevents loops for users who intentionally skip.
        const profileStillPending = userProfile?.id === 'pending';
        const hasExplicitlySkipped = typeof window !== 'undefined' && localStorage.getItem('onboarding_dismissed') === 'true';

        if (profileStillPending && !hasExplicitlySkipped) {
            setModule('onboarding');
        }
    }, [user, authLoading, currentModule, setModule, userProfile]);
}

// Module Renderer and App Component follow

// ============================================================================
// Module Renderer Component
// ============================================================================

interface ModuleRendererProps {
    moduleId: ModuleId;
}

/**
 * Renders the correct module component for a given module ID.
 * Self-parses subPath from the URL to handle 404s for invalid deep links
 * (e.g. /agent/999 where 999 is not a real agent).
 */
function GuestGate({ onUpgrade }: { onUpgrade: () => void }) {
    return (
        <div className="flex flex-col items-center justify-center h-full gap-6 text-gray-400 px-6 text-center">
            <div className="text-5xl">🔒</div>
            <div className="text-xl font-semibold text-gray-200">Account required</div>
            <p className="text-sm text-gray-500 max-w-xs">
                This feature requires a free account. Sign up in seconds to unlock distribution, finance, licensing, and more.
            </p>
            <button
                onClick={onUpgrade}
                className="px-6 py-2.5 bg-purple-600 hover:bg-purple-500 text-white rounded-lg text-sm font-semibold transition-colors"
            >
                Create Free Account
            </button>
        </div>
    );
}

function ModuleRenderer({ moduleId }: ModuleRendererProps) {
    const location = useLocation();
    const subPath = useMemo(() => {
        const segments = location.pathname.split('/').filter(Boolean);
        return segments.length > 1 ? segments[1] : undefined;
    }, [location.pathname]);

    const { user, setModule } = useStore(
        useShallow(s => ({ user: s.user, setModule: s.setModule }))
    );

    const ModuleComponent = MODULE_COMPONENTS[moduleId];

    if (!ModuleComponent) {
        return (
            <div className="flex flex-col items-center justify-center h-full gap-4 text-gray-400">
                <div className="text-6xl">404</div>
                <div className="text-xl font-semibold text-gray-300">Module not found</div>
                <div className="text-sm text-gray-500">The page <code className="text-purple-400">/{moduleId}</code> doesn't exist.</div>
            </div>
        );
    }

    // Pre-launch feature gate: block direct URL navigation to gated modules
    const gatedModules = getGatedModuleIds();
    if (gatedModules.has(moduleId)) {
        return <GatedModuleFallback moduleName={moduleId} />;
    }

    // Check for invalid sub-paths: if the URL has a sub-segment that is purely numeric
    // (e.g. /agent/999), it's an invalid deep link - show a 404 rather than silently
    // rendering the parent module, which confuses users and Chaos tests.
    if (subPath && /^\d+$/.test(subPath)) {
        return (
            <div className="flex flex-col items-center justify-center h-full gap-4 text-gray-400">
                <div className="text-6xl">404</div>
                <div className="text-xl font-semibold text-gray-300">Not found</div>
                <div className="text-sm text-gray-500">
                    <code className="text-purple-400">/{moduleId}/{subPath}</code> doesn't exist.
                </div>
            </div>
        );
    }

    // Gate commercial modules for anonymous/guest users — bypass in dev/E2E if onboarding is skipped
    if (user?.isAnonymous && COMMERCIAL_MODULES.has(moduleId) && !env.skipOnboarding) {
        return <GuestGate onUpgrade={() => setModule('onboarding')} />;
    }

    // Special case for creative studio which needs initialMode prop
    if (moduleId === 'creative') {
        return <ModuleComponent initialMode="image" />;
    }

    return <ModuleComponent />;
}

// ============================================================================
// Main App Component
// ============================================================================

export default function App() {
    // ⚡ Bolt Optimization: useShallow
    const { currentModule, user, authLoading } = useStore(
        useShallow(state => ({
            currentModule: state.currentModule,
            user: state.user,
            authLoading: state.authLoading,
        }))
    );

    // Defer non-critical startup work to avoid blocking FCP
    useEffect(() => { cleanupLocalStorage(); }, []);

    // Initialize app
    useAppInitialization();
    useOnboardingRedirect();
    // URL sync: self-guards on authLoading internally, safe to call unconditionally here
    useURLSync();
    const shortcutsModal = useGlobalShortcutsModal();

    // 📱 Remote Relay: Listen for phone commands and process them through the desktop's agent pipeline
    useRemoteCommandListener();

    // Determine if current module should show chrome (sidebar, command bar, etc.)
    const showChrome = useMemo(
        () => !STANDALONE_MODULES.includes(currentModule as ModuleId),
        [currentModule]
    );

    // SSR-safe media query for desktop detection
    const isDesktop = useMediaQuery('(min-width: 768px)');
    const { isAnyPhone } = useMobile();

    // 📱 Phone auto-route: on phones, the app IS indiiREMOTE — skip the studio entirely
    useEffect(() => {
        if (isAnyPhone && currentModule !== 'mobile-remote') {
            useStore.getState().setModule('mobile-remote');
        }
    }, [isAnyPhone, currentModule]);

    // Gate: Block ALL rendering until Firebase onAuthStateChanged has fired at least once.
    // This prevents the app from flashing <LoginForm/> on page reload before the user\'s
    // IndexedDB session is re-hydrated. authLoading starts as `true` and is set to `false`
    // exactly once by initializeAuthListener\'s onAuthStateChanged callback.
    if (authLoading) {
        return <LoadingFallback />;
    }

    if (!user) {
        return <LoginForm />;
    }

    return (
        // Item 276: MotionConfig reducedMotion="user" causes all Framer Motion
        // animations to respect the OS prefers-reduced-motion setting globally.
        <MotionConfig reducedMotion="user">
            <VoiceProvider>
                <ThemeProvider>
                    <ToastProvider>
                        <OfflineBanner />
                        <SessionTimeoutOverlay />
                        {/* Skip to content link for keyboard accessibility */}
                        <a
                            href="#main-content"
                            className="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:top-4 focus:left-4 focus:px-4 focus:py-2 focus:bg-purple-600 focus:text-white focus:rounded-lg focus:shadow-lg"
                        >
                            Skip to content
                        </a>

                        {/* AuthWrapper handles session persistence */}
                        <div className="flex h-screen w-screen bg-background text-foreground overflow-hidden" data-testid="app-container">
                            <GlobalDropZone>
                                <ShareTargetHandler />
                                <BiometricGate>
                                    <div className="flex w-full h-full">
                                        {/* Left Sidebar - Hidden for standalone modules */}
                                        {showChrome && (
                                            <div className="hidden md:block h-full">
                                                <ErrorBoundary>
                                                    <Sidebar />
                                                </ErrorBoundary>
                                            </div>
                                        )}

                                        <main id="main-content" className="flex-1 flex flex-col min-w-0 bg-background relative z-0">
                                            {/* Module Ambient Background */}
                                            <ModuleAmbientBackground />

                                            {/* Mobile Header — phone only */}
                                            {showChrome && (
                                                <MobileHeader />
                                            )}

                                            <div className={`flex-1 overflow-y-auto relative z-10 custom-scrollbar ${isAnyPhone ? 'pb-[88px]' : ''}`}>
                                                {/* Item 336: ModuleErrorBoundary wraps every lazy module — shows module name in error UI */}
                                                <ModuleErrorBoundary key={currentModule} moduleName={currentModule}>
                                                    <Suspense fallback={<LoadingFallback />}>
                                                        <ModuleRenderer moduleId={currentModule as ModuleId} />
                                                    </Suspense>
                                                </ModuleErrorBoundary>
                                            </div>
                                        </main>

                                        {/* Right Panel - Hidden for standalone modules and mobile */}
                                        {showChrome && isDesktop && (
                                            <ErrorBoundary>
                                                <RightPanel />
                                            </ErrorBoundary>
                                        )}
                                    </div>
                                </BiometricGate>

                                {/* Mobile Tab Bar — replaces MobileNav FAB on phone viewports */}
                                {showChrome && (
                                    <ErrorBoundary>
                                        <MobileTabBar />
                                    </ErrorBoundary>
                                )}

                                {/* DevTools HUD - Only in Development */}
                                {import.meta.env.DEV && (
                                    <Suspense fallback={null}>
                                        <DevPortWarning />
                                    </Suspense>
                                )}

                                {/* Global Modals */}
                                <ApprovalModal />
                                <ApprovalManager />
                                <PWAInstallPrompt />
                                <TransmissionMonitor />
                                <UpdaterMonitor />

                                {/* Global Command Bar — hidden on phone viewports (chat tab handles prompt) */}
                                {showChrome && !isAnyPhone && (
                                    <ErrorBoundary>
                                        <CommandBar />
                                    </ErrorBoundary>
                                )}

                                {/* Global Command Menu (CMD+K) */}
                                <UnifiedCommandMenu />

                                {/* The Boardroom (Zen Mode) */}
                                <BoardroomModule />

                                {/* Global Upload Manager Queue */}
                                <UploadQueueMonitor />
                                <BackgroundJobMonitor />
                                <AudioPIPPlayer />

                                {/* Global Keyboard Shortcuts Help (press ?) */}
                                <GlobalKeyboardShortcuts isOpen={shortcutsModal.isOpen} onClose={shortcutsModal.close} />

                                {/* GDPR Cookie Consent Banner (Item 303) */}
                                <CookieConsentBanner />

                                {/* Item 290: First-Run Guided Tour */}
                                <FirstRunTour />

                                {/* Agent Alignment Steering Widget */}
                                <AgentFeedbackWidget />

                                {/* Agent Progress Updates (P0) — floating checklist */}
                                <TaskPlanWidget />

                                {/* Agent Canvas Panel (A2UI) — slide-out visual content */}
                                <AgentCanvasPanel />
                            </GlobalDropZone>
                        </div>
                    </ToastProvider>
                </ThemeProvider>
            </VoiceProvider>
        </MotionConfig>
    );
}
