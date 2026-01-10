import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Loader2, Megaphone, Mic2, Disc, MapPin, DollarSign } from 'lucide-react';
import { PublicistService } from '@/services/publicist/PublicistService';

interface CreateCampaignModalProps {
    isOpen: boolean;
    onClose: () => void;
    userId: string;
}

export const CreateCampaignModal: React.FC<CreateCampaignModalProps> = ({ isOpen, onClose, userId }) => {
    const [title, setTitle] = useState('');
    const [artist, setArtist] = useState('');
    const [type, setType] = useState<'Album' | 'Single' | 'Tour'>('Single');
    const [budget, setBudget] = useState<number | ''>('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!title || !artist) return;

        setIsSubmitting(true);
        try {
            // Determine a basic start date (today)
            const startDate = new Date().toISOString().split('T')[0];

            await PublicistService.addCampaign(userId, {
                title,
                artist,
                type,
                status: 'Draft',
                releaseDate: startDate,
                progress: 0,
                openRate: 0,
                budget: Number(budget) || 0, // Ensure strictly number
                coverUrl: "https://images.unsplash.com/photo-1493225255756-d9584f8606e9?q=80&w=2670&auto=format&fit=crop" // Default placeholder
            });

            // Reset and close
            setTitle('');
            setArtist('');
            setBudget('');
            setType('Single');
            onClose();
        } catch (error) {
            console.error("Failed to create campaign:", error);
            // Optionally add toast error here
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <AnimatePresence>
            {isOpen && (
                <>
                    {/* Backdrop */}
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50"
                        onClick={onClose}
                    />

                    {/* Modal */}
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95, y: 20 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95, y: 20 }}
                        className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-lg bg-slate-900 border border-white/10 rounded-3xl shadow-2xl z-50 overflow-hidden"
                    >
                        <div className="p-6 border-b border-white/5 flex justify-between items-center bg-slate-950/50">
                            <div>
                                <h3 className="text-xl font-bold text-white flex items-center gap-2">
                                    <Megaphone size={20} className="text-sonic-purple" />
                                    New Campaign
                                </h3>
                                <p className="text-sm text-slate-400">Launch a new publicity push.</p>
                            </div>
                            <button
                                onClick={onClose}
                                className="p-2 hover:bg-white/10 rounded-full transition-colors text-slate-400 hover:text-white"
                            >
                                <X size={20} />
                            </button>
                        </div>

                        <form onSubmit={handleSubmit} className="p-6 space-y-6" noValidate>
                            <div className="space-y-2">
                                <label className="text-xs font-bold uppercase tracking-wider text-slate-400 ml-1" htmlFor="campaign-title">Campaign Title</label>
                                <input
                                    id="campaign-title"
                                    type="text"
                                    value={title}
                                    onChange={(e) => setTitle(e.target.value)}
                                    placeholder="e.g. Neon Nights Album Launch"
                                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-sonic-purple/50 transition-all font-medium"
                                    autoFocus
                                />
                            </div>

                            <div className="space-y-2">
                                <label className="text-xs font-bold uppercase tracking-wider text-slate-400 ml-1" htmlFor="artist-name">Artist / Project Name</label>
                                <input
                                    id="artist-name"
                                    type="text"
                                    value={artist}
                                    onChange={(e) => setArtist(e.target.value)}
                                    placeholder="e.g. The Midnight Echo"
                                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-sonic-purple/50 transition-all font-medium"
                                />
                            </div>

                            <div className="space-y-2">
                                <label className="text-xs font-bold uppercase tracking-wider text-slate-400 ml-1" htmlFor="budget">Estimated Value / Budget</label>
                                <div className="relative">
                                    <DollarSign className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" size={16} />
                                    <input
                                        id="budget"
                                        type="number"
                                        min="0"
                                        value={budget}
                                        onChange={(e) => setBudget(Number(e.target.value))}
                                        placeholder="0.00"
                                        className="w-full bg-white/5 border border-white/10 rounded-xl pl-10 pr-4 py-3 text-white placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-sonic-purple/50 transition-all font-medium"
                                    />
                                </div>
                            </div>

                            <div className="space-y-2">
                                <label className="text-xs font-bold uppercase tracking-wider text-slate-400 ml-1">Release Type</label>
                                <div className="grid grid-cols-3 gap-3">
                                    {['Album', 'Single', 'Tour'].map((t) => (
                                        <button
                                            key={t}
                                            type="button"
                                            onClick={() => setType(t as any)}
                                            className={`flex flex-col items-center justify-center gap-2 p-3 rounded-xl border transition-all ${type === t
                                                ? 'bg-sonic-purple/20 border-sonic-purple text-white shadow-[0_0_15px_rgba(168,85,247,0.3)]'
                                                : 'bg-white/5 border-white/5 text-slate-400 hover:bg-white/10'
                                                }`}
                                        >
                                            {t === 'Album' && <Disc size={20} />}
                                            {t === 'Single' && <Mic2 size={20} />}
                                            {t === 'Tour' && <MapPin size={20} />}
                                            <span className="text-xs font-bold">{t}</span>
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <div className="pt-4">
                                <button
                                    type="submit"
                                    disabled={isSubmitting || !title || !artist}
                                    className="w-full py-4 bg-white text-black rounded-xl font-bold text-lg hover:bg-slate-200 active:scale-95 transition-all shadow-lg flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    {isSubmitting ? (
                                        <>
                                            <Loader2 size={20} className="animate-spin" />
                                            Creating...
                                        </>
                                    ) : (
                                        <>
                                            Create Campaign
                                            <Megaphone size={20} />
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
