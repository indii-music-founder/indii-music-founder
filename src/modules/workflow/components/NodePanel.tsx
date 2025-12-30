import React from 'react';
import { useStore } from '@/core/store';
import { Box, Play, Sparkles, MessageSquare, Music, Video, Image as ImageIcon, GitBranch, ShieldAlert } from 'lucide-react';

export default function NodePanel() {
    const onDragStart = (event: React.DragEvent, nodeType: string, data?: any) => {
        event.dataTransfer.setData('application/reactflow', nodeType);
        event.dataTransfer.effectAllowed = 'move';

        if (data) {
            Object.keys(data).forEach(key => {
                event.dataTransfer.setData(`application/${key}`, data[key]);
            });
        }
    };

    return (
        <div className="absolute left-4 top-4 w-64 bg-gray-900/90 backdrop-blur border border-gray-700 rounded-xl shadow-xl overflow-hidden flex flex-col z-40">
            <div className="p-3 border-b border-gray-800 bg-gray-800/50">
                <h3 className="text-sm font-bold text-gray-300 uppercase tracking-wider">Node Library</h3>
            </div>

            <div className="p-2 space-y-1 overflow-y-auto max-h-[70vh] custom-scrollbar">
                <div className="px-2 py-1 text-xs font-bold text-gray-500 uppercase mt-2">Core</div>

                <div
                    className="flex items-center gap-3 p-2 hover:bg-gray-800 rounded-lg cursor-grab active:cursor-grabbing transition-colors group"
                    onDragStart={(event) => onDragStart(event, 'inputNode')}
                    draggable
                >
                    <div className="p-1.5 bg-blue-900/30 text-blue-400 rounded group-hover:bg-blue-900/50"><Play size={16} /></div>
                    <span className="text-sm text-gray-300 group-hover:text-white">Input Trigger</span>
                </div>

                <div
                    className="flex items-center gap-3 p-2 hover:bg-gray-800 rounded-lg cursor-grab active:cursor-grabbing transition-colors group"
                    onDragStart={(event) => onDragStart(event, 'outputNode')}
                    draggable
                >
                    <div className="p-1.5 bg-green-900/30 text-green-400 rounded group-hover:bg-green-900/50"><Sparkles size={16} /></div>
                    <span className="text-sm text-gray-300 group-hover:text-white">Final Output</span>
                </div>

                <div className="px-2 py-1 text-xs font-bold text-gray-500 uppercase mt-4">Departments</div>

                <div
                    className="flex items-center gap-3 p-2 hover:bg-gray-800 rounded-lg cursor-grab active:cursor-grabbing transition-colors group"
                    onDragStart={(event) => onDragStart(event, 'departmentNode', { departmentName: 'Art Department' })}
                    draggable
                >
                    <div className="p-1.5 bg-purple-900/30 text-purple-400 rounded group-hover:bg-purple-900/50"><ImageIcon size={16} /></div>
                    <span className="text-sm text-gray-300 group-hover:text-white">Art Department</span>
                </div>

                <div
                    className="flex items-center gap-3 p-2 hover:bg-gray-800 rounded-lg cursor-grab active:cursor-grabbing transition-colors group"
                    onDragStart={(event) => onDragStart(event, 'departmentNode', { departmentName: 'Video Department' })}
                    draggable
                >
                    <div className="p-1.5 bg-red-900/30 text-red-400 rounded group-hover:bg-red-900/50"><Video size={16} /></div>
                    <span className="text-sm text-gray-300 group-hover:text-white">Video Department</span>
                </div>

                <div
                    className="flex items-center gap-3 p-2 hover:bg-gray-800 rounded-lg cursor-grab active:cursor-grabbing transition-colors group"
                    onDragStart={(event) => onDragStart(event, 'departmentNode', { departmentName: 'Music Department' })}
                    draggable
                >
                    <div className="p-1.5 bg-amber-900/30 text-amber-400 rounded group-hover:bg-amber-900/50"><Music size={16} /></div>
                    <span className="text-sm text-gray-300 group-hover:text-white">Music Department</span>
                </div>

                <div className="px-2 py-1 text-xs font-bold text-gray-500 uppercase mt-4">Logic</div>

                <div
                    className="flex items-center gap-3 p-2 hover:bg-gray-800 rounded-lg cursor-grab active:cursor-grabbing transition-colors group"
                    onDragStart={(event) => onDragStart(event, 'logicNode', { departmentName: 'Logic', jobId: 'router' })}
                    draggable
                >
                    <div className="p-1.5 bg-gray-700/50 text-gray-400 rounded group-hover:bg-gray-600"><GitBranch size={16} /></div>
                    <span className="text-sm text-gray-300 group-hover:text-white">Router</span>
                </div>

                <div
                    className="flex items-center gap-3 p-2 hover:bg-gray-800 rounded-lg cursor-grab active:cursor-grabbing transition-colors group"
                    onDragStart={(event) => onDragStart(event, 'logicNode', { departmentName: 'Logic', jobId: 'gatekeeper' })}
                    draggable
                >
                    <div className="p-1.5 bg-gray-700/50 text-gray-400 rounded group-hover:bg-gray-600"><ShieldAlert size={16} /></div>
                    <span className="text-sm text-gray-300 group-hover:text-white">Gatekeeper</span>
                </div>
            </div>
        </div>
    );
}
