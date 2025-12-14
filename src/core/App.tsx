import { lazy, Suspense, useEffect, useMemo } from 'react';
import { useStore } from './store';
import Sidebar from './components/Sidebar';
import RightPanel from './components/RightPanel';
import CommandBar from './components/CommandBar';
import { ToastProvider } from './context/ToastContext';
import { ErrorBoundary } from './components/ErrorBoundary';
import { MobileNav } from './components/MobileNav';
import { ApiKeyErrorModal } from './components/ApiKeyErrorModal';
import ChatOverlay from './components/ChatOverlay';
import { AuthLogin } from './components/AuthLogin';
import { STANDALONE_MODULES, type ModuleId } from './constants';
import { env } from '@/config/env';

// ============================================================================
// Lazy-loaded Module Components
// ============================================================================

const CreativeStudio = lazy(() => import('../modules/creative/CreativeStudio'));
const MusicStudio = lazy(() => import('../modules/music/MusicStudio'));
const LegalDashboard = lazy(() => import('../modules/legal/LegalDashboard'));
const MarketingDashboard = lazy(() => import('../modules/marketing/MarketingDashboard'));
const VideoStudio = lazy(() => import('../modules/video/VideoStudio'));
const WorkflowLab = lazy(() => import('../modules/workflow/WorkflowLab'));
const Dashboard = lazy(() => import('../modules/dashboard/Dashboard'));
const SelectOrg = lazy(() => import('../modules/auth/SelectOrg'));
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
const Showroom = lazy(() => import('../modules/showroom/Showroom'));

// Dev-only components
const TestPlaybookPanel = lazy(() => import('./dev/TestPlaybookPanel'));
const AudioStressTest = lazy(() => import('../dev/AudioStressTest'));

// ============================================================================
// Module Router - Maps module IDs to components
// ============================================================================

// Use flexible type to accommodate different component prop signatures
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const MODULE_COMPONENTS: Partial<Record<ModuleId, React.LazyExoticComponent<React.ComponentType<any>>>> = {
    'dashboard': Dashboard,
    'creative': CreativeStudio,
    'video': VideoStudio,
    'music': MusicStudio,
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
    'showroom': Showroom,
    'onboarding': OnboardingPage,
    'select-org': SelectOrg,
};

// ============================================================================
// Helper Components
// ============================================================================

function LoadingFallback() {
    return (
        <div className="flex items-center justify-center h-full text-gray-500">
            Loading Module...
        </div>
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
    const { initializeAuth, initializeHistory, loadProjects, isAuthReady, isAuthenticated } = useStore();

    // Initialize auth on mount
    useEffect(() => {
        initializeAuth();

        // Handle direct navigation to /select-org
        if (window.location.pathname === '/select-org') {
            useStore.setState({ currentModule: 'select-org' });
        }

        // Reset agent open state on mount
        useStore.setState({ isAgentOpen: false });
    }, [initializeAuth]);

    // Load data when authenticated
    useEffect(() => {
        if (isAuthenticated && isAuthReady) {
            console.log('[App] User authenticated, loading data...');
            initializeHistory();
            loadProjects();
        }
    }, [isAuthenticated, isAuthReady, initializeHistory, loadProjects]);
}

function useOnboardingRedirect() {
    const { isAuthReady, isAuthenticated, currentModule } = useStore();

    useEffect(() => {
        if (!isAuthenticated || !isAuthReady) return;

        const state = useStore.getState();
        const isTestMode = typeof window !== 'undefined' && '__TEST_MODE__' in window;

        // Skip onboarding in dev mode if flag is set
        if (env.skipOnboarding && !state.userProfile?.bio) {
            console.log('[App] DevEx: Skipping onboarding via env flag');
            useStore.setState({
                userProfile: {
                    ...state.userProfile,
                    id: state.user?.uid || 'dev-user',
                    bio: 'Dev Mode Auto-Generated Bio',
                    preferences: '{}',
                    brandKit: state.userProfile?.brandKit || {
                        colors: [],
                        fonts: '',
                        brandDescription: '',
                        negativePrompt: '',
                        socials: {},
                        brandAssets: [],
                        referenceImages: [],
                        releaseDetails: {
                            title: '', type: 'Single', artists: '', genre: '',
                            mood: '', themes: '', lyrics: ''
                        }
                    },
                    analyzedTrackIds: [],
                    knowledgeBase: [],
                    savedWorkflows: []
                }
            });
            return;
        }

        // Redirect to onboarding if profile is incomplete
        const shouldRedirectToOnboarding =
            !state.userProfile?.bio &&
            currentModule !== 'onboarding' &&
            currentModule !== 'select-org' &&
            !isTestMode;

        if (shouldRedirectToOnboarding) {
            console.log('[App] New user detected, redirecting to onboarding');
            useStore.setState({ currentModule: 'onboarding' });
        }
    }, [isAuthenticated, isAuthReady, currentModule]);
}

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
    const { currentModule, isAuthReady, isAuthenticated } = useStore();

    // Initialize app and handle onboarding
    useAppInitialization();
    useOnboardingRedirect();

    // Log module changes in dev
    useEffect(() => {
        if (import.meta.env.DEV) {
            console.log(`[App] Current Module: ${currentModule}`);
        }
    }, [currentModule]);

    // Determine if current module should show chrome (sidebar, command bar, etc.)
    const showChrome = useMemo(
        () => !STANDALONE_MODULES.includes(currentModule as ModuleId),
        [currentModule]
    );

    return (
        <ToastProvider>
            <div className="flex h-screen w-screen bg-background text-white overflow-hidden font-sans">
                <ApiKeyErrorModal />

                {/* Left Sidebar - Hidden for standalone modules */}
                {showChrome && (
                    <div className="hidden md:block h-full">
                        <Sidebar />
                    </div>
                )}

                {/* Main Content Area */}
                <main className="flex-1 flex flex-col min-w-0 bg-background relative">
                    <div className="flex-1 overflow-y-auto relative custom-scrollbar">
                        <ErrorBoundary>
                            <Suspense fallback={<LoadingFallback />}>
                                {/* Auth Gate */}
                                {!isAuthReady || !isAuthenticated ? (
                                    <AuthLogin />
                                ) : (
                                    <ModuleRenderer moduleId={currentModule as ModuleId} />
                                )}
                            </Suspense>
                        </ErrorBoundary>
                    </div>

                    {/* Command Bar - Hidden for standalone modules */}
                    {showChrome && (
                        <div className="flex-shrink-0 z-10 relative">
                            <ErrorBoundary>
                                <ChatOverlay />
                                <CommandBar />
                            </ErrorBoundary>
                        </div>
                    )}
                </main>

                {/* Right Panel - Hidden for standalone modules */}
                {showChrome && <RightPanel />}

                {/* Mobile Navigation - Hidden for standalone modules */}
                {showChrome && <MobileNav />}

                {/* DevTools HUD - Only in Development */}
                {import.meta.env.DEV && (
                    <Suspense fallback={null}>
                        <TestPlaybookPanel />
                        <div className="fixed bottom-4 left-4 z-50">
                            <AudioStressTest />
                        </div>
                        <DevPortWarning />
                    </Suspense>
                )}
            </div>
        </ToastProvider>
    );
}
