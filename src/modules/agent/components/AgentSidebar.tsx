import React from 'react';
import { Map, List, Mail, Globe, Settings, ExternalLink } from 'lucide-react';

interface AgentSidebarProps {
    activeTab: 'scout' | 'campaigns' | 'inbox' | 'browser';
    setActiveTab: (tab: 'scout' | 'campaigns' | 'inbox' | 'browser') => void;
}

export const AgentSidebar: React.FC<AgentSidebarProps> = ({ activeTab, setActiveTab }) => {
    return (
        <div className="flex h-full border-r border-[--border]">
            {/* Sidebar Tabs - Narrow column for main nav */}
            <div className="w-16 bg-[--card] flex flex-col items-center py-4 border-r border-[--border] gap-6">
                <button
                    onClick={() => setActiveTab('scout')}
                    className={`p-3 rounded-xl transition-all duration-200 group relative ${activeTab === 'scout'
                        ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/20'
                        : 'text-slate-400 hover:text-white hover:bg-slate-800'
                        }`}
                    title="The Scout"
                >
                    <Map size={24} />
                    {activeTab === 'scout' && (
                        <span className="absolute left-14 top-1/2 -translate-y-1/2 bg-slate-900 text-white text-xs px-2 py-1 rounded ml-2 whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50 border border-slate-700">
                            The Scout
                        </span>
                    )}
                </button>

                <button
                    onClick={() => setActiveTab('browser')}
                    className={`p-3 rounded-xl transition-all duration-200 group relative ${activeTab === 'browser'
                        ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/20'
                        : 'text-slate-400 hover:text-white hover:bg-slate-800'
                        }`}
                    title="Browser Agent"
                >
                    <Globe size={24} />
                </button>

                <button
                    onClick={() => setActiveTab('campaigns')}
                    className={`p-3 rounded-xl transition-all duration-200 group relative ${activeTab === 'campaigns'
                        ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/20'
                        : 'text-slate-400 hover:text-white hover:bg-slate-800'
                        }`}
                    title="Campaigns"
                >
                    <List size={24} />
                </button>

                <button
                    onClick={() => setActiveTab('inbox')}
                    className={`p-3 rounded-xl transition-all duration-200 group relative ${activeTab === 'inbox'
                        ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/20'
                        : 'text-slate-400 hover:text-white hover:bg-slate-800'
                        }`}
                    title="Inbox"
                >
                    <Mail size={24} />
                </button>

                <div className="flex-1" />

                <button
                    className="p-3 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-all duration-200"
                    title="Agent Settings"
                >
                    <Settings size={22} />
                </button>
            </div>

            {/* Expanded Sidebar Helper Text - Optional context depending on tab */}
            {/* We could add an expanded drawer here if needed, similar to VideoEditorSidebar's secondary column */}
        </div>
    );
};
