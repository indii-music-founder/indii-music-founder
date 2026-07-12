/* eslint-disable @typescript-eslint/no-explicit-any -- Module component with dynamic data */
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
import { flushFounderFunnelQueue, trackFounderFunnelEvent } from '@/services/founders/founderFunnel';
import type { ConversationFile } from '@/modules/workflow/types';
import { v4 as uuidv4 } from 'uuid';
import { validateOptions, isSemanticallySimilar, OPENING_GREETINGS } from '../onboardingUtils';
import { secureRandomPick } from '@/utils/crypto-random';
import { logger } from '@/utils/logger';

/**
 * ISSUE-955: Brand Interview audio attachments are sent to Gemini as
 * inlineData (base64), same as images. Capped well under Gemini's
 * inlineData limit — this is a short reference clip in a chat attachment,
 * not a full master (see AudioIntelligenceService's larger cap for that
 * separate, dedicated analysis flow).
 */
const MAX_ONBOARDING_AUDIO_BYTES = 15 * 1024 * 1024;

function fileToBase64(file: File): Promise<string> {
    return new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => {
            const dataUrl = reader.result as string;
            const base64 = dataUrl.split(',')[1];
            if (!base64) {
                reject(new Error('FileReader produced an empty base64 payload'));
                return;
            }
            resolve(base64);
        };
        reader.onerror = () => reject(new Error('FileReader failed to read file'));
        reader.readAsDataURL(file);
    });
}

