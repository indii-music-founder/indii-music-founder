import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, User, Mail, Globe, MessageCircle } from 'lucide-react';
import { Contact } from '../types';
import { PublicistService } from '@/services/publicist/PublicistService';
import { useToast } from '@/core/context/ToastContext';

interface ContactDetailsModalProps {
    isOpen: boolean;
    onClose: () => void;
    contact: Contact | null;
}

export const ContactDetailsModal: React.FC<ContactDetailsModalProps> = ({ isOpen, onClose, contact }) => {
    if (!contact) return null;

    const [relationship, setRelationship] = useState<Contact['relationshipStrength']>(contact.relationshipStrength);
    const [note, setNote] = useState(contact.notes || '');
    const [isSaving, setIsSaving] = useState(false);
    const toast = useToast();

    const handleRelationshipChange = async (newStrength: Contact['relationshipStrength']) => {
        setRelationship(newStrength);
        try {
            await PublicistService.updateContact(contact.id, { relationshipStrength: newStrength });
            toast.success(`Relationship updated to ${newStrength}`);
        } catch (error) {
            console.error(error);
            toast.error("Failed to update relationship");
            setRelationship(contact.relationshipStrength); // Revert on error
        }
    };

    const handleSaveNote = async () => {
        if (!note.trim()) return;
        setIsSaving(true);
        try {
            await PublicistService.updateContact(contact.id, {
                notes: note,
                lastInteraction: new Date().toISOString()
            });
            toast.success("Interaction logged");
        } catch (error) {
            console.error(error);
            toast.error("Failed to save note");
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <AnimatePresence>
            {isOpen && (
                <>
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 bg-black/80 backdrop-blur-md z-[60]"
                        onClick={onClose}
                    />
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95, x: 20 }}
                        animate={{ opacity: 1, scale: 1, x: 0 }}
                        exit={{ opacity: 0, scale: 0.95, x: 20 }}
                        className="fixed top-0 right-0 h-full w-full max-w-md bg-slate-950 border-l border-white/10 shadow-2xl z-[70] overflow-y-auto"
                    >
                        <div className="p-6 space-y-8">
                            {/* Header */}
                            <div className="flex justify-between items-start">
                                <button
                                    onClick={onClose}
                                    className="p-2 -ml-2 hover:bg-white/10 rounded-full text-slate-400 hover:text-white transition-colors"
                                >
                                    <X size={24} />
                                </button>
                                <div className={`px-3 py-1 rounded-full text-xs font-bold uppercase border ${contact.tier === 'Top' ? 'bg-sonic-yellow/10 border-sonic-yellow/20 text-sonic-yellow' : 'bg-slate-800 border-white/5 text-slate-400'}`}>
                                    {contact.tier} Tier
                                </div>
                            </div>

                            {/* Profile Info */}
                            <div className="flex flex-col items-center text-center space-y-4">
                                <div className="w-24 h-24 rounded-full bg-slate-900 border-2 border-white/10 overflow-hidden shadow-xl">
                                    {contact.avatarUrl ? (
                                        <img src={contact.avatarUrl} alt={contact.name} className="w-full h-full object-cover" />
                                    ) : (
                                        <div className="w-full h-full flex items-center justify-center text-slate-600">
                                            <User size={40} />
                                        </div>
                                    )}
                                </div>
                                <div>
                                    <h2 className="text-2xl font-bold text-white mb-1">{contact.name}</h2>
                                    <p className="text-sonic-purple font-medium">{contact.outlet}</p>
                                    <p className="text-slate-500 text-sm mt-1">{contact.role}</p>
                                </div>
                            </div>

                            {/* Quick Actions */}
                            <div className="grid grid-cols-2 gap-3">
                                <button className="flex flex-col items-center justify-center gap-2 p-4 bg-white/5 hover:bg-white/10 border border-white/5 rounded-2xl transition-all">
                                    <Mail size={20} className="text-white" />
                                    <span className="text-xs font-bold text-slate-400">Email</span>
                                </button>
                                <button className="flex flex-col items-center justify-center gap-2 p-4 bg-white/5 hover:bg-white/10 border border-white/5 rounded-2xl transition-all">
                                    <Globe size={20} className="text-white" />
                                    <span className="text-xs font-bold text-slate-400">Website</span>
                                </button>
                            </div>

                            {/* Relationship Status */}
                            <div className="space-y-3">
                                <label className="text-xs font-bold uppercase tracking-wider text-slate-500">Relationship Strength</label>
                                <div className="grid grid-cols-3 gap-2">
                                    {['Strong', 'Neutral', 'Weak'].map((r) => (
                                        <button
                                            key={r}
                                            onClick={() => handleRelationshipChange(r as any)}
                                            className={`py-2 text-xs font-bold rounded-lg border transition-all ${relationship === r
                                                ? 'bg-white text-black border-white'
                                                : 'bg-transparent border-white/10 text-slate-500 hover:border-white/30'
                                                }`}
                                        >
                                            {r}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Log Interaction (Placeholder) */}
                            <div className="space-y-3 pt-6 border-t border-white/10">
                                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                                    <MessageCircle size={16} />
                                    Log Interaction
                                </h3>
                                <textarea
                                    value={note}
                                    onChange={(e) => setNote(e.target.value)}
                                    placeholder="Add notes about your last conversation..."
                                    className="w-full h-32 bg-slate-900 border border-white/10 rounded-xl p-3 text-sm text-white placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-sonic-purple/50 resize-none"
                                />
                                <button
                                    onClick={handleSaveNote}
                                    disabled={isSaving}
                                    className="w-full py-3 bg-sonic-purple text-white rounded-xl font-bold hover:bg-sonic-purple/90 transition-all shadow-lg shadow-sonic-purple/20 disabled:opacity-50"
                                >
                                    {isSaving ? "Saving..." : "Save Note"}
                                </button>
                            </div>
                        </div>
                    </motion.div>
                </>
            )}
        </AnimatePresence>
    );
};
