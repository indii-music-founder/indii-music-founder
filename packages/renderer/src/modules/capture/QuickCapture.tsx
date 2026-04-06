import React, { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Save, Loader2 } from 'lucide-react';
import { useMobile } from '@/hooks/useMobile';
import { useVoice } from '@/core/context/VoiceContext';
import { useToast } from '@/core/context/ToastContext';
import { useStore } from '@/core/store';
import { useShallow } from 'zustand/react/shallow';
import type { StoreState } from '@/core/store';
import { FieldContactService } from '@/services/contacts/FieldContactService';
import type { FieldContactRole, CaptureLocation } from '@/types/contacts';
import { logger } from '@/utils/logger';
import { ContactFormFields } from './components/ContactFormFields';

// ============================================================================
// QuickCapture — Fast contact capture with automatic metadata
// ============================================================================
// Bottom sheet that slides up from the tab bar. Only name is required.
// Auto-populates: GPS location, timestamp, event context.
//
// Architecture:
// - QuickCapture (this file) → Bottom sheet orchestrator + save logic
//   - ContactFormFields      → Scrollable form body (name, phone, email,
//                              Instagram, role pills, photo+notes)

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

    const startVoiceDictation = (target: 'name' | 'notes') => {
        setVoiceTarget(target);
        if (!isListening) {
            toggleListening();
        }
    };

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

    const handleSave = useCallback(async () => {
        if (!name.trim() || !userId) return;

        setIsSaving(true);
        try {
            let photoUrl: string | undefined;
            if (photoFile) {
                try {
                    const { storage } = await import('@/services/firebase');
                    const { ref, uploadBytes, getDownloadURL } = await import('firebase/storage');
                    const ext = photoFile.name.split('.').pop() || 'jpg';
                    const storagePath = `users/${userId}/contacts/${crypto.randomUUID()}.${ext}`;
                    const snapshot = await uploadBytes(ref(storage, storagePath), photoFile);
                    photoUrl = await getDownloadURL(snapshot.ref);
                } catch (uploadErr: unknown) {
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
        } catch (error: unknown) {
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

                        {/* Form Fields (extracted component) */}
                        <ContactFormFields
                            name={name}
                            phone={phone}
                            email={email}
                            instagram={instagram}
                            role={role}
                            notes={notes}
                            photoPreview={photoPreview}
                            contextString={contextString}
                            isListening={isListening}
                            voiceTarget={voiceTarget}
                            nameInputRef={nameInputRef}
                            fileInputRef={fileInputRef}
                            onNameChange={setName}
                            onPhoneChange={setPhone}
                            onEmailChange={setEmail}
                            onInstagramChange={setInstagram}
                            onRoleChange={setRole}
                            onNotesChange={setNotes}
                            onPhotoCapture={handlePhotoCapture}
                            onVoiceDictation={startVoiceDictation}
                        />

                        {/* ── Save button ── */}
                        <div className="px-5 pb-4">
                            <button
                                onClick={handleSave}
                                disabled={!name.trim() || isSaving}
                                className="w-full py-4 bg-gradient-to-r from-indigo-500 to-purple-600 text-white rounded-2xl font-bold text-sm shadow-lg shadow-indigo-500/20 active:scale-[0.97] transition-all disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
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
