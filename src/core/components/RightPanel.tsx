import React from 'react';
import { useStore } from '../store';
import { useShallow } from 'zustand/react/shallow';
import { ChevronLeft, ChevronRight, Layers, Palette, Film, Folder, Bot, Sparkles, MessageSquare, Clock, X, History } from 'lucide-react';
import CreativePanel from './right-panel/CreativePanel';
import VideoPanel from './right-panel/VideoPanel';
import { ResourceTree } from '@/components/project/ResourceTree';
import FilePreview from '@/modules/files/FilePreview';
import { motion, AnimatePresence } from 'motion/react';
import { getColorForModule } from '@/core/theme/moduleColors';
import { PromptArea } from './command-bar/PromptArea';
import { ConversationHistoryList } from './ConversationHistoryList';
import { MessageItem } from '@/core/components/chat/ChatMessage';
import AssetSpotlight from '@/modules/dashboard/components/AssetSpotlight';
import { BatchingStatus } from './agent/BatchingStatus';
import { cn } from '@/lib/utils';

export default function RightPanel() {

    const {
        currentModule,
        setModule,
        isRightPanelOpen,
        toggleRightPanel,
        isAgentOpen,
        toggleAgentWindow,
        agentHistory,
        userProfile,
        isAgentProcessing,
        rightPanelView: view,
        setRightPanelView: setView
    } = useStore(
        useShallow(state => ({
            currentModule: state.currentModule,
            setModule: state.setModule,
            isRightPanelOpen: state.isRightPanelOpen,
            toggleRightPanel: state.toggleRightPanel,
            isAgentOpen: state.isAgentOpen,
            toggleAgentWindow: state.toggleAgentWindow,
            agentHistory: state.agentHistory,
            userProfile: state.userProfile,
            isAgentProcessing: state.isAgentProcessing,
            rightPanelView: state.rightPanelView,
            setRightPanelView: state.setRightPanelView
        }))
    );

    const chatEndRef = React.useRef<HTMLDivElement>(null);

    React.useEffect(() => {
        if (view === 'messages') {
            chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
        }
    }, [agentHistory.length, view]);

    // Placeholder content based on module
    const renderContent = () => {
        // High priority: if the agent is open, show the chat overlay inside the right panel
        if (isAgentOpen) {
            return (
                <div className="flex flex-col h-full bg-card border-l border-border relative overflow-hidden">
                    <div className="flex items-center justify-between p-4 border-b border-border shrink-0">
                        <div className="flex gap-4">
                            <button
                                onClick={() => setView('messages')}
                                className={cn(
                                    "text-xs font-bold uppercase tracking-wider transition-colors",
                                    view === 'messages' ? "text-purple-400" : "text-gray-500 hover:text-gray-300"
                                )}
                                aria-label="View Messages"
                            >
                                Messages
                            </button>
                            <button
                                onClick={() => setView('archives')}
                                className={cn(
                                    "text-xs font-bold uppercase tracking-wider transition-colors",
                                    view === 'archives' ? "text-purple-400" : "text-gray-500 hover:text-gray-300"
                                )}
                                aria-label="View Archives"
                            >
                                Archives
                            </button>
                        </div>
                        <button
                            onClick={toggleAgentWindow}
                            className="p-1.5 hover:bg-white/10 rounded-lg text-gray-400 hover:text-white transition-colors"
                            aria-label="Close Chat Window"
                        >
                            <ChevronRight size={16} />
                        </button>
                    </div>

                    <div className="flex-1 overflow-hidden relative flex flex-col">
                        {view === 'archives' ? (
                            <ConversationHistoryList
                                onClose={() => setView('messages')}
                                className="w-full border-none bg-transparent"
                            />
                        ) : (
                            <div className="flex-1 flex flex-col min-h-0">
                                {/* Messages List */}
                                <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
                                    {agentHistory.length === 0 ? (
                                        <div className="h-full flex flex-col items-center justify-center text-center p-8 opacity-40">
                                            <MessageSquare size={32} className="mb-4 text-purple-400" />
                                            <p className="text-sm font-medium">No messages yet</p>
                                            <p className="text-xs mt-1">Start a conversation with indii to see it here.</p>
                                        </div>
                                    ) : (
                                        <div className="space-y-6">
                                            {agentHistory.map((msg) => (
                                                <MessageItem
                                                    key={msg.id}
                                                    msg={msg}
                                                    avatarUrl={msg.role === 'user' ? (userProfile?.photoURL ?? undefined) : undefined}
                                                    variant="compact"
                                                />
                                            ))}
                                            {isAgentProcessing && (
                                                <div className="flex items-center gap-2 px-3 py-2 text-gray-500 text-xs">
                                                    <Sparkles size={12} className="animate-pulse text-purple-400" />
                                                    indii is thinking…
                                                </div>
                                            )}
                                            <div ref={chatEndRef} />
                                        </div>
                                    )}
                                </div>

                                {/* Inline PromptArea for Right Panel */}
                                <div className="p-4 border-t border-border bg-black/20">
                                    <PromptArea isDocked className="!static !translate-x-0 !w-full !max-w-none shadow-none border-none bg-transparent" />
                                </div>

                                {/* Maestro Batching Status */}
                                <BatchingStatus />

                                {/* Asset Spotlight integration */}
                                <div className="border-t border-white/5 p-4 bg-black/20 shrink-0">
                                    <h4 className="text-[10px] uppercase tracking-wider text-gray-500 font-bold mb-3 flex items-center gap-2">
                                        <Sparkles size={10} className="text-purple-400" />
                                        Your Creations
                                    </h4>
                                    <AssetSpotlight />
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            );
        }

        switch (currentModule) {
            case 'creative':
                return <CreativePanel toggleRightPanel={toggleRightPanel} />;
            case 'video':
                return <VideoPanel toggleRightPanel={toggleRightPanel} />;
            case 'files':
                return (
                    <div className="h-full flex flex-col bg-card relative">
                        <div className="absolute top-2 right-2 z-10">
                            <button onClick={toggleRightPanel} className="p-1 hover:bg-white/10 rounded text-gray-400 hover:text-foreground transition-colors" aria-label="Close Panel">
                                <ChevronRight size={16} />
                            </button>
                        </div>
                        <div className="flex-1 flex flex-col overflow-hidden">
                            <ResourceTree className="flex-1 p-2 overflow-y-auto custom-scrollbar" />
                            <div className="h-px bg-white/5 mx-2" />
                            <div className="h-48 flex-shrink-0 bg-black/20">
                                <FilePreview variant="compact" />
                            </div>
                        </div>
                    </div>
                );
            default:
                return (
                    <div className="flex flex-col h-full">
                        <div className="p-4 flex justify-end">
                            <button onClick={toggleRightPanel} className="p-1 hover:bg-white/10 rounded text-gray-400 hover:text-white transition-colors" aria-label="Close Panel">
                                <ChevronRight size={16} />
                            </button>
                        </div>
                        <div className="flex-1 p-8 flex flex-col items-center justify-center text-center space-y-4">
                            <motion.div
                                className="w-16 h-16 bg-white/5 rounded-full flex items-center justify-center"
                                animate={{
                                    scale: [1, 1.05, 1],
                                    opacity: [0.6, 1, 0.6],
                                    boxShadow: ['0 0 0px rgba(255,255,255,0)', '0 0 20px rgba(255,255,255,0.1)', '0 0 0px rgba(255,255,255,0)']
                                }}
                                transition={{
                                    duration: 4,
                                    repeat: Infinity,
                                    ease: "easeInOut"
                                }}
                            >
                                <Layers size={24} className="text-gray-500" />
                            </motion.div>
                            <div>
                                <h3 className="text-sm font-medium text-gray-300">No Tool Selected</h3>
                                <p className="text-xs text-gray-500 mt-1 max-w-[200px]">Select a tool from the sidebar to view its controls and settings.</p>
                            </div>
                        </div>
                    </div>
                );
        }
    };

    const handleToolClick = (module: 'creative' | 'video' | 'files') => {
        setModule(module);
    };

    const creativeTheme = getColorForModule('creative');
    const videoTheme = getColorForModule('video');
    const filesTheme = getColorForModule('files');

    return (
        <motion.aside
            aria-label="Context panel"
            initial={false}
            animate={{ width: isRightPanelOpen ? 320 : 48 }}
            transition={{ type: "spring", stiffness: 300, damping: 30 }}
            className="h-full border-l border-border bg-card/80 backdrop-blur-xl flex-shrink-0 hidden lg:flex flex-col overflow-hidden z-20 shadow-2xl"
        >
            <AnimatePresence mode="wait">
                {!isRightPanelOpen ? (
                    <motion.div
                        key="collapsed"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        className="flex-1 flex flex-col items-center py-4 gap-4"
                    >
                        <button
                            onClick={toggleRightPanel}
                            className="p-2 hover:bg-white/10 rounded-xl text-gray-400 hover:text-white transition-colors mb-4"
                            title="Expand Panel"
                            aria-label="Expand Panel"
                        >
                            <ChevronLeft size={16} />
                        </button>

                        <div className="flex flex-col gap-4 w-full px-2">
                            <button
                                onClick={() => handleToolClick('creative')}
                                className={`p-2 rounded-xl transition-all flex justify-center relative group ${currentModule === 'creative' ? `${creativeTheme.bg} ${creativeTheme.text} shadow-[0_0_10px_rgba(168,85,247,0.2)]` : 'text-gray-400 hover:text-white hover:bg-white/5'}`}
                                title="Image Studio"
                                aria-label="Image Studio"
                            >
                                <Palette size={20} />
                                {currentModule === 'creative' && <div className={`absolute inset-0 rounded-xl bg-current opacity-10 blur-sm`} />}
                            </button>

                            <button
                                onClick={() => handleToolClick('video')}
                                className={`p-2 rounded-xl transition-all flex justify-center relative group ${currentModule === 'video' ? `${videoTheme.bg} ${videoTheme.text} shadow-[0_0_10px_rgba(59,130,246,0.2)]` : 'text-gray-400 hover:text-white hover:bg-white/5'}`}
                                title="Video Studio"
                                aria-label="Video Studio"
                            >
                                <Film size={20} />
                                {currentModule === 'video' && <div className={`absolute inset-0 rounded-xl bg-current opacity-10 blur-sm`} />}
                            </button>

                            <button
                                onClick={() => handleToolClick('files')}
                                className={`p-2 rounded-xl transition-all flex justify-center relative group ${currentModule === 'files' ? `${filesTheme.bg} ${filesTheme.text} shadow-[0_0_10px_rgba(34,197,94,0.2)]` : 'text-gray-400 hover:text-white hover:bg-white/5'}`}
                                title="Project Files"
                                aria-label="Project Files"
                            >
                                <Folder size={20} />
                                {currentModule === 'files' && <div className={`absolute inset-0 rounded-xl bg-current opacity-10 blur-sm`} />}
                            </button>
                        </div>
                    </motion.div>
                ) : (
                    <motion.div
                        key="expanded"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        className="flex-1 overflow-hidden relative"
                    >
                        {renderContent()}
                    </motion.div>
                )}
            </AnimatePresence>
        </motion.aside>
    );
}
