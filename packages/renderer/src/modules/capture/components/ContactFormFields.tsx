import React from 'react';
import { MapPin, Clock, User, Phone, Mail, Instagram, StickyNote, Camera, Mic, MicOff } from 'lucide-react';
import type { FieldContactRole } from '@/types/contacts';

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

interface ContactFormFieldsProps {
    name: string;
    phone: string;
    email: string;
    instagram: string;
    role: FieldContactRole;
    notes: string;
    photoPreview: string | null;
    contextString: string;
    isListening: boolean;
    voiceTarget: 'name' | 'notes' | null;
    nameInputRef: React.RefObject<HTMLInputElement>;
    fileInputRef: React.RefObject<HTMLInputElement>;
    onNameChange: (value: string) => void;
    onPhoneChange: (value: string) => void;
    onEmailChange: (value: string) => void;
    onInstagramChange: (value: string) => void;
    onRoleChange: (value: FieldContactRole) => void;
    onNotesChange: (value: string) => void;
    onPhotoCapture: (e: React.ChangeEvent<HTMLInputElement>) => void;
    onVoiceDictation: (target: 'name' | 'notes') => void;
}

/**
 * ContactFormFields — The scrollable body of the QuickCapture sheet.
 * Contains: context banner, name field with voice, contact info row,
 * Instagram, role pills, and photo + notes row.
 */
export function ContactFormFields({
    name,
    phone,
    email,
    instagram,
    role,
    notes,
    photoPreview,
    contextString,
    isListening,
    voiceTarget,
    nameInputRef,
    fileInputRef,
    onNameChange,
    onPhoneChange,
    onEmailChange,
    onInstagramChange,
    onRoleChange,
    onNotesChange,
    onPhotoCapture,
    onVoiceDictation,
}: ContactFormFieldsProps) {
    return (
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
                            onChange={(e) => onNameChange(e.target.value)}
                            placeholder="Who did you meet?"
                            aria-required="true"
                            className="w-full bg-white/5 border border-white/10 rounded-xl pl-10 pr-4 py-3.5 text-white placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 text-sm font-medium"
                        />
                    </div>
                    <button
                        onClick={() => onVoiceDictation('name')}
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
                        onChange={(e) => onPhoneChange(e.target.value)}
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
                        onChange={(e) => onEmailChange(e.target.value)}
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
                    onChange={(e) => onInstagramChange(e.target.value)}
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
                            onClick={() => onRoleChange(opt.value)}
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
                    onChange={onPhotoCapture}
                />

                {/* Notes */}
                <div className="flex-1 relative">
                    <StickyNote size={14} className="absolute left-3 top-3 text-slate-500" />
                    <textarea
                        id="qc-notes"
                        value={notes}
                        onChange={(e) => onNotesChange(e.target.value)}
                        placeholder="Quick notes..."
                        aria-label="Notes about this contact"
                        rows={2}
                        className="w-full bg-white/5 border border-white/10 rounded-xl pl-9 pr-3 py-2.5 text-white placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 text-sm resize-none"
                    />
                </div>
            </div>
        </div>
    );
}
