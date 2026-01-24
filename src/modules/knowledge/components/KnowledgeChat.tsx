import React, { useState, useEffect, useRef } from 'react';
import { Send, Bot, User, Loader2, Sparkles, X, Copy, Trash2, ChevronDown } from 'lucide-react';
import { knowledgeBaseService, ChatMessage, KnowledgeDoc } from '../services/KnowledgeBaseService';

interface KnowledgeChatProps {
    isOpen: boolean;
    onClose: () => void;
    activeDoc: KnowledgeDoc | null;
}

const SUGGESTED_QUESTIONS = [
    "Summarize this document",
    "What are the key takeaways?",
    "Explain this like I'm five",
    "Is there any action required?"
];

export const KnowledgeChat: React.FC<KnowledgeChatProps> = ({ isOpen, onClose, activeDoc }) => {
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [input, setInput] = useState('');
    const [isTyping, setIsTyping] = useState(false);
    const [streamingContent, setStreamingContent] = useState('');
    const scrollRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (messages.length === 0) {
            setMessages([{
                id: 'welcome',
                role: 'model',
                content: "Hello! I'm your Neural Knowledge Assistant. Ask me anything about your documents.",
                timestamp: Date.now()
            }]);
        }
    }, [messages.length]);

    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [messages, streamingContent, isOpen]);

    const handleSend = async (text: string = input) => {
        const query = text.trim();
        if (!query || isTyping) return;

        const userMsg: ChatMessage = {
            id: Date.now().toString(),
            role: 'user',
            content: query,
            timestamp: Date.now()
        };

        setMessages(prev => [...prev, userMsg]);
        setInput('');
        setIsTyping(true);
        setStreamingContent('');

        try {
            let fullContent = '';
            for await (const chunk of knowledgeBaseService.chatStream(query, activeDoc?.id)) {
                fullContent += chunk;
                setStreamingContent(fullContent);
            }

            const botMsg: ChatMessage = {
                id: Date.now().toString(),
                role: 'model',
                content: fullContent,
                timestamp: Date.now()
            };
            setMessages(prev => [...prev, botMsg]);
        } catch (error) {
            const errorMsg: ChatMessage = {
                id: Date.now().toString(),
                role: 'model',
                content: "I apologize, but I encountered an error processing your request.",
                timestamp: Date.now(),
                isError: true
            };
            setMessages(prev => [...prev, errorMsg]);
        } finally {
            setIsTyping(false);
            setStreamingContent('');
        }
    };

    const handleCopy = (content: string) => {
        navigator.clipboard.writeText(content);
        // Toast could be added here if context is available
    };

    const clearChat = () => {
        setMessages([]);
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 md:inset-auto md:right-0 md:top-[64px] md:bottom-0 w-full md:w-[420px] bg-bg-dark/95 backdrop-blur-2xl border-l border-gray-800 shadow-2xl z-40 flex flex-col transition-all duration-300 animate-in slide-in-from-right">
            {/* Header */}
            <div className="p-4 border-b border-gray-800 flex items-center justify-between bg-black/40">
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-[#FFE135]/10 rounded-xl border border-[#FFE135]/20">
                        <Sparkles size={18} className="text-[#FFE135] animate-pulse" />
                    </div>
                    <div>
                        <div className="flex items-center gap-2">
                            <h2 className="font-bold text-white tracking-tight">Neural Chat</h2>
                            <span className="text-[10px] font-black bg-[#FFE135] text-black px-1.5 py-0.5 rounded uppercase tracking-wider">Beta</span>
                        </div>
                        {activeDoc && (
                            <p className="text-[10px] text-gray-500 truncate max-w-[180px] uppercase tracking-widest mt-0.5">Focus: {activeDoc.title}</p>
                        )}
                    </div>
                </div>
                <div className="flex items-center gap-1">
                    <button onClick={clearChat} title="Clear Chat" className="p-2 hover:bg-red-500/10 rounded-lg text-gray-500 hover:text-red-400 transition-colors">
                        <Trash2 size={16} />
                    </button>
                    <button onClick={onClose} className="p-2 hover:bg-gray-800 rounded-lg text-gray-500 hover:text-white transition-colors">
                        <X size={18} />
                    </button>
                </div>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-5 space-y-6 custom-scrollbar" ref={scrollRef}>
                {messages.map((msg) => (
                    <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'} group animate-in fade-in slide-in-from-bottom-2`}>
                        <div className={`relative max-w-[85%] p-4 rounded-2xl text-sm leading-relaxed ${msg.role === 'user'
                            ? 'bg-[#FFE135] text-black rounded-tr-none font-semibold shadow-[0_4px_15px_rgba(255,225,53,0.15)]'
                            : 'bg-[#161b22]/80 text-gray-200 rounded-tl-none border border-gray-800/50 backdrop-blur-md'
                            }`}>
                            {msg.content}
                            {msg.role === 'model' && (
                                <button
                                    onClick={() => handleCopy(msg.content)}
                                    className="absolute -right-10 top-0 p-1.5 opacity-0 group-hover:opacity-100 hover:bg-gray-800 rounded text-gray-500 hover:text-[#FFE135] transition-all"
                                    title="Copy to clipboard"
                                >
                                    <Copy size={14} />
                                </button>
                            )}
                        </div>
                    </div>
                ))}

                {/* Streaming Indicator */}
                {(isTyping || streamingContent) && (
                    <div className="flex justify-start animate-in fade-in slide-in-from-bottom-2">
                        <div className="max-w-[85%] p-4 bg-[#161b22]/80 text-gray-200 rounded-2xl rounded-tl-none border border-gray-800/50 backdrop-blur-md flex flex-col gap-2">
                            {!streamingContent ? (
                                <div className="flex items-center gap-2">
                                    <Loader2 size={14} className="animate-spin text-[#FFE135]" />
                                    <span className="text-xs text-gray-500 font-medium animate-pulse">Initializing Neural Link...</span>
                                </div>
                            ) : (
                                <div className="whitespace-pre-wrap">{streamingContent}</div>
                            )}
                        </div>
                    </div>
                )}
            </div>

            {/* Footer / Input */}
            <div className="p-5 bg-black/40 border-t border-gray-800">
                {/* Suggested Questions */}
                {messages.length < 3 && !isTyping && (
                    <div className="flex flex-wrap gap-2 mb-4">
                        {SUGGESTED_QUESTIONS.map((q, i) => (
                            <button
                                key={i}
                                onClick={() => handleSend(q)}
                                className="text-[10px] px-3 py-1.5 bg-gray-800/50 hover:bg-[#FFE135]/10 border border-gray-700 hover:border-[#FFE135]/30 text-gray-400 hover:text-[#FFE135] rounded-full transition-all duration-300"
                            >
                                {q}
                            </button>
                        ))}
                    </div>
                )}

                <div className="relative group">
                    <input
                        type="text"
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                        placeholder={activeDoc ? `Neural Analysis of "${activeDoc.title}"...` : "Query Intelligence Base..."}
                        className="w-full bg-[#161b22] border border-gray-700 group-focus-within:border-[#FFE135]/40 text-white rounded-2xl pl-5 pr-14 py-4 focus:outline-none focus:ring-4 focus:ring-[#FFE135]/5 transition-all placeholder-gray-600 shadow-inner"
                    />
                    <button
                        onClick={() => handleSend()}
                        disabled={!input.trim() || isTyping}
                        aria-label="Send Message"
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 p-2.5 bg-[#FFE135] text-black hover:scale-105 active:scale-95 disabled:scale-100 rounded-xl disabled:bg-gray-800 disabled:text-gray-600 transition-all shadow-lg"
                    >
                        <Send size={18} />
                    </button>
                </div>
            </div>
        </div>
    );
};
