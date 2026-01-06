import React, { useState, useRef, useMemo, useCallback, memo } from 'react';
import { ArrowRight, Loader2, Paperclip, Camera, Mic, Image, ChevronUp, X } from 'lucide-react';
import { useToast } from '@/core/context/ToastContext';
import { agentService } from '@/services/agent/AgentService';
import { agentRegistry } from '@/services/agent/registry';
import { useStore } from '@/core/store';
import type { ModuleId } from '@/core/constants';
import { getColorForModule } from '../theme/moduleColors';
import { motion, AnimatePresence } from 'framer-motion';

import { voiceService } from '@/services/ai/VoiceService';
import { cn } from '@/lib/utils';
import {
    PromptInput,
    PromptInputTextarea,
    PromptInputActions,
    PromptInputAction
} from '@/components/ui/prompt-input';

interface DelegateMenuProps {
    isOpen: boolean;
    currentModule: string;
    managerAgents: any[];
    departmentAgents: any[];
    onSelect: (id: string) => void;
    onClose: () => void;
}

const DelegateMenu = memo(({ isOpen, currentModule: _currentModule, managerAgents, departmentAgents, onSelect, onClose }: DelegateMenuProps) => {
    return (
        <AnimatePresence>
            {isOpen && (
                <>
                    <div
                        className="fixed inset-0 z-40"
                        onClick={onClose}
                    />
                    <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: 10 }}
                        className="absolute bottom-full left-0 mb-2 w-64 bg-[#1a1a1a] border border-gray-700 rounded-xl shadow-2xl z-50 overflow-hidden flex flex-col max-h-[300px]"
                    >
                        <div className="overflow-y-auto custom-scrollbar">
                            <div className="p-1">
                                <button
                                    onClick={() => onSelect('dashboard')}
                                    className="w-full text-left px-3 py-2 text-xs text-gray-300 hover:bg-white/5 rounded-lg transition-colors flex items-center gap-2"
                                >
                                    <div className="w-2 h-2 rounded-full bg-gray-500" />
                                    Indii (Chief of Staff)
                                </button>
                            </div>

                            <div className="border-t border-gray-800 my-1" />

                            <div className="p-2">
                                <p className="text-[10px] font-bold text-gray-500 uppercase px-2 mb-1">Manager's Office</p>
                                {managerAgents.map(agent => (
                                    <button
                                        key={agent.id}
                                        onClick={() => onSelect(agent.id)}
                                        className="w-full text-left px-3 py-1.5 text-xs text-gray-300 hover:bg-white/5 rounded-lg transition-colors flex items-center gap-2"
                                    >
                                        <div className={`w-1.5 h-1.5 rounded-full ${agent.color}`} />
                                        {agent.name}
                                    </button>
                                ))}
                            </div>

                            <div className="border-t border-gray-800 my-1" />

                            <div className="p-2">
                                <p className="text-[10px] font-bold text-gray-500 uppercase px-2 mb-1">Departments</p>
                                {departmentAgents.map(dept => (
                                    <button
                                        key={dept.id}
                                        onClick={() => onSelect(dept.id)}
                                        className="w-full text-left px-3 py-1.5 text-xs text-gray-300 hover:bg-white/5 rounded-lg transition-colors flex items-center gap-2"
                                    >
                                        <div className={`w-1.5 h-1.5 rounded-full ${dept.color}`} />
                                        {dept.name}
                                    </button>
                                ))}
                            </div>
                        </div>
                    </motion.div>
                </>
            )}
        </AnimatePresence>
    );
});

const AttachmentList = memo(({ attachments, onRemove }: { attachments: File[], onRemove: (index: number) => void }) => {
    if (attachments.length === 0) return null;
    return (
        <div className="px-4 pb-2 flex gap-2 flex-wrap">
            {attachments.map((file, index) => (
                <div key={index} className="flex items-center gap-2 bg-white/5 px-2 py-1 rounded text-xs text-gray-300 border border-white/10">
                    {file.type.startsWith('image/') ? <Image size={12} /> : <Paperclip size={12} />}
                    <span className="max-w-[150px] truncate">{file.name}</span>
                    <button type="button" onClick={() => onRemove(index)} className="hover:text-white p-1 hover:bg-white/10 rounded-full transition-colors">
                        <X size={12} />
                    </button>
                </div>
            ))}
        </div>
    );
});

