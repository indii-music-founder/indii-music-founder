import { lazy, Suspense, useEffect, useState } from 'react';
import { useStore } from './store';
import Sidebar from './components/Sidebar';
import RightPanel from './components/RightPanel';
import CommandBar from './components/CommandBar';
import { ToastProvider } from './context/ToastContext';
import { ErrorBoundary } from './components/ErrorBoundary';
import { MobileNav } from './components/MobileNav';
import { ApiKeyErrorModal } from './components/ApiKeyErrorModal';
import ChatOverlay from './components/ChatOverlay';
import TestPlaybookPanel from './dev/TestPlaybookPanel';
import AudioStressTest from '../dev/AudioStressTest';

// Lazy load modules
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

// Auth Login Component
const AuthLogin = () => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        try {
            const { signInWithEmailAndPassword } = await import('firebase/auth');
            const { auth } = await import('@/services/firebase');
            await signInWithEmailAndPassword(auth, email, password);
            // Auth listener in App will handle the rest
        } catch (err: any) {
            console.error("Login failed:", err);
            setError(err.message || "Failed to sign in");
            setLoading(false);
        }
    };

    return (
        <div className="flex flex-col items-center justify-center h-screen bg-[#0d1117] text-white p-4">
            <div className="w-full max-w-md bg-[#161b22] p-8 rounded-xl border border-[#30363d] shadow-xl">
                <div className="text-center mb-8">
                    <h2 className="text-2xl font-bold mb-2">Welcome Back</h2>
                    <p className="text-gray-400">Sign in to Indii OS Studio</p>
                </div>

                <form onSubmit={handleLogin} className="space-y-4">
                    {error && (
                        <div className="p-3 bg-red-900/30 border border-red-800 text-red-200 rounded text-sm">
                            {error}
                        </div>
                    )}

                    <div>
                        <label htmlFor="email" className="block text-sm font-medium text-gray-300 mb-1">Email</label>
                        <input
                            id="email"
                            type="email"
                            required
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            className="w-full px-4 py-2 bg-[#0d1117] border border-[#30363d] rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none text-white transition-all"
                            placeholder="name@example.com"
                        />
                    </div>

                    <div>
                        <label htmlFor="password" className="block text-sm font-medium text-gray-300 mb-1">Password</label>
                        <input
                            id="password"
                            type="password"
                            required
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            className="w-full px-4 py-2 bg-[#0d1117] border border-[#30363d] rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none text-white transition-all"
                            placeholder="••••••••"
                        />
                    </div>

                    <button
                        type="submit"
                        disabled={loading}
                        className={`w-full py-2.5 bg-blue-600 hover:bg-blue-700 rounded-lg font-medium text-white transition-all transform active:scale-95 ${loading ? 'opacity-70 cursor-not-allowed' : ''}`}
                    >
                        {loading ? (
                            <span className="flex items-center justify-center gap-2">
                                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                Signing in...
                            </span>
                        ) : 'Sign In'}
                    </button>
                </form>

                <div className="mt-6 text-center text-sm text-gray-500">
                    <button
                        type="button"
                        onClick={async () => {
                            setLoading(true);
                            try {
                                const { signInAnonymously } = await import('firebase/auth');
                                const { auth } = await import('@/services/firebase');
                                await signInAnonymously(auth);
                            } catch (err: any) {
                                console.error("[AuthLogin] Guest Login Error:", err);
                                setError(err.message);
                                setLoading(false);
                            }
                        }}
                        className="text-indigo-600 hover:text-indigo-500 font-semibold"
                    >
                        Guest Mode (Anonymous)
                    </button>
                    <p className="mt-2">Don't have an account? Please contact your administrator.</p>
                </div>
            </div>
        </div>
    );
};


import { env } from '@/config/env';

