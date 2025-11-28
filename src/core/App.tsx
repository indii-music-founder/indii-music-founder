import React from 'react';
import { useStore } from './store';
import Sidebar from './components/Sidebar';

// Lazy load modules
const CreativeStudio = React.lazy(() => import('../modules/creative/CreativeStudio'));
const LegalDashboard = React.lazy(() => import('../modules/legal/LegalDashboard'));

export default function App() {
    const { currentModule } = useStore();

    return (
        <div className="flex h-screen w-screen bg-black text-white overflow-hidden font-sans">
            <Sidebar />

            <main className="flex-1 relative overflow-hidden flex flex-col">
                <React.Suspense fallback={<div className="flex items-center justify-center h-full text-gray-500">Loading Module...</div>}>
                    {currentModule === 'creative' && <CreativeStudio />}
                    {currentModule === 'legal' && <LegalDashboard />}
                    {currentModule === 'music' && (
                        <div className="flex items-center justify-center h-full text-gray-500">
                            <div className="text-center">
                                <h2 className="text-2xl font-bold mb-2">Music Department</h2>
                                <p>Coming Soon</p>
                            </div>
                        </div>
                    )}
                    {currentModule === 'marketing' && (
                        <div className="flex items-center justify-center h-full text-gray-500">
                            <div className="text-center">
                                <h2 className="text-2xl font-bold mb-2">Marketing Department</h2>
                                <p>Coming Soon</p>
                            </div>
                        </div>
                    )}
                </React.Suspense>
            </main>
        </div>
    );
}
