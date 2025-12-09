import React, { useState } from 'react';
import { PhysicalMediaLayout } from './components/PhysicalMediaLayout';
import { TemplateSelector } from './components/TemplateSelector';
import { PrintTemplate } from '../../services/design/templates';
import { agentRegistry } from '../../services/agent/registry';
import { Send, ZoomIn, ZoomOut, Maximize, ArrowLeft } from 'lucide-react';
import { useToast } from '../../core/context/ToastContext';

export const PhysicalMediaDesigner: React.FC = () => {
    const [selectedTemplate, setSelectedTemplate] = useState<PrintTemplate | null>(null);
    const [zoom, setZoom] = useState(0.2);
    const [chatInput, setChatInput] = useState('');
    const [messages, setMessages] = useState<{ role: 'user' | 'agent', content: string }[]>([
        { role: 'agent', content: "I'm your Creative Director. Select a format and let's design something iconic." }
    ]);
    const [isThinking, setIsThinking] = useState(false);
    const toast = useToast();

    const handleSendMessage = async () => {
        if (!chatInput.trim()) return;

        const userMsg = chatInput;
        setMessages(prev => [...prev, { role: 'user', content: userMsg }]);
        setChatInput('');
        setIsThinking(true);

        try {
            const director = agentRegistry.get('director');
            if (!director) {
                toast.error("Creative Director agent not found.");
                setIsThinking(false);
                return;
            }

            // Contextualize the prompt
            const context = selectedTemplate
                ? `Current Context: Designing a ${selectedTemplate.name} (${selectedTemplate.totalWidth}x${selectedTemplate.totalHeight}px).`
                : "Current Context: Browsing templates.";

            const fullPrompt = `${context}\n\nUser Request: ${userMsg}`;

            const response = await director.execute(fullPrompt);

            setMessages(prev => [...prev, { role: 'agent', content: response.text }]);
        } catch (error) {
            console.error("Agent error:", error);
            toast.error("Failed to get creative direction.");
            setMessages(prev => [...prev, { role: 'agent', content: "I'm having trouble seeing the vision right now. Try again?" }]);
        } finally {
            setIsThinking(false);
        }
    };

    return (
        <div className="flex h-screen bg-black text-white overflow-hidden font-sans">
            {/* Left Sidebar - Navigation & Assets */}
            <div className="w-64 border-r border-neutral-800 flex flex-col bg-neutral-900/50 backdrop-blur-md">
                <div className="p-4 border-b border-neutral-800">
                    <h1 className="font-bold text-lg tracking-tight">Physical Design</h1>
                    <p className="text-xs text-neutral-500">Print-Ready Assets</p>
                </div>

                <div className="flex-1 overflow-y-auto">
                    {!selectedTemplate ? (
                        <div className="p-4">
                            <h2 className="text-xs font-semibold text-neutral-400 uppercase tracking-wider mb-4">Select Format</h2>
                            <TemplateSelector onSelect={setSelectedTemplate} />
                        </div>
                    ) : (
                        <div className="p-4">
                            <button
                                onClick={() => setSelectedTemplate(null)}
                                className="flex items-center text-sm text-neutral-400 hover:text-white mb-6 transition-colors"
                            >
                                <ArrowLeft className="w-4 h-4 mr-2" /> Back to Templates
                            </button>

                            <div className="mb-6">
                                <h3 className="font-medium text-white">{selectedTemplate.name}</h3>
                                <div className="text-xs text-neutral-500 mt-1 grid grid-cols-2 gap-2">
                                    <div>W: {selectedTemplate.totalWidth}px</div>
                                    <div>H: {selectedTemplate.totalHeight}px</div>
                                    <div>Bleed: {selectedTemplate.bleed}px</div>
                                    <div>DPI: {selectedTemplate.dpi}</div>
                                </div>
                            </div>

                            <div className="space-y-2">
                                <h4 className="text-xs font-semibold text-neutral-500 uppercase">Export</h4>
                                <button className="w-full py-2 bg-white text-black text-xs font-bold rounded hover:bg-neutral-200">
                                    Export PDF (Print)
                                </button>
                                <button className="w-full py-2 bg-neutral-800 text-white text-xs font-medium rounded hover:bg-neutral-700">
                                    Export PNG (Preview)
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Center Stage - Canvas */}
            <div className="flex-1 flex flex-col relative bg-neutral-950">
                {/* Toolbar */}
                <div className="absolute top-4 left-1/2 -translate-x-1/2 flex items-center gap-2 bg-neutral-900/80 p-2 rounded-full border border-neutral-800 backdrop-blur z-50">
                    <button onClick={() => setZoom(z => Math.max(0.1, z - 0.05))} className="p-2 hover:text-cyan-400 transition-colors"><ZoomOut className="w-4 h-4" /></button>
                    <span className="text-xs font-mono w-12 text-center">{Math.round(zoom * 100)}%</span>
                    <button onClick={() => setZoom(z => Math.min(1, z + 0.05))} className="p-2 hover:text-cyan-400 transition-colors"><ZoomIn className="w-4 h-4" /></button>
                    <div className="w-px h-4 bg-neutral-700 mx-1" />
                    <button onClick={() => setZoom(0.2)} className="p-2 hover:text-cyan-400 transition-colors"><Maximize className="w-4 h-4" /></button>
                </div>

                <div className="flex-1 overflow-hidden relative">
                    {selectedTemplate ? (
                        <PhysicalMediaLayout template={selectedTemplate} zoom={zoom} />
                    ) : (
                        <div className="flex flex-col items-center justify-center h-full text-neutral-600">
                            <DiscIcon className="w-24 h-24 mb-4 opacity-20" />
                            <p>Select a format to begin designing</p>
                        </div>
                    )}
                </div>
            </div>

            {/* Right Sidebar - Creative Director Chat */}
            <div className="w-80 border-l border-neutral-800 flex flex-col bg-neutral-900">
                <div className="p-4 border-b border-neutral-800 flex items-center justify-between">
                    <span className="font-semibold text-sm">Creative Director</span>
                    <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                </div>

                <div className="flex-1 overflow-y-auto p-4 space-y-4">
                    {messages.map((msg, idx) => (
                        <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                            <div className={`max-w-[85%] p-3 rounded-lg text-sm ${msg.role === 'user'
                                ? 'bg-neutral-800 text-white rounded-br-none'
                                : 'bg-neutral-900 border border-neutral-800 text-neutral-300 rounded-bl-none'
                                }`}>
                                {msg.content}
                            </div>
                        </div>
                    ))}
                    {isThinking && (
                        <div className="flex justify-start">
                            <div className="bg-neutral-900 border border-neutral-800 p-3 rounded-lg rounded-bl-none text-xs text-neutral-500 italic">
                                Thinking...
                            </div>
                        </div>
                    )}
                </div>

                <div className="p-4 border-t border-neutral-800">
                    <div className="relative">
                        <input
                            type="text"
                            value={chatInput}
                            onChange={(e) => setChatInput(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
                            placeholder="Design a cover style..."
                            className="w-full bg-neutral-950 border border-neutral-800 rounded-md py-3 pl-3 pr-10 text-sm focus:outline-none focus:border-neutral-600 transition-colors"
                        />
                        <button
                            onClick={handleSendMessage}
                            disabled={!chatInput.trim() || isThinking}
                            className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 bg-white text-black rounded hover:bg-neutral-200 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            <Send className="w-3 h-3" />
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

// Simple Icon component for the empty state
const DiscIcon = ({ className }: { className?: string }) => (
    <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className={className}
    >
        <circle cx="12" cy="12" r="10" />
        <circle cx="12" cy="12" r="3" />
    </svg>
);
