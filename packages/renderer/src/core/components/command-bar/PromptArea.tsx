import React, { useState, useRef, useMemo, useCallback, memo, useEffect, type MutableRefObject } from 'react';
import { ArrowRight, Paperclip, Mic, ChevronUp, PanelTopClose, PanelTopOpen, Database, Square } from 'lucide-react';
import { useToast } from '@/core/context/ToastContext';
import { agentService } from '@/services/agent/AgentService';
import { agentRegistry } from '@/services/agent/registry';
import { useStore } from '@/core/store';
import { useShallow } from 'zustand/react/shallow';

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

import { AttachmentList } from './AttachmentList';
import { TypeaheadMenu, type TypeaheadContext } from './TypeaheadMenu';
import { logger } from '@/utils/logger';
import { useMediaQuery } from '@/hooks/useMediaQuery';
import { IndiiFavicon } from '@/components/shared/IndiiFavicon';

interface PromptAreaProps {
    className?: string;
    isDocked?: boolean;
}

export const PromptArea = memo(({ className, isDocked }: PromptAreaProps) => {
    const isMobile = useMediaQuery('(max-width: 767px)');

    const [isProcessing, setIsProcessing] = useState(false);

    const [isListening, setIsListening] = useState(false);
    const [isDragging, setIsDragging] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const _cameraInputRef = useRef<HTMLInputElement>(null);

    const {
        currentModule,
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
        isKnowledgeBaseEnabled,
        setKnowledgeBaseEnabled,
        setCommandBarCollapsed,
        isBoardroomMode,
        stopAgent,
        isAgentProcessing
    } = useStore(useShallow(state => ({
        currentModule: state.currentModule,
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
        isKnowledgeBaseEnabled: state.isKnowledgeBaseEnabled,
        setKnowledgeBaseEnabled: state.setKnowledgeBaseEnabled,
        setCommandBarCollapsed: state.setCommandBarCollapsed,
        isBoardroomMode: state.isBoardroomMode,
        stopAgent: state.stopAgent,
        isAgentProcessing: state.isAgentProcessing
    })));

    const isIndiiMode = chatChannel === 'indii';
    const colors = getColorForModule(currentModule);
    const toast = useToast();

    // Set a sensible default channel when switching modules,
    // but don't override manual Plan/Execute toggles.
    const prevModuleRef: MutableRefObject<string> = useRef(currentModule);
    useEffect(() => {
        if (prevModuleRef.current !== currentModule) {
            prevModuleRef.current = currentModule;
            // Clear chat input when switching modules to prevent text persistence/accumulation
            setCommandBarInput('');
            if (currentModule === 'dashboard' || currentModule === 'select-org') {
                setChatChannel('indii');
            } else {
                setChatChannel('agent');
            }
        }
    }, [currentModule, setChatChannel, setCommandBarInput]);

    const allAgents = useMemo(() => agentRegistry.getAll(), []);
    const knownAgentIds = useMemo(() => allAgents.map(a => a.id), [allAgents]);

    const [typeaheadContext, setTypeaheadContext] = useState<TypeaheadContext>(null);

    const handleInputValueChange = useCallback((value: string) => {
        setCommandBarInput(value);

        // Find last word matching @ or #
        const match = value.match(/(?:^|\s)([@#])([\w-]*)$/);
        if (match && match.index !== undefined) {
            setTypeaheadContext({
                type: match[1] as '@' | '#',
                query: match[2] || '',
                position: match.index + (value[match.index] === ' ' ? 1 : 0)
            });
        } else {
            setTypeaheadContext(null);
        }
    }, [setCommandBarInput]);

    const handleTypeaheadSelect = useCallback((id: string, name: string) => {
        if (!typeaheadContext) return;
        const prefix = commandBarInput.substring(0, typeaheadContext.position);
        const suffix = commandBarInput.substring(typeaheadContext.position + typeaheadContext.query.length + 1);

        const newValue = `${prefix}${typeaheadContext.type}${name} ${suffix}`;
        setCommandBarInput(newValue);
        setTypeaheadContext(null);
    }, [commandBarInput, typeaheadContext, setCommandBarInput]);



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
                    base64: (reader.result as string).split(',')[1]!
                });
                reader.onerror = reject;
                reader.readAsDataURL(file);
            })
        ));
    }, []);

    const handleSubmit = useCallback(async (e?: React.FormEvent) => {
        try {
            console.log('[PromptArea] handleSubmit fired!', { commandBarInput });
            e?.preventDefault();
            const input = commandBarInput || '';
            if (!input.trim() && (commandBarAttachments?.length ?? 0) === 0) {
                console.log('[PromptArea] Aborting submit: input is empty');
                return;
            }
            if (isProcessing) {
                console.log('[PromptArea] Aborting submit: already processing');
                return;
            }

            setIsProcessing(true);
            const currentInput = input;
            const currentAttachments = [...(commandBarAttachments || [])];

            if (currentInput.trim() === '/deploy-andromeda') {
                const state = useStore.getState();
                state.setModule('creative');
                state.enableAndromedaMode();
                toast.success('Andromeda Pipeline Armed. Enter a prompt to begin 15-variant batch generation.');
                setCommandBarInput('');
                setCommandBarAttachments([]);
                setIsProcessing(false);
                return;
            }

            if (currentInput.trim() === '/status-blitz') {
                const state = useStore.getState();
                state.setModule('dashboard');
                toast.success('System Status: Viral Velocity Active, CPS Kill-switches Armed.');
                setCommandBarInput('');
                setCommandBarAttachments([]);
                setIsProcessing(false);
                return;
            }

            setCommandBarInput('');
            setCommandBarAttachments([]);

            // On mobile Agent Dashboard, chat is displayed inline — don't open a ChatOverlay on top
            // In Boardroom mode, messages route to boardroomMessages — DON'T open the right panel
            const isOnAgentModule = currentModule === 'agent';
            if (!isOnAgentModule && !isBoardroomMode) {
                if (!isRightPanelOpen) {
                    toggleRightPanel();
                }
                useStore.setState({
                    rightPanelTab: 'agent',
                    rightPanelView: 'messages'
                });
            }

            try {
                const processedAttachments = currentAttachments.length > 0 ? await processAttachments(currentAttachments) : undefined;
                const targetAgentId = isIndiiMode ? undefined : (knownAgentIds.includes(currentModule) ? currentModule : undefined);
                await agentService.sendMessage(currentInput, processedAttachments, targetAgentId);
                setIsProcessing(false);
            } catch (error: unknown) {
                logger.error('PromptArea: Failed to send message:', error);
                toast.error("Failed to send message.");
                setCommandBarInput(currentInput);
                setCommandBarAttachments(currentAttachments);
                setIsProcessing(false);
            }
        } catch (fatalError: unknown) {
            logger.error("PromptArea: Fatal crash", fatalError);
            setIsProcessing(false);
        }
    }, [commandBarInput, commandBarAttachments, isRightPanelOpen, toggleRightPanel, currentModule, knownAgentIds, processAttachments, toast, isProcessing, isIndiiMode, isBoardroomMode, setCommandBarInput, setCommandBarAttachments]);

    return (
        <div
            data-testid="command-bar-input-container"
            className={cn(
                "glass transition-all relative focus-within:ring-2 backdrop-blur-xl",
                isDocked ? "rounded-none border-x-0 border-b-0 border-t border-white/10 px-1" : "rounded-[1.5rem]",
                isIndiiMode
                    ? "border-purple-500/50 ring-purple-500/20 shadow-[0_0_30px_rgba(168,85,247,0.15)] bg-purple-950/30"
                    : `${colors.border} ${colors.ring} bg-white/[0.04] shadow-[0_8px_32px_rgba(0,0,0,0.4)]`,
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

            <TypeaheadMenu context={typeaheadContext} onSelect={handleTypeaheadSelect} />

            <PromptInput
                value={commandBarInput}
                onValueChange={handleInputValueChange}
                onSubmit={() => handleSubmit()}
                className="bg-transparent border-none shadow-none py-1"
                disabled={isProcessing}
            >
                <PromptInputTextarea
                    placeholder={isDragging ? "" : (isIndiiMode ? "Launch a campaign, audit security, or ask anything..." : `Message ${currentModule}...`)}
                    aria-label={isIndiiMode ? "Ask indii" : `Message ${currentModule}`}
                    className="text-gray-200 placeholder-gray-600 text-base md:text-sm"
                    data-testid="main-prompt-input"
                />

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
                                        className={cn(
                                            "flex items-center justify-center rounded-xl text-gray-400 hover:bg-white/10 hover:text-gray-200 transition-all focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
                                            isDocked ? "p-1.5" : "p-2"
                                        )}
                                    >
                                        <Paperclip size={isDocked ? 16 : 18} />
                                    </button>
                                </PromptInputAction>
                            </div>
                        )}

                        <PromptInputAction tooltip={isListening ? "Stop listening" : "Voice Input"}>
                            <button
                                onClick={handleMicClick}
                                className={cn(
                                    "flex items-center justify-center rounded-xl transition-all focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
                                    isDocked ? "p-1.5" : "p-2",
                                    isListening
                                        ? "text-red-400 bg-red-400/10 hover:bg-red-400/20"
                                        : "text-gray-400 hover:bg-white/10 hover:text-gray-200"
                                )}
                                aria-label={isListening ? "Stop listening" : "Voice Input"}
                            >
                                <Mic size={isDocked ? 16 : 18} className={isListening ? "animate-pulse" : ""} />
                            </button>
                        </PromptInputAction>



                        <PromptInputAction tooltip={isKnowledgeBaseEnabled ? "Knowledge Base Active" : "Connect Knowledge Base"}>
                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    const next = !isKnowledgeBaseEnabled;
                                    setKnowledgeBaseEnabled(next);
                                    if (isMobile) {
                                        toast.success(next
                                            ? "Knowledge Base connected — AI will reference your docs"
                                            : "Knowledge Base disconnected"
                                        );
                                    }
                                }}
                                className={cn(
                                    "flex items-center justify-center gap-1 transition-all border focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
                                    isMobile
                                        ? "px-2.5 py-1.5 rounded-lg text-[10px] font-semibold uppercase tracking-wide"
                                        : isDocked ? "w-7 h-7 rounded-full" : "w-8 h-8 rounded-full",
                                    isKnowledgeBaseEnabled
                                        ? "bg-teal-600/20 border-teal-500/50 text-teal-300"
                                        : "bg-black/40 border-white/5 text-gray-500 hover:text-gray-300"
                                )}
                                aria-label={isKnowledgeBaseEnabled ? "Disconnect Knowledge Base" : "Connect Knowledge Base"}
                                aria-pressed={isKnowledgeBaseEnabled}
                            >
                                <Database size={isDocked ? 10 : 12} />
                                {isMobile && <span>KB</span>}
                            </button>
                        </PromptInputAction>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                        {/* Dock Position Toggle — removed entirely. Position is now locked to right in boardroom mode. */}

                        {/* Agent / indii Mode Toggle */}
                        <button
                            onClick={() => setChatChannel(isIndiiMode ? 'agent' : 'indii')}
                            className={cn(
                                "rounded-lg transition-all border flex items-center justify-center overflow-hidden focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
                                isDocked ? "w-7 h-7" : "w-8 h-8",
                                isIndiiMode
                                    ? "bg-purple-600/30 border-purple-500/40 hover:bg-purple-600/50"
                                    : "bg-cyan-600/30 border-cyan-500/40 hover:bg-cyan-600/50"
                            )}
                            aria-label={isIndiiMode ? "Switch to Agent mode" : "Switch to indii mode"}
                            title={isIndiiMode ? "indii mode — click for Agent" : "Agent mode — click for indii"}
                        >
                            <IndiiFavicon size={isDocked ? 14 : 18} />
                        </button>

                        {/* Collapse/Detach controls — hidden in boardroom (locked to right, always expanded) */}
                        {!isDocked && !isMobile && !isBoardroomMode && (
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

                        {isProcessing || isAgentProcessing ? (
                            <PromptInputAction tooltip="Stop Agent (Esc)">
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        stopAgent();
                                    }}
                                    aria-label="Stop agent"
                                    className={cn(
                                        "flex items-center justify-center transition-all shadow-lg focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none text-white",
                                        (!isMobile && !isDocked) ? "gap-2 px-4 py-2 rounded-xl text-xs font-bold" : (isDocked ? "min-w-[28px] w-7 h-7 rounded-lg p-0" : "min-w-[32px] w-8 h-8 rounded-lg p-0"),
                                        "bg-red-600 hover:bg-red-500 shadow-red-500/30 animate-pulse"
                                    )}
                                    data-testid="command-bar-stop-btn"
                                >
                                    <Square size={isDocked ? 12 : 14} fill="currentColor" />
                                    {(!isMobile && !isDocked) && <span className="ml-0.5">Stop</span>}
                                </button>
                            </PromptInputAction>
                        ) : (
                            <PromptInputAction tooltip="Send Message (Enter)">
                                <button
                                    onClick={(e) => handleSubmit(e)}
                                    disabled={(!(commandBarInput || '').trim() && (commandBarAttachments?.length ?? 0) === 0)}
                                    aria-label="Run command"
                                    className={cn(
                                        "flex items-center justify-center transition-all shadow-lg focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none text-white",
                                        (!isMobile && !isDocked) ? "gap-2 px-4 py-2 rounded-xl text-xs font-bold" : (isDocked ? "min-w-[28px] w-7 h-7 rounded-lg p-0" : "min-w-[32px] w-8 h-8 rounded-lg p-0"),
                                        isIndiiMode
                                            ? "bg-purple-600 hover:bg-purple-500 shadow-purple-500/20"
                                            : "bg-white/20 hover:bg-white/30 border border-white/10"
                                    )}
                                    data-testid="command-bar-run-btn"
                                >
                                    <ArrowRight size={isDocked ? 14 : 16} />
                                    {(!isMobile && !isDocked) && <span className="ml-0.5">Run</span>}
                                </button>
                            </PromptInputAction>
                        )}
                    </div>
                </PromptInputActions>
            </PromptInput>
        </div>
    );
});
