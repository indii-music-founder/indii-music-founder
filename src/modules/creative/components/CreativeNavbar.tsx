import React from 'react';
import { useStore } from '@/core/store';

export default function CreativeNavbar() {
    const { currentProjectId } = useStore();

    return (
        <div className="bg-[#1a1a1a] border-b border-gray-800 py-2 px-4 flex-shrink-0 z-20">
            <div className="max-w-6xl mx-auto flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Studio Mode</p>
                    <div className="h-4 w-px bg-gray-700"></div>
                    <select
                        className="bg-[#0f0f0f] border border-gray-700 text-xs rounded px-2 py-1 text-gray-300 focus:ring-1 focus:ring-yellow-500 outline-none"
                        value={currentProjectId}
                        onChange={() => { }}
                    >
                        <option value="default">Default Project</option>
                        <option value="new">+ New Project</option>
                    </select>
                </div>

                <div className="flex gap-2">
                    <button
                        onClick={() => useStore.getState().toggleAgentWindow()}
                        className="bg-purple-900/50 hover:bg-purple-800 text-purple-200 text-xs py-1.5 px-3 rounded border border-purple-700 transition-all flex items-center gap-2"
                    >
                        <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse"></span>
                        Agent R
                    </button>
                    {/* Mode Buttons */}
                    {['Generate', 'Edit', 'Reference', 'Remix', 'Showroom', 'Canvas'].map(mode => (
                        <button key={mode} className="bg-gray-800 hover:bg-gray-700 text-gray-300 text-xs py-1.5 px-3 rounded border border-gray-700 transition-all">
                            {mode}
                        </button>
                    ))}
                </div>
            </div>
        </div>
    );
}
