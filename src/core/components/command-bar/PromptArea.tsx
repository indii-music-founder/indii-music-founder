import React, { useState, useRef, useMemo, useCallback, memo, useEffect } from 'react';
import { ArrowRight, Loader2, Paperclip, Camera, Mic, ChevronUp, PanelTopClose, PanelTopOpen, Database, Sparkles } from 'lucide-react';
import { useToast } from '@/core/context/ToastContext';
import { agentService } from '@/services/agent/AgentService';
import { agentRegistry } from '@/services/agent/registry';
import { useStore } from '@/core/store';
import { useShallow } from 'zustand/react/shallow';
import type { ModuleId } from '@/core/constants';
import { getColorForModule } from '@/core/theme/moduleColors';
import { motion, AnimatePresence } from 'motion/react';

import { voiceService } from '@/services/ai/VoiceService';
import { cn } from '@/lib/utils';
import {
    PromptInput,
    PromptInputTextarea,
    PromptInputActions,
    PromptInputAction
} from '@/components/ui/prompt-input';
import { DelegateMenu } from './DelegateMenu';
import { AttachmentList } from './AttachmentList';

interface PromptAreaProps {
    className?: string;
    isDocked?: boolean;
}

export const PromptArea = memo(({ className, isDocked }: PromptAreaProps) => {
    const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;

    const [isProcessing, setIsProcessing] = useState(false);
    const [openDelegate, setOpenDelegate] = useState(false);
    const [isListening, setIsListening] = useState(false);
    const [isDragging, setIsDragging] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const cameraInputRef = useRef<HTMLInputElement>(null);

    const {
        currentModule,
        setModule,
        toggleAgentWindow,
        isAgentOpen,
        isRightPanelOpen,
        toggleRightPanel,
        chatChannel,
        setChatChannel,
        isCommandBarDetached,
        setCommandBarDetached,
        commandBarInput,
        setCommandBarInput,
        commandBarAttachments,
        setCommandBarAttachments,
        activeAgentProvider,
        setActiveAgentProvider,
        isKnowledgeBaseEnabled,
        setKnowledgeBaseEnabled,
        isCommandBarCollapsed,
        setCommandBarCollapsed
    } = useStore(useShallow(state => ({
        // ⚡ Bolt Optimization: Use shallow selector to prevent re-renders on unrelated store updates
        currentModule: state.currentModule,
        setModule: state.setModule,
        toggleAgentWindow: state.toggleAgentWindow,
        isAgentOpen: state.isAgentOpen,
        isRightPanelOpen: state.isRightPanelOpen,
        toggleRightPanel: state.toggleRightPanel,
        chatChannel: state.chatChannel,
        setChatChannel: state.setChatChannel,
        isCommandBarDetached: state.isCommandBarDetached,
        setCommandBarDetached: state.setCommandBarDetached,
        commandBarInput: state.commandBarInput,
        setCommandBarInput: state.setCommandBarInput,
        commandBarAttachments: state.commandBarAttachments,
        setCommandBarAttachments: state.setCommandBarAttachments,
        activeAgentProvider: state.activeAgentProvider,
        setActiveAgentProvider: state.setActiveAgentProvider,
        isKnowledgeBaseEnabled: state.isKnowledgeBaseEnabled,
        setKnowledgeBaseEnabled: state.setKnowledgeBaseEnabled,
        isCommandBarCollapsed: state.isCommandBarCollapsed,
        setCommandBarCollapsed: state.setCommandBarCollapsed
    })));

    const isIndiiMode = chatChannel === 'indii';
    const colors = getColorForModule(currentModule);
    const toast = useToast();

    useEffect(() => {
        if (currentModule === 'dashboard' || currentModule === 'select-org') {
            if (chatChannel !== 'indii') setChatChannel('indii');
        } else {
            if (chatChannel !== 'agent') setChatChannel('agent');
        }
    }, [currentModule, setChatChannel, chatChannel]);

    const allAgents = useMemo(() => agentRegistry.getAll(), []);
    const managerAgents = useMemo(() => allAgents.filter(a => a.category === 'manager' || a.category === 'specialist'), [allAgents]);
    const departmentAgents = useMemo(() => allAgents.filter(a => a.category === 'department'), [allAgents]);
    const knownAgentIds = useMemo(() => allAgents.map(a => a.id), [allAgents]);

    const handleCloseDelegate = useCallback(() => setOpenDelegate(false), []);

    const handleMicClick = useCallback(() => {
        if (isListening) {
            voiceService.stopListening();
            setIsListening(false);
        } else {
            if (voiceService.isSupported()) {
                setIsListening(true);
                voiceService.startListening((text) => {
                    setCommandBarInput(commandBarInput + (commandBarInput ? ' ' : '') + text);
                    setIsListening(false);
                }, () => setIsListening(false));
            } else {
                toast.error("Voice input not supported in this browser.");
            }
        }
    }, [isListening, toast, commandBarInput, setCommandBarInput]);

    const handleDelegate = useCallback((moduleId: string) => {
        if (moduleId !== 'dashboard') {
            setModule(moduleId as ModuleId);
        }
        if (!isAgentOpen) {
            toggleAgentWindow();
        }
        setActiveAgentProvider('native'); // Switch back to Native for specific agents
        setOpenDelegate(false);
    }, [isAgentOpen, setModule, toggleAgentWindow, setActiveAgentProvider]);

    const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files) {
            setCommandBarAttachments([...(commandBarAttachments || []), ...Array.from(e.target.files!)]);
        }
    }, [commandBarAttachments, setCommandBarAttachments]);

    const removeAttachment = useCallback((index: number) => {
        setCommandBarAttachments((commandBarAttachments || []).filter((_, i) => i !== index));
    }, [commandBarAttachments, setCommandBarAttachments]);

    const handleDragOver = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(true);
    }, []);

    const handleDragLeave = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(false);
    }, []);

    const handleDrop = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(false);
        if (e.dataTransfer.files) {
            setCommandBarAttachments([...(commandBarAttachments || []), ...Array.from(e.dataTransfer.files)]);
        }
    }, [commandBarAttachments, setCommandBarAttachments]);

    const processAttachments = useCallback(async (files: File[]) => {
        return Promise.all(files.map(file =>
            new Promise<{ mimeType: string; base64: string }>((resolve, reject) => {
                const reader = new FileReader();
                reader.onload = () => resolve({
                    mimeType: file.type,
                    base64: (reader.result as string).split(',')[1]
                });
                reader.onerror = reject;
                reader.readAsDataURL(file);
            })
        ));
    }, []);

    const handleSubmit = useCallback(async (e?: React.FormEvent) => {
        try {
            e?.preventDefault();
            const input = commandBarInput || '';
            if (!input.trim() && (commandBarAttachments?.length ?? 0) === 0) return;
            if (isProcessing) return;

            setIsProcessing(true);
            const currentInput = input;
            const currentAttachments = [...(commandBarAttachments || [])];

            setCommandBarInput('');
            setCommandBarAttachments([]);

            if (!isAgentOpen) {
                toggleAgentWindow();
            } else if (!isRightPanelOpen) {
                toggleRightPanel();
            }

            try {
                const processedAttachments = currentAttachments.length > 0 ? await processAttachments(currentAttachments) : undefined;
                const targetAgentId = isIndiiMode ? undefined : (knownAgentIds.includes(currentModule) ? currentModule : undefined);
                await agentService.sendMessage(currentInput, processedAttachments, targetAgentId);
                setIsProcessing(false);
            } catch (error) {
                console.error('PromptArea: Failed to send message:', error);
                toast.error("Failed to send message.");
                setCommandBarInput(currentInput);
                setCommandBarAttachments(currentAttachments);
                setIsProcessing(false);
            }
        } catch (fatalError) {
            console.error("PromptArea: Fatal crash", fatalError);
            setIsProcessing(false);
        }
    }, [commandBarInput, commandBarAttachments, isAgentOpen, isRightPanelOpen, toggleAgentWindow, toggleRightPanel, currentModule, knownAgentIds, processAttachments, toast, isProcessing, isIndiiMode, setCommandBarInput, setCommandBarAttachments]);

    return (
        <div
            data-testid="command-bar-input-container"
            className={cn(
                "glass transition-all relative focus-within:ring-2",
                isDocked ? "rounded-none border-x-0 border-b-0 border-t border-white/10" : "rounded-[1.5rem]",
                isIndiiMode
                    ? "border-purple-500/50 ring-purple-500/20 shadow-[0_0_30px_rgba(168,85,247,0.15)] bg-purple-950/20"
                    : `${colors.border} ${colors.ring} bg-black/40 shadow-xl`,
                isDragging && "ring-4 ring-blue-500/50 bg-blue-500/20",
                className
            )}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
        >
            <AnimatePresence>
                {isDragging && (
                    <motion.div
                        initial={{ opacity: 0, scale: 0.98 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.98 }}
                        className="absolute inset-0 z-50 flex items-center justify-center bg-blue-950/90 backdrop-blur-xl border-4 border-dashed border-blue-500 rounded-xl m-1"
                    >
                        <div className="text-center animate-bounce">
                            <Paperclip size={40} className="text-blue-300 mx-auto mb-2" />
                            <p className="text-white font-bold">Drop to attach</p>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            <PromptInput
                value={commandBarInput}
                onValueChange={setCommandBarInput}
                onSubmit={() => handleSubmit()}
                className="bg-transparent border-none shadow-none py-1"
                disabled={isProcessing}
            >
                <PromptInputTextarea
                    placeholder={isDragging ? "" : (isIndiiMode ? "Launch a campaign, audit security, or ask anything..." : `Message ${currentModule}...`)}
                    aria-label={isIndiiMode ? "Ask indii" : `Message ${currentModule}`}
                    className="text-gray-200 placeholder-gray-600 text-base md:text-sm"
                />

                {isIndiiMode && (
                    <div className="absolute top-2 right-4 flex items-center gap-2">
                        <motion.div
                            initial={{ opacity: 0, x: 10 }}
                            animate={{ opacity: 1, x: 0 }}
                            className="bg-purple-500/20 border border-purple-500/30 rounded-full px-2 py-0.5 flex items-center gap-1.5 shadow-[0_0_15px_rgba(168,85,247,0.2)]"
                        >
                            <Sparkles size={10} className="text-purple-400 animate-pulse" />
                            <span className="text-[9px] font-bold text-purple-300 uppercase tracking-widest">Master Orchestrator</span>
                        </motion.div>
                    </div>
                )}

                <AttachmentList attachments={commandBarAttachments} onRemove={removeAttachment} />

                <PromptInputActions className="px-2 pb-2">
                    <div className="flex items-center gap-1.5 flex-1">
                        {!isMobile && (
                            <div className="flex items-center gap-0.5">
                                <input
                                    type="file"
                                    ref={fileInputRef}
                                    onChange={handleFileSelect}
                                    className="hidden"
                                    multiple
                                    accept="image/*,audio/*,application/pdf,text/*"
                                    aria-label="Upload files"
                                />
                                <PromptInputAction tooltip="Attach files">
                                    <button
                                        onClick={() => fileInputRef.current?.click()}
                                        className="flex items-center justify-center p-2 rounded-xl text-gray-400 hover:bg-white/10 hover:text-gray-200 transition-all focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                                    >
                                        <Paperclip size={18} />
                                    </button>
                                </PromptInputAction>
                            </div>
                        )}

                        <PromptInputAction tooltip={isListening ? "Stop listening" : "Voice Input"}>
                            <button
                                onClick={handleMicClick}
                                className={cn(
                                    "flex items-center justify-center p-2 rounded-xl transition-all focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
                                    isListening
                                        ? "text-red-400 bg-red-400/10 hover:bg-red-400/20"
                                        : "text-gray-400 hover:bg-white/10 hover:text-gray-200"
                                )}
                                aria-label={isListening ? "Stop listening" : "Voice Input"}
                            >
                                <Mic size={18} className={isListening ? "animate-pulse" : ""} />
                            </button>
                        </PromptInputAction>

                        {!isMobile && (
                            <div className="relative">
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        setOpenDelegate(!openDelegate);
                                    }}
                                    aria-haspopup="true"
                                    aria-expanded={openDelegate}
                                    aria-label="Select active agent"
                                    className={cn(
                                        "flex items-center justify-center w-9 h-9 rounded-full transition-all border focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
                                        !isIndiiMode ? `${colors.bg} ${colors.border} ${colors.text}` : "bg-white/5 border-white/10 text-gray-400 hover:text-white"
                                    )}
                                >
                                    <div className={cn("w-1.5 h-1.5 rounded-full", !isIndiiMode ? "bg-green-400 animate-pulse" : "bg-gray-600")} />
                                </button>
                                <DelegateMenu
                                    isOpen={openDelegate}
                                    currentModule={currentModule}
                                    isIndiiMode={isIndiiMode}
                                    managerAgents={managerAgents}
                                    departmentAgents={departmentAgents}
                                    onSelect={handleDelegate}
                                    onSelectIndii={() => {
                                        setChatChannel('indii');
                                        setModule('dashboard' as ModuleId);
                                        setActiveAgentProvider('agent-zero');
                                        setOpenDelegate(false);
                                        if (!isAgentOpen) toggleAgentWindow();
                                    }}
                                    onClose={handleCloseDelegate}
                                />
                            </div>
                        )}

                        <PromptInputAction tooltip={isKnowledgeBaseEnabled ? "Knowledge Base Active" : "Connect Knowledge Base"}>
                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    setKnowledgeBaseEnabled(!isKnowledgeBaseEnabled);
                                }}
                                className={cn(
                                    "flex items-center justify-center w-8 h-8 rounded-full transition-all border focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
                                    isKnowledgeBaseEnabled
                                        ? "bg-teal-600/20 border-teal-500/50 text-teal-300"
                                        : "bg-black/40 border-white/5 text-gray-500 hover:text-gray-300"
                                )}
                                aria-label={isKnowledgeBaseEnabled ? "Disconnect Knowledge Base" : "Connect Knowledge Base"}
                                aria-pressed={isKnowledgeBaseEnabled}
                            >
                                <Database size={12} />
                            </button>
                        </PromptInputAction>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                        {!isDocked && (
                            <div className="flex items-center gap-1 border-l border-white/10 px-2 mr-1">
                                <PromptInputAction tooltip="Collapse Chat">
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            setCommandBarCollapsed(true);
                                        }}
                                        className="p-1.5 rounded-full text-gray-500 hover:text-white hover:bg-white/10 transition-all flex items-center justify-center focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                                        aria-label="Collapse Chat"
                                    >
                                        <ChevronUp size={16} className="rotate-180" />
                                    </button>
                                </PromptInputAction>

                                <PromptInputAction tooltip={isCommandBarDetached ? "Dock to Agent" : "Detach from Agent"}>
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            setCommandBarDetached(!isCommandBarDetached);
                                        }}
                                        className="p-1.5 rounded-full text-gray-500 hover:text-white hover:bg-white/10 transition-all flex items-center justify-center focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                                        aria-label={isCommandBarDetached ? "Dock to Agent" : "Detach from Agent"}
                                    >
                                        {isCommandBarDetached ? <PanelTopOpen size={16} /> : <PanelTopClose size={16} />}
                                    </button>
                                </PromptInputAction>
                            </div>
                        )}

                        <PromptInputAction tooltip="Send Message (Enter)">
                            <button
                                onClick={(e) => handleSubmit(e)}
                                disabled={(!(commandBarInput || '').trim() && (commandBarAttachments?.length ?? 0) === 0) || isProcessing}
                                aria-label="Run command"
                                className={cn(
                                    "flex items-center justify-center gap-2 px-4 py-2 rounded-xl text-white text-xs font-bold transition-all shadow-lg focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
                                    isIndiiMode
                                        ? "bg-purple-600 hover:bg-purple-500 shadow-purple-500/20"
                                        : `${colors.bg} hover:brightness-110`
                                )}
                                data-testid="command-bar-run-btn"
                            >
                                {isProcessing ? (
                                    <Loader2 size={16} className="animate-spin" data-testid="run-loader" />
                                ) : (
                                    <ArrowRight size={16} />
                                )}
                                {!isMobile && <span className="ml-0.5">Run</span>}
                            </button>
                        </PromptInputAction>
                    </div>
                </PromptInputActions>
            </PromptInput>
        </div>
    );
});
