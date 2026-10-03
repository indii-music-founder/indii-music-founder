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
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Manual form state (fallback for loud environments)
    const [name, setName] = useState('');
    const [phone, setPhone] = useState('');
    const [email, setEmail] = useState('');
    const [organization, setOrganization] = useState('');
    const [role, setRole] = useState<FieldContactRole>('other');
    const [notes, setNotes] = useState('');

    const [isSaving, setIsSaving] = useState(false);

    // Cleanup URLs & streams on close/unmount
    const cleanupMedia = useCallback(() => {
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
        if (audioUrl) {
            URL.revokeObjectURL(audioUrl);
            setAudioUrl(null);
        }
        if (photoPreviewUrl) {
            URL.revokeObjectURL(photoPreviewUrl);
            setPhotoPreviewUrl(null);
        }
        setCapturedAudioBlob(null);
        setCardPhoto(null);
        setIsRecording(false);
        setRecordingDuration(0);
        setIsPlayingAudio(false);
    }, [audioUrl, photoPreviewUrl]);

    useEffect(() => {
        return () => {
            cleanupMedia();
        };
    }, [cleanupMedia]);

    const handleClose = () => {
        cleanupMedia();
        setName('');
        setPhone('');
        setEmail('');
        setOrganization('');
        setRole('other');
        setNotes('');
        setMode('voice');
        (document.activeElement as HTMLElement)?.blur();
        onClose();
    };

    // ── Voice Recording Controls ──────────────────────────────────────────────

    const startRecording = async () => {
        triggerHaptic(50);
        (document.activeElement as HTMLElement)?.blur();

        if (audioUrl) {
            URL.revokeObjectURL(audioUrl);
            setAudioUrl(null);
        }
        setCapturedAudioBlob(null);
        setIsPlayingAudio(false);

        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            streamRef.current = stream;

            const mimeType = pickSupportedAudioMimeType();
            const recorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);
            mediaRecorderRef.current = recorder;
            audioChunksRef.current = [];

            recorder.ondataavailable = (e) => {
                if (e.data && e.data.size > 0) {
                    audioChunksRef.current.push(e.data);
                }
            };

            recorder.onstop = () => {
                const effectiveMimeType = recorder.mimeType || mimeType || 'audio/webm';
                const audioBlob = new Blob(audioChunksRef.current, { type: effectiveMimeType });
                setCapturedAudioBlob(audioBlob);
                const nextUrl = URL.createObjectURL(audioBlob);
                setAudioUrl(nextUrl);

                if (streamRef.current) {
                    streamRef.current.getTracks().forEach((track) => track.stop());
                    streamRef.current = null;
                }
            };

            recorder.start(100);
            setIsRecording(true);
            setRecordingDuration(0);

            timerRef.current = window.setInterval(() => {
                setRecordingDuration((prev) => prev + 1);
            }, 1000);
        } catch (error) {
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
            if (photoPreviewUrl) URL.revokeObjectURL(photoPreviewUrl);
            setCardPhoto(file);
            setPhotoPreviewUrl(URL.createObjectURL(file));
            triggerHaptic(30);
        }
    };

    const removePhoto = () => {
        if (photoPreviewUrl) URL.revokeObjectURL(photoPreviewUrl);
        setCardPhoto(null);
        setPhotoPreviewUrl(null);
        triggerHaptic(20);
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

            // 2. Upload optional photo/avatar
            let photoDownloadUrl: string | undefined;
            let photoStoragePath: string | undefined;
            if (cardPhoto) {
                const photoExt = cardPhoto.name.split('.').pop() || 'jpg';
                const photoFilename = `contact_avatar_${Date.now()}.${photoExt}`;
                photoStoragePath = `users/${userId}/assets/captured_contacts/${photoFilename}`;
                photoDownloadUrl = await StorageService.uploadFile(cardPhoto, photoStoragePath);
            }

            // 3. Create Encounter in Firestore (triggers Gemini 3 Flash multimodal extraction pipeline)
            await EncounterService.createEncounter({
                assets: [
                    {
                        type: 'audio',
                        storagePath: audioPath,
                        downloadUrl: audioDownloadUrl,
                        mimeType: capturedAudioBlob.type || 'audio/webm',
                    },
                    ...(photoDownloadUrl && photoStoragePath ? [{
                        type: 'photo' as const,
                        storagePath: photoStoragePath,
                        downloadUrl: photoDownloadUrl,
                        mimeType: cardPhoto?.type || 'image/jpeg',
                    }] : []),
                ],
                clientContext: 'Contact Intake: Extract contact information (name, phone, email, organization, role, notes)',
            });

            // 4. Notify paired desktop relay if active
            try {
                await remoteRelayService.dispatchTask({
                    type: 'quick_contact',
                    payload: {
                        audioUrl: audioDownloadUrl,
                        imageUrl: photoDownloadUrl,
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
        const trimmedName = name.trim();
        if (!trimmedName) {
            toast.error('Contact name is required.');
            return;
        }

        setIsSaving(true);
        triggerHaptic([40, 80]);

        try {
            const userId = auth.currentUser?.uid;
            let photoUrl: string | undefined;

            if (cardPhoto && userId) {
                const filename = `contact_card_${Date.now()}.${cardPhoto.name.split('.').pop() || 'jpg'}`;
                const path = `users/${userId}/assets/captured_contacts/${filename}`;
                photoUrl = await StorageService.uploadFile(cardPhoto, path);
            }

            // Create encounter with pre-extracted contact details so it is immediately confirmed
            const encounterId = await EncounterService.createEncounter({
                assets: photoUrl ? [{
                    type: 'photo',
                    storagePath: `users/${userId}/assets/captured_contacts/`,
                    downloadUrl: photoUrl,
                    mimeType: cardPhoto?.type || 'image/jpeg',
                }] : [],
                clientContext: `Direct field contact: ${trimmedName}${organization ? ` (${organization})` : ''}`,
            });

            // Review & confirm contact in Firestore immediately
            await EncounterService.reviewContact(encounterId, {
                name: trimmedName,
                phone: phone.trim(),
                email: email.trim(),
                organization: organization.trim(),
                notes: notes.trim(),
                role,
            });

            triggerHaptic([50, 100, 50]);
            toast.success(`Saved contact: ${trimmedName}`);
            handleClose();
            onSaved?.();
        } catch (error) {
            triggerHaptic([100, 150]);
            toast.error(error instanceof Error ? error.message : 'Failed to save contact.');
        } finally {
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
                                    onClick={() => {
                                        triggerHaptic(20);
                                        setMode('manual');
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
                            <div className="w-full flex items-center justify-between p-3 rounded-2xl bg-white/[0.03] border border-white/10">
                                <div className="flex items-center gap-3">
                                    {photoPreviewUrl ? (
                                        <div className="relative">
                                            <img
                                                src={photoPreviewUrl}
                                                alt="Contact Avatar / Card"
                                                className="w-12 h-12 rounded-xl object-cover border border-[#00ff66]/50"
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
                                        <p className="text-xs font-semibold text-stone-200">Photo / Avatar / Card</p>
                                        <p className="text-[10px] text-stone-400">Optional headshot or business card</p>
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
                                    className="px-3.5 py-2 rounded-xl bg-white/5 border border-white/15 text-xs font-semibold text-stone-200 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
                                >
                                    {cardPhoto ? 'Change' : 'Snap Photo'}
                                </button>
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
                                onClick={() => setMode('manual')}
                                className="text-xs text-stone-400 hover:text-stone-300 font-sans cursor-pointer underline underline-offset-4"
                            >
                                In a loud venue? Enter details manually
                            </button>
                        </div>
                    ) : (
                        /* MANUAL FORM FALLBACK */
                        <form onSubmit={handleManualSubmit} className="p-5 overflow-y-auto space-y-4 custom-scrollbar">
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
                        </form>
                    )}
                </motion.div>
            </div>
        </AnimatePresence>
    );
}
