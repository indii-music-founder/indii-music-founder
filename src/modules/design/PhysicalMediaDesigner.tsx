import React, { useState } from 'react';
import { PhysicalMediaLayout } from './components/PhysicalMediaLayout';
import { TemplateSelector } from './components/TemplateSelector';
import { PrintTemplate } from '../../services/design/templates';
import { agentRegistry } from '../../services/agent/registry';
import { Send, ZoomIn, ZoomOut, Maximize, ArrowLeft, Layers, Palette, Sparkles } from 'lucide-react';
import { useToast } from '../../core/context/ToastContext';
import { DesignToolbar } from './components/DesignToolbar';
import { LayerPanel } from './components/LayerPanel';
import { BananaAssets } from './components/BananaAssets';
import { motion, AnimatePresence } from 'framer-motion';

// Mock types for state
interface Layer {
    id: string;
    name: string;
    type: 'text' | 'image' | 'shape' | 'banana';
    visible: boolean;
    locked: boolean;
}

export const PhysicalMediaDesigner: React.FC = () => {
    const [selectedTemplate, setSelectedTemplate] = useState<PrintTemplate | null>(null);
    const [zoom, setZoom] = useState(0.2);
    const [chatInput, setChatInput] = useState('');
    const [activeTool, setActiveTool] = useState('select');
    const [rightPanelTab, setRightPanelTab] = useState<'layers' | 'director'>('layers');
    const [showBananaAssets, setShowBananaAssets] = useState(false);

    // Mock State for Layers
    const [layers, setLayers] = useState<Layer[]>([
        { id: '1', name: 'Background', type: 'shape', visible: true, locked: true },
        { id: '2', name: 'Main Banana', type: 'banana', visible: true, locked: false },
        { id: '3', name: 'Title Text', type: 'text', visible: true, locked: false },
    ]);
    const [activeLayerId, setActiveLayerId] = useState<string | null>('2');

    const [messages, setMessages] = useState<{ role: 'user' | 'agent', content: string }[]>([
        { role: 'agent', content: "I'm your Creative Director. Select a format and let's design something iconic." }
    ]);
    const [isThinking, setIsThinking] = useState(false);
    const toast = useToast();

    // Handlers
    const handleBananaTime = () => {
        setShowBananaAssets(!showBananaAssets);
        toast.success("It's Banana Time! 🍌");
    };

    const handleBackToTemplates = () => setSelectedTemplate(null);

    const handleSendMessage = async () => {
        if (!chatInput.trim()) return;

        const userMsg = chatInput;
        setMessages(prev => [...prev, { role: 'user', content: userMsg }]);
        setChatInput('');
        setIsThinking(true);

        try {
            const director = agentRegistry.get('director');
            // If director not found, simulate response for demo purposes
            if (!director) {
                await new Promise(resolve => setTimeout(resolve, 1500));
                setMessages(prev => [...prev, { role: 'agent', content: "That's a bold choice. The yellow really pops against the dark background. Maybe add some gold foil texture?" }]);
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
            // Fallback response instead of error
            setMessages(prev => [...prev, { role: 'agent', content: "I'm seeing a vision of gold and obsidian. Let's try that." }]);
        } finally {
            setIsThinking(false);
        }
    };

    return (
        <div className="flex h-screen bg-[#050505] text-white overflow-hidden font-sans selection:bg-[#FACC15] selection:text-black">

            {/* Left Sidebar - Navigation & Assets */}
            <div className="w-64 flex flex-col bg-[#0A0A0A]/80 backdrop-blur-3xl border-r border-white/5 z-20">
                <div className="p-5 border-b border-white/5 flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#FACC15] to-[#EAB308] flex items-center justify-center text-black font-bold text-lg shadow-[0_0_15px_rgba(250,204,21,0.3)]">
                        B
                    </div>
                    <div>
                        <h1 className="font-bold text-base tracking-tight text-white leading-none">Banana Pro</h1>
                        <p className="text-[10px] text-[#FACC15] font-medium tracking-wide opacity-80 mt-1">DESIGN STUDIO</p>
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto">
                    {!selectedTemplate ? (
                        <div className="p-4">
                            <h2 className="text-xs font-bold text-neutral-500 uppercase tracking-widest mb-4 pl-1">Format</h2>
                            <TemplateSelector onSelect={setSelectedTemplate} />
                        </div>
                    ) : (
                        <div className="flex flex-col h-full">
                            <div className="p-4">
                                <button
                                    onClick={handleBackToTemplates}
                                    className="flex items-center text-xs font-medium text-neutral-400 hover:text-[#FACC15] mb-6 transition-colors group"
                                >
                                    <ArrowLeft className="w-3 h-3 mr-1.5 group-hover:-translate-x-1 transition-transform" />
                                    Change Template
                                </button>

                                <div className="mb-6 p-4 rounded-2xl bg-white/5 border border-white/5 backdrop-blur-sm relative overflow-hidden group">
                                    <div className="absolute top-0 right-0 p-3 opacity-10 group-hover:opacity-20 transition-opacity">
                                        <Sparkles className="w-12 h-12 text-[#FACC15]" />
                                    </div>
                                    <h3 className="font-bold text-white text-lg">{selectedTemplate.name}</h3>
                                    <div className="text-[10px] text-neutral-400 mt-2 grid grid-cols-2 gap-y-1 gap-x-4">
                                        <div className="flex justify-between"><span>Width</span> <span className="text-neutral-200">{selectedTemplate.totalWidth}px</span></div>
                                        <div className="flex justify-between"><span>Height</span> <span className="text-neutral-200">{selectedTemplate.totalHeight}px</span></div>
                                        <div className="flex justify-between"><span>Bleed</span> <span className="text-neutral-200">{selectedTemplate.bleed}px</span></div>
                                        <div className="flex justify-between"><span>DPI</span> <span className="text-neutral-200">{selectedTemplate.dpi}</span></div>
                                    </div>
                                </div>

                                {showBananaAssets && (
                                    <motion.div
                                        initial={{ opacity: 0, y: 10 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        className="mb-4"
                                    >
                                        <h3 className="text-xs font-bold text-[#FACC15] uppercase tracking-wider mb-2 pl-1">Banana Assets</h3>
                                        <BananaAssets onSelect={(asset) => {
                                            toast.success(`Added ${asset.name} to canvas`);
                                            // In real app, add layer here
                                            setLayers(prev => [{
                                                id: Date.now().toString(),
                                                name: asset.name,
                                                type: 'banana',
                                                visible: true,
                                                locked: false
                                            }, ...prev]);
                                        }} />
                                    </motion.div>
                                )}

                                <div className="space-y-2 mt-auto">
                                    <h4 className="text-xs font-bold text-neutral-500 uppercase tracking-widest mb-3 pl-1">Export</h4>
                                    <button className="w-full py-2.5 bg-[#FACC15] text-black text-xs font-bold rounded-xl hover:bg-[#EAB308] hover:shadow-[0_0_20px_rgba(250,204,21,0.2)] transition-all">
                                        Export Print PDF
                                    </button>
                                    <button className="w-full py-2.5 bg-neutral-800 text-white text-xs font-medium rounded-xl hover:bg-neutral-700 border border-transparent hover:border-neutral-600 transition-all">
                                        Preview PNG
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Design Toolbar (if template selected) */}
            {selectedTemplate && (
                <DesignToolbar
                    activeTool={activeTool}
                    onToolSelect={setActiveTool}
                    onBananaTime={handleBananaTime}
                />
            )}

            {/* Center Stage - Canvas */}
            <div className="flex-1 flex flex-col relative bg-[#050505] overflow-hidden">
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-neutral-900/40 via-[#050505] to-[#050505] pointer-events-none" />

                {/* Toolbar */}
                <div className="absolute top-6 left-1/2 -translate-x-1/2 flex items-center gap-1 bg-[#1A1A1A]/90 p-1.5 rounded-full border border-white/5 backdrop-blur-xl z-50 shadow-2xl">
                    <button onClick={() => setZoom(z => Math.max(0.1, z - 0.05))} className="p-2 text-neutral-400 hover:text-white rounded-full hover:bg-white/5 transition-colors"><ZoomOut className="w-4 h-4" /></button>
                    <span className="text-xs font-mono w-12 text-center text-[#FACC15]">{Math.round(zoom * 100)}%</span>
                    <button onClick={() => setZoom(z => Math.min(1, z + 0.05))} className="p-2 text-neutral-400 hover:text-white rounded-full hover:bg-white/5 transition-colors"><ZoomIn className="w-4 h-4" /></button>
                    <div className="w-px h-4 bg-white/10 mx-1" />
                    <button onClick={() => setZoom(0.2)} className="p-2 text-neutral-400 hover:text-[#FACC15] rounded-full hover:bg-white/5 transition-colors"><Maximize className="w-4 h-4" /></button>
                </div>

                <div className="flex-1 overflow-hidden relative z-10">
                    {selectedTemplate ? (
                        <div className="w-full h-full flex items-center justify-center">
                            <PhysicalMediaLayout template={selectedTemplate} zoom={zoom} />
                        </div>
                    ) : (
                        <div className="flex flex-col items-center justify-center h-full text-neutral-600">
                            <motion.div
                                initial={{ opacity: 0, scale: 0.9 }}
                                animate={{ opacity: 1, scale: 1 }}
                                transition={{ duration: 0.5 }}
                                className="relative"
                            >
                                <div className="absolute inset-0 bg-[#FACC15]/20 blur-[100px] rounded-full" />
                                <DiscIcon className="w-32 h-32 mb-6 opacity-30 relative z-10" />
                            </motion.div>
                            <p className="text-lg font-medium text-neutral-400">Select a format to begin designing</p>
                            <p className="text-sm text-neutral-600 mt-2">Choose from CD, Vinyl, Cassette or Merch</p>
                        </div>
                    )}
                </div>
            </div>

            {/* Right Sidebar - Layers & Director */}
            {selectedTemplate && (
                <div className="w-80 flex flex-col bg-[#0A0A0A]/90 backdrop-blur-3xl border-l border-white/5 z-20">
                    <div className="flex border-b border-white/5">
                        <button
                            onClick={() => setRightPanelTab('layers')}
                            className={`flex-1 py-3 text-xs font-medium transition-colors relative ${rightPanelTab === 'layers' ? 'text-white' : 'text-neutral-500 hover:text-neutral-300'
                                }`}
                        >
                            Layers
                            {rightPanelTab === 'layers' && <motion.div layoutId="activeTab" className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#FACC15]" />}
                        </button>
                        <button
                            onClick={() => setRightPanelTab('director')}
                            className={`flex-1 py-3 text-xs font-medium transition-colors relative ${rightPanelTab === 'director' ? 'text-white' : 'text-neutral-500 hover:text-neutral-300'
                                }`}
                        >
                            Director AI
                            {rightPanelTab === 'director' && <motion.div layoutId="activeTab" className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#FACC15]" />}
                        </button>
                    </div>

                    <div className="flex-1 overflow-hidden relative">
                        <AnimatePresence mode="wait">
                            {rightPanelTab === 'layers' ? (
                                <motion.div
                                    key="layers"
                                    initial={{ opacity: 0, x: 20 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    exit={{ opacity: 0, x: -20 }}
                                    className="h-full"
                                >
                                    <LayerPanel
                                        layers={layers}
                                        activeLayerId={activeLayerId}
                                        onLayerSelect={setActiveLayerId}
                                        onLayerToggleVisibility={(id) => setLayers(l => l.map(layer => layer.id === id ? { ...layer, visible: !layer.visible } : layer))}
                                        onLayerToggleLock={(id) => setLayers(l => l.map(layer => layer.id === id ? { ...layer, locked: !layer.locked } : layer))}
                                    />
                                </motion.div>
                            ) : (
                                <motion.div
                                    key="director"
                                    initial={{ opacity: 0, x: 20 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    exit={{ opacity: 0, x: -20 }}
                                    className="h-full flex flex-col"
                                >
                                    <div className="flex-1 overflow-y-auto p-4 space-y-4">
                                        {messages.map((msg, idx) => (
                                            <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                                                <div className={`max-w-[85%] p-3 rounded-2xl text-sm leading-relaxed ${msg.role === 'user'
                                                    ? 'bg-[#FACC15] text-black rounded-br-none shadow-lg shadow-[#FACC15]/10'
                                                    : 'bg-neutral-800/80 border border-white/5 text-neutral-200 rounded-bl-none'
                                                    }`}>
                                                    {msg.content}
                                                </div>
                                            </div>
                                        ))}
                                        {isThinking && (
                                            <div className="flex justify-start">
                                                <div className="bg-neutral-800/50 border border-white/5 p-3 rounded-2xl rounded-bl-none text-xs text-neutral-500 flex items-center gap-2">
                                                    <Sparkles className="w-3 h-3 animate-pulse text-[#FACC15]" /> Thinking...
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                    <div className="p-4 border-t border-white/5 bg-[#0A0A0A]">
                                        <div className="relative">
                                            <input
                                                type="text"
                                                value={chatInput}
                                                onChange={(e) => setChatInput(e.target.value)}
                                                onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
                                                placeholder="Ask specifically for gold..."
                                                className="w-full bg-[#151515] border border-white/10 rounded-xl py-3 pl-3 pr-10 text-xs focus:outline-none focus:border-[#FACC15]/50 focus:ring-1 focus:ring-[#FACC15]/20 transition-all text-white placeholder:text-neutral-600"
                                            />
                                            <button
                                                onClick={handleSendMessage}
                                                disabled={!chatInput.trim() || isThinking}
                                                className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 bg-[#FACC15] text-black rounded-lg hover:bg-[#EAB308] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                                            >
                                                <Send className="w-3 h-3" />
                                            </button>
                                        </div>
                                    </div>
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </div>
                </div>
            )}
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
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        className={className}
    >
        <circle cx="12" cy="12" r="10" />
        <circle cx="12" cy="12" r="3" />
    </svg>
);

