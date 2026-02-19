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
import ChatOverlay from './components/ChatOverlay';
import { PWAInstallPrompt } from '@/components/PWAInstallPrompt';
import { TransmissionMonitor } from '@/modules/distribution/components/TransmissionMonitor';
import { STANDALONE_MODULES, type ModuleId } from './constants';
import { env } from '@/config/env';
import { useURLSync } from '@/hooks/useURLSync';
import { useMediaQuery } from '@/hooks/useMediaQuery';
import { GlobalKeyboardShortcuts, useGlobalShortcutsModal } from '@/components/shared/GlobalKeyboardShortcuts';
import { ErrorButton } from './components/debug/ErrorButton';

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



// ============================================================================
// Module Router - Maps module IDs to components
// ============================================================================

// Use flexible type to accommodate different component prop signatures
// eslint-disable-next-line @typescript-eslint/no-explicit-any
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
    'observability': ObservabilityDashboard,
    'history': HistoryDashboard,
    'debug': MultimodalGauntlet,
    'investor': InvestorPortal,
};

// ============================================================================
// Helper Components
// ============================================================================

function LoadingFallback() {
    const [show, setShow] = useState(false);

    useEffect(() => {
        // Delay showing the skeleton to prevent flash for fast module loads
        const timer = setTimeout(() => setShow(true), 150);
        return () => clearTimeout(timer);
    }, []);

    if (!show) {
        return null;
    }

    return (
        <div className="absolute inset-0 bg-background/95 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="h-full flex flex-col p-6 gap-4">
                {/* Header skeleton */}
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="h-8 w-8 rounded-lg bg-white/5 animate-pulse" />
                        <div className="h-5 w-40 rounded bg-white/5 animate-pulse" />
                    </div>
                    <div className="flex gap-2">
                        <div className="h-8 w-20 rounded-lg bg-white/5 animate-pulse" />
                        <div className="h-8 w-20 rounded-lg bg-white/5 animate-pulse" />
                    </div>
                </div>

                {/* Content skeleton */}
                <div className="flex-1 grid grid-cols-3 gap-4">
                    <div className="col-span-2 space-y-4">
                        <div className="h-48 rounded-xl bg-white/5 animate-pulse" />
                        <div className="grid grid-cols-2 gap-4">
                            <div className="h-32 rounded-xl bg-white/5 animate-pulse" />
                            <div className="h-32 rounded-xl bg-white/5 animate-pulse" />
                        </div>
                    </div>
                    <div className="space-y-4">
                        <div className="h-24 rounded-xl bg-white/5 animate-pulse" />
                        <div className="h-24 rounded-xl bg-white/5 animate-pulse" />
                        <div className="h-24 rounded-xl bg-white/5 animate-pulse" />
                    </div>
                </div>
            </div>
        </div>
    );
}

/**
 * ChatOverlayWrapper - Bridges store state to ChatOverlay props
 * The refactored ChatOverlay requires explicit onClose/onToggleMinimize props,
 * while the app uses isAgentOpen from the store. This wrapper connects them.
 */
function ChatOverlayWrapper() {
    const { isAgentOpen, toggleAgentWindow, isRightPanelOpen, toggleRightPanel } = useStore(
        useShallow(state => ({
            isAgentOpen: state.isAgentOpen,
            toggleAgentWindow: state.toggleAgentWindow,
            isRightPanelOpen: state.isRightPanelOpen,
            toggleRightPanel: state.toggleRightPanel
        }))
    );
    const [isMinimized, setIsMinimized] = useState(false);

    // Platinum Polish: Auto-close right panel when agent opens to prevent UI overlap
    useEffect(() => {
        if (isAgentOpen && isRightPanelOpen) {
            toggleRightPanel();
        }
    }, [isAgentOpen]);

    if (!isAgentOpen) return null;

    return (
        <ChatOverlay
            onClose={toggleAgentWindow}
            isMinimized={isMinimized}
            onToggleMinimize={() => setIsMinimized(!isMinimized)}
        />
    );
}

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

        // Initialize Proactive Service (Start Polling)
        import('@/services/agent/ProactiveService').then(({ proactiveService }) => {
            proactiveService.start();
        });

        return () => {
            unsubscribe();
            import('@/services/agent/ProactiveService').then(({ proactiveService }) => {
                proactiveService.dispose();
            });
        };
    }, [initializeAuthListener]);

    // 2. Load User Profile when User is Authenticated
    useEffect(() => {
        if (user?.uid) {
            loadUserProfile(user.uid);
        }
    }, [user, loadUserProfile]);

    // 3. Load Application Data (Projects, History) when Profile is ready
    // We assume if user exists and profile is loaded (we don't have isProfileReady yet, but let's assume loose coupling)
    useEffect(() => {
        if (user) {
            // Log removed (Platinum Polish)
            initializeHistory();
            loadProjects();

            // Re-enable Agent if needed, but keep closed by default
            useStore.setState({ isAgentOpen: false });
        }
    }, [user, initializeHistory, loadProjects]);
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

function ModuleRenderer({ moduleId }: ModuleRendererProps) {
    const ModuleComponent = MODULE_COMPONENTS[moduleId];

    if (!ModuleComponent) {
        return <div className="flex items-center justify-center h-full text-gray-500">Unknown module</div>;
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
    const shortcutsModal = useGlobalShortcutsModal();

    // Log module changes in dev


    // Determine if current module should show chrome (sidebar, command bar, etc.)
    const showChrome = useMemo(
        () => !STANDALONE_MODULES.includes(currentModule as ModuleId),
        [currentModule]
    );

    // Call URL Sync Hook (must be inside Router context, which App is)
    useURLSync();

    // SSR-safe media query for desktop detection
    const isDesktop = useMediaQuery('(min-width: 768px)');

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

                                    {showChrome && <ChatOverlayWrapper />}
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

                        {/* Global Keyboard Shortcuts Help (press ?) */}
                        <GlobalKeyboardShortcuts isOpen={shortcutsModal.isOpen} onClose={shortcutsModal.close} />
                    </div>
                </ToastProvider>
            </ThemeProvider>
        </VoiceProvider >
    );
}
