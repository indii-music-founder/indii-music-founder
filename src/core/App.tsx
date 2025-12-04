import { lazy, Suspense, useEffect } from 'react';
import { useStore } from './store';
import Sidebar from './components/Sidebar';
import RightPanel from './components/RightPanel';

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

import CommandBar from './components/CommandBar';
import { ToastProvider } from './context/ToastContext';
import { ErrorBoundary } from './components/ErrorBoundary';

import { MobileNav } from './components/MobileNav';
import { ApiKeyErrorModal } from './components/ApiKeyErrorModal';

import AgentWindow from './components/AgentWindow';

export default function App() {
    const { currentModule, initializeHistory, initializeAuth, loadProjects } = useStore();

    useEffect(() => {
        initializeAuth();
        initializeHistory();
        loadProjects();
        useStore.setState({ isAgentOpen: false });

        // Handle direct navigation to /select-org
        if (window.location.pathname === '/select-org') {
            useStore.setState({ currentModule: 'select-org' });
        }
    }, []);

    return (
        <ToastProvider>
            <ErrorBoundary>
                <div className="flex h-screen w-screen bg-[#0d1117] text-white overflow-hidden font-sans">
                    <ApiKeyErrorModal />
                    <AgentWindow />

                    {/* Left Sidebar */}
                    {currentModule !== 'select-org' && (
                        <div className="hidden md:block h-full">
                            <Sidebar />
                        </div>
                    )}

                    {/* Main Content Area */}
                    <main className="flex-1 flex flex-col min-w-0 bg-[#0d1117] relative">
                        <div className="flex-1 overflow-y-auto relative custom-scrollbar">
                            <Suspense fallback={<div className="flex items-center justify-center h-full text-gray-500">Loading Module...</div>}>
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
                            </Suspense>
                        </div>

                        {/* Command Bar at Bottom */}
                        {currentModule !== 'select-org' && (
                            <div className="flex-shrink-0 z-10">
                                <CommandBar />
                            </div>
                        )}
                    </main>

                    {/* Right Panel */}
                    {currentModule !== 'select-org' && (
                        <RightPanel />
                    )}

                    {/* Mobile Navigation */}
                    {currentModule !== 'select-org' && <MobileNav />}
                </div>
            </ErrorBoundary>
        </ToastProvider>
    );
}
