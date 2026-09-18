import React, { useState, useEffect } from 'react';
import { Play, Pause, UserPlus, Phone, Mail, MapPin, CheckCircle, Clock, AlertTriangle, FileText, ChevronDown, ChevronUp } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import type { FieldEncounter } from '@/types/encounter';
import type { FieldContact } from '@/types/contacts';
import { EncounterService } from '@/services/encounters/EncounterService';
import { exportContactToIPhone } from '@/utils/vcard';
import { useToast } from '@/core/context/ToastContext';
import { triggerHaptic } from '../haptics';
import { Timestamp } from 'firebase/firestore';

export default function EncounterFeedView() {
    const [encounters, setEncounters] = useState<FieldEncounter[]>([]);
    const [playingAudioId, setPlayingAudioId] = useState<string | null>(null);
    const [audioElement, setAudioElement] = useState<HTMLAudioElement | null>(null);
    const [expandedId, setExpandedId] = useState<string | null>(null);
    const toast = useToast();

    useEffect(() => {
        const unsub = EncounterService.subscribeRecentEncounters((items) => {
            setEncounters(items);
        });
        return () => unsub();
    }, []);

    const togglePlayAudio = (assetId: string, audioUrl: string) => {
        triggerHaptic(50);
        if (playingAudioId === assetId) {
            audioElement?.pause();
            setPlayingAudioId(null);
        } else {
            if (audioElement) {
                audioElement.pause();
            }
            const nextAudio = new Audio(audioUrl);
            nextAudio.onended = () => setPlayingAudioId(null);
            nextAudio.onerror = () => {
                toast.error('Unable to play audio memo.');
                setPlayingAudioId(null);
            };
            nextAudio.play();
            setAudioElement(nextAudio);
            setPlayingAudioId(assetId);
        }
    };

    const handleSaveToIPhone = async (encounter: FieldEncounter) => {
        if (!encounter.extractedContact?.name) return;
        triggerHaptic([50, 100]);

        const contact: FieldContact = {
            id: encounter.contactId || encounter.id,
            name: encounter.extractedContact.name,
            phone: encounter.extractedContact.phone,
            email: encounter.extractedContact.email,
            organization: encounter.extractedContact.organization,
            role: (encounter.extractedContact.role as any) || 'other',
            notes: encounter.extractedContact.notes || encounter.summary,
            photoUrl: encounter.assets.find(a => a.type === 'photo')?.downloadUrl,
            audioMemoUrl: encounter.assets.find(a => a.type === 'audio')?.downloadUrl,
            encounterId: encounter.id,
            capturedContext: encounter.location?.venueName || 'Mobile Remote Field Capture',
            capturedAt: Timestamp.now(),
            source: 'encounter_ai',
        };

        try {
            const success = await exportContactToIPhone(contact);
            if (success) {
                toast.success('Contact opened for iPhone Contacts!');
            }
        } catch {
            toast.error('Failed to export contact to iPhone.');
        }
    };

    if (encounters.length === 0) {
        return (
            <div className="w-full flex flex-col space-y-4 px-3 pb-24">
                <div className="flex items-center justify-between px-1">
                    <span className="text-xs uppercase tracking-widest font-mono text-stone-400">Recent Encounters</span>
                    <span className="text-[10px] bg-emerald-500/10 text-emerald-400 px-2 py-0.5 rounded-full font-mono">Live Synced</span>
                </div>
                <div className="flex flex-col items-center justify-center p-8 text-center text-stone-400 space-y-3 bg-[#1c1815] border border-white/10 rounded-2xl">
                    <Clock className="w-8 h-8 text-stone-600 animate-pulse" />
                    <p className="text-sm font-medium text-stone-300">No encounters captured yet.</p>
                    <p className="text-xs text-stone-500">Record a voice note, snap a photo, or shoot video in Quick Capture to start.</p>
                </div>
            </div>
        );
    }

    return (
        <div className="w-full flex flex-col space-y-4 px-3 pb-24">
            <div className="flex items-center justify-between px-1">
                <span className="text-xs uppercase tracking-widest font-mono text-stone-400">Recent Encounters</span>
                <span className="text-[10px] bg-emerald-500/10 text-emerald-400 px-2 py-0.5 rounded-full font-mono">Live Synced</span>
            </div>

            {encounters.map((enc) => {
                const photoAsset = enc.assets.find((a) => a.type === 'photo');
                const videoAsset = enc.assets.find((a) => a.type === 'video');
                const audioAsset = enc.assets.find((a) => a.type === 'audio');
                const isExpanded = expandedId === enc.id;

                return (
                    <div
                        key={enc.id}
                        className="bg-[#1c1815] border border-white/10 rounded-2xl overflow-hidden shadow-lg transition-all"
                    >
                        {/* Header Banner */}
                        <div className="p-4 flex items-start justify-between gap-3">
                            <div className="flex items-center gap-3">
                                {photoAsset?.downloadUrl ? (
                                    <img
                                        src={photoAsset.downloadUrl}
                                        alt="Contact/Moment"
                                        className="w-14 h-14 rounded-xl object-cover border border-white/10 shadow-sm"
                                    />
                                ) : (
                                    <div className="w-14 h-14 rounded-xl bg-stone-800 border border-white/10 flex items-center justify-center text-stone-400">
                                        <FileText className="w-6 h-6" />
                                    </div>
                                )}
                                <div>
                                    <h4 className="text-sm font-semibold text-stone-100 leading-tight">
                                        {enc.extractedContact?.name || enc.title || 'Field Interaction'}
                                    </h4>
                                    {enc.extractedContact?.organization && (
                                        <p className="text-xs text-emerald-400 font-medium">
                                            {enc.extractedContact.organization} {enc.extractedContact.role ? `• ${enc.extractedContact.role}` : ''}
                                        </p>
                                    )}
                                    <p className="text-[11px] text-stone-400 flex items-center gap-1 mt-0.5">
                                        <Clock className="w-3 h-3" />
                                        {new Date(enc.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                        {enc.location?.venueName && ` @ ${enc.location.venueName}`}
                                    </p>
                                </div>
                            </div>

                            {/* Status Badge */}
                            <div>
                                {enc.status === 'completed' && (
                                    <span className="inline-flex items-center gap-1 text-[10px] text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full font-mono">
                                        <CheckCircle className="w-3 h-3" /> Processed
                                    </span>
                                )}
                                {enc.status === 'analyzing' && (
                                    <span className="inline-flex items-center gap-1 text-[10px] text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-full font-mono animate-pulse">
                                        <Clock className="w-3 h-3" /> Analyzing
                                    </span>
                                )}
                                {enc.status === 'pending' && (
                                    <span className="inline-flex items-center gap-1 text-[10px] text-blue-400 bg-blue-500/10 px-2 py-0.5 rounded-full font-mono">
                                        Queued
                                    </span>
                                )}
                            </div>
                        </div>

                        {/* Summary & Transcript */}
                        <div className="px-4 pb-3 text-xs text-stone-300">
                            {enc.summary && <p className="mb-2 italic text-stone-400">"{enc.summary}"</p>}

                            {/* Audio Player Row */}
                            {audioAsset?.downloadUrl && (
                                <div className="mt-2 flex items-center justify-between bg-black/40 border border-white/5 rounded-xl p-2.5">
                                    <div className="flex items-center gap-2">
                                        <button
                                            onClick={() => togglePlayAudio(audioAsset.id, audioAsset.downloadUrl)}
                                            className="w-8 h-8 rounded-full bg-emerald-500 text-black flex items-center justify-center shadow-md active:scale-95 transition-transform"
                                        >
                                            {playingAudioId === audioAsset.id ? <Pause className="w-4 h-4 fill-current" /> : <Play className="w-4 h-4 fill-current ml-0.5" />}
                                        </button>
                                        <span className="text-xs font-mono text-stone-300">Voice Note</span>
                                    </div>
                                    {enc.audioTranscript && (
                                        <button
                                            onClick={() => setExpandedId(isExpanded ? null : enc.id)}
                                            className="text-[11px] text-stone-400 flex items-center gap-1 underline"
                                        >
                                            {isExpanded ? 'Hide transcript' : 'Read transcript'}
                                            {isExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                                        </button>
                                    )}
                                </div>
                            )}

                            {/* Transcript dropdown */}
                            <AnimatePresence>
                                {isExpanded && enc.audioTranscript && (
                                    <motion.div
                                        initial={{ height: 0, opacity: 0 }}
                                        animate={{ height: 'auto', opacity: 1 }}
                                        exit={{ height: 0, opacity: 0 }}
                                        className="mt-2 bg-stone-900/90 border border-white/5 rounded-xl p-3 text-[11px] text-stone-300 font-sans leading-relaxed"
                                    >
                                        {enc.audioTranscript}
                                    </motion.div>
                                )}
                            </AnimatePresence>

                            {/* Video Stream Preview */}
                            {videoAsset?.downloadUrl && (
                                <div className="mt-3 rounded-xl overflow-hidden border border-white/10 bg-black">
                                    <video
                                        src={videoAsset.downloadUrl}
                                        controls
                                        playsInline
                                        preload="metadata"
                                        className="w-full max-h-48 object-cover"
                                    />
                                </div>
                            )}
                        </div>

                        {/* Action Bar (Contacts + Notes Bridge) */}
                        <div className="border-t border-white/5 bg-white/[0.02] px-4 py-2.5 flex items-center justify-between gap-2">
                            {enc.extractedContact?.phone ? (
                                <a
                                    href={`tel:${enc.extractedContact.phone}`}
                                    className="flex items-center gap-1.5 text-xs text-stone-300 hover:text-white bg-white/5 px-2.5 py-1.5 rounded-lg active:scale-95 transition-transform"
                                >
                                    <Phone className="w-3.5 h-3.5 text-emerald-400" />
                                    {enc.extractedContact.phone}
                                </a>
                            ) : (
                                <span className="text-[11px] text-stone-500 font-mono">Saved to Notes</span>
                            )}

                            {enc.extractedContact?.name && (
                                <button
                                    onClick={() => handleSaveToIPhone(enc)}
                                    className="flex items-center gap-1.5 text-xs font-semibold text-black bg-emerald-400 hover:bg-emerald-300 px-3 py-1.5 rounded-lg shadow active:scale-95 transition-transform"
                                >
                                    <UserPlus className="w-3.5 h-3.5" />
                                    Add to iPhone
                                </button>
                            )}
                        </div>
                    </div>
                );
            })}
        </div>
    );
}
