import React, { useEffect, useRef, useState, memo, useMemo } from 'react';
import { useStore, AgentMessage } from '@/core/store';
import { AgentThought } from '@/core/store/slices/agentSlice';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { motion, AnimatePresence } from 'framer-motion';
import { TextEffect } from '@/components/motion-primitives/text-effect';
import { Virtuoso, VirtuosoHandle } from 'react-virtuoso';
import VisualScriptRenderer from './VisualScriptRenderer';
import ScreenplayRenderer from './ScreenplayRenderer';
import CallSheetRenderer from './CallSheetRenderer';
import ContractRenderer from './ContractRenderer';
import { voiceService } from '@/services/ai/VoiceService';
import { Volume2, VolumeX } from 'lucide-react';

// --- Components ---

const ThoughtChain = memo(({ thoughts }: { thoughts: AgentThought[] }) => {
    const [isOpen, setIsOpen] = useState(true);

    if (!thoughts || thoughts.length === 0) return null;

    return (
        <div className="mb-3 border-l-2 border-gray-700 pl-3 ml-1">
            <button onClick={() => setIsOpen(!isOpen)} className="text-xs text-gray-500 hover:text-gray-300 flex items-center gap-2 mb-2 transition-colors">
                <span className="text-[10px]">{isOpen ? '▼' : '▶'}</span>
                <TextEffect per='char' preset='fade'>Thinking Process</TextEffect> <span className="opacity-50">({thoughts.length} steps)</span>
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
});

const MessageItem = memo(({ msg, avatarUrl }: { msg: AgentMessage; avatarUrl?: string }) => (
    <div className={`flex gap-3 ${msg.role === 'user' ? 'justify-end' : 'justify-start'} mb-4 px-1`}>
        {msg.role === 'model' && (
            avatarUrl ? (
                <img
                    src={avatarUrl}
                    className="w-8 h-8 rounded-full object-cover flex-shrink-0 shadow-lg shadow-purple-900/20 mt-1 border border-purple-500/30"
                    alt="AI"
                />
            ) : (
                <div className="w-8 h-8 rounded-full bg-purple-600 flex items-center justify-center text-xs font-bold flex-shrink-0 shadow-lg shadow-purple-900/20 mt-1">
                    AI
                </div>
            )
        )}

        <div
            data-testid={msg.role === 'model' ? 'agent-message' : 'user-message'}
            className={`max-w-[80%] rounded-2xl px-4 py-3 ${msg.role === 'user'
                ? 'bg-blue-600/20 text-blue-100 border border-blue-500/30 rounded-tr-sm'
                : msg.role === 'system'
                    ? 'bg-transparent text-gray-500 text-sm italic border border-transparent w-full text-center'
                    : 'bg-[#1a1f2e] text-gray-200 border border-gray-800 rounded-tl-sm shadow-xl'
                }`}>

            {msg.role === 'model' && msg.thoughts && <ThoughtChain thoughts={msg.thoughts} />}

            {msg.role !== 'system' && (
                <div className="prose prose-invert prose-sm max-w-none break-words leading-relaxed">
                    <ReactMarkdown
                        remarkPlugins={[remarkGfm]}
                        components={{
                            code({ node, inline, className, children, ...props }: any) {
                                const match = /language-(\w+)/.exec(className || '')
                                const isJson = match && match[1] === 'json';

                                // Contract Detection (Markdown content check)
                                const childrenStr = String(children);
                                if (!inline && (childrenStr.includes('# LEGAL AGREEMENT') || childrenStr.includes('**NON-DISCLOSURE AGREEMENT**'))) {
                                    return <ContractRenderer markdown={childrenStr} />;
                                }

                                if (!inline && isJson) {
                                    try {
                                        const content = childrenStr.replace(/\n$/, '');
                                        const data = JSON.parse(content);

                                        // Heuristic Detection
                                        if (data.beats && (data.title || data.synopsis)) {
                                            return <VisualScriptRenderer data={data} />;
                                        }
                                        if (data.elements && data.elements[0]?.type === 'slugline') {
                                            return <ScreenplayRenderer data={data} />;
                                        }
                                        if (data.callTime && data.nearestHospital) {
                                            return <CallSheetRenderer data={data} />;
                                        }

                                    } catch (e) {
                                        // Not valid JSON or unknown type
                                    }
                                }
                                return !inline && match ? (
                                    <code className={className} {...props}>
                                        {children}
                                    </code>
                                ) : (
                                    <code className={className} {...props}>
                                        {children}
                                    </code>
                                )
                            }
                        }}
                    >
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
));

const EMPTY_ARRAY: AgentMessage[] = [];

export default function ChatOverlay() {
    const agentHistory = useStore(state => state.agentHistory) || EMPTY_ARRAY;
    const isAgentOpen = useStore(state => state.isAgentOpen) || false;
    const userProfile = useStore(state => state.userProfile);
    const virtuosoRef = useRef<VirtuosoHandle>(null);

    const [isMuted, setIsMuted] = useState(true);
    const lastSpokenIdRef = useRef<string | null>(null);

    // Get the first available reference image to use as avatar
    const avatarUrl = userProfile?.brandKit?.referenceImages?.[0]?.url;

    // Auto-speak effect
    useEffect(() => {
        if (isMuted || !isAgentOpen) {
            voiceService.stopSpeaking();
            return;
        }

        const lastMsg = agentHistory[agentHistory.length - 1];
        if (lastMsg && lastMsg.role === 'model' && !lastMsg.isStreaming && lastMsg.text && lastMsg.id !== lastSpokenIdRef.current) {
            lastSpokenIdRef.current = lastMsg.id;
            const timer = setTimeout(() => voiceService.speak(lastMsg.text), 0);
            return () => clearTimeout(timer);
        }
    }, [agentHistory, isMuted, isAgentOpen]);

    if (!isAgentOpen) return null;

    return (
        <AnimatePresence>
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 20 }}
                className="absolute bottom-full left-0 right-0 h-[60vh] bg-gradient-to-t from-[#0d1117] via-[#0d1117]/95 to-transparent p-4 pb-2 z-40"
            >
                {/* Voice Toggle */}
                <button
                    onClick={() => setIsMuted(!isMuted)}
                    className="absolute top-4 right-8 p-2 rounded-full bg-black/50 hover:bg-black/70 text-gray-400 hover:text-white transition-colors z-50 backdrop-blur-sm border border-white/10"
                    title={isMuted ? "Unmute Text-to-Speech" : "Mute Text-to-Speech"}
                >
                    {isMuted ? <VolumeX size={16} /> : <Volume2 size={16} />}
                </button>

                {/* Virtualized Container */}
                <div className="w-full h-full max-w-4xl mx-auto relative">
                    <Virtuoso
                        ref={virtuosoRef}
                        style={{ height: '100%' }}
                        data={agentHistory}
                        itemContent={(index, msg) => <MessageItem msg={msg} avatarUrl={avatarUrl} />}
                        followOutput="smooth"
                        initialTopMostItemIndex={agentHistory.length > 0 ? agentHistory.length - 1 : 0}
                        className="custom-scrollbar"
                    />
                </div>
            </motion.div>
        </AnimatePresence>
    );
}
