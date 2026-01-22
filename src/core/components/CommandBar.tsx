import React, { memo } from 'react';
import { useStore } from '@/core/store';
import { motion, AnimatePresence } from 'framer-motion';
import { PromptArea } from './command-bar/PromptArea';

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
    const delegateButtonRef = useRef<HTMLButtonElement>(null);

    const { currentModule, setModule, toggleAgentWindow, isAgentOpen, chatChannel, setChatChannel } = useStore();
    const isIndiiMode = chatChannel === 'indii';
    const colors = getColorForModule(currentModule);

    const toast = useToast();

    // Auto-switch to agent channel when entering a specialist module
    useEffect(() => {
        if (currentModule === 'dashboard' || currentModule === 'select-org') {
            if (chatChannel !== 'indii') setChatChannel('indii');
        } else {
            if (chatChannel !== 'agent') setChatChannel('agent');
        }
    }, [currentModule, setChatChannel]); // Removed chatChannel dependency to fix toggle reversion

    // Memoize agent lists to avoid re-calling registry on every render
    const allAgents = useMemo(() => agentRegistry.getAll(), []);
    const managerAgents = useMemo(() => allAgents.filter(a => a.category === 'manager' || a.category === 'specialist'), [allAgents]);
    const departmentAgents = useMemo(() => allAgents.filter(a => a.category === 'department'), [allAgents]);
    const knownAgentIds = useMemo(() => allAgents.map(a => a.id), [allAgents]);

    const handleCloseDelegate = useCallback(() => {
        setOpenDelegate(false);
        // Focus restoration is handled by effect below
    }, []);

    // Restore focus to delegate button when menu closes
    const prevOpenDelegate = useRef(openDelegate);
    useEffect(() => {
        if (prevOpenDelegate.current && !openDelegate) {
            delegateButtonRef.current?.focus();
        }
        prevOpenDelegate.current = openDelegate;
    }, [openDelegate]);

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
    const { isCommandBarDetached, isAgentOpen } = useStore();

    // In docked mode, if the chat overlay is open, we hide this standalone bar 
    // because it's rendered inside ChatOverlay.
    if (!isCommandBarDetached && isAgentOpen) return null;

    // We show the bar if it's detached OR if the chat window is closed.
    const shouldShow = isCommandBarDetached || !isAgentOpen;

    return (
        <AnimatePresence>
            {shouldShow && (
                <motion.div
                    key="standalone-command-bar"
                    initial={{ opacity: 0, y: 40, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 40, scale: 0.95 }}
                    drag={isCommandBarDetached}
                    dragMomentum={false}
                    className="fixed bottom-8 left-1/2 -translate-x-1/2 w-full max-w-2xl px-6 md:px-0 z-[500] pointer-events-none flex items-center justify-center"
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
                            placeholder={isDragging ? "" : (isIndiiMode ? "Ask indii to orchestrate..." : `Message ${currentModule}...`)}
                            className="text-gray-200 placeholder-gray-600 text-base md:text-sm"
                            aria-label="Command input"
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
                                            style={{ display: 'none' }}
                                            multiple
                                            aria-label="File upload"
                                        />
                                        <input
                                            type="file"
                                            ref={cameraInputRef}
                                            onChange={handleFileSelect}
                                            className="hidden"
                                            style={{ display: 'none' }}
                                            accept="image/*"
                                            capture="environment"
                                            aria-label="Camera upload"
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
                                            ref={delegateButtonRef}
                                            type="button"
                                            onClick={() => setOpenDelegate(!openDelegate)}
                                            className={cn(
                                                "flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium transition-all border duration-300",
                                                !isIndiiMode
                                                    ? `${colors.bg} ${colors.border} ${colors.text} shadow-[0_0_10px_rgba(0,0,0,0.3)]`
                                                    : "bg-transparent border-transparent text-gray-400 hover:bg-white/5 hover:text-white hover:border-white/10"
                                            )}
                                            aria-haspopup="true"
                                            aria-expanded={openDelegate}
                                        >
                                            {/* Active indicator dot */}
                                            <div className={cn(
                                                "w-1.5 h-1.5 rounded-full transition-all duration-300",
                                                !isIndiiMode ? "bg-green-400 shadow-[0_0_8px_rgba(74,222,128,0.6)] animate-pulse" : "bg-gray-600"
                                            )} />
                                            <span>Delegate to {currentModule === 'dashboard' || currentModule === 'select-org' ? 'indii' : currentModule.charAt(0).toUpperCase() + currentModule.slice(1)}</span>
                                            <ChevronUp size={12} className={`transition-transform duration-300 ${openDelegate ? 'rotate-180 text-white' : ''}`} />
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

                            <div className="flex items-center gap-2 ml-auto">
                                <button
                                    type="button"
                                    onClick={toggleAgentWindow}
                                    className={cn(
                                        "p-1.5 rounded-full transition-all duration-300 mr-2 hover:bg-white/10",
                                        isAgentOpen ? "text-white bg-white/10" : "text-gray-500 hover:text-gray-300"
                                    )}
                                    title={isAgentOpen ? "Close chat" : "Open chat"}
                                    aria-label={isAgentOpen ? "Close chat" : "Open chat"}
                                >
                                    {isAgentOpen ? <PanelTopClose size={16} /> : <PanelTopOpen size={16} />}
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setChatChannel(isIndiiMode ? 'agent' : 'indii')}
                                    className={cn(
                                        "p-1.5 rounded-full transition-all duration-300 border flex items-center gap-2 px-4 group relative overflow-hidden",
                                        isIndiiMode
                                            ? "bg-purple-600/20 border-purple-500/50 text-purple-200 shadow-[0_0_15px_rgba(168,85,247,0.2)]"
                                            : "bg-black/40 border-white/5 text-gray-500 hover:text-gray-200 hover:border-white/20 hover:bg-white/5"
                                    )}
                                    title={isIndiiMode ? "active: indii (Orchestrator)" : "Switch to indii"}
                                    aria-label={isIndiiMode ? "Switch to Agent" : "Switch to indii"}
                                    aria-pressed={isIndiiMode}
                                >
                                    {isIndiiMode && <div className="absolute inset-0 bg-purple-500/10 animate-pulse-slow" />}
                                    <div className={cn(
                                        "w-1.5 h-1.5 rounded-full transition-all duration-300 relative z-10",
                                        isIndiiMode ? "bg-purple-400 shadow-[0_0_8px_rgba(192,132,252,0.8)]" : "bg-gray-600 group-hover:bg-gray-500"
                                    )} />
                                    <span className={cn(
                                        "text-[10px] font-bold tracking-widest transition-all relative z-10 font-lowercase",
                                        isIndiiMode ? "text-purple-100 shadow-purple-500/50" : ""
                                    )}>indii</span>
                                </button>
                                <div className="h-4 w-[1px] bg-white/10 mx-1"></div>
                                <PromptInputAction tooltip={isListening ? "Stop listening" : "Voice input"}>
                                    <button
                                        type="button"
                                        onClick={handleMicClick}
                                        aria-label={isListening ? "Stop listening" : "Voice input"}
                                        className={`p-1.5 rounded-lg transition-colors ${isListening ? 'bg-red-500/20 text-red-500 animate-pulse' : 'text-gray-400 hover:bg-white/5 hover:text-gray-200'}`}
                                    >
                                        <Mic size={14} />
                                    </button>
                                </PromptInputAction>
                                <PromptInputAction tooltip="Run command (Enter)">
                                    <button
                                        type="button"
                                        onClick={(e) => handleSubmit(e)}
                                        data-testid="command-bar-run-btn"
                                        disabled={(!input.trim() && attachments.length === 0) || isProcessing}
                                        className="flex items-center gap-2 px-3 py-1.5 bg-gray-800 hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed text-white text-xs font-medium rounded-lg transition-colors"
                                        aria-label={isProcessing ? "Processing command" : "Run command"}
                                    >
                                        {isProcessing ? (
                                            <Loader2 data-testid="run-loader" size={14} className="animate-spin" />
                                        ) : (
                                            <>
                                                Run
                                                <ArrowRight size={14} />
                                            </>
                                        )}
                                    </button>
                                </PromptInputAction>
                            </div>
                        </PromptInputActions>
                    </PromptInput>
                </div>


            </div>
        </div >
                    <div className="w-full pointer-events-auto">
                        <PromptArea />
                    </div>
                </motion.div>
            )}
        </AnimatePresence>
    );
}

export default memo(CommandBar);
