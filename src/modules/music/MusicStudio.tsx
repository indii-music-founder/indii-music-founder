import React, { useState } from 'react';
import { Music, Upload, FileAudio, Activity, BarChart3, Zap, Heart, Waves } from 'lucide-react';
import AgentWindow from '../../core/components/AgentWindow';
import { DualAgentService } from '../../services/agent/DualAgentService';
import { MUSIC_TOOLS, MUSIC_MANAGER_PROMPT, MUSIC_EXECUTOR_PROMPT } from './tools';

const musicAgent = new DualAgentService(
    {
        name: "Lead Audio Analyst",
        role: "Manager",
        systemPrompt: MUSIC_MANAGER_PROMPT,
        tools: {}
    },
    {
        name: "Audio Technician",
        role: "Executor",
        systemPrompt: MUSIC_EXECUTOR_PROMPT,
        tools: MUSIC_TOOLS
    }
);

export default function MusicStudio() {
    const [isDragging, setIsDragging] = useState(false);
    const [selectedFile, setSelectedFile] = useState<File | null>(null);

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(true);
    };

    const handleDragLeave = () => {
        setIsDragging(false);
    };

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(false);
        const file = e.dataTransfer.files[0];
        if (file && file.type.startsWith('audio/')) {
            setSelectedFile(file);
            // Trigger agent analysis
            musicAgent.processGoal(`Perform a deep analysis (Essentia style) on '${file.name}'. Extract Mood, Energy, and Timbre, then generate a visual prompt.`);
        }
    };

    return (
        <div className="h-full flex flex-col bg-[#0a0a0a] text-white p-6">
            <header className="flex items-center gap-4 mb-8">
                <div className="p-3 bg-purple-500/10 rounded-xl text-purple-400">
                    <Activity size={32} />
                </div>
                <div>
                    <h1 className="text-3xl font-bold">Deep Audio Analysis Lab</h1>
                    <p className="text-gray-400">Essentia-powered feature extraction & Synesthetic Art Generation.</p>
                </div>
            </header>

            <div className="flex-1 grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Main Work Area */}
                <div className="lg:col-span-2 flex flex-col gap-6">
                    {/* Upload Zone */}
                    <div
                        onDragOver={handleDragOver}
                        onDragLeave={handleDragLeave}
                        onDrop={handleDrop}
                        className={`
                            flex-1 border-2 border-dashed rounded-2xl flex flex-col items-center justify-center p-12 transition-all relative overflow-hidden
                            ${isDragging
                                ? 'border-purple-500 bg-purple-500/10'
                                : 'border-gray-800 hover:border-gray-700 bg-gray-900/50'}
                        `}
                    >
                        {selectedFile ? (
                            <div className="text-center animate-in fade-in zoom-in duration-300 z-10">
                                <div className="w-20 h-20 bg-purple-500/20 rounded-full flex items-center justify-center mx-auto mb-4 text-purple-400">
                                    <FileAudio size={40} />
                                </div>
                                <h3 className="text-xl font-medium text-white mb-2">{selectedFile.name}</h3>
                                <p className="text-gray-500 mb-6">{(selectedFile.size / 1024 / 1024).toFixed(2)} MB</p>

                                <div className="grid grid-cols-3 gap-4 text-left bg-black/40 p-4 rounded-xl border border-gray-800 backdrop-blur-sm">
                                    <div className="flex items-center gap-2 text-gray-400">
                                        <BarChart3 size={16} />
                                        <span className="text-xs">Rhythm</span>
                                    </div>
                                    <div className="flex items-center gap-2 text-gray-400">
                                        <Zap size={16} />
                                        <span className="text-xs">Energy</span>
                                    </div>
                                    <div className="flex items-center gap-2 text-gray-400">
                                        <Waves size={16} />
                                        <span className="text-xs">Timbre</span>
                                    </div>
                                </div>

                                <button
                                    onClick={() => setSelectedFile(null)}
                                    className="mt-6 px-4 py-2 bg-gray-800 hover:bg-gray-700 rounded-lg text-sm transition-colors"
                                >
                                    Analyze Another File
                                </button>
                            </div>
                        ) : (
                            <div className="text-center pointer-events-none z-10">
                                <div className="w-16 h-16 bg-gray-800 rounded-full flex items-center justify-center mx-auto mb-4 text-gray-500">
                                    <Upload size={32} />
                                </div>
                                <h3 className="text-xl font-medium text-white mb-2">Drop Audio File Here</h3>
                                <p className="text-gray-500 max-w-sm mx-auto">
                                    Upload a track to extract Mood, Danceability, Roughness, and more.
                                </p>
                            </div>
                        )}

                        {/* Background Decoration */}
                        <div className="absolute inset-0 opacity-10 pointer-events-none">
                            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-purple-500/20 blur-[100px] rounded-full"></div>
                        </div>
                    </div>

                    {/* Metrics Preview (Static for now, Agent populates real data) */}
                    <div className="h-48 bg-gray-900/50 rounded-2xl border border-gray-800 p-6 flex flex-col justify-between">
                        <div className="flex justify-between items-center">
                            <h3 className="text-sm font-medium text-gray-400">REAL-TIME METRICS</h3>
                            <span className="text-xs text-green-500 flex items-center gap-1">
                                <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
                                ESSENTIA ENGINE READY
                            </span>
                        </div>

                        <div className="grid grid-cols-4 gap-4 h-24 items-end">
                            {[0.4, 0.7, 0.3, 0.8, 0.5, 0.9, 0.6, 0.4, 0.7, 0.5, 0.8, 0.6].map((h, i) => (
                                <div key={i} className="w-full bg-gray-800 rounded-t-sm relative overflow-hidden group">
                                    <div
                                        className="absolute bottom-0 left-0 right-0 bg-purple-500/50 transition-all duration-1000 group-hover:bg-purple-400"
                                        style={{ height: `${h * 100}%` }}
                                    ></div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Agent Sidebar */}
                <div className="bg-gray-900/30 rounded-2xl border border-gray-800 overflow-hidden">
                    <AgentWindow agent={musicAgent} title="Audio Analyst" />
                </div>
            </div>
        </div>
    );
}
