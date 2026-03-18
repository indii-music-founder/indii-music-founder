import { useState, useEffect, useRef } from 'react';
import { useStore } from '@/core/store';
import { useShallow } from 'zustand/react/shallow';
import {
    runOnboardingConversation,
    processFunctionCalls,
    calculateProfileStatus,
    generateNaturalFallback,
    generateEmptyResponseFallback,
    generateSection,
    OPTION_WHITELISTS,
    TopicKey
} from '@/services/onboarding/onboardingService';
import { useToast } from '@/core/context/ToastContext';
import { onboardingAnalytics } from '@/services/onboarding/onboardingAnalytics';
import type { ConversationFile } from '@/modules/workflow/types';
import { v4 as uuidv4 } from 'uuid';
import { validateOptions, isSemanticallySimilar, OPENING_GREETINGS } from '../onboardingUtils';

export interface HistoryItem {
    role: string;
    parts: { text: string; inlineData?: { mimeType: string; data: string } }[];
    toolCall?: {
        name: string;
        args: any;
    } | null;
}

interface ShareInsightArgs {
    insight: string;
    [key: string]: unknown;
}

interface AskMultipleChoiceArgs {
    options: string[];
    question_type: string;
    [key: string]: unknown;
}

export interface UseOnboardingOptions {
    /** Override the conversation mode. Defaults to smart detection based on profile completeness. */
    mode?: 'onboarding' | 'update';
    /** Custom callback when the interview is complete. If not provided, navigates to dashboard. */
    onComplete?: () => void;
    /** Custom opening greetings. If not provided, uses the default OPENING_GREETINGS. */
    greetings?: string[];
    /** Whether to track analytics. Defaults to true. */
    trackAnalytics?: boolean;
}

