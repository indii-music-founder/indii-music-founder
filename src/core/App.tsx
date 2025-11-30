import React from 'react';
import { useStore } from './store';
import Sidebar from './components/Sidebar';

// Lazy load modules
const CreativeStudio = React.lazy(() => import('../modules/creative/CreativeStudio'));
const MusicStudio = React.lazy(() => import('../modules/music/MusicStudio'));
const LegalDashboard = React.lazy(() => import('../modules/legal/LegalDashboard'));
const MarketingDashboard = React.lazy(() => import('../modules/marketing/MarketingDashboard'));
const VideoStudio = React.lazy(() => import('../modules/video/VideoStudio'));
const WorkflowLab = React.lazy(() => import('../modules/workflow/WorkflowLab'));
const Dashboard = React.lazy(() => import('../modules/dashboard/Dashboard'));

import CommandBar from './components/CommandBar';
import { ToastProvider } from './context/ToastContext';

export default function App() {
    const { currentModule, initializeHistory } = useStore();

    React.useEffect(() => {
        initializeHistory();
        useStore.setState({ isAgentOpen: false });
    }, []);

    return (
        <ToastProvider>
            <div className="flex h-screen w-screen bg-surface text-white overflow-hidden font-sans">
                <CommandBar />
                <Sidebar />

                <main className="flex-1 relative overflow-hidden flex flex-col pb-16 md:pb-0">
                    <React.Suspense fallback={<div className="flex items-center justify-center h-full text-gray-500">Loading Module...</div>}>
                        {currentModule === 'dashboard' && <Dashboard />}
                        {currentModule === 'creative' && <CreativeStudio />}
                        {currentModule === 'legal' && <LegalDashboard />}
                        {currentModule === 'music' && <MusicStudio />}
                        {currentModule === 'marketing' && <MarketingDashboard />}
                        {currentModule === 'video' && <VideoStudio />}
                        {currentModule === 'workflow' && <WorkflowLab />}
                    </React.Suspense>
                </main>
            </div>
        </ToastProvider>
    );
}