function CommandBar() {
    // Check if device is mobile
    const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;

    const [input, setInput] = useState('');
    const [isProcessing, setIsProcessing] = useState(false);
    const [openDelegate, setOpenDelegate] = useState(false);
    const [isListening, setIsListening] = useState(false);
    const [attachments, setAttachments] = useState<File[]>([]);
    const [isDragging, setIsDragging] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const cameraInputRef = useRef<HTMLInputElement>(null);

    const { currentModule, setModule, toggleAgentWindow, isAgentOpen } = useStore();
    const colors = getColorForModule(currentModule);

    const toast = useToast();

    // Memoize agent lists to avoid re-calling registry on every render
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
                    setInput(prev => prev + (prev ? ' ' : '') + text);
                    setIsListening(false);
                }, () => setIsListening(false));
            } else {
                toast.error("Voice input not supported in this browser.");
            }
        }
    }, [isListening, toast]);

    const handleDelegate = useCallback((moduleId: string) => {
        if (moduleId !== 'dashboard') {
            setModule(moduleId as ModuleId);
        }
        if (!isAgentOpen) {
            toggleAgentWindow();
        }
        setOpenDelegate(false);
    }, [isAgentOpen, setModule, toggleAgentWindow]);

    const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files) {
            setAttachments(prev => [...prev, ...Array.from(e.target.files!)]);
        }
    }, []);

    const removeAttachment = useCallback((index: number) => {
        setAttachments(prev => prev.filter((_, i) => i !== index));
    }, []);

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
            setAttachments(prev => [...prev, ...Array.from(e.dataTransfer.files)]);
        }
    }, []);

    // Memoize file processing to avoid recreating Promise.all handler
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
        e?.preventDefault();
        if (!input.trim() && attachments.length === 0) return;

        setIsProcessing(true);
        if (!isAgentOpen) {
            toggleAgentWindow();
        }

        try {
            const targetAgent = knownAgentIds.includes(currentModule) ? currentModule : undefined;
            const processedAttachments = attachments.length > 0 ? await processAttachments(attachments) : undefined;

            await agentService.sendMessage(input, processedAttachments, targetAgent);

            setInput('');
            setAttachments([]);
            setIsProcessing(false);
        } catch (error) {
            console.error("CommandBar error:", error);
            toast.error("Failed to send message.");
            setIsProcessing(false);
        }
    }, [input, attachments, isAgentOpen, toggleAgentWindow, currentModule, knownAgentIds, processAttachments, toast]);

    return (
        <div className="w-full bg-[#0d1117] border-t border-white/10 p-4">
            <div className="max-w-4xl mx-auto">
                {/* Input Area */}
                <div
                    data-testid="command-bar-input-container"
                    className={`bg-[#161b22] border rounded-xl transition-all ${colors.border} ${colors.ring} focus-within:ring-1 relative overflow-hidden ${isDragging ? 'ring-4 ring-blue-500/50 bg-blue-500/20' : ''}`}
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                    onDrop={handleDrop}
                >
                    {/* Drag Overlay */}
                    <AnimatePresence>
                        {isDragging && (
                            <motion.div
                                initial={{ opacity: 0, scale: 0.98 }}
                                animate={{ opacity: 1, scale: 1 }}
                                exit={{ opacity: 0, scale: 0.98 }}
                                className="absolute inset-0 z-50 flex items-center justify-center bg-blue-950/90 backdrop-blur-xl border-4 border-dashed border-blue-500 rounded-xl m-1 shadow-[0_0_50px_rgba(59,130,246,0.6)]"
                            >
                                <div className="text-center animate-bounce">
                                    <div className="bg-blue-500/20 p-5 rounded-full mx-auto mb-3 w-20 h-20 flex items-center justify-center border border-blue-400/30">
                                        <Paperclip size={40} className="text-blue-300" />
                                    </div>
                                    <p className="text-white font-bold text-xl tracking-wide drop-shadow-md">Drop files to attach</p>
                                    <p className="text-blue-200 text-sm mt-1">Images, documents, audio</p>
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>

                    <PromptInput
                        value={input}
                        onValueChange={setInput}
                        onSubmit={() => handleSubmit()}
                        className={cn(
                            "bg-transparent border-none shadow-none",
                            isDragging && "opacity-50"
                        )}
                        disabled={isProcessing}
                    >
                        <PromptInputTextarea
                            placeholder={isDragging ? "" : "Describe your task, drop files, or take a picture..."}
                            className="text-gray-200 placeholder-gray-600"
                        />

                        {/* Attachments Preview */}
                        <AttachmentList attachments={attachments} onRemove={removeAttachment} />

                        {/* Toolbar */}
                        <PromptInputActions className="px-2 pb-2">
                            <div className="flex items-center gap-1">
                                {/* Attachment Buttons - Hidden on mobile */}
                                {!isMobile && (
                                    <>
                                        <input
                                    type="file"
                                    ref={fileInputRef}
                                    onChange={handleFileSelect}
                                    className="hidden"
                                    multiple
                                />
                                <input
                                    type="file"
                                    ref={cameraInputRef}
                                    onChange={handleFileSelect}
                                    className="hidden"
                                    accept="image/*"
                                    capture="environment"
                                />
                                <PromptInputAction tooltip="Attach files">
                                    <button
                                        type="button"
                                        onClick={() => fileInputRef.current?.click()}
                                        title="Attach files"
                                        aria-label="Attach files"
                                        className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium text-gray-400 hover:bg-white/5 hover:text-gray-200 transition-colors"
                                    >
                                        <Paperclip size={14} />
                                        <span className="hidden sm:inline">Attach</span>
                                    </button>
                                </PromptInputAction>
                                <PromptInputAction tooltip="Take a picture">
                                    <button
                                        type="button"
                                        onClick={() => cameraInputRef.current?.click()}
                                        title="Take a picture"
                                        aria-label="Take a picture"
                                        className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-blue-400 bg-blue-500/10 border border-blue-500/20 hover:bg-blue-500/20 hover:text-blue-300 transition-all shadow-sm"
                                    >
                                        <Camera size={14} />
                                        <span className="text-xs font-medium">Camera</span>
                                    </button>
                                </PromptInputAction>
                                    </>
                                )}
                                <div className="h-4 w-[1px] bg-white/10 mx-1"></div>
                                {/* Delegate Button - Hidden on mobile (available via "More" menu in MobileNav) */}
                                {!isMobile && (
                                    <div className="relative">
                                    <button
                                        type="button"
                                        onClick={() => setOpenDelegate(!openDelegate)}
                                        className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium text-gray-400 hover:bg-white/5 hover:text-gray-200 transition-colors"
                                    >
                                        <span>Delegate to {currentModule === 'dashboard' || currentModule === 'select-org' ? 'Indii' : currentModule.charAt(0).toUpperCase() + currentModule.slice(1)}</span>
                                        <ChevronUp size={12} className={`transition-transform ${openDelegate ? 'rotate-180' : ''}`} />
                                    </button>

                                    <DelegateMenu
                                        isOpen={openDelegate}
                                        currentModule={currentModule}
                                        managerAgents={managerAgents}
                                        departmentAgents={departmentAgents}
                                        onSelect={handleDelegate}
                                        onClose={handleCloseDelegate}
                                    />
                                    </div>
                                )}
                            </div>

                            <div className="flex items-center gap-2">
                                <PromptInputAction tooltip={isListening ? "Stop listening" : "Voice input"}>
                                    <button
                                        type="button"
                                        onClick={handleMicClick}
                                        className={`p-1.5 rounded-lg transition-colors ${isListening ? 'bg-red-500/20 text-red-500 animate-pulse' : 'text-gray-400 hover:bg-white/5 hover:text-gray-200'}`}
                                    >
                                        <Mic size={14} />
                                    </button>
                                </PromptInputAction>
                                <button
                                    type="button"
                                    onClick={(e) => handleSubmit(e)}
                                    disabled={(!input.trim() && attachments.length === 0) || isProcessing}
                                    className="flex items-center gap-2 px-3 py-1.5 bg-gray-800 hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed text-white text-xs font-medium rounded-lg transition-colors"
                                >
                                    {isProcessing ? (
                                        <Loader2 size={14} className="animate-spin" />
                                    ) : (
                                        <>
                                            Run
                                            <ArrowRight size={14} />
                                        </>
                                    )}
                                </button>
                            </div>
                        </PromptInputActions>
                    </PromptInput>
                </div>

                <div className="flex justify-end mt-2">
                    <span className="text-[10px] text-gray-600 flex items-center gap-1">
                        <span className="text-yellow-500">✦</span> Powered by Gemini
                    </span>
                </div>
            </div>
        </div>
    );
}

export default memo(CommandBar);
