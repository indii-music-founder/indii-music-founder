import React, { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
    X,
    MapPin,
    Clock,
    Camera,
    Save,
    Loader2,
    Mic,
    MicOff,
    User,
    Phone,
    Mail,
    Instagram,
    StickyNote,
} from 'lucide-react';
import { useMobile } from '@/hooks/useMobile';
import { useVoice } from '@/core/context/VoiceContext';
import { useToast } from '@/core/context/ToastContext';
import { useStore } from '@/core/store';
import { useShallow } from 'zustand/react/shallow';
import type { StoreState } from '@/core/store';
import { FieldContactService } from '@/services/contacts/FieldContactService';
import { FieldContactRole, CaptureLocation } from '@/types/contacts';
import { logger } from '@/utils/logger';

// ============================================================================
// QuickCapture — Fast contact capture with automatic metadata
// ============================================================================
// Bottom sheet that slides up from the tab bar. Only name is required.
// Auto-populates: GPS location, timestamp, event context.

const ROLE_OPTIONS: { value: FieldContactRole; label: string; emoji: string }[] = [
    { value: 'musician', label: 'Musician', emoji: '🎸' },
    { value: 'promoter', label: 'Promoter', emoji: '📢' },
    { value: 'venue_staff', label: 'Venue', emoji: '🏛️' },
    { value: 'engineer', label: 'Engineer', emoji: '🎛️' },
    { value: 'manager', label: 'Manager', emoji: '💼' },
    { value: 'fan', label: 'Fan', emoji: '⭐' },
    { value: 'industry', label: 'Industry', emoji: '🏢' },
    { value: 'media', label: 'Media', emoji: '📰' },
    { value: 'other', label: 'Other', emoji: '👤' },
];

interface QuickCaptureProps {
    isOpen: boolean;
    onClose: () => void;
}

