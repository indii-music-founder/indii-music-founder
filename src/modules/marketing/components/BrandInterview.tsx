import React, { useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
    Send,
    Paperclip,
    FileText,
    Trash2,
    Loader2,
    Music,
    MessageCircle,
    CheckCircle,
    Sparkles
} from 'lucide-react';
import { useOnboarding } from '@/modules/onboarding/hooks/useOnboarding';
import { ProfileProgressPanel } from '@/modules/onboarding/components/ProfileProgressPanel';
import {
    MultipleChoiceRenderer,
    IndustryInsightCard,
    CreativeDirectionCard,
    DistributorInfoCard
} from '@/modules/onboarding/components/GenerativeUIComponents';
import { determinePhase, calculateProfileStatus } from '@/services/onboarding/onboardingService';
import { StepStepper } from '@/modules/onboarding/components/StepStepper';
import { useToast } from '@/core/context/ToastContext';
import { useStore } from '@/core/store';
import { useShallow } from 'zustand/react/shallow';

// Custom greetings for the Brand Manager context (not first-time onboarding)
const BRAND_INTERVIEW_GREETINGS = [
    "Hey — welcome to the Brand Interview. I'm indii, your creative director. Whether you skipped onboarding or just want to dig deeper, let's build out your artist identity. What should we start with?",
    "Alright, let's get your brand locked in. I'm indii — I'll walk you through everything from your bio to your visual identity, genre, goals, and release details. Ready? Tell me about yourself.",
    "Hey there. This is where we build your artist DNA. I'm indii, and I'm going to ask you some questions to understand who you are, what you sound like, and how you want the world to see you. Start by telling me your story.",
    "Welcome to the interview room. I'm indii — think of me as half creative director, half brand architect. Everything I learn here powers your AI tools, your campaign strategy, and your visual identity. So — who are you?",
];

const RETURNING_GREETINGS = [
    "Back for more? Let's pick up where we left off. What do you want to update or add?",
    "Good to see you again. What needs work — your identity, your release details, or something new entirely?",
    "Hey — checking in. Got new music, a new direction, or just want to fill in some blanks?",
    "Let's tighten things up. What's on the agenda — new release, new brand direction, or just finishing what we started?",
];

/**
 * BrandInterview — The AI-powered interview chat embedded in the Brand Manager.
 * Reuses the same onboarding conversation engine with smart mode detection.
 * Users who skipped onboarding can complete their entire brand profile here.
 */
