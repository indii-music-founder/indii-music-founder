import React from 'react';
import ProjectHub from './components/ProjectHub';
import DataStorageManager from './components/DataStorageManager';
import AnalyticsView from './components/AnalyticsView';
import GlobalSettings from './components/GlobalSettings';
import ReferenceImageManager from './components/ReferenceImageManager';

import RevenueView from './components/RevenueView';

export default function Dashboard() {
    return (
        <div className="min-h-screen bg-[#0d1117] p-8 overflow-y-auto">
            <header className="mb-8">
                <h1 className="text-3xl font-bold text-white tracking-tight">Studio Headquarters</h1>
                <p className="text-gray-400 mt-1">Manage your projects, data, and global configuration.</p>
            </header>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                {/* Main Content: Projects & Finance (8 cols) */}
                <div className="lg:col-span-8 space-y-8">
                    <ProjectHub />
                    <RevenueView />
                </div>

                {/* Sidebar: Utilities (4 cols) */}
                <div className="lg:col-span-4 space-y-6">
                    <DataStorageManager />
                    <ReferenceImageManager />
                    <AnalyticsView />
                    <GlobalSettings />
                </div>
            </div>
        </div>
    );
}
