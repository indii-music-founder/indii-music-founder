import React, { useEffect, useRef, useState } from 'react';
import { useStore, AgentMessage } from '@/core/store';
import { AgentThought } from '@/core/store/slices/agentSlice';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { motion, AnimatePresence } from 'framer-motion';

const ThoughtChain = ({ thoughts }: { thoughts: AgentThought[] }) => {
    const [isOpen, setIsOpen] = useState(true);

    if (!thoughts || thoughts.length === 0) return null;

    return (
        <div className="mb-3 border-l-2 border-gray-700 pl-3 ml-1">
            <button onClick={() => setIsOpen(!isOpen)} className="text-xs text-gray-500 hover:text-gray-300 flex items-center gap-2 mb-2 transition-colors">
                <span className="text-[10px]">{isOpen ? '▼' : '▶'}</span>
                Thinking Process <span className="opacity-50">({thoughts.length} steps)</span>
            </button>
            <AnimatePresence>
                {isOpen && (
                    <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="space-y-2 overflow-hidden"
                    >
                        {thoughts.map(thought => (
                            <div key={thought.id} className="text-xs text-gray-400 font-mono flex items-start gap-2 leading-relaxed">
                                <span className="opacity-50 mt-0.5 select-none text-[10px]">
                                    {thought.type === 'tool' ? '🛠️' : '🧠'}
                                </span>
                                <span className={thought.type === 'error' ? 'text-red-400' : ''}>{thought.text}</span>
                            </div>
                        ))}
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};

export default function ChatOverlay() {
    const { agentHistory, isAgentOpen } = useStore();
    const scrollRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [agentHistory, isAgentOpen, agentHistory.map(m => m.thoughts?.length).join(',')]);

    if (!isAgentOpen) return null;

    return (
        <AnimatePresence>
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 20 }}
                className="absolute bottom-full left-0 right-0 max-h-[60vh] overflow-y-auto custom-scrollbar bg-gradient-to-t from-[#0d1117] via-[#0d1117]/95 to-transparent p-4 pb-2"
                ref={scrollRef}
            >
                <div className="max-w-4xl mx-auto space-y-4">
                    {agentHistory.map((msg) => (
                        <div key={msg.id} className={`flex gap-3 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                            {msg.role === 'model' && (
                                <div className="w-8 h-8 rounded-full bg-purple-600 flex items-center justify-center text-xs font-bold flex-shrink-0 shadow-lg shadow-purple-900/20 mt-1">
                                    AI
                                </div>
                            )}

                            <div className={`max-w-[80%] rounded-2xl px-4 py-3 ${msg.role === 'user'
                                ? 'bg-blue-600/20 text-blue-100 border border-blue-500/30 rounded-tr-sm'
                                : msg.role === 'system'
                                    ? 'bg-transparent text-gray-500 text-sm italic border border-transparent w-full text-center'
                                    : 'bg-[#1a1a1a] text-gray-200 border border-gray-800 rounded-tl-sm shadow-xl'
                                }`}>

                                {msg.role === 'model' && msg.thoughts && <ThoughtChain thoughts={msg.thoughts} />}

                                {msg.role !== 'system' && (
                                    <div className="prose prose-invert prose-sm max-w-none break-words leading-relaxed">
                                        <ReactMarkdown remarkPlugins={[remarkGfm]}>
                                            {msg.text}
                                        </ReactMarkdown>
                                    </div>
                                )}
                                {msg.role === 'system' && <span>{msg.text}</span>}

                                {msg.isStreaming && (
                                    <span className="inline-block w-2 h-4 ml-1 bg-purple-500 animate-pulse align-middle rounded-full"></span>
                                )}

                                {msg.attachments && (
                                    <div className="mt-3 flex gap-2 flex-wrap">
                                        {msg.attachments.map((att, i) => (
                                            <img key={i} src={att.base64} className="w-20 h-20 object-cover rounded-lg border border-white/10 shadow-sm" alt="attachment" />
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            </motion.div>
        </AnimatePresence>
    );
}
