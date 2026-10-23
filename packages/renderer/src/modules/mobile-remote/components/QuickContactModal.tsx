import React, { useState, useRef, useEffect, useCallback } from 'react';
import { User, Phone, Mail, Building, FileText, Camera, Check, X, Loader2, Mic, Play, Pause, RotateCcw, Sparkles } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { EncounterService } from '@/services/encounters/EncounterService';
import { remoteRelayService } from '@/services/agent/RemoteRelayService';
import { useToast } from '@/core/context/ToastContext';
import { triggerHaptic } from '../haptics';
import type { FieldContactRole } from '@/types/contacts';
import { StorageService } from '@/services/StorageService';
import { auth } from '@/services/firebase';
import { logger } from '@/utils/logger';
import { safeStorageFetch } from '@/services/storage/safeStorageFetch';
import type { CreateEncounterInput } from '@/types/encounter';
import { manualContactRecord } from '@/services/encounters/manualContact';

interface QuickContactModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSaved?: () => void;
}

const ROLES: { id: FieldContactRole; label: string }[] = [
    { id: 'promoter', label: 'Promoter' },
    { id: 'venue_staff', label: 'Venue' },
    { id: 'musician', label: 'Artist' },
    { id: 'manager', label: 'Manager' },
    { id: 'media', label: 'Media' },
    { id: 'fan', label: 'Fan' },
    { id: 'other', label: 'Other' },
];

const AUDIO_MIME_CANDIDATES = [
    'audio/webm;codecs=opus',
    'audio/webm',
    'audio/ogg;codecs=opus',
    'audio/mp4',
    'audio/aac',
];

function pickSupportedAudioMimeType(): string | undefined {
    if (typeof MediaRecorder === 'undefined' || typeof MediaRecorder.isTypeSupported !== 'function') {
        return undefined;
    }
    for (const candidate of AUDIO_MIME_CANDIDATES) {
        if (MediaRecorder.isTypeSupported(candidate)) {
            return candidate;
        }
    }
    return undefined;
}

function audioExtensionForMimeType(mimeType: string): string {
    const lower = mimeType.toLowerCase();
    if (lower.includes('webm')) return 'webm';
    if (lower.includes('ogg')) return 'ogg';
    if (lower.includes('mp4') || lower.includes('m4a') || lower.includes('aac')) return 'm4a';
    return 'wav';
}

