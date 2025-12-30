import React, { useState, useEffect } from 'react';
import { useStore } from '@/core/store';
import { X, Sparkles, Save, Loader2 } from 'lucide-react';
import { useStore } from '@/core/store';
import { X, Save, Sparkles, Loader2 } from 'lucide-react';
import { AI } from '@/services/ai/AIService';
import { isTextPart } from '@/shared/types/ai.dto';
import { AI_MODELS } from '@/core/config/ai-models';
import { X, Save, Sparkles, Loader2 } from 'lucide-react';

export default function WorkflowNodeInspector() {
    const { nodes, setNodes, selectedNodeId, setSelectedNodeId } = useStore();
    const [prompt, setPrompt] = useState('');
    const [aiInstruction, setAiInstruction] = useState('');
    const [isGenerating, setIsGenerating] = useState(false);

    const selectedNode = nodes.find(n => n.id === selectedNodeId);

    useEffect(() => {
        if (selectedNode) {
            setPrompt((selectedNode.data as any).prompt || '');
        }
    }, [selectedNodeId, selectedNode]);

    if (!selectedNode) return null;

    const handleSave = () => {
        setNodes(nodes.map(n =>
            n.id === selectedNodeId
                ? { ...n, data: { ...n.data, prompt } }
                : n
        ));
        // Optional: Close inspector or show success toast
    };

    const handleAiGenerate = async () => {
        if (!aiInstruction.trim()) return;
        setIsGenerating(true);
        try {
            const response = await AI.generateContent({
                model: AI_MODELS.TEXT.AGENT,
                contents: [{ role: 'user', parts: [{ text: `Refine this prompt based on the instruction: "${aiInstruction}". \n\nCurrent Prompt: "${prompt}"\n\nReturn ONLY the refined prompt text.` }] }]
            });
            const part = response.response.candidates?.[0]?.content?.parts?.[0];
            const newPrompt = (part && isTextPart(part)) ? part.text : prompt;
            setPrompt(newPrompt);
            setAiInstruction('');
        } catch (e) {
            console.error("AI Refinement Error", e);
        } finally {
            setIsGenerating(false);
        }
    };

    return (
        <div className="absolute right-4 top-4 w-80 bg-gray-900 border border-gray-700 rounded-xl shadow-2xl overflow-hidden flex flex-col z-50 animate-in slide-in-from-right-10 fade-in duration-300">
            <div className="flex items-center justify-between p-4 border-b border-gray-800 bg-gray-800/50">
                <h3 className="font-bold text-white">Node Inspector</h3>
                <button onClick={() => setSelectedNodeId(null)} className="text-gray-400 hover:text-white">
                    <X size={18} />
                </button>
            </div>

            <div className="p-4 space-y-4 flex-1 overflow-y-auto custom-scrollbar">
                <div>
                    <label className="text-xs font-bold text-gray-500 uppercase mb-1 block">Type</label>
                    <div className="px-3 py-2 bg-gray-800 rounded border border-gray-700 text-sm text-gray-300 capitalize">
                        {selectedNode.data.nodeType} Node
                    </div>
                </div>

                <div>
                    <label className="text-xs font-bold text-gray-500 uppercase mb-1 block">Prompt / Configuration</label>
                    <textarea
                        value={prompt}
                        onChange={(e) => setPrompt(e.target.value)}
                        className="w-full h-32 bg-black/30 border border-gray-700 rounded-lg p-3 text-sm text-gray-200 focus:border-purple-500 outline-none resize-none"
                        placeholder="Enter node instructions..."
                    />
                </div>

                <div className="bg-purple-900/10 border border-purple-500/30 rounded-lg p-3">
                    <label className="text-xs font-bold text-purple-400 uppercase mb-2 block flex items-center gap-2">
                        <Sparkles size={12} /> AI Assistant
                    </label>
                    <div className="flex gap-2">
                        <input
                            type="text"
                            value={aiInstruction}
                            onChange={(e) => setAiInstruction(e.target.value)}
                            placeholder="e.g. Make it more detailed..."
                            className="flex-1 bg-black/30 border border-gray-700 rounded px-2 py-1.5 text-xs text-white focus:border-purple-500 outline-none"
                            onKeyDown={(e) => e.key === 'Enter' && handleAiGenerate()}
                        />
                        <button
                            onClick={handleAiGenerate}
                            disabled={isGenerating || !aiInstruction.trim()}
                            className="p-1.5 bg-purple-600 hover:bg-purple-500 text-white rounded disabled:opacity-50"
                        >
                            {isGenerating ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
                        </button>
                    </div>
                </div>
            </div>

            <div className="p-4 border-t border-gray-800 bg-gray-800/50 flex justify-end">
                <button
                    onClick={handleSave}
                    className="px-4 py-2 bg-green-600 hover:bg-green-500 text-white text-sm font-bold rounded-lg flex items-center gap-2"
                >
                    <Save size={16} /> Save Changes
                </button>
            </div>
        </div>
    );
}
