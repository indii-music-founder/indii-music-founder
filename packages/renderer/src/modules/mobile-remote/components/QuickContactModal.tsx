import React, { useState, useRef } from 'react';
import { User, Phone, Mail, Building, FileText, Camera, Check, X, Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { EncounterService } from '@/services/encounters/EncounterService';
import { useToast } from '@/core/context/ToastContext';
import { triggerHaptic } from '../haptics';
import type { FieldContactRole } from '@/types/contacts';
import { StorageService } from '@/services/StorageService';
import { auth } from '@/services/firebase';

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

export default function QuickContactModal({ isOpen, onClose, onSaved }: QuickContactModalProps) {
    const toast = useToast();
    const [name, setName] = useState('');
    const [phone, setPhone] = useState('');
    const [email, setEmail] = useState('');
    const [organization, setOrganization] = useState('');
    const [role, setRole] = useState<FieldContactRole>('other');
    const [notes, setNotes] = useState('');
    const [cardPhoto, setCardPhoto] = useState<File | null>(null);
    const [photoPreviewUrl, setPhotoPreviewUrl] = useState<string | null>(null);
    const [isSaving, setIsSaving] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handlePhotoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            const file = e.target.files[0];
            setCardPhoto(file);
            setPhotoPreviewUrl(URL.createObjectURL(file));
            triggerHaptic(30);
        }
    };

    const handleClose = () => {
        if (photoPreviewUrl) URL.revokeObjectURL(photoPreviewUrl);
        setName('');
        setPhone('');
        setEmail('');
        setOrganization('');
        setRole('other');
        setNotes('');
        setCardPhoto(null);
        setPhotoPreviewUrl(null);
        onClose();
    };

    const handleSubmit = async (e: React.FormEvent) => {
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

    return (
        <AnimatePresence>
            <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/80 backdrop-blur-md">
                <motion.div
                    initial={{ y: '100%', opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    exit={{ y: '100%', opacity: 0 }}
                    transition={{ type: 'spring', damping: 26, stiffness: 280 }}
                    className="w-full max-w-md bg-[#16120e] border border-white/10 rounded-t-[32px] sm:rounded-[32px] shadow-2xl overflow-hidden flex flex-col max-h-[90dvh]"
                    style={{ paddingBottom: 'calc(1rem + env(safe-area-inset-bottom, 0px))' }}
                >
                    {/* Header */}
                    <div className="flex items-center justify-between px-6 pt-5 pb-3 border-b border-white/5">
                        <div className="flex items-center gap-2.5">
                            <div className="w-8 h-8 rounded-xl bg-[#00ff66]/10 border border-[#00ff66]/20 flex items-center justify-center text-[#00ff66]">
                                <User className="w-4 h-4" />
                            </div>
                            <div>
                                <h3 className="text-base font-bold text-white font-display">Quick Contact</h3>
                                <p className="text-[10px] text-stone-400 font-mono">Syncs directly to desktop</p>
                            </div>
                        </div>
                        <button
                            type="button"
                            onClick={handleClose}
                            className="w-8 h-8 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-stone-400 hover:text-white transition-colors cursor-pointer"
                        >
                            <X className="w-4 h-4" />
                        </button>
                    </div>

                    {/* Scrollable Form Body */}
                    <form onSubmit={handleSubmit} className="p-5 overflow-y-auto space-y-4 custom-scrollbar">
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

                        {/* Card/Photo Snap */}
                        <div className="flex items-center justify-between p-3 rounded-xl bg-white/[0.02] border border-white/5">
                            <div className="flex items-center gap-3">
                                {photoPreviewUrl ? (
                                    <img src={photoPreviewUrl} alt="Card preview" className="w-10 h-10 rounded-lg object-cover border border-[#00ff66]/40" />
                                ) : (
                                    <div className="w-10 h-10 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center text-stone-500">
                                        <Camera className="w-5 h-5" />
                                    </div>
                                )}
                                <div>
                                    <p className="text-xs font-semibold text-stone-200">Business Card / Snap</p>
                                    <p className="text-[10px] text-stone-500">Attach photo or card</p>
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
                                className="px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-xs font-semibold text-stone-300 hover:text-white transition-colors"
                            >
                                {cardPhoto ? 'Change' : 'Snap Photo'}
                            </button>
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
                                    <span>Saving to Desktop...</span>
                                </>
                            ) : (
                                <>
                                    <Check className="w-4 h-4" />
                                    <span>Save Contact</span>
                                </>
                            )}
                        </button>
                    </form>
                </motion.div>
            </div>
        </AnimatePresence>
    );
}
