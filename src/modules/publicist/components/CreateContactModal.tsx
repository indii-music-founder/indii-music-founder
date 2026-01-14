import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { User, Star, X, Loader2 } from 'lucide-react';
import { PublicistService } from '@/services/publicist/PublicistService';
import { useToast } from '@/core/context/ToastContext';
import { Contact } from '../types';

interface CreateContactModalProps {
    isOpen: boolean;
    onClose: () => void;
    userId: string;
}

export const CreateContactModal: React.FC<CreateContactModalProps> = ({ isOpen, onClose, userId }) => {
    const [name, setName] = useState('');
    const [outlet, setOutlet] = useState('');
    const [role, setRole] = useState<Contact['role']>('Journalist');
    const [tier, setTier] = useState<Contact['tier']>('Mid');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const toast = useToast();

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!name || !outlet) return;

        setIsSubmitting(true);
        try {
            await PublicistService.addContact(userId, {
                name,
                outlet,
                role,
                tier,
                relationshipStrength: 'Neutral',
                influenceScore: tier === 'Top' ? 85 : tier === 'Mid' ? 60 : 25,
                lastInteraction: 'Never',
                notes: '',
                avatarUrl: ''
            });

            toast.success(`Contact ${name} added to Media Network`);

            // Reset and close
            setName('');
            setOutlet('');
            setRole('Journalist');
            setTier('Mid');
            onClose();
        } catch (error) {
            console.error("Failed to create contact:", error);
            toast.error("Failed to add contact");
        } finally {
            setIsSubmitting(false);
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
                        className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50"
                        onClick={onClose}
                    />

                    <motion.div
                        initial={{ opacity: 0, scale: 0.95, y: 20 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95, y: 20 }}
                        className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-lg bg-slate-900 border border-white/10 rounded-3xl shadow-2xl z-50 overflow-hidden"
                    >
                        <div className="p-6 border-b border-white/5 flex justify-between items-center bg-slate-950/50">
                            <div>
                                <h3 className="text-xl font-bold text-white flex items-center gap-2">
                                    <User size={20} className="text-sonic-purple" />
                                    Add New Contact
                                </h3>
                                <p className="text-sm text-slate-400">Expand your Media Network.</p>
                            </div>
                            <button
                                onClick={onClose}
                                className="p-2 hover:bg-white/10 rounded-full transition-colors text-slate-400 hover:text-white"
                            >
                                <X size={20} />
                            </button>
                        </div>

                        <form onSubmit={handleSubmit} className="p-6 space-y-5">
                            <div className="space-y-2">
                                <label className="text-xs font-bold uppercase tracking-wider text-slate-400 ml-1">Contact Name</label>
                                <input
                                    type="text"
                                    value={name}
                                    onChange={(e) => setName(e.target.value)}
                                    placeholder="e.g. Test Journalist"
                                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-sonic-purple/50 transition-all font-medium"
                                    autoFocus
                                />
                            </div>

                            <div className="space-y-2">
                                <label className="text-xs font-bold uppercase tracking-wider text-slate-400 ml-1">Media Outlet</label>
                                <input
                                    type="text"
                                    value={outlet}
                                    onChange={(e) => setOutlet(e.target.value)}
                                    placeholder="e.g. Pitchfork / Rolling Stone"
                                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-sonic-purple/50 transition-all font-medium"
                                />
                            </div>

                            <div className="space-y-2">
                                <label className="text-xs font-bold uppercase tracking-wider text-slate-400 ml-1">Role/Position</label>
                                <select
                                    value={role}
                                    onChange={(e) => setRole(e.target.value as Contact['role'])}
                                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-sonic-purple/50 transition-all font-medium bg-slate-900"
                                >
                                    <option value="Journalist">Journalist</option>
                                    <option value="Editor">Editor</option>
                                    <option value="Curator">Curator</option>
                                    <option value="Influencer">Influencer</option>
                                </select>
                            </div>

                            <div className="space-y-2">
                                <label className="text-xs font-bold uppercase tracking-wider text-slate-400 ml-1">Contact Tier</label>
                                <div className="grid grid-cols-3 gap-3">
                                    {(['Top', 'Mid', 'Blog'] as const).map((t) => (
                                        <button
                                            key={t}
                                            type="button"
                                            onClick={() => setTier(t)}
                                            className={`flex flex-col items-center justify-center gap-2 p-3 rounded-xl border transition-all ${tier === t
                                                ? 'bg-sonic-purple/20 border-sonic-purple text-white shadow-[0_0_15px_rgba(168,85,247,0.3)]'
                                                : 'bg-white/5 border-white/5 text-slate-400 hover:bg-white/10'
                                                }`}
                                        >
                                            <Star size={16} className={tier === t ? 'text-sonic-purple' : 'opacity-40'} />
                                            <span className="text-[10px] font-bold uppercase tracking-wider">{t} Tier</span>
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <div className="pt-4">
                                <button
                                    type="submit"
                                    disabled={isSubmitting || !name || !outlet}
                                    className="w-full py-4 bg-white text-black rounded-xl font-bold text-lg hover:bg-slate-200 active:scale-95 transition-all shadow-lg flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    {isSubmitting ? (
                                        <>
                                            <Loader2 size={20} className="animate-spin" />
                                            Adding...
                                        </>
                                    ) : (
                                        <>
                                            Add Contact
                                            <User size={20} />
                                        </>
                                    )}
                                </button>
                            </div>
                        </form>
                    </motion.div>
                </>
            )}
        </AnimatePresence>
    );
};