export function useOnboarding(options: UseOnboardingOptions = {}) {
    const { userProfile, setUserProfile, setModule } = useStore(
        useShallow(state => ({
            userProfile: state.userProfile,
            setUserProfile: state.setUserProfile,
            setModule: state.setModule
        }))
    );
    const { showToast } = useToast();
    const [input, setInput] = useState('');
    const [history, setHistory] = useState<HistoryItem[]>([]);
    const [isProcessing, setIsProcessing] = useState(false);
    const [files, setFiles] = useState<ConversationFile[]>([]);
    const [showMobileStatus, setShowMobileStatus] = useState(false);
    const [isEditingBio, setIsEditingBio] = useState(false);
    const [editedBio, setEditedBio] = useState('');
    const [isRegenerating, setIsRegenerating] = useState(false);
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Determine conversation mode: smart detection based on profile completeness
    const resolvedMode = options.mode ?? (() => {
        const { coreProgress, releaseProgress } = calculateProfileStatus(userProfile);
        return (coreProgress + releaseProgress) / 2 < 30 ? 'onboarding' : 'update';
    })();

    const shouldTrackAnalytics = options.trackAnalytics ?? true;
    const greetingsToUse = options.greetings ?? OPENING_GREETINGS;

    // Initial greeting — intentionally only fires once on mount
    useEffect(() => {
        if (history.length === 0) {
            const randomGreeting = greetingsToUse[Math.floor(Math.random() * greetingsToUse.length)];
            setHistory([{ role: 'model', parts: [{ text: randomGreeting ?? '' }] }]);
            if (shouldTrackAnalytics) {
                onboardingAnalytics.start();
            }
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [history.length]);

    // Auto-scroll to bottom
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [history]);

    /**
     * Shared file processing logic — used by both click-to-upload and drag-and-drop.
     */
    const processFiles = async (fileList: FileList | File[]) => {
        const filesArray = Array.from(fileList);
        if (filesArray.length === 0) return;

        const filePromises = filesArray.map(file => {
            return new Promise<ConversationFile>((resolve) => {
                const isImage = file.type.startsWith('image/');
                const isAudio = file.type.startsWith('audio/') || ['.mp3', '.wav', '.flac', '.aiff', '.m4a', '.ogg', '.aac'].some(ext => file.name.toLowerCase().endsWith(ext));
                const isText = file.type === 'text/plain' || file.type === 'application/json' || file.type === 'text/markdown';
                const isPdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');

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
                    resolve({
                        id: uuidv4(),
                        file,
                        preview: '',
                        type: 'audio',
                        content: `[Audio File: ${file.name}, Size: ${(file.size / 1024 / 1024).toFixed(2)}MB, Type: ${file.type}]`
                    });
                } else if (isPdf) {
                    resolve({
                        id: uuidv4(),
                        file,
                        preview: '',
                        type: 'document',
                        content: `[PDF Document: ${file.name}, Size: ${(file.size / 1024 / 1024).toFixed(2)}MB]`
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
                } else {
                    // Fallback — treat unknown types as generic documents
                    resolve({
                        id: uuidv4(),
                        file,
                        preview: '',
                        type: 'document',
                        content: `[File: ${file.name}, Size: ${(file.size / 1024 / 1024).toFixed(2)}MB, Type: ${file.type || 'unknown'}]`
                    });
                }
            });
        });

        const newFiles = await Promise.all(filePromises);
        setFiles(prev => [...prev, ...newFiles]);
    };

    const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files.length > 0) {
            await processFiles(e.target.files);
        }
    };

    const handleFileDrop = async (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();

        const droppedFiles = e.dataTransfer?.files;
        if (droppedFiles && droppedFiles.length > 0) {
            await processFiles(droppedFiles);
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
        setFiles([]);
        setIsProcessing(true);

        try {
            const { text, functionCalls } = await runOnboardingConversation(newHistory, userProfile, resolvedMode, currentFiles);
            const nextHistory = [...newHistory];
            let uiToolCall: HistoryItem['toolCall'] = null;

            if (functionCalls && functionCalls.length > 0) {
                const { updatedProfile, isFinished, updates } = processFunctionCalls(functionCalls, userProfile, currentFiles);
                setUserProfile(updatedProfile);

                if (shouldTrackAnalytics) {
                    for (const update of updates) {
                        if (typeof update === 'string') {
                            onboardingAnalytics.fieldCompleted(update, 'identity_core');
                        }
                    }
                }

                if (isFinished) {
                    const { coreProgress: cp, releaseProgress: rp } = calculateProfileStatus(updatedProfile);
                    if (shouldTrackAnalytics) {
                        onboardingAnalytics.completed(cp, rp, history.filter(h => h.role === 'user').length);
                    }
                    if (options.onComplete) {
                        options.onComplete();
                    } else {
                        setModule('dashboard');
                    }
                }

                const uiToolNames = ['askMultipleChoice', 'shareInsight', 'suggestCreativeDirection', 'shareDistributorInfo'];
                const foundCall = functionCalls.find(fc => uiToolNames.includes(fc.name));
                if (foundCall) {
                    uiToolCall = { name: foundCall.name, args: foundCall.args };
                }

                if (uiToolCall?.name === 'shareInsight' && 'insight' in uiToolCall.args) {
                    const args = uiToolCall.args as ShareInsightArgs;
                    const alreadyShown = newHistory.some(
                        msg => msg.toolCall?.name === 'shareInsight' &&
                            'insight' in msg.toolCall.args &&
                            isSemanticallySimilar((msg.toolCall.args as ShareInsightArgs).insight, args.insight)
                    );
                    if (alreadyShown) uiToolCall = null;
                }

                if (uiToolCall?.name === 'askMultipleChoice' && 'options' in uiToolCall.args && 'question_type' in uiToolCall.args) {
                    const args = uiToolCall.args as AskMultipleChoiceArgs;
                    const validatedOptions = validateOptions(args.question_type, args.options);
                    if (validatedOptions.length === 0) {
                        args.options = OPTION_WHITELISTS[args.question_type] || args.options;
                    } else if (validatedOptions.length !== args.options.length) {
                        args.options = validatedOptions;
                    }
                }

                if (!text && updates.length > 0) {
                    const { coreMissing, releaseMissing } = calculateProfileStatus(updatedProfile);
                    const nextMissing = (coreMissing.length > 0
                        ? coreMissing[0]
                        : releaseMissing.length > 0
                            ? releaseMissing[0]
                            : null) as TopicKey | null;

                    const isReleaseContext = coreMissing.length === 0 && releaseMissing.length > 0;
                    const fallbackText = generateNaturalFallback(updates, nextMissing, isReleaseContext);
                    nextHistory.push({ role: 'model', parts: [{ text: fallbackText }], toolCall: uiToolCall });
                } else if (text) {
                    nextHistory.push({ role: 'model', parts: [{ text }], toolCall: uiToolCall });
                } else {
                    nextHistory.push({ role: 'model', parts: [{ text: generateEmptyResponseFallback() }], toolCall: uiToolCall });
                }
            } else {
                nextHistory.push({ role: 'model', parts: [{ text }] });
            }
            setHistory(nextHistory);
        } catch (error) {
            const errorResponses = [
                `Hmm, something went sideways on my end. Mind trying that again?`,
                `Tech hiccup — my bad. Hit me with that one more time?`,
                `Lost the thread there for a second. What were you saying?`,
                `Connection blip. Run that by me again?`,
            ];
            setHistory(prev => [...prev, { role: 'model', parts: [{ text: errorResponses[Math.floor(Math.random() * errorResponses.length)] ?? '' }] }]);
        } finally {
            setIsProcessing(false);
        }
    };

    const handleComplete = () => {
        const { coreProgress: cp, releaseProgress: rp } = calculateProfileStatus(userProfile);
        if (shouldTrackAnalytics) {
            if (cp >= 100 && rp >= 100) {
                onboardingAnalytics.completed(cp, rp, history.filter(h => h.role === 'user').length);
            } else {
                onboardingAnalytics.skipped(cp, rp, 'complete');
            }
        }

        // Persist dismissal so the user never gets redirected back to onboarding.
        // This is the escape hatch read by useOnboardingRedirect in App.tsx.
        try {
            localStorage.setItem('onboarding_dismissed', 'true');
        } catch {
            // localStorage may be unavailable (private browsing, quota exceeded)
        }

        if (options.onComplete) {
            options.onComplete();
        } else {
            setModule('dashboard');
        }
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
            // silent catch
        } finally {
            setIsRegenerating(false);
        }
    };

    const profileStatus = calculateProfileStatus(userProfile);

    return {
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
        setEditedBio,
        isRegenerating,
        messagesEndRef,
        fileInputRef,
        profileStatus,
        resolvedMode,
        handleFileSelect,
        handleFileDrop,
        removeFile,
        handleSend,
        handleComplete,
        handleEditBio,
        handleSaveBio,
        handleCancelEdit,
        handleRegenerateBio
    };
}