const BrandInterview: React.FC = () => {
    const toast = useToast();
    const { userProfile } = useStore(useShallow(state => ({ userProfile: state.userProfile })));

    // Smart greeting selection based on current profile completeness
    const smartGreetings = useMemo(() => {
        const { coreProgress, releaseProgress } = calculateProfileStatus(userProfile);
        const avgProgress = (coreProgress + releaseProgress) / 2;
        return avgProgress < 30 ? BRAND_INTERVIEW_GREETINGS : RETURNING_GREETINGS;
    }, [userProfile]);

    const handleInterviewComplete = useCallback(() => {
        toast.success("Brand profile complete! All systems go. 🚀");
    }, [toast]);

    const {
        userProfile: _profileFromHook,
        input,
        setInput,
        history,
        isProcessing,
        files,
        isEditingBio,
        editedBio,
        isRegenerating,
        messagesEndRef,
        fileInputRef,
        profileStatus,
        resolvedMode,
        handleFileSelect,
        removeFile,
        handleSend,
        handleComplete,
        handleEditBio,
        handleSaveBio,
        handleCancelEdit,
        handleRegenerateBio,
        setEditedBio
    } = useOnboarding({
        onComplete: handleInterviewComplete,
        greetings: smartGreetings,
        trackAnalytics: false, // Don't double-track analytics from Brand Manager
    });
    const currentPhase = determinePhase(userProfile);
    const { coreProgress, releaseProgress, coreMissing, releaseMissing } = profileStatus;
    const isProfileComplete = coreProgress >= 100 && releaseProgress >= 100;

    return (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-0 h-full min-h-[600px]">
            {/* Chat Area */}
            <div className="lg:col-span-8 flex flex-col h-full min-h-0 relative">
                {/* Mode indicator + Step Stepper */}
                <div className="px-4 lg:px-6 pt-4 pb-2 border-b border-white/5 bg-[#0a0a0a]/50 backdrop-blur-sm">
                    <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                            <div className="w-2 h-2 rounded-full bg-dept-marketing animate-pulse" />
                            <span className="text-[10px] font-black text-gray-400 uppercase tracking-[0.15em]">
                                {resolvedMode === 'onboarding' ? 'New Interview' : 'Profile Update'}
                            </span>
                        </div>
                        {isProfileComplete && (
                            <div className="flex items-center gap-1.5 text-emerald-500">
                                <CheckCircle size={12} />
                                <span className="text-[10px] font-bold uppercase tracking-wider">Complete</span>
                            </div>
                        )}
                    </div>
                    <StepStepper currentPhase={currentPhase} />
                </div>

                {/* Messages */}
                <div className="flex-1 overflow-y-auto px-4 lg:px-6 py-6 space-y-6 custom-scrollbar">
                    <AnimatePresence mode="popLayout">
                        {history.map((msg, idx) => (
                            <motion.div
                                key={idx}
                                initial={{ opacity: 0, y: 10, scale: 0.98 }}
                                animate={{ opacity: 1, y: 0, scale: 1 }}
                                transition={{ duration: 0.4, ease: [0.23, 1, 0.32, 1] }}
                                className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                            >
                                <div className={`max-w-[85%] lg:max-w-[80%]`}>
                                    <div className={`
                                        p-4 rounded-2xl shadow-lg backdrop-blur-md
                                        ${msg.role === 'user'
                                            ? 'bg-white text-black font-medium border border-white/20'
                                            : 'bg-white/5 border border-white/10 text-gray-200'
                                        }
                                    `}>
                                        <p className="text-sm leading-relaxed whitespace-pre-wrap">{msg.parts[0].text}</p>

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
                                <Loader2 className="animate-spin text-dept-marketing" size={18} />
                                <span className="text-xs text-gray-400 font-bold uppercase tracking-widest">indii is thinking...</span>
                            </div>
                        </motion.div>
                    )}
                    <div ref={messagesEndRef} />
                </div>

                {/* File Previews */}
                <AnimatePresence>
                    {files.length > 0 && (
                        <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: 'auto', opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            className="flex flex-wrap gap-2 px-4 lg:px-6 py-3 border-t border-white/5 bg-[#0a0a0a]/50"
                        >
                            {files.map(file => (
                                <div key={file.id} className="relative group animate-in zoom-in-75 duration-300">
                                    {file.type === 'image' ? (
                                        <img src={file.preview} alt="" className="w-14 h-14 rounded-xl object-cover border-2 border-white/10 shadow-lg" />
                                    ) : file.type === 'audio' ? (
                                        <div className="w-14 h-14 rounded-xl bg-purple-500/10 border-2 border-white/10 flex items-center justify-center shadow-lg">
                                            <Music size={20} className="text-purple-400" />
                                        </div>
                                    ) : (
                                        <div className="w-14 h-14 rounded-xl bg-white/5 border-2 border-white/10 flex flex-col items-center justify-center p-2 shadow-lg">
                                            <FileText size={18} className="text-dept-marketing mb-0.5" />
                                            <span className="text-[7px] text-gray-500 truncate w-full text-center">{file.file.name}</span>
                                        </div>
                                    )}
                                    <button
                                        onClick={() => removeFile(file.id)}
                                        className="absolute -top-1 -right-1 bg-red-500 text-white p-0.5 rounded-full opacity-0 group-hover:opacity-100 transition-all transform scale-75 group-hover:scale-100 shadow-xl"
                                        aria-label={`Remove ${file.file.name}`}
                                    >
                                        <Trash2 size={10} />
                                    </button>
                                </div>
                            ))}
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* Input Bar */}
                <div className="p-4 lg:p-6 border-t border-white/5 bg-[#0a0a0a]/80 backdrop-blur-xl">
                    <div className="relative group">
                        <input
                            type="text"
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                            placeholder="Tell indii about your music, brand, or goals..."
                            aria-label="Type your message"
                            className="w-full bg-white/5 border border-white/10 rounded-2xl px-5 py-3.5 pr-28 focus:outline-none focus:border-dept-marketing/40 transition-all text-sm font-medium placeholder:text-gray-600 focus:bg-white/10"
                        />
                        <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
                            <button
                                onClick={() => fileInputRef.current?.click()}
                                className="p-2.5 text-gray-500 hover:text-white transition-all hover:bg-white/5 rounded-xl"
                                title="Attach Assets"
                                aria-label="Attach file"
                            >
                                <Paperclip size={18} />
                            </button>
                            <button
                                onClick={() => handleSend()}
                                disabled={!input.trim() && files.length === 0}
                                aria-label="Send message"
                                className="h-9 w-9 bg-dept-marketing text-white flex items-center justify-center rounded-xl hover:brightness-110 transition-all shadow-lg shadow-dept-marketing/20 disabled:opacity-30 disabled:cursor-not-allowed group"
                            >
                                <Send size={16} className="group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
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
                    <p className="mt-2 text-[9px] text-gray-600 font-bold uppercase tracking-[0.15em] text-center">
                        Secure Interview • AI-Powered by Gemini 3 Pro
                    </p>
                </div>
            </div>

            {/* Right Panel — Profile Progress */}
            <div className="hidden lg:flex lg:col-span-4 flex-col border-l border-white/5 bg-[#0a0a0a]/30 backdrop-blur-xl p-6 overflow-y-auto custom-scrollbar">
                {/* Brand Interview Header */}
                <div className="flex items-center gap-3 mb-6 pb-4 border-b border-white/5">
                    <div className="w-10 h-10 rounded-xl bg-dept-marketing/10 border border-dept-marketing/20 flex items-center justify-center">
                        <MessageCircle size={18} className="text-dept-marketing" />
                    </div>
                    <div>
                        <h3 className="text-sm font-bold text-white tracking-tight">Brand Interview</h3>
                        <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest">
                            {resolvedMode === 'onboarding' ? 'Building your identity' : 'Updating your profile'}
                        </p>
                    </div>
                </div>

                {/* Progress Panel */}
                <ProfileProgressPanel
                    coreProgress={coreProgress}
                    releaseProgress={releaseProgress}
                    coreMissing={coreMissing}
                    releaseMissing={releaseMissing}
                    isReadyForDashboard={false}
                    onComplete={handleComplete}
                />

                {/* Live Preview Section */}
                {(userProfile.bio || userProfile.brandKit?.releaseDetails?.title) && (
                    <div className="mt-6 pt-6 border-t border-white/5">
                        <h4 className="text-[10px] text-gray-500 font-bold uppercase tracking-widest mb-4 flex items-center gap-2">
                            <Sparkles size={10} className="text-dept-marketing" />
                            Live Preview
                        </h4>
                        {userProfile.bio && (
                            <div className="mb-4">
                                <p className="text-[9px] text-gray-600 font-bold uppercase tracking-wider mb-1">Bio</p>
                                <p className="text-xs text-gray-300 line-clamp-4 leading-relaxed">{userProfile.bio}</p>
                            </div>
                        )}
                        {userProfile.brandKit?.releaseDetails?.title && (
                            <div className="mb-4">
                                <p className="text-[9px] text-gray-600 font-bold uppercase tracking-wider mb-1">Active Release</p>
                                <p className="text-xs text-gray-300">
                                    {userProfile.brandKit.releaseDetails.title}
                                    {userProfile.brandKit.releaseDetails.type && (
                                        <span className="text-gray-600 ml-1">({userProfile.brandKit.releaseDetails.type})</span>
                                    )}
                                </p>
                            </div>
                        )}
                        {userProfile.brandKit?.colors && userProfile.brandKit.colors.length > 0 && (
                            <div>
                                <p className="text-[9px] text-gray-600 font-bold uppercase tracking-wider mb-2">Palette</p>
                                <div className="flex gap-1.5">
                                    {userProfile.brandKit.colors.slice(0, 6).map((color, idx) => (
                                        <div
                                            key={idx}
                                            className="w-6 h-6 rounded-md border border-white/10 shadow-sm"
                                            style={{ backgroundColor: color }}
                                            title={color}
                                        />
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
};

export default BrandInterview;