export default function App() {
    const { currentModule, initializeHistory, initializeAuth, loadProjects, isAuthReady, isAuthenticated } = useStore();

    useEffect(() => {
        initializeAuth();

        // Handle direct navigation to /select-org
        if (window.location.pathname === '/select-org') {
            useStore.setState({ currentModule: 'select-org' });
        }
    }, [initializeAuth]);

    // Data Load Effect - Only load when authenticated
    useEffect(() => {
        if (isAuthenticated && isAuthReady) {
            console.log("[App] User authenticated, loading data...", { isAuthenticated, isAuthReady });
            initializeHistory();
            loadProjects();
        }
    }, [isAuthenticated, isAuthReady, initializeHistory, loadProjects]);

    // Reset agent open state on mount
    useEffect(() => {
        useStore.setState({ isAgentOpen: false });
    }, []);

    // New User Onboarding Redirect
    useEffect(() => {
        if (isAuthenticated && isAuthReady) {
            const state = useStore.getState();

            // Check for DevEx skip flag
            if (env.skipOnboarding && !state.userProfile?.bio) {
                console.log("[App] DevEx: Skipping onboarding via env flag");
                // Mock a profile to satisfy the check
                useStore.setState({
                    userProfile: {
                        ...state.userProfile,
                        id: state.user?.uid || 'dev-user',
                        bio: 'Dev Mode Auto-Generated Bio',
                        preferences: '{}',
                        // Minimal required fields
                        brandKit: state.userProfile?.brandKit || {
                            colors: [], fonts: '', brandDescription: '', negativePrompt: '', socials: {}, brandAssets: [], referenceImages: [], releaseDetails: { title: '', type: 'Single', artists: '', genre: '', mood: '', themes: '', lyrics: '' }
                        },
                        analyzedTrackIds: [],
                        knowledgeBase: [],
                        savedWorkflows: []
                    }
                });
                return; // Skip the redirect below
            }

            // Simple check: if bio is missing, assume onboarding is needed
            // Ideally we check a specific flag, but this works for the "nuclear" reset flow
            if (!state.userProfile?.bio && currentModule !== 'onboarding' && currentModule !== 'select-org' && !(window as any).__TEST_MODE__) {
                console.log("[App] New user detected, redirecting to onboarding");
                useStore.setState({ currentModule: 'onboarding' });
            }
        }
    }, [isAuthenticated, isAuthReady, currentModule]);

    // Auth Guard - No auto-redirect loop. Just show login form if needed.
    useEffect(() => {
        if (isAuthReady && !isAuthenticated) {
            console.log("[App] Not authenticated. Showing login form.");
        }
    }, [isAuthReady, isAuthenticated]);


    useEffect(() => {
        console.log(`[App] Current Module Changed: ${currentModule}`);
    }, [currentModule]);

    return (
        <ToastProvider>
            <div className="flex h-screen w-screen bg-[#0d1117] text-white overflow-hidden font-sans">
                <ApiKeyErrorModal />
                {/* Left Sidebar */}
                {currentModule !== 'select-org' && currentModule !== 'onboarding' && currentModule !== 'dashboard' && (
                    <div className="hidden md:block h-full">
                        <Sidebar />
                    </div>
                )}

                {/* Main Content Area */}
                <main className="flex-1 flex flex-col min-w-0 bg-[#0d1117] relative">
                    <div className="flex-1 overflow-y-auto relative custom-scrollbar">
                        <ErrorBoundary>
                            <Suspense fallback={<div className="flex items-center justify-center h-full text-gray-500">Loading Module...</div>}>
                                {/* Auth Gate */}
                                {(!isAuthReady || !isAuthenticated) ? (
                                    <AuthLogin />
                                ) : (
                                    <>
                                        {currentModule === 'select-org' && <SelectOrg />}
                                        {currentModule === 'dashboard' && <Dashboard />}
                                        {currentModule === 'creative' && <CreativeStudio initialMode="image" />}
                                        {currentModule === 'legal' && <LegalDashboard />}
                                        {currentModule === 'music' && <MusicStudio />}
                                        {currentModule === 'marketing' && <MarketingDashboard />}
                                        {currentModule === 'video' && <VideoStudio />}
                                        {currentModule === 'workflow' && <WorkflowLab />}
                                        {currentModule === 'knowledge' && <KnowledgeBase />}
                                        {currentModule === 'road' && <RoadManager />}
                                        {currentModule === 'social' && <SocialDashboard />}
                                        {currentModule === 'brand' && <BrandManager />}
                                        {currentModule === 'campaign' && <CampaignDashboard />}
                                        {currentModule === 'publicist' && <PublicistDashboard />}
                                        {currentModule === 'publishing' && <PublishingDashboard />}
                                        {currentModule === 'finance' && <FinanceDashboard />}
                                        {currentModule === 'licensing' && <LicensingDashboard />}
                                        {currentModule === 'onboarding' && <OnboardingPage />}
                                        {currentModule === 'showroom' && <Showroom />}

                                        {/* Fallback for unknown modules */}
                                    </>
                                )}
                            </Suspense>
                        </ErrorBoundary>
                    </div>

                    {/* Command Bar at Bottom */}
                    {currentModule !== 'select-org' && currentModule !== 'onboarding' && currentModule !== 'dashboard' && (
                        <div className="flex-shrink-0 z-10 relative">
                            <ErrorBoundary>
                                <ChatOverlay />
                                <CommandBar />
                            </ErrorBoundary>
                        </div>
                    )}
                </main>

                {/* Right Panel */}
                {currentModule !== 'select-org' && currentModule !== 'onboarding' && currentModule !== 'dashboard' && (
                    <RightPanel />
                )}

                {/* Mobile Navigation */}
                {currentModule !== 'select-org' && currentModule !== 'onboarding' && currentModule !== 'dashboard' && <MobileNav />}

                {/* DevTools HUD - Only in Development */}
                {import.meta.env.DEV && (
                    <>
                        <TestPlaybookPanel />
                        <div className="fixed bottom-4 left-4 z-50">
                            <AudioStressTest />
                        </div>
                    </>
                )}
            </div>
        </ToastProvider>
    );
}