export const QuickCapture: React.FC<QuickCaptureProps> = ({ isOpen, onClose }) => {
    const { isAnyPhone } = useMobile();
    const { isListening, toggleListening, transcript } = useVoice();
    const toast = useToast();
    const userId = useStore(useShallow((s: StoreState) => s.userProfile?.uid));

    // Form state
    const [name, setName] = useState('');
    const [phone, setPhone] = useState('');
    const [email, setEmail] = useState('');
    const [instagram, setInstagram] = useState('');
    const [role, setRole] = useState<FieldContactRole>('other');
    const [notes, setNotes] = useState('');
    const [photoPreview, setPhotoPreview] = useState<string | null>(null);
    const [photoFile, setPhotoFile] = useState<File | null>(null);
    const [isSaving, setIsSaving] = useState(false);

    // Auto-metadata
    const [captureLocation, setCaptureLocation] = useState<CaptureLocation | null>(null);
    const [contextString, setContextString] = useState('');

    const nameInputRef = useRef<HTMLInputElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [voiceTarget, setVoiceTarget] = useState<'name' | 'notes' | null>(null);

    // Grab GPS when opened
    useEffect(() => {
        if (isOpen) {
            FieldContactService.getCurrentLocation().then((loc) => {
                setCaptureLocation(loc);
                setContextString(FieldContactService.buildContextString(loc));
            });
            // Focus the name input
            setTimeout(() => nameInputRef.current?.focus(), 300);
        }
    }, [isOpen]);

    // Voice-to-text: apply transcript to the target field
    useEffect(() => {
        if (transcript && !isListening && voiceTarget) {
            if (voiceTarget === 'name') {
                setName((prev) => (prev ? `${prev} ${transcript}` : transcript));
            } else if (voiceTarget === 'notes') {
                setNotes((prev) => (prev ? `${prev} ${transcript}` : transcript));
            }
            setVoiceTarget(null);
        }
    }, [transcript, isListening, voiceTarget]);

    // Handle voice dictation for a specific field
    const startVoiceDictation = (target: 'name' | 'notes') => {
        setVoiceTarget(target);
        if (!isListening) {
            toggleListening();
        }
    };

    // Photo capture — store File for upload + preview data URL for display
    const handlePhotoCapture = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            setPhotoFile(file);
            const reader = new FileReader();
            reader.onloadend = () => {
                setPhotoPreview(reader.result as string);
            };
            reader.readAsDataURL(file);
        }
    };

    // Save contact — uploads photo to Firebase Storage if one was captured
    const handleSave = useCallback(async () => {
        if (!name.trim() || !userId) return;

        setIsSaving(true);
        try {
            // Upload contact photo to Firebase Storage before saving
            let photoUrl: string | undefined;
            if (photoFile) {
                try {
                    const { storage } = await import('@/services/firebase');
                    const { ref, uploadBytes, getDownloadURL } = await import('firebase/storage');
                    const ext = photoFile.name.split('.').pop() || 'jpg';
                    const storagePath = `users/${userId}/contacts/${crypto.randomUUID()}.${ext}`;
                    const snapshot = await uploadBytes(ref(storage, storagePath), photoFile);
                    photoUrl = await getDownloadURL(snapshot.ref);
                } catch (uploadErr) {
                    logger.warn('[QuickCapture] Photo upload failed, saving without photo:', uploadErr);
                }
            }

            await FieldContactService.addFieldContact(userId, {
                name: name.trim(),
                phone: phone.trim() || undefined,
                email: email.trim() || undefined,
                instagram: instagram.trim() || undefined,
                role,
                notes: notes.trim() || undefined,
                capturedLocation: captureLocation || undefined,
                capturedContext: contextString || undefined,
                photoUrl,
                source: 'quick_capture',
            });

            toast.success(`Contact "${name}" captured`);

            // Reset form
            setName('');
            setPhone('');
            setEmail('');
            setInstagram('');
            setRole('other');
            setNotes('');
            setPhotoPreview(null);
            setPhotoFile(null);
            onClose();
        } catch (error) {
            logger.error('[QuickCapture] Failed to save contact:', error);
            toast.error('Failed to save contact');
        } finally {
            setIsSaving(false);
        }
    }, [name, phone, email, instagram, role, notes, captureLocation, contextString, userId, photoFile, toast, onClose]);

    // Don't render on non-phone viewports
    if (!isAnyPhone) return null;

    return (
        <AnimatePresence>
            {isOpen && (
                <>
                    {/* Backdrop */}
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[70]"
                        onClick={onClose}
                    />

                    {/* Bottom Sheet */}
                    <motion.div
                        initial={{ y: '100%' }}
                        animate={{ y: 0 }}
                        exit={{ y: '100%' }}
                        transition={{ type: 'spring', damping: 28, stiffness: 300 }}
                        className="fixed inset-x-0 bottom-0 z-[71] bg-[#0d1117] rounded-t-3xl border-t border-white/10 max-h-[92vh] flex flex-col"
                    >
                        {/* Handle */}
                        <div className="flex justify-center py-2">
                            <div className="w-10 h-1 rounded-full bg-white/20" />
                        </div>

                        {/* Header */}
                        <div className="flex items-center justify-between px-5 pb-3">
                            <div>
                                <h2 className="text-lg font-bold text-white">Quick Capture</h2>
                                <p className="text-[10px] text-slate-500 font-mono uppercase tracking-widest">
                                    New Contact
                                </p>
                            </div>
                            <button
                                onClick={onClose}
                                aria-label="Close quick capture"
                                className="p-2 rounded-full bg-white/5 text-slate-400 hover:text-white transition-colors"
                            >
                                <X size={18} />
                            </button>
                        </div>

                        {/* Scrollable form */}
                        <div className="flex-1 overflow-y-auto px-5 pb-safe-bottom custom-scrollbar">
                            {/* ── Auto-populated context banner ── */}
                            <div className="flex items-center gap-2 p-3 rounded-xl bg-indigo-500/10 border border-indigo-500/20 mb-4">
                                <MapPin size={14} className="text-indigo-400 flex-shrink-0" />
                                <span className="text-xs text-indigo-300 font-medium truncate">
                                    {contextString || 'Acquiring location...'}
                                </span>
                                <Clock size={12} className="text-indigo-400/60 flex-shrink-0 ml-auto" />
                            </div>

                            {/* ── Name (required) ── */}
                            <div className="mb-4">
                                <label htmlFor="qc-name" className="text-[10px] text-slate-500 font-bold uppercase tracking-[0.15em] block mb-1.5 ml-1">
                                    Name *
                                </label>
                                <div className="flex gap-2">
                                    <div className="flex-1 relative">
                                        <User size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" aria-hidden="true" />
                                        <input
                                            id="qc-name"
                                            ref={nameInputRef}
                                            type="text"
                                            value={name}
                                            onChange={(e) => setName(e.target.value)}
                                            placeholder="Who did you meet?"
                                            aria-required="true"
                                            className="w-full bg-white/5 border border-white/10 rounded-xl pl-10 pr-4 py-3.5 text-white placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 text-sm font-medium"
                                        />
                                    </div>
                                    <button
                                        onClick={() => startVoiceDictation('name')}
                                        aria-label={isListening && voiceTarget === 'name' ? 'Stop voice dictation for name' : 'Start voice dictation for name'}
                                        aria-pressed={isListening && voiceTarget === 'name'}
                                        className={`p-3 rounded-xl border transition-all flex-shrink-0 ${isListening && voiceTarget === 'name'
                                            ? 'bg-red-500/20 border-red-500/30 text-red-400 animate-pulse'
                                            : 'bg-white/5 border-white/10 text-slate-400'
                                            }`}
                                    >
                                        {isListening && voiceTarget === 'name'
                                            ? <MicOff size={18} />
                                            : <Mic size={18} />
                                        }
                                    </button>
                                </div>
                            </div>

                            {/* ── Contact info row ── */}
                            <div className="grid grid-cols-2 gap-3 mb-4">
                                <div className="relative">
                                    <Phone size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" aria-hidden="true" />
                                    <input
                                        id="qc-phone"
                                        type="tel"
                                        value={phone}
                                        onChange={(e) => setPhone(e.target.value)}
                                        placeholder="Phone"
                                        aria-label="Phone number"
                                        className="w-full bg-white/5 border border-white/10 rounded-xl pl-9 pr-3 py-3 text-white placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 text-sm"
                                    />
                                </div>
                                <div className="relative">
                                    <Mail size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" aria-hidden="true" />
                                    <input
                                        id="qc-email"
                                        type="email"
                                        value={email}
                                        onChange={(e) => setEmail(e.target.value)}
                                        placeholder="Email"
                                        aria-label="Email address"
                                        className="w-full bg-white/5 border border-white/10 rounded-xl pl-9 pr-3 py-3 text-white placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 text-sm"
                                    />
                                </div>
                            </div>

                            {/* ── Instagram ── */}
                            <div className="mb-4 relative">
                                <Instagram size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" aria-hidden="true" />
                                <input
                                    id="qc-instagram"
                                    type="text"
                                    value={instagram}
                                    onChange={(e) => setInstagram(e.target.value)}
                                    placeholder="@instagram"
                                    aria-label="Instagram handle"
                                    className="w-full bg-white/5 border border-white/10 rounded-xl pl-9 pr-3 py-3 text-white placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 text-sm"
                                />
                            </div>

                            {/* ── Role pills (horizontal scroll) ── */}
                            <div className="mb-4">
                                <p id="qc-role-label" className="text-[10px] text-slate-500 font-bold uppercase tracking-[0.15em] block mb-2 ml-1">
                                    Role
                                </p>
                                <div role="radiogroup" aria-labelledby="qc-role-label" className="flex gap-2 overflow-x-auto pb-2 -mx-1 px-1 custom-scrollbar">
                                    {ROLE_OPTIONS.map((opt) => (
                                        <button
                                            key={opt.value}
                                            role="radio"
                                            aria-checked={role === opt.value}
                                            onClick={() => setRole(opt.value)}
                                            className={`flex items-center gap-1.5 px-3 py-2 rounded-full text-xs font-semibold whitespace-nowrap border transition-all flex-shrink-0 ${role === opt.value
                                                ? 'bg-indigo-500/20 border-indigo-500/40 text-indigo-300'
                                                : 'bg-white/5 border-white/10 text-slate-400'
                                                }`}
                                        >
                                            <span>{opt.emoji}</span>
                                            <span>{opt.label}</span>
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* ── Photo + Notes row ── */}
                            <div className="flex gap-3 mb-4">
                                {/* Photo capture */}
                                <button
                                    onClick={() => fileInputRef.current?.click()}
                                    aria-label={photoPreview ? 'Change contact photo' : 'Add contact photo'}
                                    className="w-16 h-16 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center flex-shrink-0 overflow-hidden transition-all hover:border-indigo-500/30"
                                >
                                    {photoPreview ? (
                                        <img
                                            src={photoPreview}
                                            alt="Contact"
                                            className="w-full h-full object-cover"
                                        />
                                    ) : (
                                        <Camera size={20} className="text-slate-500" />
                                    )}
                                </button>
                                <input
                                    type="file"
                                    ref={fileInputRef}
                                    className="hidden"
                                    accept="image/*"
                                    capture="environment"
                                    onChange={handlePhotoCapture}
                                />

                                {/* Notes */}
                                <div className="flex-1 relative">
                                    <StickyNote size={14} className="absolute left-3 top-3 text-slate-500" />
                                    <textarea
                                        id="qc-notes"
                                        value={notes}
                                        onChange={(e) => setNotes(e.target.value)}
                                        placeholder="Quick notes..."
                                        aria-label="Notes about this contact"
                                        rows={2}
                                        className="w-full bg-white/5 border border-white/10 rounded-xl pl-9 pr-3 py-2.5 text-white placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 text-sm resize-none"
                                    />
                                </div>
                            </div>

                            {/* ── Save button ── */}
                            <button
                                onClick={handleSave}
                                disabled={!name.trim() || isSaving}
                                className="w-full py-4 bg-gradient-to-r from-indigo-500 to-purple-600 text-white rounded-2xl font-bold text-sm shadow-lg shadow-indigo-500/20 active:scale-[0.97] transition-all disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2 mb-4"
                            >
                                {isSaving ? (
                                    <>
                                        <Loader2 size={18} className="animate-spin" />
                                        Saving...
                                    </>
                                ) : (
                                    <>
                                        <Save size={18} />
                                        Capture Contact
                                    </>
                                )}
                            </button>
                        </div>
                    </motion.div>
                </>
            )}
        </AnimatePresence>
    );
};
