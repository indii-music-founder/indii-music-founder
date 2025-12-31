import React, { useState } from 'react';
import { ChevronLeft, ChevronRight, Database, ImageIcon, Activity, Settings } from 'lucide-react';
import QuickActions from './components/QuickActions';
import ProjectHub from './components/ProjectHub';
import DataStorageManager from './components/DataStorageManager';
import AnalyticsView from './components/AnalyticsView';
import RevenueView from './components/RevenueView';
import GlobalSettings from './components/GlobalSettings';
import ReferenceImageManager from './components/ReferenceImageManager';

export default function Dashboard() {
    const [sidebarOpen, setSidebarOpen] = useState(true);

    return (
        <div className="min-h-screen bg-[#0d1117] p-8 overflow-y-auto">
            <header className="mb-8">
                <h1 className="text-3xl font-bold text-white tracking-tight">Studio Headquarters</h1>
                <p className="text-gray-400 mt-1">Manage your projects, data, and global configuration.</p>
            </header>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                {/* Main Content: Quick Actions & Projects */}
                <div className={`${sidebarOpen ? 'lg:col-span-8' : 'lg:col-span-11'} space-y-8 transition-all`}>
                    <QuickActions />
                    <ProjectHub />
                </div>

                {/* Sidebar: Utilities (collapsible) */}
                <div className={`${sidebarOpen ? 'lg:col-span-4' : 'lg:col-span-1'} transition-all`}>
                    <button
                        onClick={() => setSidebarOpen(!sidebarOpen)}
                        className="w-full flex items-center justify-center gap-2 mb-4 py-2 bg-[#161b22]/50 border border-gray-800 rounded-lg text-gray-400 hover:text-white hover:border-gray-600 transition-all"
                    >
                        {sidebarOpen ? (
                            <>
                                <ChevronRight size={16} />
                                <span className="text-xs font-medium">Collapse</span>
                            </>
                        ) : (
                            <ChevronLeft size={16} />
                        )}
                    </button>

                    {sidebarOpen ? (
                        <div className="space-y-6">
                            <DataStorageManager />
                            <ReferenceImageManager />
                            <AnalyticsView />
                            <RevenueView />
                            <GlobalSettings />
                        </div>
                    ) : (
                        <div className="space-y-3">
                            <button className="w-full p-3 bg-[#161b22]/50 border border-gray-800 rounded-lg text-gray-400 hover:text-white hover:border-gray-600 transition-all flex items-center justify-center" title="Storage">
                                <Database size={18} />
                            </button>
                            <button className="w-full p-3 bg-[#161b22]/50 border border-gray-800 rounded-lg text-gray-400 hover:text-white hover:border-gray-600 transition-all flex items-center justify-center" title="References">
                                <ImageIcon size={18} />
                            </button>
                            <button className="w-full p-3 bg-[#161b22]/50 border border-gray-800 rounded-lg text-gray-400 hover:text-white hover:border-gray-600 transition-all flex items-center justify-center" title="Analytics">
                                <Activity size={18} />
                            </button>
                            <button className="w-full p-3 bg-[#161b22]/50 border border-gray-800 rounded-lg text-gray-400 hover:text-white hover:border-gray-600 transition-all flex items-center justify-center" title="Settings">
                                <Settings size={18} />
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
