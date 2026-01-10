import React, { useEffect, useRef, useState, memo, useMemo } from 'react';
import { useStore, AgentMessage, AgentThought } from '@/core/store';
import { useVoice } from '@/core/context/VoiceContext';
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
import { Volume2, VolumeX, ChevronDown, ChevronRight, FileJson, X, Bot, Sparkles, History as HistoryIcon, Plus, UserPlus } from 'lucide-react';

const CollapsibleJson = ({ data }: { data: any }) => {
    const [isOpen, setIsOpen] = useState(false);
    return (
        <div className="my-4 p-4 bg-black/40 rounded-2xl border border-white/5 backdrop-blur-md shadow-inner overflow-hidden relative group">
            <div className="absolute inset-0 bg-gradient-to-br from-purple-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="relative z-10 text-[11px] font-bold text-gray-400 hover:text-purple-300 flex items-center gap-3 transition-colors uppercase tracking-widest"
            >
                <div className={`p-1.5 rounded-lg border border-white/10 bg-white/5 transition-transform ${isOpen ? 'rotate-90' : ''}`}>
                    <ChevronRight size={12} />
                </div>
                <div className="flex items-center gap-2">
                    <FileJson size={14} className="text-purple-400/70" />
                    <span>{isOpen ? 'Secure Payload' : 'View Payload Data'}</span>
                </div>
            </button>
            <AnimatePresence>
                {isOpen && (
                    <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="relative z-10"
                    >
                        <pre className="mt-4 text-[10px] text-gray-500 overflow-x-auto custom-scrollbar p-3 bg-black/60 rounded-xl border border-white/5 font-mono leading-relaxed">
                            {JSON.stringify(data, null, 2)}
                        </pre>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};

// --- Components ---

const ThoughtChain = memo(({ thoughts, messageId }: { thoughts: AgentThought[]; messageId: string }) => {
    const [isOpen, setIsOpen] = useState(true);
    const contentId = `thought-chain-${messageId}`;

    if (!thoughts || thoughts.length === 0) return null;

    return (
        <div className="mb-5 relative">
            <div className="absolute left-0 top-8 bottom-0 w-px bg-gradient-to-b from-purple-500/30 to-transparent" />
            <button
                onClick={() => setIsOpen(!isOpen)}
                aria-expanded={isOpen}
                aria-controls={contentId}
                className="group flex items-center gap-3 mb-3 h-8 px-3 rounded-full bg-white/5 border border-white/5 hover:bg-white/10 hover:border-white/10 transition-all"
            >
                <div className={`w-2 h-2 rounded-full bg-purple-500 shadow-[0_0_8px_rgba(168,85,247,0.8)] ${isOpen ? 'animate-pulse' : ''}`} />
                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-[0.15em] flex items-center gap-2">
                    <TextEffect per='char' preset='fade'>Cognitive Logic</TextEffect>
                    <span className="text-[9px] text-gray-600 font-mono">[{thoughts.length} ITERATIONS]</span>
                </span>
                <span className={`text-gray-600 group-hover:text-gray-400 transition-transform ${isOpen ? 'rotate-180' : ''}`}>
                    <ChevronDown size={12} />
                </span>
            </button>
            <AnimatePresence>
                {isOpen && (
                    <motion.div
                        initial={{ height: 0, opacity: 0, x: -5 }}
                        animate={{ height: 'auto', opacity: 1, x: 0 }}
                        exit={{ height: 0, opacity: 0, x: -5 }}
                        id={contentId}
                        role="region"
                        className="space-y-3 pl-6 overflow-hidden"
                    >
                        {thoughts.map(thought => (
                            <div key={thought.id} className="text-[11px] text-gray-400 font-mono flex items-start gap-3 leading-relaxed group/item">
                                <span className="opacity-40 mt-1 select-none text-[10px] group-hover/item:opacity-100 transition-opacity">
                                    {thought.type === 'tool' ? '⚡' : '🧠'}
                                </span>
                                <span className={`${thought.type === 'error' ? 'text-red-400' : 'text-gray-400 group-hover/item:text-gray-300'} transition-colors`}>
                                    {thought.text.length > 250 ? thought.text.substring(0, 250) + '...' : thought.text}
                                </span>
                            </div>
                        ))}
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
});

const MessageItem = memo(({ msg, avatarUrl }: { msg: AgentMessage; avatarUrl?: string }) => (
    <motion.div
        initial={{ opacity: 0, y: 10, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ type: 'spring', stiffness: 400, damping: 30 }}
        className={`flex gap-4 ${msg.role === 'user' ? 'justify-end' : 'justify-start'} mb-6 px-1`}
    >
        {msg.role === 'model' && (
            <div className="relative mt-1 flex-shrink-0">
                <div className="absolute -inset-1 bg-purple-500/20 rounded-full blur-sm opacity-0 group-hover:opacity-100 transition-opacity"></div>
                {avatarUrl ? (
                    <img
                        src={avatarUrl}
                        className="w-9 h-9 rounded-full object-cover relative z-10 border border-purple-500/30 shadow-[0_0_15px_rgba(168,85,247,0.2)]"
                        alt="AI"
                    />
                ) : (
                    <div className="w-9 h-9 rounded-full bg-gradient-to-br from-purple-600 to-purple-800 flex items-center justify-center text-xs font-bold relative z-10 border border-purple-500/30">
                        <Bot size={18} className="text-purple-200" />
                    </div>
                )}
            </div>
        )}

        <div
            data-testid={msg.role === 'model' ? 'agent-message' : 'user-message'}
            aria-live={msg.role === 'model' && msg.isStreaming ? 'polite' : undefined}
            className={`max-w-[85%] rounded-[1.5rem] px-5 py-4 relative group transition-all duration-300 ${msg.role === 'user'
                ? 'bg-gradient-to-br from-white/10 to-transparent text-gray-100 border border-white/10 rounded-tr-sm shadow-sm'
                : msg.role === 'system'
                    ? 'bg-white/5 backdrop-blur-sm text-gray-400 text-[11px] font-mono tracking-wider uppercase border border-white/5 w-full text-center rounded-xl p-2'
                    : 'bg-gradient-to-br from-[rgba(16,16,22,0.6)] to-[rgba(10,10,14,0.9)] text-gray-200 border border-white/5 rounded-tl-sm shadow-[0_10px_30px_-10px_rgba(0,0,0,0.5)]'
                }`}>

            {msg.role === 'model' && msg.thoughts && <ThoughtChain thoughts={msg.thoughts} messageId={msg.id} />}

            <div className="prose prose-invert prose-sm max-w-none break-words leading-[1.6] font-medium tracking-tight">
                <ReactMarkdown
                    remarkPlugins={[remarkGfm]}
                    components={{
                        img: ImageRenderer,
                        pre: ({ children, ...props }: any) => {
                            if (React.isValidElement(children)) {
                                const { className, children: codeChildren } = children.props as any;
                                const content = String(codeChildren || '');
                                const match = /language-(\w+)/.exec(className || '');
                                const isJson = match && match[1] === 'json';

                                if (content.includes('# LEGAL AGREEMENT') || content.includes('**NON-DISCLOSURE AGREEMENT**')) {
                                    return <>{children}</>;
                                }

                                if (isJson) {
                                    try {
                                        JSON.parse(content.replace(/\n$/, ''));
                                        return <>{children}</>;
                                    } catch (e) { }
                                }
                            }
                            return <pre {...props}>{children}</pre>;
                        },
                        table: ({ node, ...props }: any) => (
                            <div className="overflow-x-auto custom-scrollbar my-4 border border-white/5 rounded-lg bg-black/20">
                                <table {...props} className="min-w-full" />
                            </div>
                        ),
                        code({ node, inline, className, children, ...props }: any) {
                            const match = /language-(\w+)/.exec(className || '')
                            const isJson = match && match[1] === 'json';
                            const childrenStr = String(children);

                            if (!inline && (childrenStr.includes('# LEGAL AGREEMENT') || childrenStr.includes('**NON-DISCLOSURE AGREEMENT**'))) {
                                return <ContractRenderer markdown={childrenStr} />;
                            }

                            if (!inline && isJson) {
                                try {
                                    const content = childrenStr.replace(/\n$/, '');
                                    const data = JSON.parse(content);
                                    if (data.beats && (data.title || data.synopsis)) return <VisualScriptRenderer data={data} />;
                                    if (data.elements && data.elements[0]?.type === 'slugline') return <ScreenplayRenderer data={data} />;
                                    if (data.callTime && data.nearestHospital) return <CallSheetRenderer data={data} />;
                                    return <CollapsibleJson data={data} />;
                                } catch (e) { }
                            }
                            return <code className={className} {...props}>{children}</code>
                        }
                    }}
                >
                    {msg.text}
                </ReactMarkdown>
            </div>

            {msg.role === 'system' && <span>{msg.text}</span>}

            {msg.isStreaming && (
                <div className="mt-2 flex items-center gap-1.5 h-4" role="status" aria-label="AI is thinking">
                    <motion.div
                        animate={{ scale: [1, 1.5, 1], opacity: [0.5, 1, 0.5] }}
                        transition={{ repeat: Infinity, duration: 1.5, ease: "easeInOut" }}
                        className="w-1.5 h-1.5 bg-purple-500 rounded-full"
                    />
                    <motion.div
                        animate={{ scale: [1, 1.5, 1], opacity: [0.5, 1, 0.5] }}
                        transition={{ repeat: Infinity, duration: 1.5, ease: "easeInOut", delay: 0.2 }}
                        className="w-1.5 h-1.5 bg-purple-500/60 rounded-full"
                    />
                    <motion.div
                        animate={{ scale: [1, 1.5, 1], opacity: [0.5, 1, 0.5] }}
                        transition={{ repeat: Infinity, duration: 1.5, ease: "easeInOut", delay: 0.4 }}
                        className="w-1.5 h-1.5 bg-purple-500/30 rounded-full"
                    />
                </div>
            )}

            {msg.attachments && (
                <div className="mt-4 flex gap-3 flex-wrap">
                    {msg.attachments.map((att, i) => (
                        <motion.div
                            key={i}
                            whileHover={{ scale: 1.05, rotate: 2 }}
                            className="relative group/att"
                        >
                            <div className="absolute inset-0 bg-purple-500/20 blur opacity-0 group-hover/att:opacity-100 transition-opacity rounded-xl"></div>
                            <img src={att.base64} className="w-24 h-24 object-cover rounded-xl border border-white/10 shadow-lg relative z-10" alt="attachment" />
                        </motion.div>
                    ))}
                </div>
            )}
        </div>
    </motion.div>
));

const EMPTY_ARRAY: AgentMessage[] = [];

const ImageRenderer = ({ src, alt }: { src?: string; alt?: string }) => {
    const { setModule, setGenerationMode, setViewMode, setSelectedItem, generatedHistory, currentProjectId } = useStore.getState();
    const [isHovered, setIsHovered] = useState(false);

    const handleClick = () => {
        if (!src) return;

        // 1. Try to find the image in history
        const historyItem = generatedHistory.find(h => h.url === src);

        // 2. Prepare item (found or temp)
        const itemToEdit = historyItem || {
            id: crypto.randomUUID(),
            url: src,
            prompt: alt || 'Imported Image',
            type: 'image',
            timestamp: Date.now(),
            projectId: currentProjectId
        };

        // 3. Navigate
        setModule('creative');
        setGenerationMode('image');
        setViewMode('canvas');
        setSelectedItem(itemToEdit);
    };

    return (
        <div
            className="group relative inline-block my-2 cursor-pointer rounded-lg overflow-hidden border border-white/10 shadow-lg transition-transform hover:scale-[1.02]"
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
            onClick={handleClick}
        >
            <img
                src={src}
                alt={alt}
                className="max-w-full h-auto rounded-lg"
                style={{ maxHeight: '400px' }}
            />

            {/* Hover Overlay */}
            <div className={`absolute inset-0 bg-black/50 flex items-center justify-center transition-opacity duration-200 ${isHovered ? 'opacity-100' : 'opacity-0'}`}>
                <div className="bg-purple-600 text-white px-4 py-2 rounded-full font-bold text-sm flex items-center gap-2 shadow-xl transform scale-100 hover:scale-105 transition-transform">
                    <span>✏️ Edit in Studio</span>
                </div>
            </div>
        </div>
    );
};

export default function ChatOverlay() {
    const agentHistory = useStore(state => state.agentHistory) || EMPTY_ARRAY;
    const isAgentOpen = useStore(state => state.isAgentOpen) || false;
    const userProfile = useStore(state => state.userProfile);
    const virtuosoRef = useRef<VirtuosoHandle>(null);

    const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;

    const { isVoiceEnabled, setVoiceEnabled } = useVoice();
    const lastSpokenIdRef = useRef<string | null>(null);

    // Desktop: Bottom overlay state
    const [showHistory, setShowHistory] = useState(false);
    const [showInvite, setShowInvite] = useState(false);
    const activeSessionId = useStore(state => state.activeSessionId);
    const sessions = useStore(state => state.sessions);
    const createSession = useStore(state => state.createSession);
    const currentSession = activeSessionId ? sessions[activeSessionId] : null;

    // Load sessions on mount if open
    const loadSessions = useStore(state => state.loadSessions);
    useEffect(() => {
        if (isAgentOpen) {
            loadSessions();
        }
    }, [isAgentOpen, loadSessions]);

    // Lazy load UI components
    const [ConversationHistoryList, setConversationHistoryList] = useState<any>(null);
    const [AgentSelector, setAgentSelector] = useState<any>(null);

    useEffect(() => {
        if (showHistory && !ConversationHistoryList) {
            import('./ConversationHistoryList').then(m => setConversationHistoryList(() => m.ConversationHistoryList));
        }
    }, [showHistory]);

    useEffect(() => {
        if (showInvite && !AgentSelector) {
            import('./AgentSelector').then(m => setAgentSelector(() => m.AgentSelector));
        }
    }, [showInvite]);

    // Get the first available reference image to use as avatar
    const avatarUrl = userProfile?.brandKit?.referenceImages?.[0]?.url;

    // Auto-speak effect
    useEffect(() => {
        if (!isVoiceEnabled || !isAgentOpen) {
            voiceService.stopSpeaking();
            return;
        }

        const lastMsg = agentHistory[agentHistory.length - 1];
        if (lastMsg && lastMsg.role === 'model' && !lastMsg.isStreaming && lastMsg.text && lastMsg.id !== lastSpokenIdRef.current) {
            lastSpokenIdRef.current = lastMsg.id;

            const VOICE_MAP: Record<string, string> = {
                'kyra': 'Kore',
                'liora': 'Vega',
                'mistral': 'Charon',
                'seraph': 'Capella',
                'vance': 'Puck'
            };
            const voice = lastMsg.agentId ? VOICE_MAP[lastMsg.agentId.toLowerCase()] || 'Kore' : 'Kore';

            const timer = setTimeout(() => voiceService.speak(lastMsg.text, voice), 0);
            return () => clearTimeout(timer);
        }
    }, [agentHistory, isVoiceEnabled, isAgentOpen]);

    if (!isAgentOpen) return null;

    // Mobile: Full-screen modal
    if (isMobile) {
        return (
            <AnimatePresence>
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="fixed inset-0 z-[70] flex flex-col bg-[#0d1117]"
                >
                    {/* Mobile Header */}
                    <div className="flex items-center justify-between p-4 border-b border-white/10 mobile-safe-top">
                        <div className="flex items-center gap-2">
                            {avatarUrl ? (
                                <img
                                    src={avatarUrl}
                                    className="w-8 h-8 rounded-full object-cover border border-purple-500/30"
                                    alt="AI"
                                />
                            ) : (
                                <div className="w-8 h-8 rounded-full bg-purple-600 flex items-center justify-center text-xs font-bold">
                                    AI
                                </div>
                            )}
                            <h2 className="text-white font-semibold">AI Assistant</h2>
                        </div>
                        <button
                            onClick={() => useStore.getState().toggleAgentWindow()}
                            className="p-2 hover:bg-white/10 rounded-full transition-colors text-gray-400"
                            aria-label="Close Agent"
                        >
                            <X size={20} />
                        </button>
                    </div>

                    {/* Mobile Content */}
                    <div className="flex-1 overflow-y-auto custom-scrollbar p-4">
                        <Virtuoso
                            ref={virtuosoRef}
                            style={{ height: '100%' }}
                            data={agentHistory}
                            itemContent={(index, msg) => <MessageItem msg={msg} avatarUrl={avatarUrl} />}
                            followOutput="smooth"
                            initialTopMostItemIndex={agentHistory.length > 0 ? agentHistory.length - 1 : 0}
                        />
                    </div>

                    {/* Mobile Footer with Voice Toggle */}
                    <div className="flex items-center justify-between p-4 border-t border-white/10 bg-[#0d1117] mobile-safe-bottom">
                        <span className="text-xs text-gray-500">
                            {agentHistory.length} messages
                        </span>
                        <button
                            onClick={() => setVoiceEnabled(!isVoiceEnabled)}
                            className={`p-2 rounded-full transition-all border ${isVoiceEnabled
                                ? 'bg-purple-600/20 text-purple-400 border-purple-500/30'
                                : 'bg-black/50 text-gray-500 border-white/10'
                                }`}
                            aria-label={isVoiceEnabled ? "Mute Voice" : "Enable Voice"}
                        >
                            {!isVoiceEnabled ? <VolumeX size={16} /> : <Volume2 size={16} />}
                        </button>
                    </div>
                </motion.div>
            </AnimatePresence>
        );
    }

    return (
        <AnimatePresence>
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 20 }}
                // Restrict width to avoid covering the right sidebar (approx 300-350px)
                className="absolute bottom-full left-4 right-[350px] mb-4 h-[65vh] rounded-2xl overflow-hidden z-40 p-0 pointer-events-none origin-bottom flex border border-white/10 shadow-[0_20px_50px_rgba(0,0,0,0.5),0_1px_0_rgba(255,255,255,0.1)_inset]"
                style={{
                    background: 'linear-gradient(135deg, rgba(8, 8, 10, 0.85) 0%, rgba(13, 13, 16, 0.95) 100%)',
                    backdropFilter: 'blur(32px) saturate(180%)',
                    boxShadow: '0 0 0 1px rgba(255,255,255,0.05) inset'
                }}
            >
                <div className="pointer-events-auto h-full flex flex-row w-full relative">
                    {/* Noise Texture Overlay */}
                    <div className="absolute inset-0 z-0 opacity-[0.03] pointer-events-none mix-blend-overlay" style={{ backgroundImage: 'url("data:image/svg+xml,%3Csvg viewBox=\'0 0 200 200\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cfilter id=\'noiseFilter\'%3E%3CfeTurbulence type=\'fractalNoise\' baseFrequency=\'0.65\' numOctaves=\'3\' stitchTiles=\'stitch\'/%3E%3C/filter%3E%3Crect width=\'100%25\' height=\'100%25\' filter=\'url(%23noiseFilter)\'/%3E%3C/svg%3E")' }}></div>

                    {/* Session Sidebar */}
                    <AnimatePresence>
                        {showHistory && ConversationHistoryList && (
                            <motion.div
                                initial={{ width: 0, opacity: 0 }}
                                animate={{ width: 260, opacity: 1 }}
                                exit={{ width: 0, opacity: 0 }}
                                transition={{ type: 'spring', stiffness: 300, damping: 30 }}
                                className="overflow-hidden h-full border-r border-white/5 relative z-10 bg-black/20"
                            >
                                <ConversationHistoryList onClose={() => setShowHistory(false)} />
                            </motion.div>
                        )}
                    </AnimatePresence>

                    {/* Main Chat Area */}
                    <div className="flex-1 flex flex-col h-full min-w-0 relative z-10">
                        {/* Desktop Header */}
                        <div className="flex items-center justify-between px-6 py-4 border-b border-white/5 bg-gradient-to-b from-white/5 to-transparent backdrop-blur-md">
                            <div className="flex items-center gap-4">
                                <div className="relative group">
                                    <div className="absolute -inset-1 bg-gradient-to-r from-purple-600 to-blue-600 rounded-full blur opacity-40 group-hover:opacity-60 transition duration-500"></div>
                                    <div className="relative w-9 h-9 rounded-full bg-black flex items-center justify-center border border-white/10 overflow-hidden">
                                        {avatarUrl ? (
                                            <img src={avatarUrl} alt="Indii" className="w-full h-full object-cover" />
                                        ) : (
                                            <Sparkles size={18} className="text-purple-300" />
                                        )}
                                    </div>
                                </div>

                                <div className="min-w-0 flex flex-col justify-center">
                                    <h3 className="text-[15px] font-bold text-white leading-tight flex items-center gap-2 tracking-tight">
                                        {currentSession?.title || 'Talk to Indii'}
                                        <span className="px-1.5 py-0.5 rounded-full text-[9px] font-bold bg-purple-500/10 text-purple-300 border border-purple-500/20 shadow-[0_0_10px_rgba(168,85,247,0.2)]">
                                            BETA
                                        </span>
                                    </h3>
                                    <div className="flex items-center gap-2 text-xs text-gray-400 font-medium">
                                        <span>AI Orchestrator</span>
                                        {currentSession && currentSession.participants.length > 1 && (
                                            <>
                                                <span className="w-1 h-1 rounded-full bg-gray-600"></span>
                                                <span className="text-purple-300 shine-text">{currentSession.participants.length} Agents Active</span>
                                            </>
                                        )}
                                    </div>
                                </div>
                            </div>

                            <div className="flex items-center gap-2">
                                <button
                                    onClick={() => setShowInvite(!showInvite)}
                                    className={`p-2 rounded-xl transition-all duration-300 border ${showInvite
                                        ? 'bg-white/10 text-white border-white/20 shadow-inner'
                                        : 'bg-transparent text-gray-400 border-transparent hover:bg-white/5 hover:text-white'
                                        }`}
                                    title="Invite"
                                    aria-label="Invite"
                                >
                                    <UserPlus size={18} strokeWidth={1.5} />
                                </button>

                                <button
                                    onClick={() => setShowHistory(!showHistory)}
                                    className={`p-2 rounded-xl transition-all duration-300 border ${showHistory
                                        ? 'bg-white/10 text-white border-white/20 shadow-inner'
                                        : 'bg-transparent text-gray-400 border-transparent hover:bg-white/5 hover:text-white'
                                        }`}
                                    title="History"
                                    aria-label="History"
                                >
                                    <HistoryIcon size={18} strokeWidth={1.5} />
                                </button>

                                <button
                                    onClick={() => createSession()}
                                    className="p-2 rounded-xl transition-all duration-300 border bg-transparent text-gray-400 border-transparent hover:bg-white/5 hover:text-white"
                                    title="New"
                                    aria-label="New Session"
                                >
                                    <Plus size={18} strokeWidth={1.5} />
                                </button>

                                <div className="w-px h-5 bg-white/10 mx-2"></div>

                                <button
                                    onClick={() => setVoiceEnabled(!isVoiceEnabled)}
                                    className={`p-2 rounded-xl transition-all duration-300 relative overflow-hidden ${isVoiceEnabled
                                        ? 'text-white shadow-[0_0_15px_rgba(147,51,234,0.4)] border border-purple-500/50'
                                        : 'text-gray-400 hover:text-white hover:bg-white/5 border border-transparent'
                                        }`}
                                    aria-label={isVoiceEnabled ? "Mute Voice" : "Enable Voice"}
                                >
                                    <div className={`absolute inset-0 bg-gradient-to-tr from-purple-600/20 to-blue-600/20 transition-opacity duration-300 ${isVoiceEnabled ? 'opacity-100' : 'opacity-0'}`}></div>
                                    <div className="relative">
                                        {!isVoiceEnabled ? <VolumeX size={18} strokeWidth={1.5} /> : <Volume2 size={18} strokeWidth={1.5} />}
                                    </div>
                                </button>

                                <button
                                    onClick={() => useStore.getState().toggleAgentWindow()}
                                    className="p-2 rounded-xl transition-all duration-300 border border-transparent text-gray-400 hover:text-white hover:bg-white/5 hover:border-white/10"
                                    title="Close"
                                    aria-label="Close Agent"
                                >
                                    <X size={18} strokeWidth={1.5} />
                                </button>
                            </div>
                        </div>

                        {/* Virtualized Container */}
                        <div className="flex-1 min-h-0 bg-transparent flex flex-col">
                            {/* Participants Header (if multi-agent) */}
                            {currentSession && currentSession.participants.length > 1 && (
                                <div className="flex items-center gap-2 px-4 py-2 border-b border-white/5 bg-black/20 overflow-x-auto custom-scrollbar">
                                    {currentSession.participants.map(p => (
                                        <span key={p} className="text-[10px] bg-purple-900/30 px-2 py-1 rounded text-purple-200 border border-purple-500/20 whitespace-nowrap">
                                            {p === 'indii' ? '🤖 Indii' : `👤 ${p.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}`}
                                        </span>
                                    ))}
                                </div>
                            )}

                            <div className="w-full h-full max-w-4xl mx-auto relative px-2 flex-1 relative">
                                <Virtuoso
                                    ref={virtuosoRef}
                                    style={{ height: '100%' }}
                                    data={agentHistory}
                                    itemContent={(index, msg) => <MessageItem msg={msg} avatarUrl={avatarUrl} />}
                                    followOutput="smooth"
                                    initialTopMostItemIndex={agentHistory.length > 0 ? agentHistory.length - 1 : 0}
                                    className="custom-scrollbar"
                                />

                                <AnimatePresence>
                                    {showInvite && AgentSelector && (
                                        <div className="absolute top-4 right-4 z-50">
                                            <AgentSelector onClose={() => setShowInvite(false)} />
                                        </div>
                                    )}
                                </AnimatePresence>
                            </div>
                        </div>
                    </div>
                </div>
            </motion.div>
        </AnimatePresence>
    );
}