export interface HistoryItem {
    role: string;
    parts: { 
        text?: string; 
        inlineData?: { mimeType: string; data: string };
        functionCall?: { name: string; args: Record<string, unknown> };
        functionResponse?: { name: string; response: Record<string, unknown> };
    }[];
    toolCall?: {
        name: string;
        args: any;
    } | null;
    thoughtSignature?: string;
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
    const { userProfile, setUserProfile, setModule, addActiveAgent, removeActiveAgent } = useStore(
        useShallow(state => ({
            userProfile: state.userProfile,
            setUserProfile: state.setUserProfile,
            setModule: state.setModule,
            addActiveAgent: state.addActiveAgent,
            removeActiveAgent: state.removeActiveAgent
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
            const randomGreeting = secureRandomPick(greetingsToUse);
            setHistory([{ role: 'model', parts: [{ text: randomGreeting ?? '' }] }]);
            if (shouldTrackAnalytics) {
                onboardingAnalytics.start();
            }
            flushFounderFunnelQueue();
            try {
                if (typeof window !== 'undefined' && localStorage.getItem('indii_founder_preview_pending') === 'true') {
                    void trackFounderFunnelEvent('founder_walkthrough_started', {
                        mode: resolvedMode,
                        surface: 'onboarding',
                    }, {
                        userId: userProfile?.id ?? null,
                        email: userProfile?.email ?? null,
                    });
                }
            } catch {
                // localStorage may be unavailable; founder tracking remains best-effort.
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

        const filePromises = filesArray.map(async (file): Promise<ConversationFile> => {
            const isImage = file.type.startsWith('image/');
            const isAudio = file.type.startsWith('audio/') || ['.mp3', '.wav', '.flac', '.aiff', '.m4a', '.ogg', '.aac'].some(ext => file.name.toLowerCase().endsWith(ext));
            const isText = file.type === 'text/plain' || file.type === 'application/json' || file.type === 'text/markdown';
            const isPdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');

            if (isImage) {
                return new Promise<ConversationFile>((resolve) => {
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
                });
            }

            if (isAudio) {
                // ISSUE-955: previously stored only a metadata string —
                // the model could never hear the audio. Attach the real
                // bytes (bounded) so onboardingService can send them to
                // Gemini as inlineData, same as images.
                if (file.size > MAX_ONBOARDING_AUDIO_BYTES) {
                    return {
                        id: uuidv4(),
                        file,
                        preview: '',
                        type: 'audio',
                        content: `[Audio File: ${file.name} is ${(file.size / 1024 / 1024).toFixed(1)}MB, over the ${MAX_ONBOARDING_AUDIO_BYTES / 1024 / 1024}MB limit — not attached for analysis.]`
                    };
                }
                try {
                    const base64 = await fileToBase64(file);
                    return {
                        id: uuidv4(),
                        file,
                        preview: '',
                        type: 'audio',
                        base64
                    };
                } catch (error: unknown) {
                    logger.error('Failed to read audio file for onboarding attachment', error);
                    return {
                        id: uuidv4(),
                        file,
                        preview: '',
                        type: 'audio',
                        content: `[Audio File: ${file.name} could not be read — it may be corrupt.]`
                    };
                }
            }

            if (isPdf) {
                // ISSUE-955: previously stored only a "[PDF Document: name,
                // Size: ...]" placeholder as if it were the document's
                // content. Extract the real text via the existing
                // PDFService (pdfjs-dist) instead.
                try {
                    const { PDFService } = await import('@/services/utils/PDFService');
                    const text = await PDFService.extractText(file);
                    if (!text.trim()) {
                        return {
                            id: uuidv4(),
                            file,
                            preview: '',
                            type: 'document',
                            content: `[PDF Document: ${file.name} — no extractable text found. It may be a scanned/image-only PDF.]`
                        };
                    }
                    return { id: uuidv4(), file, preview: '', type: 'document', content: text };
                } catch (error: unknown) {
                    logger.error('Failed to extract PDF text for onboarding attachment', error);
                    return {
                        id: uuidv4(),
                        file,
                        preview: '',
                        type: 'document',
                        content: `[PDF Document: ${file.name} could not be read — it may be encrypted or corrupt.]`
                    };
                }
            }

            if (isText) {
                const text = await file.text();
                return { id: uuidv4(), file, preview: '', type: 'document', content: text };
            }

            // Fallback — treat unknown types as generic documents
            return {
                id: uuidv4(),
                file,
                preview: '',
                type: 'document',
                content: `[File: ${file.name}, Size: ${(file.size / 1024 / 1024).toFixed(2)}MB, Type: ${file.type || 'unknown'}]`
            };
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
        
        // Inject thoughtSignature from previous model message if available
        const lastModelMsg = history.slice().reverse().find(m => m.role === 'model' && m.thoughtSignature);
        if (lastModelMsg && lastModelMsg.thoughtSignature) {
            userMsg.thoughtSignature = lastModelMsg.thoughtSignature;
        }

        const newHistory = [...history, userMsg];
        setHistory(newHistory);
        setInput('');
        const currentFiles = [...files];
        setFiles([]);
        setIsProcessing(true);

        try {
            const { text, functionCalls, thoughtSignature } = await runOnboardingConversation(newHistory, userProfile, resolvedMode, currentFiles);
            const nextHistory = [...newHistory];
            let uiToolCall: HistoryItem['toolCall'] = null;

            if (functionCalls && functionCalls.length > 0) {
                const { updatedProfile, isFinished, updates, warnings } = processFunctionCalls(functionCalls, userProfile, currentFiles);
                setUserProfile(updatedProfile);

                warnings.forEach(warning => showToast(warning, 'error'));

                if (updatedProfile.careerProfile && updatedProfile.careerProfile !== userProfile.careerProfile) {
                    const seatingMap: Record<string, string[]> = {
                        dj: ['generalist', 'marketing', 'social', 'creative'],
                        sync_producer: ['generalist', 'legal', 'licensing', 'publishing'],
                        touring_band: ['generalist', 'road', 'marketing', 'merchandise', 'finance'],
                        label_manager: ['generalist', 'legal', 'finance', 'distribution', 'publishing']
                    };
                    const agentsToSeat = seatingMap[updatedProfile.careerProfile] || ['generalist'];
                    agentsToSeat.forEach(agentId => addActiveAgent(agentId));
                }

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

                // Push the model's function calls (and text if present) into history
                const modelParts: any[] = functionCalls.map(fc => ({ functionCall: { name: fc.name, args: fc.args } }));
                if (text) {
                    modelParts.push({ text });
                }
                
                nextHistory.push({ 
                    role: 'model', 
                    parts: modelParts, 
                    toolCall: uiToolCall,
                    thoughtSignature 
                });

                // Push the system's function response into history
                const functionResponseParts = functionCalls.map(fc => ({
                    functionResponse: { name: fc.name, response: { success: true } }
                }));
                nextHistory.push({
                    role: 'function',
                    parts: functionResponseParts
                });

                // If no text was returned but we made updates, add a natural fallback as a second model turn
                if (!text && updates.length > 0) {
                    const { coreMissing, releaseMissing } = calculateProfileStatus(updatedProfile);
                    const nextMissing = (coreMissing.length > 0
                        ? coreMissing[0]
                        : releaseMissing.length > 0
                            ? releaseMissing[0]
                            : null) as TopicKey | null;

                    const isReleaseContext = coreMissing.length === 0 && releaseMissing.length > 0;
                    const fallbackText = generateNaturalFallback(updates, nextMissing, isReleaseContext);
                    nextHistory.push({ role: 'model', parts: [{ text: fallbackText }], thoughtSignature });
                } else if (!text) {
                    nextHistory.push({ role: 'model', parts: [{ text: generateEmptyResponseFallback() }], thoughtSignature });
                }
            } else {
                nextHistory.push({ role: 'model', parts: [{ text }], thoughtSignature });
            }
            setHistory(nextHistory);
        } catch (error: unknown) {
            const msg = error instanceof Error ? error.message : String(error);

            let errorText: string;
            if (msg.includes('ONBOARDING_TIMEOUT')) {
                errorText = `Took me a minute there — my thinking engine timed out. Hit send again and I'll pick up where we left off.`;
            } else if (msg.includes('ONBOARDING_RATE_LIMIT')) {
                errorText = `I'm getting a lot of requests right now. Give me about 30 seconds and try again?`;
            } else {
                const errorResponses = [
                    `Hmm, something went sideways on my end. Mind trying that again?`,
                    `Tech hiccup — my bad. Hit me with that one more time?`,
                    `Lost the thread there for a second. What were you saying?`,
                    `Connection blip. Run that by me again?`,
                ];
                errorText = secureRandomPick(errorResponses);
            }

            setHistory(prev => [...prev, { role: 'model', parts: [{ text: errorText }] }]);
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
            const isFounderPreview = localStorage.getItem('indii_founder_preview_pending') === 'true';
            localStorage.setItem('onboarding_dismissed', 'true');
            localStorage.removeItem('indii_founder_preview_pending');
            if (isFounderPreview) {
                void trackFounderFunnelEvent('founder_walkthrough_completed', {
                    mode: resolvedMode,
                    surface: 'onboarding',
                }, {
                    userId: userProfile?.id ?? null,
                    email: userProfile?.email ?? null,
                });
            }
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
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        } catch (error: unknown) {
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
        handleRegenerateBio,
        addActiveAgent,
        setUserProfile
    };
}
