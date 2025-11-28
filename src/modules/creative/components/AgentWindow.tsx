import React, { useState, useRef, useEffect } from 'react';
import { useStore } from '@/core/store';
import { agentService } from '@/services/agent/AgentService';
import { X, Minimize2, Trash2, Send, Paperclip } from 'lucide-react'; // Assuming lucide-react is installed

export default function AgentWindow() {
    const { agentHistory, clearAgentHistory, isAgentOpen, toggleAgentWindow } = useStore();
    const [input, setInput] = useState('');
    const [isMinimized, setIsMinimized] = useState(false);
    const scrollRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [agentHistory]);

    const handleSend = () => {
        if (!input.trim()) return;
        agentService.sendMessage(input);
        setInput('');
    };

    if (!isAgentOpen) return null;

    return (
        <div className={`fixed top-20 left-4 bg-[#0f0f0f] border border-gray-700 rounded-xl shadow-2xl z-50 flex flex-col w-72 transition-all duration-200 ${isMinimized ? 'h-10' : 'h-[85vh]'}`}>
            {/* Header */}
            <div className="bg-[#1a1a1a] p-2 border-b border-gray-800 flex justify-between items-center cursor-move select-none">
                <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></div>
                    <span className="font-bold text-xs text-gray-200">Agent R (React)</span>
                </div>
                <div className="flex gap-1">
                    <button onClick={clearAgentHistory} className="p-1 hover:text-red-400 text-gray-500"><Trash2 size={12} /></button>
                    <button onClick={() => setIsMinimized(!isMinimized)} className="p-1 hover:text-white text-gray-500"><Minimize2 size={12} /></button>
                    <button onClick={toggleAgentWindow} className="p-1 hover:text-white text-gray-500"><X size={12} /></button>
                </div>
            </div>

            {/* Chat Area */}
            {!isMinimized && (
                <>
                    <div ref={scrollRef} className="flex-1 p-3 overflow-y-auto space-y-3 custom-scrollbar bg-[#0f0f0f]">
                        {agentHistory.length === 0 && (
                            <div className="text-center text-xs text-gray-600 italic mt-4">
                                I am Agent R. How can I help you?
                            </div>
                        )}
                        {agentHistory.map((msg) => (
                            <div key={msg.id} className={`flex gap-2 mb-2 ${msg.role === 'user' ? 'justify-end' : ''}`}>
                                {msg.role === 'model' && (
                                    <div className="w-6 h-6 rounded bg-purple-600 flex items-center justify-center text-[10px] flex-shrink-0 font-bold">AR</div>
                                )}
                                <div className={`p-2 rounded-lg text-xs max-w-[90%] ${msg.role === 'user' ? 'bg-blue-900/30 text-blue-100 border border-blue-800' :
                                    msg.role === 'system' ? 'text-gray-500 italic text-center w-full' :
                                        'bg-[#1a1a1a] text-gray-300 border border-gray-800'
                                    }`}>
                                    {msg.text}
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* Input Area */}
                    <div className="p-2 bg-[#1a1a1a] border-t border-gray-800">
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
                </>
            )}
        </div>
    );
}
