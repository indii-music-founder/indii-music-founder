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

import CommandBar from './components/CommandBar';
import { ToastProvider } from './context/ToastContext';

export default function App() {
    const { currentModule, initializeHistory } = useStore();
    console.log('App: Render, currentModule:', currentModule);

    useEffect(() => {
        initializeHistory();
        useStore.setState({ isAgentOpen: false });
    }, []);

    return (
        <ToastProvider>
            <div className="flex h-screen w-screen bg-surface text-white overflow-hidden font-sans">
                <CommandBar />
                {currentModule !== 'select-org' && <Sidebar />}

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
                    </Suspense>
                </main>
            </div>
        </ToastProvider>
    );
}