export default function QuickContactModal({ isOpen, onClose, onSaved }: QuickContactModalProps) {
    const toast = useToast();
    const [mode, setMode] = useState<'voice' | 'manual'>('voice');

    // Voice recording state
    const [isRecording, setIsRecording] = useState(false);
    const [recordingDuration, setRecordingDuration] = useState(0);
    const [capturedAudioBlob, setCapturedAudioBlob] = useState<Blob | null>(null);
    const [audioUrl, setAudioUrl] = useState<string | null>(null);
    const [isPlayingAudio, setIsPlayingAudio] = useState(false);

    // MediaRefs
    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const audioChunksRef = useRef<Blob[]>([]);
    const streamRef = useRef<MediaStream | null>(null);
    const timerRef = useRef<number | null>(null);
    const audioElementRef = useRef<HTMLAudioElement | null>(null);

    // Photo/Avatar state
    const [cardPhoto, setCardPhoto] = useState<File | null>(null);
    const [photoPreviewUrl, setPhotoPreviewUrl] = useState<string | null>(null);
    const audioUrlRef = useRef<string | null>(null);
    const photoUrlRef = useRef<string | null>(null);
    const mediaSessionRef = useRef(0);
    const avatarRequestRef = useRef(0);
    const [generatedAvatarUrl, setGeneratedAvatarUrl] = useState<string | null>(null);
    const [isGeneratingAvatar, setIsGeneratingAvatar] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Manual form state (fallback for loud environments)
    const manualSavingRef = useRef(false);
    const [name, setName] = useState('');
    const [phone, setPhone] = useState('');
    const [email, setEmail] = useState('');
    const [organization, setOrganization] = useState('');
    const [role, setRole] = useState<FieldContactRole>('other');
    const [notes, setNotes] = useState('');

    const [isSaving, setIsSaving] = useState(false);

    // Cleanup URLs & streams on close/unmount
    const cleanupMedia = useCallback(() => {
        mediaSessionRef.current++;
        avatarRequestRef.current++;
        audioChunksRef.current = [];
        const recorder = mediaRecorderRef.current;
        if (recorder) {
            recorder.ondataavailable = null;
            recorder.onstop = null;
            if (recorder.state !== 'inactive') recorder.stop();
            mediaRecorderRef.current = null;
        }
        if (streamRef.current) {
            streamRef.current.getTracks().forEach((track) => track.stop());
            streamRef.current = null;
        }
        if (timerRef.current) {
            window.clearInterval(timerRef.current);
            timerRef.current = null;
        }
        if (audioElementRef.current) {
            audioElementRef.current.pause();
            audioElementRef.current = null;
        }
        if (audioUrlRef.current) URL.revokeObjectURL(audioUrlRef.current);
        if (photoUrlRef.current) URL.revokeObjectURL(photoUrlRef.current);
        audioUrlRef.current = null;
        photoUrlRef.current = null;
        setAudioUrl(null);
        setPhotoPreviewUrl(null);
        setGeneratedAvatarUrl(null);
        setIsGeneratingAvatar(false);
        setCapturedAudioBlob(null);
        setCardPhoto(null);
        setIsRecording(false);
        setRecordingDuration(0);
        setIsPlayingAudio(false);
    }, []);

    useEffect(() => {
        if (!isOpen) cleanupMedia();
        return () => {
            cleanupMedia();
        };
    }, [isOpen, cleanupMedia]);

    const handleClose = () => {
        cleanupMedia();
        setName('');
        setPhone('');
        setEmail('');
        setOrganization('');
        setRole('other');
        setNotes('');
        setGeneratedAvatarUrl(null);
        setIsGeneratingAvatar(false);
        setMode('voice');
        (document.activeElement as HTMLElement)?.blur();
        onClose();
    };

    // ── Voice Recording Controls ──────────────────────────────────────────────

    const startRecording = async () => {
        const session = ++mediaSessionRef.current;
        triggerHaptic(50);
        (document.activeElement as HTMLElement)?.blur();

        if (audioUrlRef.current) {
            URL.revokeObjectURL(audioUrlRef.current);
            audioUrlRef.current = null;
            setAudioUrl(null);
        }
        setCapturedAudioBlob(null);
        setIsPlayingAudio(false);

        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            if (session !== mediaSessionRef.current) {
                stream.getTracks().forEach(track => track.stop());
                return;
            }
            streamRef.current = stream;

            const mimeType = pickSupportedAudioMimeType();
            const recorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);
            mediaRecorderRef.current = recorder;
            const chunks: Blob[] = [];
            audioChunksRef.current = chunks;

            recorder.ondataavailable = (e) => {
                if (session === mediaSessionRef.current && e.data && e.data.size > 0) {
                    chunks.push(e.data);
                }
            };

            recorder.onstop = () => {
                if (session !== mediaSessionRef.current) return;
                stream.getTracks().forEach(track => track.stop());
                if (streamRef.current === stream) streamRef.current = null;
                setIsRecording(false);
                if (timerRef.current) {
                    window.clearInterval(timerRef.current);
                    timerRef.current = null;
                }
                if (!chunks.some(chunk => chunk.size > 0)) {
                    toast.error('No audio was recorded. Please try recording again.');
                    return;
                }
                const effectiveMimeType = recorder.mimeType || mimeType || 'audio/webm';
                const audioBlob = new Blob(chunks, { type: effectiveMimeType });
                setCapturedAudioBlob(audioBlob);
                const nextUrl = URL.createObjectURL(audioBlob);
                if (audioUrlRef.current) URL.revokeObjectURL(audioUrlRef.current);
                audioUrlRef.current = nextUrl;
                setAudioUrl(nextUrl);

            };

            recorder.start(100);
            setIsRecording(true);
            setRecordingDuration(0);

            timerRef.current = window.setInterval(() => {
                setRecordingDuration((prev) => prev + 1);
            }, 1000);
        } catch (error) {
            if (session !== mediaSessionRef.current) return;
            streamRef.current?.getTracks().forEach(track => track.stop());
            streamRef.current = null;
            setIsRecording(false);
            logger.error('[VoiceContactModal] Failed to access mic:', error);
            toast.error('Unable to access microphone. Please check browser permissions.');
        }
    };

    const stopRecording = () => {
        triggerHaptic(50);
        if (timerRef.current) {
            window.clearInterval(timerRef.current);
            timerRef.current = null;
        }
        if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
            mediaRecorderRef.current.stop();
        }
        setIsRecording(false);
    };

    const switchToManual = () => {
        // Cancel pending microphone permission as well as an active recording.
        mediaSessionRef.current++;
        stopRecording();
        streamRef.current?.getTracks().forEach(track => track.stop());
        streamRef.current = null;
        setMode('manual');
    };

    const togglePlayAudio = () => {
        if (!audioUrl) return;
        triggerHaptic(30);

        if (isPlayingAudio) {
            audioElementRef.current?.pause();
            setIsPlayingAudio(false);
        } else {
            if (!audioElementRef.current) {
                audioElementRef.current = new Audio(audioUrl);
                audioElementRef.current.onended = () => setIsPlayingAudio(false);
                audioElementRef.current.onerror = () => setIsPlayingAudio(false);
            }
            audioElementRef.current.play();
            setIsPlayingAudio(true);
        }
    };

    // ── Photo / Avatar Snap ───────────────────────────────────────────────────

    const handlePhotoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            const file = e.target.files[0];
            avatarRequestRef.current++;
            setIsGeneratingAvatar(false);
            if (photoUrlRef.current) URL.revokeObjectURL(photoUrlRef.current);
            setCardPhoto(file);
            photoUrlRef.current = URL.createObjectURL(file);
            setPhotoPreviewUrl(photoUrlRef.current);
            setGeneratedAvatarUrl(null);
            triggerHaptic(30);
        }
    };

    const removePhoto = () => {
        avatarRequestRef.current++;
        setIsGeneratingAvatar(false);
        if (photoUrlRef.current) URL.revokeObjectURL(photoUrlRef.current);
        photoUrlRef.current = null;
        setCardPhoto(null);
        setPhotoPreviewUrl(null);
        setGeneratedAvatarUrl(null);
        triggerHaptic(20);
    };

    const handleGenerateAvatar = async () => {
        const photo = cardPhoto;
        if (!photo) { toast.error('Choose a portrait before generating an avatar.'); return; }
        const requestId = ++avatarRequestRef.current;

        setIsGeneratingAvatar(true);
        triggerHaptic([30, 60]);

        try {
            const { ImageGeneration } = await import('@/services/image/ImageGenerationService');
            // Send the chosen portrait itself; missing/empty media is an error, never a placeholder image.
            if (!photo.size || !photo.type.startsWith('image/')) throw new Error('Choose a readable portrait before generating an avatar.');
            let base64Data: string;
            const mimeType = photo.type;
            if (typeof photo.arrayBuffer === 'function') {
                const bytes = new Uint8Array(await photo.arrayBuffer());
                if (!bytes.length) throw new Error('The portrait is empty. Choose the photo again.');
                base64Data = btoa(bytes.reduce((data, byte) => data + String.fromCharCode(byte), ''));
            } else {
                base64Data = await new Promise<string>((resolve, reject) => {
                    const reader = new FileReader();
                    reader.onload = () => {
                        const value = typeof reader.result === 'string' ? reader.result.split(',')[1] : '';
                        if (value) resolve(value); else reject(new Error('The portrait could not be read.'));
                    };
                    reader.onerror = () => reject(new Error('The portrait could not be read.'));
                    reader.readAsDataURL(photo);
                });
            }

            const prompt = 'Stylized high-definition music industry artist avatar portrait, cinematic lighting, ultra-detailed professional studio headshot, vibrant background';
            if (requestId !== avatarRequestRef.current) return;
            const results = await ImageGeneration.generateImages({
                prompt,
                aspectRatio: '1:1',
                count: 1,
                model: 'pro',
                sourceImages: [{
                    mimeType,
                    data: base64Data,
                }],
            });

            if (requestId !== avatarRequestRef.current) return;
            if (results && results.length > 0 && results[0]?.url) {
                setGeneratedAvatarUrl(results[0].url);
                triggerHaptic([40, 80, 40]);
                toast.success('Generated AI avatar from portrait!');
            } else {
                throw new Error('Image generation completed without a valid result URL');
            }
        } catch (error) {
            if (requestId !== avatarRequestRef.current) return;
            logger.error('[QuickContactModal] Failed to generate avatar:', error);
            toast.error(error instanceof Error ? error.message : 'Failed to generate avatar');
        } finally {
            if (requestId === avatarRequestRef.current) setIsGeneratingAvatar(false);
        }
    };

    const uploadContactPhoto = async (userId: string): Promise<CreateEncounterInput['assets'][number] | null> => {
        if (auth.currentUser?.uid !== userId) throw new Error('Sign in again before saving this contact.');
        const photo = generatedAvatarUrl ? (await safeStorageFetch(generatedAvatarUrl)).blob : cardPhoto;
        if (!photo) return null;
        if (!photo.type.startsWith('image/')) throw new Error('Choose a readable image for this contact.');
        if (auth.currentUser?.uid !== userId) throw new Error('Sign in again before saving this contact.');
        const filename = `contact_${crypto.randomUUID()}`;
        const path = `users/${userId}/assets/captured_contacts/${filename}`;
        const downloadUrl = await StorageService.uploadFile(photo, path);
        return { type: 'photo', storagePath: path, downloadUrl, mimeType: photo.type, sizeBytes: photo.size, filename };
    };

    // ── Submit Handlers ───────────────────────────────────────────────────────

    const handleVoiceSubmit = async () => {
        if (!capturedAudioBlob) {
            toast.error('Please record contact information first.');
            return;
        }

        setIsSaving(true);
        triggerHaptic([40, 80]);

        try {
            const userId = auth.currentUser?.uid;
            if (!userId) throw new Error('You must be signed in to create a contact.');

            // 1. Upload audio memo
            const audioExt = audioExtensionForMimeType(capturedAudioBlob.type);
            const audioFilename = `contact_voice_${Date.now()}.${audioExt}`;
            const audioPath = `users/${userId}/voice_memos/${audioFilename}`;
            const audioDownloadUrl = await StorageService.uploadFile(capturedAudioBlob, audioPath);

            // The source descriptor must name the actual uploaded object, including generated avatars.
            const photoAsset = await uploadContactPhoto(userId);

            // 3. Create Encounter in Firestore (triggers Gemini 3 Flash multimodal extraction pipeline)
            await EncounterService.createEncounter({
                assets: [
                    {
                        type: 'audio',
                        storagePath: audioPath,
                        downloadUrl: audioDownloadUrl,
                        mimeType: capturedAudioBlob.type || 'audio/webm',
                    },
                    ...(photoAsset ? [photoAsset] : []),
                ],
                clientContext: 'Contact Intake: Extract contact information (name, phone, email, organization, role, notes)',
            }, userId);

            // 4. Notify paired desktop relay if active
            try {
                await remoteRelayService.dispatchTask({
                    type: 'quick_contact',
                    payload: {
                        audioUrl: audioDownloadUrl,
                        imageUrl: photoAsset?.downloadUrl,
                        transcription: 'Voice contact intake: AI extraction pending',
                    },
                });
            } catch {
                // Background relay dispatch is advisory; primary persistence is in Firestore
            }

            triggerHaptic([50, 100, 50]);
            toast.success('Voice contact sent to AI — parsing into Contacts!');
            handleClose();
            onSaved?.();
        } catch (error) {
            triggerHaptic([100, 150]);
            toast.error(error instanceof Error ? error.message : 'Failed to save voice contact.');
        } finally {
            setIsSaving(false);
        }
    };

    const handleManualSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (isSaving || manualSavingRef.current) return;
        const trimmedName = name.trim();
        if (!trimmedName) {
            toast.error('Contact name is required.');
            return;
        }

        manualSavingRef.current = true;
        setIsSaving(true);
        triggerHaptic([40, 80]);

        try {
            const userId = auth.currentUser?.uid;
            if (!userId) throw new Error('Sign in to save this contact.');
            const fields = manualContactRecord({ name, phone, email, organization, notes, role }).fields;
            const photoAsset = await uploadContactPhoto(userId);
            const assets = photoAsset ? [photoAsset] : [];
            await EncounterService.saveManualContact(fields, assets, userId);

            triggerHaptic([50, 100, 50]);
            toast.success(`Saved contact: ${trimmedName}`);
            handleClose();
            onSaved?.();
        } catch (error) {
            triggerHaptic([100, 150]);
            toast.error(error instanceof Error ? error.message : 'Failed to save contact.');
        } finally {
            manualSavingRef.current = false;
            setIsSaving(false);
        }
    };

    if (!isOpen) return null;

    const formatTimer = (sec: number) => {
        const m = Math.floor(sec / 60);
        const s = sec % 60;
        return `${m}:${s < 10 ? '0' : ''}${s}`;
    };

    return (
        <AnimatePresence>
            <div
                className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/85 backdrop-blur-md"
                onPointerDown={(e) => {
                    if ((e.target as HTMLElement).tagName !== 'INPUT' && (e.target as HTMLElement).tagName !== 'TEXTAREA') {
                        (document.activeElement as HTMLElement)?.blur();
                    }
                }}
            >
                <motion.div
                    initial={{ y: '100%', opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    exit={{ y: '100%', opacity: 0 }}
                    transition={{ type: 'spring', damping: 26, stiffness: 280 }}
                    className="w-full max-w-md bg-[#16120e] border border-white/10 rounded-t-[32px] sm:rounded-[32px] shadow-2xl overflow-hidden flex flex-col max-h-[92dvh]"
                    style={{ paddingBottom: 'calc(1rem + env(safe-area-inset-bottom, 0px))' }}
                >
                    {/* Header */}
                    <div className="flex items-center justify-between px-6 pt-5 pb-3 border-b border-white/5">
                        <div className="flex items-center gap-2.5">
                            <div className="w-8 h-8 rounded-xl bg-[#00ff66]/10 border border-[#00ff66]/20 flex items-center justify-center text-[#00ff66]">
                                {mode === 'voice' ? <Mic className="w-4 h-4" /> : <User className="w-4 h-4" />}
                            </div>
                            <div>
                                <h3 className="text-base font-bold text-white font-display">
                                    {mode === 'voice' ? 'Voice Contact' : 'Manual Contact'}
                                </h3>
                                <p className="text-[10px] text-stone-400 font-mono">
                                    {mode === 'voice' ? 'AI parses voice into contacts' : 'Direct manual entry'}
                                </p>
                            </div>
                        </div>

                        {/* Mode Switch & Close */}
                        <div className="flex items-center gap-2">
                            <div className="flex items-center p-0.5 bg-white/5 border border-white/10 rounded-xl">
                                <button
                                    type="button"
                                    disabled={isSaving}
                                    onClick={() => {
                                        triggerHaptic(20);
                                        (document.activeElement as HTMLElement)?.blur();
                                        setMode('voice');
                                    }}
                                    className={`px-2 py-1 rounded-lg text-[10px] font-mono font-medium transition-all ${
                                        mode === 'voice' ? 'bg-[#00ff66] text-[#061806] font-bold' : 'text-stone-400 hover:text-white'
                                    }`}
                                >
                                    Voice
                                </button>
                                <button
                                    type="button"
                                    disabled={isSaving}
                                    onClick={() => {
                                        triggerHaptic(20);
                                        switchToManual();
                                    }}
                                    className={`px-2 py-1 rounded-lg text-[10px] font-mono font-medium transition-all ${
                                        mode === 'manual' ? 'bg-[#00ff66] text-[#061806] font-bold' : 'text-stone-400 hover:text-white'
                                    }`}
                                >
                                    Manual
                                </button>
                            </div>

                            <button
                                type="button"
                                onClick={handleClose}
                                className="w-8 h-8 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-stone-400 hover:text-white transition-colors cursor-pointer"
                            >
                                <X className="w-4 h-4" />
                            </button>
                        </div>
                    </div>

                    {/* Mode Body */}
                    {mode === 'voice' ? (
                        /* VOICE-FIRST INTAKE (Zero keyboard pop-up) */
                        <div className="p-6 flex flex-col items-center justify-center space-y-5 overflow-y-auto custom-scrollbar">
                            {/* Central Voice Recording Hub */}
                            <div className="flex flex-col items-center justify-center w-full py-2">
                                <div className="relative flex items-center justify-center mb-4">
                                    {/* Animated Ring when Recording */}
                                    {isRecording && (
                                        <motion.div
                                            className="absolute -inset-4 rounded-full border-2 border-red-500/40"
                                            animate={{ scale: [1, 1.25, 1], opacity: [0.6, 0.2, 0.6] }}
                                            transition={{ repeat: Infinity, duration: 1.5, ease: 'easeInOut' }}
                                        />
                                    )}

                                    <button
                                        type="button"
                                        onClick={isRecording ? stopRecording : startRecording}
                                        disabled={isSaving}
                                        className={`w-28 h-28 rounded-full flex flex-col items-center justify-center shadow-xl transition-all active:scale-95 cursor-pointer z-10 ${
                                            isRecording
                                                ? 'bg-red-500 text-white shadow-red-500/30'
                                                : capturedAudioBlob
                                                    ? 'bg-[#1c1815] border-2 border-[#00ff66]/40 text-[#00ff66] hover:border-[#00ff66]'
                                                    : 'bg-[#00ff66] text-[#061806] shadow-[#00ff66]/25 hover:bg-[#36D96F]'
                                        }`}
                                    >
                                        <Mic className={`w-9 h-9 ${isRecording ? 'animate-pulse' : ''}`} />
                                        <span className="text-[10px] font-bold tracking-wider uppercase font-mono mt-1">
                                            {isRecording ? formatTimer(recordingDuration) : capturedAudioBlob ? 'Re-record' : 'Tap to Speak'}
                                        </span>
                                    </button>
                                </div>

                                {/* Guidance instruction */}
                                <div className="text-center space-y-1 max-w-xs">
                                    <h4 className="text-sm font-bold text-stone-200 font-display">
                                        {isRecording
                                            ? 'Listening...'
                                            : capturedAudioBlob
                                                ? 'Voice Contact Captured'
                                                : 'Speak Contact Information'}
                                    </h4>
                                    <p className="text-xs text-stone-400 font-sans leading-relaxed">
                                        {isRecording
                                            ? 'Say their name, phone, email, organization, and role...'
                                            : capturedAudioBlob
                                                ? 'Review your recording or snap a photo before AI extraction.'
                                                : 'Say: "Alex Morgan, booking manager at Live Nation, 313-555-0199, alex@livenation.com"'}
                                    </p>
                                </div>

                                {/* Active Recording Waveform Visualizer */}
                                {isRecording && (
                                    <div className="flex items-center justify-center gap-1.5 h-8 mt-2">
                                        {[0.4, 0.8, 0.6, 1, 0.7, 0.9, 0.5, 0.85, 0.65, 0.45, 0.75, 0.35, 0.8, 0.6, 0.95, 0.5, 0.7].map((h, idx) => (
                                            <motion.div
                                                key={idx}
                                                animate={{
                                                    scaleY: [h * 0.3, h * 1.3, h * 0.4],
                                                    opacity: [0.6, 1, 0.6],
                                                }}
                                                transition={{
                                                    repeat: Infinity,
                                                    duration: 0.6 + (idx % 4) * 0.15,
                                                    ease: 'easeInOut',
                                                    delay: idx * 0.04,
                                                }}
                                                className="w-1 rounded-full bg-gradient-to-t from-red-500 via-[#00ff66] to-[#12C6D4] h-7 origin-center"
                                            />
                                        ))}
                                    </div>
                                )}
                            </div>

                            {/* Audio Playback pill when recorded */}
                            {capturedAudioBlob && audioUrl && !isRecording && (
                                <div className="w-full flex items-center justify-between p-3 rounded-2xl bg-white/[0.04] border border-white/10">
                                    <div className="flex items-center gap-2.5">
                                        <button
                                            type="button"
                                            onClick={togglePlayAudio}
                                            className="w-9 h-9 rounded-xl bg-[#00ff66] text-[#061806] flex items-center justify-center cursor-pointer hover:bg-[#36D96F] transition-colors"
                                        >
                                            {isPlayingAudio ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 ml-0.5" />}
                                        </button>
                                        <div>
                                            <p className="text-xs font-semibold text-stone-200">Audio Recorded</p>
                                            <p className="text-[10px] text-stone-400 font-mono">Ready for AI parsing</p>
                                        </div>
                                    </div>

                                    <button
                                        type="button"
                                        onClick={startRecording}
                                        className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-white/5 border border-white/10 text-stone-300 text-xs hover:text-white"
                                    >
                                        <RotateCcw className="w-3 h-3" />
                                        <span>Redo</span>
                                    </button>
                                </div>
                            )}

                            {/* Optional Photo / Avatar / Card Snap */}
                            <div className="w-full flex flex-col gap-2 p-3 rounded-2xl bg-white/[0.03] border border-white/10">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                        {(generatedAvatarUrl || photoPreviewUrl) ? (
                                            <div className="relative">
                                                <img
                                                    src={generatedAvatarUrl || photoPreviewUrl!}
                                                    alt="Contact Avatar / Card"
                                                    className={`w-12 h-12 rounded-xl object-cover border ${generatedAvatarUrl ? 'border-[#00ff66] ring-2 ring-[#00ff66]/30' : 'border-white/20'}`}
                                                />
                                                <button
                                                    type="button"
                                                    onClick={removePhoto}
                                                    className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-red-600 text-white flex items-center justify-center text-xs shadow-md"
                                                >
                                                    <X className="w-3 h-3" />
                                                </button>
                                            </div>
                                        ) : (
                                            <div className="w-12 h-12 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-stone-400">
                                                <Camera className="w-5 h-5" />
                                            </div>
                                        )}
                                        <div>
                                            <p className="text-xs font-semibold text-stone-200">
                                                {generatedAvatarUrl ? 'AI Avatar Ready' : 'Photo / Portrait'}
                                            </p>
                                            <p className="text-[10px] text-stone-400">
                                                {generatedAvatarUrl ? 'Generated from captured portrait' : 'Snap headshot or card'}
                                            </p>
                                        </div>
                                    </div>

                                    <input
                                        type="file"
                                        accept="image/*"
                                        capture="environment"
                                        ref={fileInputRef}
                                        onChange={handlePhotoSelect}
                                        className="hidden"
                                    />

                                    <button
                                        type="button"
                                        onClick={() => fileInputRef.current?.click()}
                                        className="px-3 py-1.5 rounded-xl bg-white/5 border border-white/15 text-xs font-semibold text-stone-200 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
                                    >
                                        {cardPhoto ? 'Change' : 'Snap Photo'}
                                    </button>
                                </div>

                                {/* Avatar Generation Action Button */}
                                {photoPreviewUrl && !generatedAvatarUrl && (
                                    <button
                                        type="button"
                                        onClick={handleGenerateAvatar}
                                        disabled={isGeneratingAvatar}
                                        className="w-full py-2 px-3 rounded-xl bg-gradient-to-r from-purple-500/20 to-emerald-500/20 border border-purple-500/30 text-purple-200 hover:text-white hover:border-purple-400/50 flex items-center justify-center gap-1.5 text-xs font-semibold transition-all cursor-pointer disabled:opacity-50"
                                    >
                                        {isGeneratingAvatar ? (
                                            <>
                                                <Loader2 className="w-3.5 h-3.5 animate-spin text-purple-400" />
                                                <span>Crafting AI Avatar…</span>
                                            </>
                                        ) : (
                                            <>
                                                <Sparkles className="w-3.5 h-3.5 text-purple-400" />
                                                <span>Generate AI Avatar from Photo</span>
                                            </>
                                        )}
                                    </button>
                                )}
                            </div>

                            {/* Save with AI button */}
                            <button
                                type="button"
                                onClick={handleVoiceSubmit}
                                disabled={isSaving || !capturedAudioBlob || isRecording}
                                className="w-full h-13 rounded-2xl bg-[#00ff66] text-[#061806] font-bold text-sm flex items-center justify-center gap-2 shadow-lg shadow-[#00ff66]/20 hover:bg-[#36D96F] active:scale-[0.98] transition-all disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer font-display"
                            >
                                {isSaving ? (
                                    <>
                                        <Loader2 className="w-4 h-4 animate-spin" />
                                        <span>Extracting & Saving with AI...</span>
                                    </>
                                ) : (
                                    <>
                                        <Sparkles className="w-4 h-4" />
                                        <span>Save & Extract with AI</span>
                                    </>
                                )}
                            </button>

                            <button
                                type="button"
                                onClick={switchToManual}
                                className="text-xs text-stone-400 hover:text-stone-300 font-sans cursor-pointer underline underline-offset-4"
                            >
                                In a loud venue? Enter details manually
                            </button>
                        </div>
                    ) : (
                        /* MANUAL FORM FALLBACK */
                        <form onSubmit={handleManualSubmit} className="p-5 overflow-y-auto space-y-4 custom-scrollbar">
                            <fieldset disabled={isSaving} className="min-w-0 space-y-4">
                            {/* Name */}
                            <div>
                                <label className="block text-[10px] font-bold uppercase tracking-wider text-stone-400 font-mono mb-1.5">
                                    Name *
                                </label>
                                <div className="relative">
                                    <User className="w-4 h-4 absolute left-3.5 top-3.5 text-stone-500" />
                                    <input
                                        type="text"
                                        required
                                        value={name}
                                        onChange={(e) => setName(e.target.value)}
                                        placeholder="Jane Doe / DJ Shadow"
                                        className="w-full h-11 pl-10 pr-3.5 rounded-xl bg-white/[0.04] border border-white/10 text-sm text-stone-100 placeholder:text-stone-600 focus:outline-none focus:border-[#00ff66]/50 focus:bg-white/[0.07] transition-all font-sans"
                                    />
                                </div>
                            </div>

                            {/* Phone & Email */}
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-[10px] font-bold uppercase tracking-wider text-stone-400 font-mono mb-1.5">
                                        Phone
                                    </label>
                                    <div className="relative">
                                        <Phone className="w-4 h-4 absolute left-3.5 top-3.5 text-stone-500" />
                                        <input
                                            type="tel"
                                            value={phone}
                                            onChange={(e) => setPhone(e.target.value)}
                                            placeholder="555-0199"
                                            className="w-full h-11 pl-10 pr-3 rounded-xl bg-white/[0.04] border border-white/10 text-sm text-stone-100 placeholder:text-stone-600 focus:outline-none focus:border-[#00ff66]/50 transition-all font-sans"
                                        />
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-[10px] font-bold uppercase tracking-wider text-stone-400 font-mono mb-1.5">
                                        Email
                                    </label>
                                    <div className="relative">
                                        <Mail className="w-4 h-4 absolute left-3.5 top-3.5 text-stone-500" />
                                        <input
                                            type="email"
                                            value={email}
                                            onChange={(e) => setEmail(e.target.value)}
                                            placeholder="jane@mgmt.com"
                                            className="w-full h-11 pl-10 pr-3 rounded-xl bg-white/[0.04] border border-white/10 text-sm text-stone-100 placeholder:text-stone-600 focus:outline-none focus:border-[#00ff66]/50 transition-all font-sans"
                                        />
                                    </div>
                                </div>
                            </div>

                            {/* Organization & Role */}
                            <div className="space-y-2">
                                <div>
                                    <label className="block text-[10px] font-bold uppercase tracking-wider text-stone-400 font-mono mb-1.5">
                                        Company / Label / Handle
                                    </label>
                                    <div className="relative">
                                        <Building className="w-4 h-4 absolute left-3.5 top-3.5 text-stone-500" />
                                        <input
                                            type="text"
                                            value={organization}
                                            onChange={(e) => setOrganization(e.target.value)}
                                            placeholder="@instagram or Atlantic Records"
                                            className="w-full h-11 pl-10 pr-3.5 rounded-xl bg-white/[0.04] border border-white/10 text-sm text-stone-100 placeholder:text-stone-600 focus:outline-none focus:border-[#00ff66]/50 transition-all font-sans"
                                        />
                                    </div>
                                </div>

                                {/* Role Chips */}
                                <div className="flex flex-wrap gap-1.5 pt-1">
                                    {ROLES.map((r) => (
                                        <button
                                            type="button"
                                            key={r.id}
                                            onClick={() => {
                                                triggerHaptic(20);
                                                setRole(r.id);
                                            }}
                                            className={`px-2.5 py-1 rounded-lg text-[10px] font-mono font-medium transition-all ${
                                                role === r.id
                                                    ? 'bg-[#00ff66] text-[#061806] font-bold shadow-xs'
                                                    : 'bg-white/5 border border-white/10 text-stone-400 hover:text-white'
                                            }`}
                                        >
                                            {r.label}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Quick Notes */}
                            <div>
                                <label className="block text-[10px] font-bold uppercase tracking-wider text-stone-400 font-mono mb-1.5">
                                    Quick Note
                                </label>
                                <div className="relative">
                                    <FileText className="w-4 h-4 absolute left-3.5 top-3 text-stone-500" />
                                    <textarea
                                        rows={2}
                                        value={notes}
                                        onChange={(e) => setNotes(e.target.value)}
                                        placeholder="Met at show, wants unreleased demo..."
                                        className="w-full pl-10 pr-3.5 py-2.5 rounded-xl bg-white/[0.04] border border-white/10 text-sm text-stone-100 placeholder:text-stone-600 focus:outline-none focus:border-[#00ff66]/50 transition-all font-sans resize-none"
                                    />
                                </div>
                            </div>

                            {/* Submit Button */}
                            <button
                                type="submit"
                                disabled={isSaving || !name.trim()}
                                className="w-full h-12 rounded-xl bg-[#00ff66] text-[#061806] font-bold text-sm flex items-center justify-center gap-2 shadow-lg shadow-[#00ff66]/15 hover:bg-[#36D96F] active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer font-display"
                            >
                                {isSaving ? (
                                    <>
                                        <Loader2 className="w-4 h-4 animate-spin" />
                                        <span>Saving Contact...</span>
                                    </>
                                ) : (
                                    <>
                                        <Check className="w-4 h-4" />
                                        <span>Save Contact</span>
                                    </>
                                )}
                            </button>
                            </fieldset>
                        </form>
                    )}
                </motion.div>
            </div>
        </AnimatePresence>
    );
}
