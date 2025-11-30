import React, { useState, useRef, useEffect } from 'react';
import { useStore } from '@/core/store';
import { agentService } from '@/services/agent/AgentService';
import { X, Minimize2, Trash2, Send, Paperclip } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface AgentWindowProps {
    agent?: { sendMessage: (text: string) => void };
    title?: string;
    className?: string;
}

export default function AgentWindow({ agent, title, className }: AgentWindowProps) {
    const { agentHistory, clearAgentHistory, isAgentOpen, toggleAgentWindow, generatedHistory, uploadedImages } = useStore();
    const [input, setInput] = useState('');
    const [isMinimized, setIsMinimized] = useState(false);
    const [size, setSize] = useState({ width: 320, height: 500 });
    const [pendingAttachments, setPendingAttachments] = useState<{ mimeType: string; base64: string; preview: string }[]>([]);
    const scrollRef = useRef<HTMLDivElement>(null);

    const activeAgent = agent || agentService;
    const windowTitle = title || "Agent R";

    const AgentHeader = () => (
        <div className="flex items-center gap-2 pointer-events-none">
            <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></div>
            <span className="font-bold text-xs text-gray-200">
                Agent <span className="inline-block transform -scale-x-100">R</span>
            </span>
        </div>
    );

    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [agentHistory]);

    const handleSend = () => {
        if (!input.trim() && pendingAttachments.length === 0) return;

        const attachments = pendingAttachments.map(a => ({ mimeType: a.mimeType, base64: a.base64 }));
        activeAgent.sendMessage(input, attachments.length > 0 ? attachments : undefined);

        setInput('');
        setPendingAttachments([]);
    };

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();

        // 1. Handle Internal Drag (History/Assets)
        const id = e.dataTransfer.getData('text/plain');
        if (id) {
            const item = generatedHistory.find(i => i.id === id) || uploadedImages.find(i => i.id === id);
            if (item) {
                setPendingAttachments(prev => [...prev, {
                    mimeType: item.type === 'video' ? 'video/mp4' : 'image/png', // Simplified assumption
                    base64: item.url, // Assuming URL is base64 or we treat it as such for the agent context
                    preview: item.url
                }]);
                return;
            }
        }

        // 2. Handle External Files
        const files = Array.from(e.dataTransfer.files);
        files.forEach(file => {
            const reader = new FileReader();
            reader.onload = (ev) => {
                if (ev.target?.result) {
                    setPendingAttachments(prev => [...prev, {
                        mimeType: file.type,
                        base64: ev.target!.result as string,
                        preview: ev.target!.result as string
                    }]);
                }
            };
            reader.readAsDataURL(file);
        });
    };

    const handleResizeStart = (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation(); // Prevent drag interference

        const startX = e.clientX;
        const startY = e.clientY;
        const startWidth = size.width;
        const startHeight = size.height;

        const handleMouseMove = (moveEvent: MouseEvent) => {
            const newWidth = Math.max(280, startWidth + (moveEvent.clientX - startX));
            const newHeight = Math.max(200, startHeight + (moveEvent.clientY - startY));
            setSize({ width: newWidth, height: newHeight });
        };

        const handleMouseUp = () => {
            document.removeEventListener('mousemove', handleMouseMove);
            document.removeEventListener('mouseup', handleMouseUp);
        };

        document.addEventListener('mousemove', handleMouseMove);
        document.addEventListener('mouseup', handleMouseUp);
    };

    const isEmbedded = !!className;

    // For embedded windows, we render normally.
    if (isEmbedded) {
        return (
            <div
                className={`flex flex-col h-full bg-[#0f0f0f] border-l border-gray-800 ${className}`}
                onDragOver={(e) => e.preventDefault()}
                onDrop={handleDrop}
            >
                {/* Header */}
                <div className="bg-[#1a1a1a] p-2 border-b border-gray-800 flex justify-between items-center select-none">
                    <AgentHeader />
                    <div className="flex gap-1">
                        <button onClick={clearAgentHistory} className="p-1 hover:text-red-400 text-gray-500"><Trash2 size={12} /></button>
                    </div>
                </div>

                {/* Chat Area */}
                <div ref={scrollRef} className="flex-1 p-3 overflow-y-auto space-y-3 custom-scrollbar bg-[#0f0f0f]">
                    {agentHistory.length === 0 && (
                        <div className="text-center text-xs text-gray-600 italic mt-4">
                            I am {windowTitle}. How can I help you?
                        </div>
                    )}
                    {agentHistory.map((msg) => (
                        <div key={msg.id} className={`flex gap-2 mb-2 ${msg.role === 'user' ? 'justify-end' : ''}`}>
                            {msg.role === 'model' && (
                                <div className="w-6 h-6 rounded bg-purple-600 flex items-center justify-center text-[10px] flex-shrink-0 font-bold">AI</div>
                            )}
                            <div className={`p-2 rounded-lg text-xs max-w-[90%] ${msg.role === 'user' ? 'bg-blue-900/30 text-blue-100 border border-blue-800' :
                                msg.role === 'system' ? 'text-gray-500 italic text-center w-full' :
                                    'bg-[#1a1a1a] text-gray-300 border border-gray-800'
                                }`}>
                                {msg.text}
                                {msg.isStreaming && (
                                    <span className="inline-block w-2 h-4 ml-1 bg-purple-500 animate-pulse align-middle"></span>
                                )}
                                {msg.attachments && (
                                    <div className="mt-2 flex gap-1 flex-wrap">
                                        {msg.attachments.map((att, i) => (
                                            <img key={i} src={att.base64} className="w-12 h-12 object-cover rounded border border-white/10" />
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                    ))}
                </div>

                {/* Input Area */}
                <div className="p-2 bg-[#1a1a1a] border-t border-gray-800">
                    {pendingAttachments.length > 0 && (
                        <div className="flex gap-2 mb-2 overflow-x-auto pb-2">
                            {pendingAttachments.map((att, i) => (
                                <div key={i} className="relative group">
                                    <img src={att.preview} className="w-12 h-12 object-cover rounded border border-purple-500" />
                                    <button
                                        onClick={() => setPendingAttachments(prev => prev.filter((_, idx) => idx !== i))}
                                        className="absolute -top-1 -right-1 bg-red-500 text-white rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
                                    >
                                        <X size={8} />
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}
                    <div className="flex gap-2">
                        <button className="p-2 bg-gray-800 text-gray-400 rounded hover:text-white"><Paperclip size={14} /></button>
                        <input
                            type="text"
                            className="flex-1 bg-[#0f0f0f] border border-gray-700 rounded px-2 py-1 text-xs text-white focus:border-blue-500 outline-none"
                            placeholder="Command the agent..."
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                        />
                        <button onClick={handleSend} className="p-2 bg-purple-600 hover:bg-purple-500 text-white rounded"><Send size={14} /></button>
                    </div>
                </div>
            </div>
        );
    }

    // For the global floating window
    return (
        <AnimatePresence>
            {isAgentOpen && (
                <motion.div
                    drag
                    dragMomentum={false}
                    initial={{ opacity: 0, scale: 0.9, y: 20 }}
                    animate={{
                        opacity: 1,
                        scale: 1,
                        y: 0,
                        width: size.width,
                        height: isMinimized ? 40 : size.height
                    }}
                    exit={{ opacity: 0, scale: 0.9, y: 20 }}
                    className={`fixed top-28 left-20 bg-[#0f0f0f] border border-gray-700 rounded-xl shadow-2xl z-50 flex flex-col overflow-hidden`}
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={handleDrop}
                >
                    {/* Header */}
                    <div className="bg-[#1a1a1a] p-2 border-b border-gray-800 flex justify-between items-center cursor-move select-none">
                        <AgentHeader />
                        <div className="flex gap-1" onPointerDownCapture={e => e.stopPropagation()}>
                            <button onClick={clearAgentHistory} className="p-1 hover:text-red-400 text-gray-500"><Trash2 size={12} /></button>
                            <button onClick={() => setIsMinimized(!isMinimized)} className="p-1 hover:text-white text-gray-500"><Minimize2 size={12} /></button>
                            <button onClick={toggleAgentWindow} className="p-1 hover:text-white text-gray-500"><X size={12} /></button>
                        </div>
                    </div>

                    {/* Chat Area */}
                    {!isMinimized && (
                        <>
                            <div ref={scrollRef} className="flex-1 p-3 overflow-y-auto space-y-3 custom-scrollbar bg-[#0f0f0f]" onPointerDownCapture={e => e.stopPropagation()}>
                                {agentHistory.length === 0 && (
                                    <div className="text-center text-xs text-gray-600 italic mt-4">
                                        I am {windowTitle}. How can I help you?
                                    </div>
                                )}
                                {agentHistory.map((msg) => (
                                    <div key={msg.id} className={`flex gap-2 mb-2 ${msg.role === 'user' ? 'justify-end' : ''}`}>
                                        {msg.role === 'model' && (
                                            <div className="w-6 h-6 rounded bg-purple-600 flex items-center justify-center text-[10px] flex-shrink-0 font-bold">AI</div>
                                        )}
                                        <div className={`p-2 rounded-lg text-xs max-w-[90%] ${msg.role === 'user' ? 'bg-blue-900/30 text-blue-100 border border-blue-800' :
                                            msg.role === 'system' ? 'text-gray-500 italic text-center w-full' :
                                                'bg-[#1a1a1a] text-gray-300 border border-gray-800'
                                            }`}>
                                            {msg.text}
                                            {msg.isStreaming && (
                                                <span className="inline-block w-2 h-4 ml-1 bg-purple-500 animate-pulse align-middle"></span>
                                            )}
                                            {msg.attachments && (
                                                <div className="mt-2 flex gap-1 flex-wrap">
                                                    {msg.attachments.map((att, i) => (
                                                        <img key={i} src={att.base64} className="w-12 h-12 object-cover rounded border border-white/10" />
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>

                            {/* Input Area */}
                            <div className="p-2 bg-[#1a1a1a] border-t border-gray-800 relative" onPointerDownCapture={e => e.stopPropagation()}>
                                {pendingAttachments.length > 0 && (
                                    <div className="flex gap-2 mb-2 overflow-x-auto pb-2">
                                        {pendingAttachments.map((att, i) => (
                                            <div key={i} className="relative group">
                                                <img src={att.preview} className="w-12 h-12 object-cover rounded border border-purple-500" />
                                                <button
                                                    onClick={() => setPendingAttachments(prev => prev.filter((_, idx) => idx !== i))}
                                                    className="absolute -top-1 -right-1 bg-red-500 text-white rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
                                                >
                                                    <X size={8} />
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                )}
                                <div className="flex gap-2">
                                    <button className="p-2 bg-gray-800 text-gray-400 rounded hover:text-white"><Paperclip size={14} /></button>
                                    <input
                                        type="text"
                                        className="flex-1 bg-[#0f0f0f] border border-gray-700 rounded px-2 py-1 text-xs text-white focus:border-blue-500 outline-none"
                                        placeholder="Command the agent..."
                                        value={input}
                                        onChange={(e) => setInput(e.target.value)}
                                        onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                                    />
                                    <button onClick={handleSend} className="p-2 bg-purple-600 hover:bg-purple-500 text-white rounded"><Send size={14} /></button>
                                </div>

                                {/* Resize Handle */}
                                <div
                                    className="absolute bottom-0 right-0 w-4 h-4 cursor-nwse-resize flex items-end justify-end p-0.5 hover:bg-gray-700/50 rounded-tl"
                                    onMouseDown={handleResizeStart}
                                >
                                    <div className="w-1.5 h-1.5 bg-gray-500 rounded-full opacity-50"></div>
                                </div>
                            </div>
                        </>
                    )}
                </motion.div>
            )}
        </AnimatePresence>
    );
}
