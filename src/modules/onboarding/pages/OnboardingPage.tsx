import React, { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
    Send,
    Paperclip,
    FileText,
    Trash2,
    Menu,
    X,
    ChevronRight,
    Loader2,
    Upload
} from 'lucide-react';
import { useOnboarding } from '../hooks/useOnboarding';
import { ProfileProgressPanel } from '../components/ProfileProgressPanel';
import { BrandKitPreview } from '../components/BrandKitPreview';
import {
    MultipleChoiceRenderer,
    IndustryInsightCard,
    CreativeDirectionCard,
    DistributorInfoCard
} from '../components/GenerativeUIComponents';
import { StepStepper } from '../components/StepStepper';
import { determinePhase } from '@/services/onboarding/onboardingService';
import { ModuleErrorBoundary } from '@/core/components/ModuleErrorBoundary';

export default function OnboardingPage() {
    const {
        userProfile,
        input,
        setInput,
        history,
        isProcessing,
        files,
        showMobileStatus,
        setShowMobileStatus,
        isEditingBio,
        editedBio,
        isRegenerating,
        messagesEndRef,
        fileInputRef,
        profileStatus,
        handleFileSelect,
        handleFileDrop,
        removeFile,
        handleSend,
        handleComplete,
        handleEditBio,
        handleSaveBio,
        handleCancelEdit,
        handleRegenerateBio,
        setEditedBio
    } = useOnboarding();

    const currentPhase = determinePhase(userProfile);

    // Drag-and-drop state
    const [isDragOver, setIsDragOver] = useState(false);
    const dragCounterRef = React.useRef(0);

    const handleDragEnter = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        dragCounterRef.current += 1;
        if (e.dataTransfer?.types?.includes('Files')) {
            setIsDragOver(true);
        }
    }, []);

    const handleDragLeave = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        dragCounterRef.current -= 1;
        if (dragCounterRef.current <= 0) {
            dragCounterRef.current = 0;
            setIsDragOver(false);
        }
    }, []);

    const handleDragOver = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
    }, []);

    const handleDrop = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        dragCounterRef.current = 0;
        setIsDragOver(false);
        handleFileDrop(e);
    }, [handleFileDrop]);

    return (
        <ModuleErrorBoundary moduleName="Onboarding">
        <div className="flex flex-col lg:flex-row h-full w-full bg-bg-dark text-white overflow-hidden relative">
            {/* Background Atmosphere */}
            <div className="absolute inset-0 pointer-events-none overflow-hidden">
                <div className="absolute top-[-10%] right-[-10%] w-[40%] h-[40%] bg-purple-600/10 blur-[120px] rounded-full" />
                <div className="absolute bottom-[-10%] left-[-10%] w-[40%] h-[40%] bg-cyan-600/10 blur-[120px] rounded-full" />
            </div>

            {/* Mobile Header */}
            <div className="lg:hidden flex items-center justify-between p-4 border-b border-white/5 bg-bg-dark/80 backdrop-blur-md sticky top-0 z-40">
                <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-white flex items-center justify-center">
                        <span className="text-black font-black text-xs">i</span>
                    </div>
                    <span className="font-bold tracking-tight">Onboarding</span>
                </div>
                <button
                    onClick={() => setShowMobileStatus(true)}
                    className="p-2 text-gray-400 hover:text-white transition-colors"
                    aria-label={`View profile progress, ${profileStatus.coreProgress}% complete`}
                >
                    <Menu size={24} />
                </button>
            </div>

            <main
                className="flex-1 flex flex-col h-full min-w-0 z-10 relative"
                onDragEnter={handleDragEnter}
                onDragLeave={handleDragLeave}
                onDragOver={handleDragOver}
                onDrop={handleDrop}
            >
                {/* Drag-and-Drop Overlay */}
                <AnimatePresence>
                    {isDragOver && (
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            transition={{ duration: 0.15 }}
                            className="absolute inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-md border-2 border-dashed border-purple-400/60 rounded-2xl m-2"
                        >
                            <div className="text-center">
                                <motion.div
                                    animate={{ y: [0, -8, 0] }}
                                    transition={{ repeat: Infinity, duration: 1.5, ease: 'easeInOut' }}
                                    className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-purple-500/20 border border-purple-400/30 mb-4"
                                >
                                    <Upload size={28} className="text-purple-400" />
                                </motion.div>
                                <p className="text-white font-bold text-lg mb-1">Drop files here</p>
                                <p className="text-gray-400 text-sm">Images, audio, documents — indii will handle them</p>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
                <div className="flex-1 overflow-y-auto px-4 py-8 lg:px-12 scrollbar-hide">
                    <div className="max-w-3xl mx-auto flex flex-col h-full space-y-8">

                        <div className="pt-4 pb-8 sticky top-0 bg-bg-dark/80 backdrop-blur-md z-20 mx-[-1rem] px-[1rem] lg:mx-0 lg:px-0">
                            <StepStepper currentPhase={currentPhase} />
                        </div>

                        <div className="space-y-8">
                            <AnimatePresence mode="popLayout">
                                {history.map((msg, idx) => (
                                    <motion.div
                                        key={idx}
                                        initial={{ opacity: 0, y: 10, scale: 0.98 }}
                                        animate={{ opacity: 1, y: 0, scale: 1 }}
                                        transition={{ duration: 0.4, ease: [0.23, 1, 0.32, 1] }}
                                        className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                                    >
                                        <div className={`max-w-[85%] lg:max-w-[80%] ${msg.role === 'user' ? 'order-1' : 'order-2'}`}>
                                            <div className={`
                                            p-4 lg:p-6 rounded-2xl shadow-xl backdrop-blur-md
                                            ${msg.role === 'user'
                                                    ? 'bg-white text-black font-medium border border-white/20'
                                                    : 'bg-white/5 border border-white/10 text-gray-200'
                                                }
                                        `}>
                                                <p className="text-sm lg:text-[15px] leading-relaxed whitespace-pre-wrap">{msg.parts[0]!.text}</p>

                                                {/* Generative UI Components */}
                                                {msg.toolCall?.name === 'askMultipleChoice' && (
                                                    <MultipleChoiceRenderer
                                                        options={msg.toolCall.args.options}
                                                        hasBeenAnswered={idx < history.length - 1}
                                                        onSelect={(opt) => handleSend(opt)}
                                                    />
                                                )}

                                                {msg.toolCall?.name === 'shareInsight' && (
                                                    <IndustryInsightCard
                                                        insight={msg.toolCall.args.insight}
                                                        action_suggestion={msg.toolCall.args.action_suggestion}
                                                    />
                                                )}

                                                {msg.toolCall?.name === 'suggestCreativeDirection' && (
                                                    <CreativeDirectionCard
                                                        suggestion={msg.toolCall.args.suggestion}
                                                        rationale={msg.toolCall.args.rationale}
                                                        examples={msg.toolCall.args.examples}
                                                    />
                                                )}

                                                {msg.toolCall?.name === 'shareDistributorInfo' && (
                                                    <DistributorInfoCard distributorName={msg.toolCall.args.distributor_name} />
                                                )}
                                            </div>
                                        </div>
                                    </motion.div>
                                ))}
                            </AnimatePresence>
                            {isProcessing && (
                                <motion.div
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: 1 }}
                                    className="flex justify-start"
                                >
                                    <div className="bg-white/5 border border-white/10 p-4 rounded-2xl flex items-center gap-3">
                                        <Loader2 className="animate-spin text-purple-400" size={18} />
                                        <span className="text-xs text-gray-400 font-bold uppercase tracking-widest">indii is thinking...</span>
                                    </div>
                                </motion.div>
                            )}
                            <div ref={messagesEndRef} />
                        </div>
                    </div>
                </div>

                <div className="p-4 lg:p-8 border-t border-white/5 bg-bg-dark/50 backdrop-blur-xl">
                    <div className="max-w-3xl mx-auto">
                        <AnimatePresence>
                            {files.length > 0 && (
                                <motion.div
                                    initial={{ height: 0, opacity: 0 }}
                                    animate={{ height: 'auto', opacity: 1 }}
                                    exit={{ height: 0, opacity: 0 }}
                                    className="flex flex-wrap gap-2 mb-4"
                                >
                                    {files.map(file => (
                                        <div key={file.id} className="relative group animate-in zoom-in-75 duration-300">
                                            {file.type === 'image' ? (
                                                <img src={file.preview} alt="" className="w-16 h-16 rounded-xl object-cover border-2 border-white/10 shadow-lg" />
                                            ) : (
                                                <div className="w-16 h-16 rounded-xl bg-white/5 border-2 border-white/10 flex flex-col items-center justify-center p-2 shadow-lg">
                                                    <FileText size={20} className="text-purple-400 mb-1" />
                                                    <span className="text-[8px] text-gray-500 truncate w-full text-center">{file.file.name}</span>
                                                </div>
                                            )}
                                            <button
                                                onClick={() => removeFile(file.id)}
                                                className="absolute -top-1.5 -right-1.5 bg-red-500 text-white p-1 rounded-full opacity-0 group-hover:opacity-100 transition-all transform scale-75 group-hover:scale-100 shadow-xl"
                                            >
                                                <Trash2 size={12} />
                                            </button>
                                        </div>
                                    ))}
                                </motion.div>
                            )}
                        </AnimatePresence>

                        <div className="relative group">
                            <input
                                type="text"
                                value={input}
                                onChange={(e) => setInput(e.target.value)}
                                onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                                placeholder="Tell indii about your music..."
                                aria-label="Type your message"
                                className="w-full bg-white/5 border border-white/10 rounded-2xl px-6 py-4 pr-32 focus:outline-none focus:border-white/30 transition-all text-sm lg:text-base font-medium placeholder:text-gray-600 focus:bg-white/10"
                            />
                            <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1.5 p-1.5">
                                <button
                                    onClick={() => fileInputRef.current?.click()}
                                    className="p-3 text-gray-500 hover:text-white transition-all hover:bg-white/5 rounded-xl border border-transparent hover:border-white/5"
                                    title="Attach Assets"
                                    aria-label="Attach file"
                                >
                                    <Paperclip size={20} />
                                </button>
                                <button
                                    onClick={() => handleSend()}
                                    disabled={!input.trim() && files.length === 0}
                                    aria-label="Send message"
                                    className="h-11 w-11 bg-white text-black flex items-center justify-center rounded-xl hover:bg-gray-200 transition-all shadow-xl shadow-white/5 disabled:opacity-50 disabled:cursor-not-allowed group"
                                >
                                    <Send size={20} className="group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
                                </button>
                            </div>
                        </div>
                        <input
                            type="file"
                            multiple
                            ref={fileInputRef}
                            onChange={handleFileSelect}
                            className="hidden"
                            accept="image/*,audio/*,.mp3,.wav,.flac,.pdf,text/*"
                        />
                        <p className="mt-3 text-[10px] text-gray-600 font-bold uppercase tracking-widest text-center lg:text-left ml-2">Secure AI Workspace • Gemini 3 Pro 2M Enabled</p>
                    </div>
                </div>
            </main>

            {/* Desktop Dashboard Sidebar */}
            <aside className="hidden lg:flex flex-col w-[400px] border-l border-white/5 bg-bg-dark/30 backdrop-blur-xl p-8 overflow-y-auto scrollbar-hide z-20">
                <ProfileProgressPanel
                    coreProgress={profileStatus.coreProgress}
                    releaseProgress={profileStatus.releaseProgress}
                    coreMissing={profileStatus.coreMissing}
                    releaseMissing={profileStatus.releaseMissing}
                    isReadyForDashboard={profileStatus.coreProgress >= 50}
                    onComplete={handleComplete}
                />

                <div className="mt-8 space-y-6">
                    <BrandKitPreview
                        userProfile={userProfile}
                        isEditingBio={isEditingBio}
                        editedBio={editedBio}
                        isRegenerating={isRegenerating}
                        onEditBio={handleEditBio}
                        onSaveBio={handleSaveBio}
                        onCancelEdit={handleCancelEdit}
                        onRegenerateBio={handleRegenerateBio}
                        onBioChange={setEditedBio}
                    />
                </div>
            </aside>

            {/* Mobile Status Drawer */}
            <AnimatePresence>
                {showMobileStatus && (
                    <>
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            onClick={() => setShowMobileStatus(false)}
                            className="fixed inset-0 bg-black/80 backdrop-blur-sm z-40 lg:hidden"
                        />
                        <motion.div
                            initial={{ x: '100%' }}
                            animate={{ x: 0 }}
                            exit={{ x: '100%' }}
                            transition={{ type: "spring", damping: 25, stiffness: 200 }}
                            className="fixed inset-y-0 right-0 w-[85%] max-w-sm bg-bg-dark border-l border-white/10 p-6 z-50 lg:hidden shadow-2xl flex flex-col"
                        >
                            <div className="flex justify-between items-center mb-8">
                                <h3 className="text-white font-bold text-lg tracking-tight">Your Progress</h3>
                                <button
                                    onClick={() => setShowMobileStatus(false)}
                                    className="p-2 text-gray-400 hover:text-white rounded-full hover:bg-white/5 transition-colors"
                                >
                                    <X size={24} />
                                </button>
                            </div>

                            <div className="flex-1 overflow-y-auto pr-2 scrollbar-hide">
                                <ProfileProgressPanel
                                    coreProgress={profileStatus.coreProgress}
                                    releaseProgress={profileStatus.releaseProgress}
                                    coreMissing={profileStatus.coreMissing}
                                    releaseMissing={profileStatus.releaseMissing}
                                    isReadyForDashboard={profileStatus.coreProgress >= 50}
                                    onComplete={handleComplete}
                                />
                                <div className="mt-8">
                                    <BrandKitPreview
                                        userProfile={userProfile}
                                        isEditingBio={isEditingBio}
                                        editedBio={editedBio}
                                        isRegenerating={isRegenerating}
                                        onEditBio={handleEditBio}
                                        onSaveBio={handleSaveBio}
                                        onCancelEdit={handleCancelEdit}
                                        onRegenerateBio={handleRegenerateBio}
                                        onBioChange={setEditedBio}
                                    />
                                </div>
                            </div>
                        </motion.div>
                    </>
                )}
            </AnimatePresence>
        </div>
        </ModuleErrorBoundary>
    );
}
