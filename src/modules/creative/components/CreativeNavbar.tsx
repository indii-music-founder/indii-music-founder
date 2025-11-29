import React, { useState } from 'react';
import { useStore } from '@/core/store';
import { ScreenControl } from '@/services/screen/ScreenControlService';
import { Image } from '@/services/image/ImageService';
import { MonitorPlay, Sparkles, Loader2, ChevronDown, ChevronUp } from 'lucide-react';
import PromptBuilder from './PromptBuilder';
import PromptTools from './PromptTools';
import PromptLibrary from './PromptLibrary';

import { useToast } from '@/core/context/ToastContext';

export default function CreativeNavbar() {
    const { currentProjectId, addToHistory } = useStore();
    const toast = useToast();
    const [prompt, setPrompt] = useState('');
    const [isGenerating, setIsGenerating] = useState(false);
    const [showPromptBuilder, setShowPromptBuilder] = useState(false);

    const handleGenerate = async () => {
        if (!prompt.trim()) return;
        setIsGenerating(true);
        try {
            const results = await Image.generateImages({
                prompt: prompt,
                count: 1,
                resolution: '2K'
            });

            if (results.length === 0) {
                toast.error("No images were generated. The model might have returned text only or failed silently.");
                console.warn("Generation returned 0 results.");
            } else {
                toast.success("Image generated successfully!");
            }

            results.forEach(res => {
                addToHistory({
                    id: res.id,
                    url: res.url,
                    prompt: res.prompt,
                    type: 'image',
                    timestamp: Date.now(),
                    projectId: currentProjectId
                });
            });
            setPrompt('');
        } catch (e) {
            console.error("Generation Error:", e);
            toast.error(`Generation failed: ${e instanceof Error ? e.message : 'Unknown error'}`);
        } finally {
            setIsGenerating(false);
        }
    };

    return (
        <div className="flex flex-col z-20">
            <div className="bg-[#1a1a1a] border-b border-gray-800 py-2 px-4 flex-shrink-0">
                <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 md:gap-4">
                    <div className="flex items-center justify-between md:justify-start gap-4 flex-shrink-0">
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

                        {/* Mobile: Agent Toggle in top row */}
                        <button
                            onClick={() => useStore.getState().toggleAgentWindow()}
                            className="md:hidden bg-purple-900/50 hover:bg-purple-800 text-purple-200 text-xs py-1.5 px-3 rounded border border-purple-700 transition-all flex items-center gap-2"
                        >
                            <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse"></span>
                            Agent
                        </button>
                    </div>

                    {/* Prompt Input Area */}
                    <div className="flex-1 w-full md:max-w-3xl flex items-center gap-2 order-3 md:order-2">
                        <div className="flex-1 relative flex items-center gap-2 bg-[#0f0f0f] border border-gray-700 rounded-lg pr-2 focus-within:ring-1 focus-within:ring-purple-500 transition-all">
                            <input
                                type="text"
                                value={prompt}
                                onChange={(e) => setPrompt(e.target.value)}
                                onKeyDown={(e) => e.key === 'Enter' && handleGenerate()}
                                placeholder="Describe what you want to create..."
                                className="flex-1 bg-transparent border-none rounded-l-lg pl-3 py-1.5 text-sm text-white placeholder-gray-500 focus:ring-0 outline-none"
                            />

                            {/* Tools inside input */}
                            <div className="flex items-center gap-1 border-l border-gray-700 pl-2">
                                <PromptTools currentPrompt={prompt} onUpdatePrompt={setPrompt} />
                                <PromptLibrary currentPrompt={prompt} onLoadPrompt={setPrompt} />
                                <button
                                    onClick={() => setShowPromptBuilder(!showPromptBuilder)}
                                    className={`p-1.5 rounded transition-colors ${showPromptBuilder ? 'text-white bg-gray-700' : 'text-gray-500 hover:text-white'}`}
                                    title="Toggle Prompt Builder"
                                >
                                    {showPromptBuilder ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                                </button>
                            </div>
                        </div>

                        <button
                            onClick={handleGenerate}
                            disabled={isGenerating || !prompt.trim()}
                            className="bg-purple-600 hover:bg-purple-500 disabled:opacity-50 disabled:cursor-not-allowed text-white text-xs font-medium py-1.5 px-4 rounded-lg transition-all flex items-center gap-2 shadow-lg shadow-purple-900/20"
                        >
                            {isGenerating ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
                            Generate
                        </button>
                    </div>

                    <div className="hidden md:flex gap-2 flex-shrink-0 order-2 md:order-3">
                        <button
                            onClick={async () => {
                                const granted = await ScreenControl.requestPermission();
                                if (granted) {
                                    ScreenControl.openProjectorWindow(window.location.href);
                                } else {
                                    alert("Screen Control API not supported or permission denied.");
                                }
                            }}
                            className="bg-blue-900/50 hover:bg-blue-800 text-blue-200 text-xs py-1.5 px-3 rounded border border-blue-700 transition-all flex items-center gap-2"
                        >
                            <MonitorPlay size={12} />
                            Projector
                        </button>
                        <button
                            onClick={() => useStore.getState().toggleAgentWindow()}
                            className="bg-purple-900/50 hover:bg-purple-800 text-purple-200 text-xs py-1.5 px-3 rounded border border-purple-700 transition-all flex items-center gap-2"
                        >
                            <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse"></span>
                            Agent R
                        </button>
                    </div>
                </div>
            </div>

            {/* Prompt Builder Drawer */}
            {showPromptBuilder && (
                <PromptBuilder onAddTag={(tag) => setPrompt(prev => prev ? `${prev}, ${tag}` : tag)} />
            )}
        </div>
    );
}
