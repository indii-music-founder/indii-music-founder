import React from 'react';
import { Map, List, Mail, Globe, Settings, MessageSquare, ListTodo } from 'lucide-react';

type AgentTab = 'scout' | 'campaigns' | 'inbox' | 'browser' | 'chat' | 'tasks';

interface AgentSidebarProps {
    activeTab: AgentTab;
    setActiveTab: (tab: AgentTab) => void;
}

const NAV_ITEMS: Array<{ id: AgentTab; icon: React.ComponentType<{ size?: string | number; className?: string }>; label: string }> = [
    { id: 'scout', icon: Map, label: 'The Scout' },
    { id: 'browser', icon: Globe, label: 'Browser Agent' },
    { id: 'chat', icon: MessageSquare, label: 'Chat' },
    { id: 'tasks', icon: ListTodo, label: 'Task Queue' },
    { id: 'campaigns', icon: List, label: 'Campaigns' },
    { id: 'inbox', icon: Mail, label: 'Inbox' },
];

export const AgentSidebar: React.FC<AgentSidebarProps> = ({ activeTab, setActiveTab }) => {
    return (
        <div className="flex h-full border-r border-[--border]">
            {/* Narrow icon column */}
            <div className="w-16 bg-[--card] flex flex-col items-center py-4 border-r border-[--border] gap-2">
                {NAV_ITEMS.map(({ id, icon: Icon, label }) => (
                    <button
                        key={id}
                        onClick={() => setActiveTab(id)}
                        className={`p-3 rounded-xl transition-all duration-200 group relative ${activeTab === id
                            ? 'bg-cyan-500 text-white shadow-lg shadow-cyan-500/20'
                            : 'text-slate-400 hover:text-white hover:bg-slate-800'
                            }`}
                        title={label}
                        aria-label={label}
                        aria-pressed={activeTab === id}
                    >
                        <Icon size={22} />
                        {/* Tooltip */}
                        <span className="absolute left-14 top-1/2 -translate-y-1/2 bg-slate-900 text-white text-xs px-2 py-1 rounded ml-2 whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50 border border-slate-700">
                            {label}
                        </span>
                    </button>
                ))}

                <div className="flex-1" />

                <button
                    className="p-3 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-all duration-200"
                    title="Agent Settings"
                    aria-label="Agent Settings"
                >
                    <Settings size={22} />
                </button>
            </div>
        </div>
    );
};
