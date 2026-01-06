import React, { useState, useEffect, useRef } from 'react';
import { useStore } from '@/core/store';
import { runOnboardingConversation, processFunctionCalls, calculateProfileStatus, generateNaturalFallback, generateEmptyResponseFallback, generateSection, OPTION_WHITELISTS } from '@/services/onboarding/onboardingService';
import { Send, CheckCircle, Circle, Sparkles, Paperclip, FileText, Trash2, ArrowRight, Menu, X, ChevronRight, Lightbulb, Zap, BookOpen, Music, Image, FileCheck, Clock, DollarSign, Pencil, RefreshCw, Check } from 'lucide-react';
import { getDistributorRequirements } from '@/services/onboarding/distributorRequirements';
import { motion, AnimatePresence } from 'framer-motion';
import type { ConversationFile } from '@/modules/workflow/types';
import { v4 as uuidv4 } from 'uuid';

interface HistoryItem {
    role: string;
    parts: { text: string; inlineData?: { mimeType: string; data: string } }[];
    toolCall?: {
        name: string;
        args: any;
    } | null;
}

// Client-side option validation - ensures AI-provided options match the question type's whitelist
const validateOptions = (questionType: string, options: string[]): string[] => {
    const whitelist = OPTION_WHITELISTS[questionType];
    if (!whitelist) return options; // No whitelist = allow custom options

    // Filter options to only include those in whitelist (fuzzy match)
    return options.filter(opt => {
        const optLower = opt.toLowerCase();
        return whitelist.some(w => {
            const wLower = w.toLowerCase();
            return wLower.includes(optLower) || optLower.includes(wLower) || wLower === optLower;
        });
    });
};

// Semantic insight deduplication - catches paraphrased duplicates
const isSemanticallySimilar = (a: string, b: string): boolean => {
    const normalize = (s: string) => s.toLowerCase().replace(/[^a-z0-9 ]/g, '').trim();
    const wordsA = normalize(a).split(' ').filter(w => w.length > 2); // Skip tiny words
    const wordsB = normalize(b).split(' ').filter(w => w.length > 2);

    if (wordsA.length === 0 || wordsB.length === 0) return false;

    const overlap = wordsA.filter(w => wordsB.includes(w)).length;
    const similarity = overlap / Math.max(wordsA.length, wordsB.length);
    return similarity > 0.5; // 50% word overlap = semantically similar
};

