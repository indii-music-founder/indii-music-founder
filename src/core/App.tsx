import { lazy, Suspense, useEffect, useMemo, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useStore } from './store';
import Sidebar from './components/Sidebar';
import RightPanel from './components/RightPanel';
import CommandBar from './components/CommandBar';
import { ToastProvider } from './context/ToastContext';
import { VoiceProvider } from './context/VoiceContext';
import { ThemeProvider } from './context/ThemeContext';
import { ErrorBoundary } from './components/ErrorBoundary';
import { MobileNav } from './components/MobileNav';
import LoginForm from './components/auth/LoginForm';
import { ApiKeyErrorModal } from './components/ApiKeyErrorModal';
import { ApprovalModal } from './components/ApprovalModal';
import { BiometricGate } from './components/auth/BiometricGate';
import { ShareTargetHandler } from '@/core/components/ShareTargetHandler';
import { ApprovalManager } from '@/components/instruments/InstrumentApprovalModal';

import { PWAInstallPrompt } from '@/components/PWAInstallPrompt';
import { TransmissionMonitor } from '@/modules/distribution/components/TransmissionMonitor';
import { STANDALONE_MODULES, type ModuleId } from './constants';
import { env } from '@/config/env';
import { useURLSync } from '@/hooks/useURLSync';
import { useLocation } from 'react-router-dom';
import { useMediaQuery } from '@/hooks/useMediaQuery';
import { GlobalKeyboardShortcuts, useGlobalShortcutsModal } from '@/components/shared/GlobalKeyboardShortcuts';
import { UnifiedCommandMenu } from '@/components/shared/UnifiedCommandMenu';
import { LoadingFallback } from '@/core/components/LoadingFallbacks';
import { ErrorButton } from './components/debug/ErrorButton';
import { cleanupLocalStorage } from '@/lib/storageHealth';

cleanupLocalStorage();

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

const FilePreview = lazy(() => import('../modules/files/FilePreview'));
const MerchStudio = lazy(() => import('../modules/merchandise/MerchStudio'));
const AudioAnalyzer = lazy(() => import('../modules/tools/AudioAnalyzer'));
const ObserverabilityDashboard = lazy(() => import('../modules/observability/ObservabilityDashboard'));
const HistoryDashboard = lazy(() => import('../modules/history/HistoryDashboard'));
const MultimodalGauntlet = lazy(() => import('../modules/debug/MultimodalGauntlet'));
const InvestorPortal = lazy(() => import('../modules/investor/InvestorPortal'));
const GhostCapture = lazy(() => import('../modules/capture/GhostCapture'));

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
    'files': FilePreview,
    'distribution': DistributionDashboard,
    'merch': MerchStudio,
    'audio-analyzer': AudioAnalyzer,
    'history': HistoryDashboard,
    'debug': MultimodalGauntlet,
    'investor': InvestorPortal,
    'capture': GhostCapture,
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
            // Log removed (Platinum Polish)
            initializeHistory();
            loadProjects();

            // Re-enable Agent if needed, but keep closed by default
            useStore.setState({ isAgentOpen: false });

            // Initialize Proactive Service (Start Polling) — requires auth
            import('@/services/agent/ProactiveService').then(({ proactiveService }) => {
                proactiveService.start();
            });

            // Initialize Asset Observer — requires auth for Firestore subscriptions
            import('@/services/agent/AssetObserver').then(({ assetObserver }) => {
                assetObserver.initialize();
            });

            return () => {
                import('@/services/agent/ProactiveService').then(({ proactiveService }) => {
                    proactiveService.dispose();
                });
                import('@/services/agent/AssetObserver').then(({ assetObserver }) => {
                    assetObserver.stop();
                });
            };
        }
    }, [user, initializeHistory, loadProjects]);

    // 4. Sidecar Health Listener (Electron only)
    useEffect(() => {
        const { setSidecarStatus } = useStore.getState();

        // window.electronAPI is only available in the Electron environment
        // @ts-ignore
        if (window.electronAPI?.on) {
            // @ts-ignore
            const removeListener = window.electronAPI.on('sidecar:status-update', (status: any) => {
                setSidecarStatus(status);
            });
            return () => removeListener();
        }
    }, []);
}


function useOnboardingRedirect() {
    const { user, authLoading, currentModule } = useStore();

    useEffect(() => {
        if (authLoading) return;

        // If not authenticated, we might want to redirect to a login screen?
        // But currently App.tsx doesn't have a specific login route visible in the code I saw.
        // It renders modules. We probably need a Login Module or Overlay.

    }, [user, authLoading, currentModule]);
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
function ModuleRenderer({ moduleId }: ModuleRendererProps) {
    const location = useLocation();
    const subPath = useMemo(() => {
        const segments = location.pathname.split('/').filter(Boolean);
        return segments.length > 1 ? segments[1] : undefined;
    }, [location.pathname]);

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
            authLoading: state.authLoading
        }))
    );

    // Initialize app
    useAppInitialization();
    useOnboardingRedirect();
    // URL sync: self-guards on authLoading internally, safe to call unconditionally here
    useURLSync();
    const shortcutsModal = useGlobalShortcutsModal();

    // Determine if current module should show chrome (sidebar, command bar, etc.)
    const showChrome = useMemo(
        () => !STANDALONE_MODULES.includes(currentModule as ModuleId),
        [currentModule]
    );

    // SSR-safe media query for desktop detection
    const isDesktop = useMediaQuery('(min-width: 768px)');

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
        <VoiceProvider>
            <ThemeProvider>
                <ToastProvider>
                    {/* Skip to content link for keyboard accessibility */}
                    <a
                        href="#main-content"
                        className="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:top-4 focus:left-4 focus:px-4 focus:py-2 focus:bg-purple-600 focus:text-white focus:rounded-lg focus:shadow-lg"
                    >
                        Skip to content
                    </a>

                    {/* AuthWrapper handles session persistence */}
                    <div className="flex h-screen w-screen bg-background text-foreground overflow-hidden" data-testid="app-container">
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

                                <main id="main-content" className="flex-1 flex flex-col min-w-0 bg-background relative">
                                    <div className="flex-1 overflow-y-auto relative custom-scrollbar">
                                        <ErrorBoundary>
                                            <Suspense fallback={<LoadingFallback />}>
                                                <ModuleRenderer moduleId={currentModule as ModuleId} />
                                            </Suspense>
                                        </ErrorBoundary>
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

                        {/* Mobile Navigation - Hidden for standalone modules */}
                        {showChrome && (
                            <ErrorBoundary>
                                <MobileNav />
                            </ErrorBoundary>
                        )}

                        {/* DevTools HUD - Only in Development */}
                        {import.meta.env.DEV && (
                            <Suspense fallback={null}>
                                <DevPortWarning />
                                <ErrorButton />
                            </Suspense>
                        )}

                        {/* Global Modals */}
                        <ApprovalModal />
                        <ApprovalManager />
                        <PWAInstallPrompt />
                        <TransmissionMonitor />

                        {/* Global Command Bar */}
                        {showChrome && (
                            <ErrorBoundary>
                                <CommandBar />
                            </ErrorBoundary>
                        )}

                        {/* Global Command Menu (CMD+K) */}
                        <UnifiedCommandMenu />

                        {/* Global Keyboard Shortcuts Help (press ?) */}
                        <GlobalKeyboardShortcuts isOpen={shortcutsModal.isOpen} onClose={shortcutsModal.close} />
                    </div>
                </ToastProvider>
            </ThemeProvider>
        </VoiceProvider >
    );
}
