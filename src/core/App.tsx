import { lazy, Suspense, useEffect } from 'react';
import { useStore } from './store';
import Sidebar from './components/Sidebar';

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

import CommandBar from './components/CommandBar';
import { ToastProvider } from './context/ToastContext';
import { ErrorBoundary } from './components/ErrorBoundary';

import { MobileNav } from './components/MobileNav';

export default function App() {
    const { currentModule, initializeHistory, initializeAuth, loadProjects } = useStore();
    console.log('App: Render, currentModule:', currentModule);

    useEffect(() => {
        initializeAuth();
        initializeHistory();
        loadProjects();
        useStore.setState({ isAgentOpen: false });
    }, []);

    return (
        <ToastProvider>
            <ErrorBoundary>
                <div className="flex h-screen w-screen bg-surface text-white overflow-hidden font-sans">
                    <CommandBar />
                    {currentModule !== 'select-org' && (
                        <div className="hidden md:block">
                            <Sidebar />
                        </div>
                    )}

                    <main className="flex-1 relative overflow-hidden flex flex-col pb-16 md:pb-0">
                        <Suspense fallback={<div className="flex items-center justify-center h-full text-gray-500">Loading Module...</div>}>
                            {currentModule === 'select-org' && <SelectOrg />}
                            {currentModule === 'dashboard' && <Dashboard />}
                            {currentModule === 'creative' && <CreativeStudio />}
                            {currentModule === 'legal' && <LegalDashboard />}
                            {currentModule === 'music' && <MusicStudio />}
                            {currentModule === 'marketing' && <MarketingDashboard />}
                            {currentModule === 'video' && <VideoStudio />}
                            {currentModule === 'workflow' && <WorkflowLab />}
                            {currentModule === 'knowledge' && <KnowledgeBase />}
                        </Suspense>
                    </main>

                    {/* Mobile Navigation */}
                    {currentModule !== 'select-org' && <MobileNav />}
                </div>
            </ErrorBoundary>
        </ToastProvider>
    );
}