export default function OnboardingPage() {
    // Type definitions for tool call arguments (Platinum Polish compliance)
    interface ShareInsightArgs {
        insight: string;
        [key: string]: unknown;
    }

    interface AskMultipleChoiceArgs {
        options: string[];
        question_type: string;
        [key: string]: unknown;
    }

    const { userProfile, setUserProfile, setModule } = useStore();
    const [input, setInput] = useState('');
    const [history, setHistory] = useState<HistoryItem[]>([]);
    const [isProcessing, setIsProcessing] = useState(false);
    const [files, setFiles] = useState<ConversationFile[]>([]);
    const [showMobileStatus, setShowMobileStatus] = useState(false); // Mobile Drawer State
    const [isEditingBio, setIsEditingBio] = useState(false);
    const [editedBio, setEditedBio] = useState('');
    const [isRegenerating, setIsRegenerating] = useState(false);
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Dynamic opening greetings - feels more like meeting someone at a showcase
    const OPENING_GREETINGS = [
        "Hey — I'm indii. Think of me as your creative director, campaign strategist, and hype person rolled into one. Whether you are a bedroom producer or a platinum artist, I'm here to make sure the world sees what you've got. So tell me — who are you and what's your sound?",

        "Alright, let's do this. I'm indii — part creative director, part campaign architect, full-time believer in independent artists. Your bedroom demo could become a Billboard hit, and TikTok moments can become careers with the right system. What I need to know first: what makes YOUR sound different?",
        "Hey there. I'm indii, and my job is to help turn your music into a movement. But first, I need to get inside your head a bit. Forget the typical 'describe your genre' questions — tell me what you're really trying to say with your music.",
        "What's up — I'm indii. I've been trained by industry professionals to know that the best campaigns come from knowing the artist, not just the music. So before we talk releases and rollouts, let's talk about you. What's the indii pitch? Who are you?",
    ];

    // Initial greeting
    useEffect(() => {
        if (history.length === 0) {
            const randomGreeting = OPENING_GREETINGS[Math.floor(Math.random() * OPENING_GREETINGS.length)];
            setHistory([{ role: 'model', parts: [{ text: randomGreeting }] }]);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // Auto-scroll to bottom
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [history]);

    // Lifecycle log cleanup
    useEffect(() => {
        // console.log("[Onboarding] Component mounted");
        return () => {
            // console.log("[Onboarding] Component unmounted");
        };
    }, []);

    const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files.length > 0) {
            const filePromises = Array.from(e.target.files).map(file => {
                return new Promise<ConversationFile>((resolve) => {
                    const isImage = file.type.startsWith('image/');
                    const isAudio = file.type.startsWith('audio/') || ['.mp3', '.wav', '.flac', '.aiff', '.m4a'].some(ext => file.name.toLowerCase().endsWith(ext));
                    const isText = file.type === 'text/plain' || file.type === 'application/json' || file.type === 'text/markdown';

                    if (isImage) {
                        const reader = new FileReader();
                        reader.onload = (e) => {
                            resolve({
                                id: uuidv4(),
                                file,
                                preview: e.target?.result as string,
                                type: 'image',
                                base64: (e.target?.result as string)?.split(',')[1]
                            });
                        };
                        reader.readAsDataURL(file);
                    } else if (isAudio) {
                        // Audio files - we only extract metadata, never store the actual audio
                        resolve({
                            id: uuidv4(),
                            file,
                            preview: '',
                            type: 'audio',
                            content: `[Audio File: ${file.name}, Size: ${(file.size / 1024 / 1024).toFixed(2)}MB, Type: ${file.type}]`
                        });
                    } else if (isText) {
                        file.text().then(text => {
                            resolve({
                                id: uuidv4(),
                                file,
                                preview: '',
                                type: 'document',
                                content: text
                            });
                        });
                    }
                });
            });

            const newFiles = await Promise.all(filePromises);
            setFiles(prev => [...prev, ...newFiles]);
        }
    };

    const removeFile = (id: string) => {
        setFiles(prev => prev.filter(f => f.id !== id));
    };

    const handleSend = async (arg?: string | React.MouseEvent) => {
        const textToSend = typeof arg === 'string' ? arg : input;
        if (!textToSend.trim() && files.length === 0) return;

        const userMsg: HistoryItem = { role: 'user', parts: [{ text: textToSend }] };
        const newHistory = [...history, userMsg];
        setHistory(newHistory);
        setInput('');
        const currentFiles = [...files];
        setFiles([]); // Clear files after sending
        setIsProcessing(true);

        try {
            const { text, functionCalls } = await runOnboardingConversation(newHistory, userProfile, 'onboarding', currentFiles);

            const nextHistory = [...newHistory];
            let uiToolCall = null;

            if (functionCalls && functionCalls.length > 0) {
                const { updatedProfile, isFinished, updates } = processFunctionCalls(functionCalls, userProfile, currentFiles);

                setUserProfile(updatedProfile);

                if (isFinished) {
                    // Handle completion
                }

                // Check for UI Tools (multiple choice, insights, creative direction, distributor info)
                const uiToolNames = ['askMultipleChoice', 'shareInsight', 'suggestCreativeDirection', 'shareDistributorInfo'];
                uiToolCall = functionCalls.find(fc => uiToolNames.includes(fc.name));

                // Dedupe insights: Check if this insight is semantically similar to one already shown
                if (uiToolCall?.name === 'shareInsight' && 'insight' in uiToolCall.args) {
                    const args = uiToolCall.args as ShareInsightArgs;
                    const currentInsight = args.insight;
                    const alreadyShown = newHistory.some(
                        msg => msg.toolCall?.name === 'shareInsight' &&
                            'insight' in msg.toolCall.args &&
                            isSemanticallySimilar((msg.toolCall.args as ShareInsightArgs).insight, currentInsight)
                    );
                    if (alreadyShown) {
                        // console.log('[Onboarding] Deduped similar insight:', typeof currentInsight === 'string' ? currentInsight.substring(0, 50) : 'Non-string insight');
                        uiToolCall = null; // Don't show duplicate insight
                    }
                }

                // Validate options for askMultipleChoice
                if (uiToolCall?.name === 'askMultipleChoice' && 'options' in uiToolCall.args && 'question_type' in uiToolCall.args) {
                    const args = uiToolCall.args as AskMultipleChoiceArgs;
                    const validatedOptions = validateOptions(args.question_type, args.options);
                    if (validatedOptions.length === 0) {
                        // All options invalid - fall back to whitelist
                        // console.log('[Onboarding] All options invalid, using whitelist for:', args.question_type);
                        args.options = OPTION_WHITELISTS[args.question_type] || args.options;
                    } else if (validatedOptions.length !== args.options.length) {
                        // console.log('[Onboarding] Filtered invalid options:', args.options.length - validatedOptions.length);
                        args.options = validatedOptions;
                    }
                }

                // --- NATURAL FALLBACK RESPONSES ---
                // If the AI didn't return text (silent update), generate a human-sounding response
                if (!text && updates.length > 0) {
                    const { coreMissing, releaseMissing } = calculateProfileStatus(updatedProfile);

                    // Determine the next topic to ask about (prioritize core identity, then release)
                    const nextMissing = coreMissing.length > 0
                        ? coreMissing[0]
                        : releaseMissing.length > 0
                            ? releaseMissing[0]
                            : null;

                    const isReleaseContext = coreMissing.length === 0 && releaseMissing.length > 0;
                    const fallbackText = generateNaturalFallback(updates, nextMissing, isReleaseContext);
                    nextHistory.push({ role: 'model', parts: [{ text: fallbackText }], toolCall: uiToolCall });
                } else if (text) {
                    nextHistory.push({ role: 'model', parts: [{ text }], toolCall: uiToolCall });
                } else {
                    // Edge case: AI returned nothing at all
                    nextHistory.push({ role: 'model', parts: [{ text: generateEmptyResponseFallback() }], toolCall: uiToolCall });
                }
            } else {
                nextHistory.push({ role: 'model', parts: [{ text }] });
            }

            setHistory(nextHistory);

        } catch (error: unknown) {
            // console.error("Full Onboarding Error:", error);
            const errorMessage = error instanceof Error ? error.message : JSON.stringify(error);
            const errorResponses = [
                `Hmm, something went sideways on my end. Mind trying that again?`,
                `Tech hiccup — my bad. Hit me with that one more time?`,
                `Lost the thread there for a second. What were you saying?`,
                `Connection blip. Run that by me again?`,
            ];
            setHistory(prev => [...prev, { role: 'model', parts: [{ text: errorResponses[Math.floor(Math.random() * errorResponses.length)] }] }]);
        } finally {
            setIsProcessing(false);
        }
    };

    const handleComplete = () => {
        setModule('dashboard');
    };

    const handleEditBio = () => {
        setEditedBio(userProfile.bio || '');
        setIsEditingBio(true);
    };

    const handleSaveBio = () => {
        setUserProfile({ ...userProfile, bio: editedBio });
        setIsEditingBio(false);
    };

    const handleCancelEdit = () => {
        setIsEditingBio(false);
        setEditedBio('');
    };

    const handleRegenerateBio = async () => {
        if (isRegenerating) return;
        setIsRegenerating(true);
        try {
            // Gather context from what we know about the artist
            const context = [
                userProfile.brandKit?.brandDescription,
                userProfile.brandKit?.releaseDetails?.genre,
                userProfile.brandKit?.releaseDetails?.mood,
                userProfile.careerStage,
                userProfile.goals?.join(', '),
            ].filter(Boolean).join('. ');

            const newBio = await generateSection('bio', context || 'Independent artist');
            if (newBio) {
                setUserProfile({ ...userProfile, bio: newBio });
            }
        } catch (error) {
            // console.error('[Onboarding] Failed to regenerate bio:', error);
        } finally {
            setIsRegenerating(false);
        }
    };

    const { coreProgress, releaseProgress, coreMissing, releaseMissing } = calculateProfileStatus(userProfile);
    const isReadyForDashboard = coreProgress > 50; // Threshold for allowing skip/complete

    // --- SHARED PROGRESS COMPONENT ---
    const ProfileProgress = () => (
        <div>
            {/* Identity Progress */}
            <div className="mb-8">
                <div className="flex justify-between text-sm mb-2">
                    <span className="text-gray-300 font-medium">Core Identity</span>
                    <span className="text-white font-bold">{coreProgress}%</span>
                </div>
                <div className="h-2 bg-gray-800 rounded-full overflow-hidden">
                    <div
                        className="h-full bg-white transition-all duration-500"
                        style={{ width: `${coreProgress}%` }}
                    />
                </div>
                <div className="mt-4 space-y-3">
                    {[
                        { key: 'bio', label: 'Bio' },
                        { key: 'brandDescription', label: 'Brand Description' },
                        { key: 'socials', label: 'Social Links' },
                        { key: 'visuals', label: 'Visual Assets' },
                        { key: 'careerStage', label: 'Career Stage' },
                        { key: 'goals', label: 'Goals' },
                        { key: 'colorPalette', label: 'Color Palette' },
                        { key: 'typography', label: 'Typography' },
                        { key: 'aestheticStyle', label: 'Aesthetic Style' },
                    ].map(({ key, label }) => {
                        const isMissing = coreMissing.includes(key);
                        return (
                            <div key={key} className="flex items-center gap-3 text-sm">
                                {isMissing ? (
                                    <div className="w-5 h-5 rounded-full border-2 border-gray-700 flex items-center justify-center">
                                        <div className="w-full h-full rounded-full bg-transparent" />
                                    </div>
                                ) : (
                                    <div className="w-5 h-5 rounded-full bg-green-500 flex items-center justify-center text-black">
                                        <CheckCircle size={12} fill="currentColor" className="text-black" />
                                    </div>
                                )}
                                <span className={isMissing ? 'text-gray-500' : 'text-gray-200 font-medium'}>
                                    {label}
                                </span>
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* Release Progress */}
            <div className="mb-8">
                <div className="flex justify-between text-sm mb-2">
                    <span className="text-gray-300 font-medium">Current Release</span>
                    <span className="text-white font-bold">{releaseProgress}%</span>
                </div>
                <div className="h-2 bg-gray-800 rounded-full overflow-hidden">
                    <div
                        className="h-full bg-purple-500 transition-all duration-500"
                        style={{ width: `${releaseProgress}%` }}
                    />
                </div>
                <div className="mt-4 space-y-3">
                    {[
                        { key: 'title', label: 'Release Title' },
                        { key: 'type', label: 'Release Type' },
                        { key: 'genre', label: 'Genre' },
                        { key: 'mood', label: 'Mood' },
                        { key: 'themes', label: 'Themes' },
                    ].map(({ key, label }) => {
                        const isMissing = releaseMissing.includes(key);
                        return (
                            <div key={key} className="flex items-center gap-3 text-sm">
                                {isMissing ? (
                                    <div className="w-5 h-5 rounded-full border-2 border-gray-700 flex items-center justify-center">
                                        <div className="w-full h-full rounded-full bg-transparent" />
                                    </div>
                                ) : (
                                    <div className="w-5 h-5 rounded-full bg-purple-500 flex items-center justify-center text-white">
                                        <CheckCircle size={12} fill="currentColor" className="text-white" />
                                    </div>
                                )}
                                <span className={isMissing ? 'text-gray-500' : 'text-gray-200 font-medium'}>
                                    {label}
                                </span>
                            </div>
                        );
                    })}
                </div>
            </div>

            {isReadyForDashboard && (
                <div className="pt-6 border-t border-gray-800">
                    <button
                        onClick={handleComplete}
                        className="w-full bg-white text-black px-6 py-4 rounded-xl font-bold hover:bg-gray-200 transition-all flex items-center justify-center gap-2 group"
                    >
                        Go to Studio <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" />
                    </button>
                    <p className="text-center text-xs text-gray-500 mt-3">You can continue editing your profile later.</p>
                </div>
            )}
        </div>
    );

    return (
        <div className="flex h-screen w-full bg-[#0d1117] overflow-hidden">
            {/* Left Panel: Chat */}
            <div className="flex-1 flex flex-col relative">
                {/* Header */}
                <div className="absolute top-0 left-0 right-0 p-4 md:p-6 z-10 flex justify-between items-center bg-gradient-to-b from-[#0d1117] via-[#0d1117]/90 to-transparent">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-white/10 rounded-full flex items-center justify-center backdrop-blur-md">
                            <Sparkles className="text-white" size={20} />
                        </div>
                        <div>
                            <h1 className="text-lg md:text-xl font-bold text-white">Setup Your Profile</h1>
                            <p className="text-xs md:text-sm text-gray-400">Chat with indii to build your brand</p>
                        </div>
                    </div>

                    {/* Desktop Action */}
                    <div className="hidden lg:block">
                        {isReadyForDashboard && (
                            <button
                                onClick={handleComplete}
                                className="flex items-center gap-2 bg-white text-black px-6 py-2 rounded-full font-bold hover:bg-gray-200 transition-colors text-sm"
                            >
                                Enter Studio <ArrowRight size={16} />
                            </button>
                        )}
                    </div>

                    {/* Mobile Action: View Progress */}
                    <div className="flex items-center gap-2 lg:hidden">
                        <button
                            onClick={() => setShowMobileStatus(true)}
                            className="flex items-center gap-2 bg-[#1a1f2e] border border-gray-700 text-white px-3 py-2 rounded-lg text-sm font-medium hover:bg-gray-800 transition-colors"
                        >
                            {coreProgress}% <ChevronRight size={14} className="text-gray-400" />
                        </button>
                    </div>
                </div>

                {/* Chat Area */}
                <div className="flex-1 overflow-y-auto px-4 pt-24 pb-4 space-y-6 max-w-3xl mx-auto w-full">
                    {history.map((msg, idx) => (
                        <motion.div
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            key={idx}
                            className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                        >
                            <div className={`max-w-[85%] md:max-w-[80%] p-4 rounded-2xl ${msg.role === 'user'
                                ? 'bg-white text-black rounded-tr-sm'
                                : 'bg-[#161b22] text-gray-200 rounded-tl-sm border border-gray-800' // Darker bubble
                                }`}>
                                <div className="text-sm md:text-base leading-relaxed whitespace-pre-wrap">{msg.parts[0].text}</div>

                                {/* Generative UI Renderer - Multiple Choice */}
                                {msg.toolCall && msg.toolCall.name === 'askMultipleChoice' && (() => {
                                    // Check if this question has been answered (user message came after this one)
                                    const hasBeenAnswered = history.slice(idx + 1).some(m => m.role === 'user');

                                    return (
                                        <div className="mt-4 flex flex-wrap gap-2 animate-in fade-in slide-in-from-bottom-4 duration-500">
                                            {msg.toolCall.args.options.map((option: string) => (
                                                <button
                                                    key={option}
                                                    onClick={() => {
                                                        if (hasBeenAnswered) return; // Don't allow clicking answered options
                                                        setInput(option);
                                                        handleSend(option);
                                                    }}
                                                    disabled={hasBeenAnswered}
                                                    className={`px-4 py-2 rounded-lg text-sm transition-all ${hasBeenAnswered
                                                        ? 'bg-black/10 border border-white/5 text-gray-600 cursor-not-allowed opacity-50'
                                                        : 'bg-black/20 hover:bg-white hover:text-black border border-white/10 transform hover:scale-105'
                                                        }`}
                                                >
                                                    {option}
                                                </button>
                                            ))}
                                        </div>
                                    );
                                })()}

                                {/* Industry Insight Card */}
                                {msg.toolCall && msg.toolCall.name === 'shareInsight' && (
                                    <div className="mt-4 bg-gradient-to-r from-amber-900/20 to-orange-900/20 border border-amber-500/30 rounded-xl p-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
                                        <div className="flex items-start gap-3">
                                            <div className="p-2 bg-amber-500/20 rounded-lg">
                                                <Lightbulb size={18} className="text-amber-400" />
                                            </div>
                                            <div className="flex-1">
                                                <p className="text-xs text-amber-400 font-semibold uppercase tracking-wider mb-1">Industry Insight</p>
                                                <p className="text-sm text-gray-200 leading-relaxed">{msg.toolCall.args.insight}</p>
                                                {msg.toolCall.args.action_suggestion && (
                                                    <p className="text-xs text-amber-300/80 mt-2 italic">→ {msg.toolCall.args.action_suggestion}</p>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {/* Creative Direction Card */}
                                {msg.toolCall && msg.toolCall.name === 'suggestCreativeDirection' && (
                                    <div className="mt-4 bg-gradient-to-r from-purple-900/20 to-pink-900/20 border border-purple-500/30 rounded-xl p-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
                                        <div className="flex items-start gap-3">
                                            <div className="p-2 bg-purple-500/20 rounded-lg">
                                                <Zap size={18} className="text-purple-400" />
                                            </div>
                                            <div className="flex-1">
                                                <p className="text-xs text-purple-400 font-semibold uppercase tracking-wider mb-1">Creative Direction</p>
                                                <p className="text-sm text-gray-200 leading-relaxed">{msg.toolCall.args.suggestion}</p>
                                                <p className="text-xs text-gray-400 mt-2">{msg.toolCall.args.rationale}</p>
                                                {msg.toolCall.args.examples && msg.toolCall.args.examples.length > 0 && (
                                                    <div className="flex gap-2 mt-3 flex-wrap">
                                                        {msg.toolCall.args.examples.map((ex: string, idx: number) => (
                                                            <span key={idx} className="text-xs bg-purple-500/20 text-purple-300 px-2 py-1 rounded">
                                                                {ex}
                                                            </span>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {/* Distributor Requirements Card */}
                                {msg.toolCall && msg.toolCall.name === 'shareDistributorInfo' && (() => {
                                    const distro = getDistributorRequirements(msg.toolCall.args.distributor_name);
                                    if (!distro) return null;
                                    return (
                                        <div className="mt-4 bg-gradient-to-r from-cyan-900/20 to-blue-900/20 border border-cyan-500/30 rounded-xl p-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
                                            <div className="flex items-start gap-3 mb-4">
                                                <div className="p-2 bg-cyan-500/20 rounded-lg">
                                                    <BookOpen size={18} className="text-cyan-400" />
                                                </div>
                                                <div>
                                                    <p className="text-xs text-cyan-400 font-semibold uppercase tracking-wider mb-1">{distro.name} Requirements</p>
                                                    <p className="text-xs text-gray-400">Here's what you need to know for your release</p>
                                                </div>
                                            </div>

                                            <div className="grid grid-cols-2 gap-3 mb-4">
                                                {/* Cover Art */}
                                                <div className="bg-black/20 rounded-lg p-3">
                                                    <div className="flex items-center gap-2 mb-2">
                                                        <Image size={14} className="text-cyan-400" />
                                                        <span className="text-xs font-semibold text-gray-300">Cover Art</span>
                                                    </div>
                                                    <p className="text-xs text-gray-400">
                                                        {distro.coverArt.minSize} - {distro.coverArt.maxSize}
                                                    </p>
                                                    <p className="text-xs text-gray-500">{distro.coverArt.format} • {distro.coverArt.colorMode}</p>
                                                </div>

                                                {/* Audio */}
                                                <div className="bg-black/20 rounded-lg p-3">
                                                    <div className="flex items-center gap-2 mb-2">
                                                        <Music size={14} className="text-cyan-400" />
                                                        <span className="text-xs font-semibold text-gray-300">Audio</span>
                                                    </div>
                                                    <p className="text-xs text-gray-400">{distro.audio.format}</p>
                                                    <p className="text-xs text-gray-500">{distro.audio.sampleRate} / {distro.audio.bitDepth}</p>
                                                </div>

                                                {/* Timeline */}
                                                <div className="bg-black/20 rounded-lg p-3">
                                                    <div className="flex items-center gap-2 mb-2">
                                                        <Clock size={14} className="text-cyan-400" />
                                                        <span className="text-xs font-semibold text-gray-300">Timeline</span>
                                                    </div>
                                                    <p className="text-xs text-gray-400">{distro.timeline.minLeadTime} lead time</p>
                                                    <p className="text-xs text-gray-500">{distro.timeline.reviewTime} review</p>
                                                </div>

                                                {/* Pricing */}
                                                <div className="bg-black/20 rounded-lg p-3">
                                                    <div className="flex items-center gap-2 mb-2">
                                                        <DollarSign size={14} className="text-cyan-400" />
                                                        <span className="text-xs font-semibold text-gray-300">Payout</span>
                                                    </div>
                                                    <p className="text-xs text-gray-400">{distro.pricing.artistPayout}</p>
                                                    <p className="text-xs text-gray-500">{distro.pricing.model}</p>
                                                </div>
                                            </div>

                                            {/* Metadata */}
                                            <div className="bg-black/20 rounded-lg p-3 mb-3">
                                                <div className="flex items-center gap-2 mb-2">
                                                    <FileCheck size={14} className="text-cyan-400" />
                                                    <span className="text-xs font-semibold text-gray-300">Required Metadata</span>
                                                </div>
                                                <div className="flex flex-wrap gap-1">
                                                    {distro.metadata.requiredFields.slice(0, 8).map((field, idx) => (
                                                        <span key={idx} className="text-xs bg-cyan-500/10 text-cyan-300 px-2 py-0.5 rounded">
                                                            {field}
                                                        </span>
                                                    ))}
                                                    {distro.metadata.requiredFields.length > 8 && (
                                                        <span className="text-xs text-gray-500">+{distro.metadata.requiredFields.length - 8} more</span>
                                                    )}
                                                </div>
                                            </div>

                                            {/* Pro Tips */}
                                            {distro.proTips.length > 0 && (
                                                <div className="border-t border-cyan-500/20 pt-3">
                                                    <p className="text-xs text-cyan-400 font-semibold mb-2">💡 Pro Tips</p>
                                                    <ul className="space-y-1">
                                                        {distro.proTips.slice(0, 3).map((tip, idx) => (
                                                            <li key={idx} className="text-xs text-gray-400 flex items-start gap-2">
                                                                <span className="text-cyan-500 mt-0.5">→</span>
                                                                {tip}
                                                            </li>
                                                        ))}
                                                    </ul>
                                                </div>
                                            )}
                                        </div>
                                    );
                                })()}
                            </div>
                        </motion.div>
                    ))}
                    {isProcessing && (
                        <div className="flex justify-start">
                            <div className="bg-[#161b22] text-gray-400 p-4 rounded-2xl rounded-tl-sm border border-gray-800 flex items-center gap-2">
                                <Sparkles size={16} className="animate-spin" />
                                <span className="text-sm animate-pulse">
                                    {['Hang on...', 'Let me think...', 'One sec...', 'Mmm...', 'Okay...'][Math.floor(Math.random() * 5)]}
                                </span>
                            </div>
                        </div>
                    )}
                    <div ref={messagesEndRef} />
                </div>

                {/* File Previews */}
                {files.length > 0 && (
                    <div className="px-4 py-2 bg-[#0d1117]/95 backdrop-blur border-t border-gray-800 flex gap-2 overflow-x-auto max-w-3xl mx-auto w-full z-20">
                        {files.map(file => (
                            <div key={file.id} className="relative group flex-shrink-0 w-16 h-16 bg-gray-800 rounded-lg overflow-hidden border border-gray-700">
                                {file.type === 'image' ? (
                                    <img src={file.preview} alt="preview" className="w-full h-full object-cover" />
                                ) : file.type === 'audio' ? (
                                    <div className="w-full h-full flex items-center justify-center text-purple-400 bg-purple-500/10">
                                        <Music size={24} />
                                    </div>
                                ) : (
                                    <div className="w-full h-full flex items-center justify-center text-gray-400">
                                        <FileText size={24} />
                                    </div>
                                )}
                                <button
                                    onClick={() => removeFile(file.id)}
                                    className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 flex items-center justify-center text-white transition-opacity"
                                >
                                    <Trash2 size={16} />
                                </button>
                            </div>
                        ))}
                    </div>
                )}

                {/* Quick Suggestions */}
                {history.length > 0 && history.length < 6 && !input && !isProcessing && (
                    <div className="px-4 pb-2 bg-[#0d1117]">
                        <div className="max-w-3xl mx-auto">
                            <p className="text-xs text-gray-600 mb-2">Not sure what to say? Try:</p>
                            <div className="flex flex-wrap gap-2">
                                {[
                                    "I'm an electronic producer from...",
                                    "I'm working on my debut single",
                                    "Let me upload a track so you can hear it",
                                    "My sound is influenced by...",
                                    "I've got some press photos to share"
                                ].slice(0, 3).map((suggestion) => (
                                    <button
                                        key={suggestion}
                                        onClick={() => setInput(suggestion)}
                                        className="text-xs text-gray-400 hover:text-white bg-[#1a1f2e] hover:bg-[#252b40] border border-gray-800 px-3 py-1.5 rounded-full transition-colors"
                                    >
                                        {suggestion}
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>
                )}

                {/* Input Area */}
                <div className="p-4 md:p-6 bg-[#0d1117] border-t border-gray-800 z-20 pb-safe">
                    <div className="max-w-3xl mx-auto flex gap-2 md:gap-3">
                        <input
                            type="file"
                            ref={fileInputRef}
                            onChange={handleFileSelect}
                            className="hidden"
                            multiple
                            accept="image/*,.txt,.md,.json,audio/*,.mp3,.wav,.flac,.aiff,.m4a"
                        />
                        <button
                            onClick={() => fileInputRef.current?.click()}
                            className="p-3 md:p-4 text-gray-400 hover:text-white bg-[#1a1f2e] hover:bg-[#252b40] rounded-xl border border-gray-800 transition-colors"
                        >
                            <Paperclip size={20} className="md:w-6 md:h-6" />
                        </button>
                        <input
                            type="text"
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                            placeholder="Tell me about your music..."
                            className="flex-1 bg-[#1a1f2e] border border-gray-800 rounded-xl px-4 md:px-6 py-3 md:py-4 text-white focus:border-white/20 focus:outline-none text-base md:text-lg placeholder:text-gray-600"
                            autoFocus
                        />
                        <button
                            onClick={handleSend}
                            disabled={isProcessing || (!input.trim() && files.length === 0)}
                            aria-label="Send message"
                            className="bg-white hover:bg-gray-200 text-black p-3 md:p-4 rounded-xl disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                        >
                            <Send size={20} className="md:w-6 md:h-6" />
                        </button>
                    </div>
                </div>
            </div>

            {/* Right Panel: Live Status (Desktop) */}
            <div className="hidden lg:block w-96 bg-[#010409] border-l border-gray-800 p-8 overflow-y-auto">
                <div className="mb-8">
                    <h3 className="text-gray-400 text-xs font-bold uppercase tracking-wider mb-6">Profile Completion</h3>
                    <ProfileProgress />
                </div>

                <div className="pt-8 border-t border-gray-800">
                    <h4 className="text-gray-400 text-xs font-bold uppercase tracking-wider mb-4">Live Preview</h4>
                    <div className="bg-[#161b22] rounded-xl p-4 border border-gray-800">
                        {userProfile.bio || isEditingBio ? (
                            <div className="mb-4">
                                <div className="flex items-center justify-between mb-2">
                                    <p className="text-xs text-gray-500 uppercase font-bold">Bio</p>
                                    {!isEditingBio && (
                                        <div className="flex items-center gap-1">
                                            <button
                                                onClick={handleRegenerateBio}
                                                disabled={isRegenerating}
                                                className="p-1.5 text-gray-500 hover:text-purple-400 hover:bg-purple-500/10 rounded-md transition-colors disabled:opacity-50"
                                                title="Regenerate with AI"
                                            >
                                                <RefreshCw size={14} className={isRegenerating ? 'animate-spin' : ''} />
                                            </button>
                                            <button
                                                onClick={handleEditBio}
                                                className="p-1.5 text-gray-500 hover:text-white hover:bg-white/10 rounded-md transition-colors"
                                                title="Edit bio"
                                            >
                                                <Pencil size={14} />
                                            </button>
                                        </div>
                                    )}
                                </div>
                                {isEditingBio ? (
                                    <div className="space-y-2">
                                        <textarea
                                            value={editedBio}
                                            onChange={(e) => setEditedBio(e.target.value)}
                                            className="w-full bg-[#0d1117] border border-gray-700 rounded-lg p-3 text-sm text-gray-200 leading-relaxed resize-none focus:outline-none focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500"
                                            rows={4}
                                            placeholder="Write your bio..."
                                        />
                                        <div className="flex justify-end gap-2">
                                            <button
                                                onClick={handleCancelEdit}
                                                className="px-3 py-1.5 text-xs text-gray-400 hover:text-white transition-colors"
                                            >
                                                Cancel
                                            </button>
                                            <button
                                                onClick={handleSaveBio}
                                                className="px-3 py-1.5 text-xs bg-white text-black rounded-md hover:bg-gray-200 transition-colors flex items-center gap-1"
                                            >
                                                <Check size={12} /> Save
                                            </button>
                                        </div>
                                    </div>
                                ) : (
                                    <p className="text-sm text-gray-300 leading-relaxed">{userProfile.bio}</p>
                                )}
                            </div>
                        ) : (
                            <div className="py-4 text-center">
                                <p className="text-sm text-gray-600 italic mb-2">Bio will appear here...</p>
                                <button
                                    onClick={handleEditBio}
                                    className="text-xs text-purple-400 hover:text-purple-300 transition-colors"
                                >
                                    + Add manually
                                </button>
                            </div>
                        )}

                        {(userProfile.brandKit.releaseDetails.title || userProfile.brandKit.releaseDetails.genre) && (
                            <div className="mt-4 pt-4 border-t border-gray-700/50">
                                <p className="text-xs text-gray-500 mb-2 uppercase font-bold">Latest Release</p>
                                {userProfile.brandKit.releaseDetails.title && (
                                    <p className="text-sm text-white font-medium mb-1">{userProfile.brandKit.releaseDetails.title}</p>
                                )}
                                <div className="flex gap-2 text-xs">
                                    {userProfile.brandKit.releaseDetails.genre && (
                                        <span className="bg-gray-800 px-2 py-1 rounded text-gray-300">{userProfile.brandKit.releaseDetails.genre}</span>
                                    )}
                                    {userProfile.brandKit.releaseDetails.type && (
                                        <span className="bg-gray-800 px-2 py-1 rounded text-gray-300">{userProfile.brandKit.releaseDetails.type}</span>
                                    )}
                                </div>
                            </div>
                        )}

                        {/* Color Palette Preview */}
                        {userProfile.brandKit.colors && userProfile.brandKit.colors.length > 0 && (
                            <div className="mt-4 pt-4 border-t border-gray-700/50">
                                <p className="text-xs text-gray-500 mb-2 uppercase font-bold">Brand Colors</p>
                                <div className="flex gap-2 flex-wrap">
                                    {userProfile.brandKit.colors.map((color, idx) => (
                                        <div
                                            key={idx}
                                            className="w-8 h-8 rounded-lg border border-white/10 shadow-sm"
                                            style={{ backgroundColor: color }}
                                            title={color}
                                        />
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Aesthetic, Fonts & Avoid Preview */}
                        {(userProfile.brandKit.aestheticStyle || userProfile.brandKit.fonts || userProfile.brandKit.negativePrompt) && (
                            <div className="mt-4 pt-4 border-t border-gray-700/50 space-y-3">
                                {userProfile.brandKit.aestheticStyle && (
                                    <div>
                                        <p className="text-xs text-gray-500 uppercase font-bold">Aesthetic</p>
                                        <span className="inline-block mt-1 text-sm text-purple-300 bg-purple-500/10 px-2 py-1 rounded">
                                            {userProfile.brandKit.aestheticStyle}
                                        </span>
                                    </div>
                                )}
                                {userProfile.brandKit.fonts && (
                                    <div>
                                        <p className="text-xs text-gray-500 uppercase font-bold">Typography</p>
                                        <p className="text-sm text-gray-300">{userProfile.brandKit.fonts}</p>
                                    </div>
                                )}
                                {userProfile.brandKit.negativePrompt && (
                                    <div>
                                        <p className="text-xs text-gray-500 uppercase font-bold">Avoid</p>
                                        <p className="text-sm text-gray-400 italic">{userProfile.brandKit.negativePrompt}</p>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            </div>

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
                            className="fixed inset-y-0 right-0 w-[85%] max-w-sm bg-[#0d1117] border-l border-gray-800 p-6 z-50 lg:hidden shadow-2xl flex flex-col"
                        >
                            <div className="flex justify-between items-center mb-8">
                                <h3 className="text-white font-bold text-lg">Your Progress</h3>
                                <button
                                    onClick={() => setShowMobileStatus(false)}
                                    className="p-2 text-gray-400 hover:text-white rounded-full hover:bg-gray-800"
                                >
                                    <X size={24} />
                                </button>
                            </div>

                            <div className="flex-1 overflow-y-auto">
                                <ProfileProgress />
                            </div>
                        </motion.div>
                    </>
                )}
            </AnimatePresence>
        </div>
    );
}
