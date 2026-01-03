import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Save, Trash2, Calendar, Activity, BarChart2 } from 'lucide-react';
import { Campaign } from '../types';
import { PublicistService } from '@/services/publicist/PublicistService';
import { useToast } from '@/core/context/ToastContext';

interface CampaignDetailsModalProps {
    isOpen: boolean;
    onClose: () => void;
    campaign: Campaign | null;
    userId: string;
}

export const CampaignDetailsModal: React.FC<CampaignDetailsModalProps> = ({ isOpen, onClose, campaign, userId }) => {
    const [status, setStatus] = useState<Campaign['status']>('Draft');
    const [progress, setProgress] = useState(0);
    const [isSaving, setIsSaving] = useState(false);
    const toast = useToast();

    useEffect(() => {
        if (campaign) {
            setStatus(campaign.status);
            setProgress(campaign.progress);
        }
    }, [campaign]);

    if (!campaign) return null;

    const handleSave = async () => {
        setIsSaving(true);
        try {
            if (campaign) {
                await PublicistService.updateCampaign(campaign.id, { status, progress });
                toast.success("Campaign updated successfully");
                onClose();
            }
        } catch (e) {
            console.error(e);
            toast.error("Failed to update campaign");
        } finally {
            setIsSaving(false);
        }
    };

    const StatusBadge = ({ s }: { s: string }) => {
        const isActive = status === s;
        return (
            <button
                onClick={() => setStatus(s as any)}
                className={`px-3 py-1 rounded-full text-xs font-bold border transition-all ${isActive
                    ? 'bg-sonic-purple/20 border-sonic-purple text-sonic-purple shadow-[0_0_10px_rgba(168,85,247,0.3)]'
                    : 'bg-white/5 border-white/5 text-slate-400 hover:bg-white/10'
                    }`}
            >
                {s}
            </button>
        );
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
                        initial={{ opacity: 0, scale: 0.95, y: 20 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95, y: 20 }}
                        className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-2xl bg-slate-950 border border-white/10 rounded-3xl shadow-2xl z-[70] overflow-hidden"
                    >
                        {/* Header Image */}
                        <div className="h-40 relative bg-slate-900 overflow-hidden">
                            <img
                                src={campaign.coverUrl || "https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?q=80&w=2670&auto=format&fit=crop"}
                                alt="Cover"
                                className="w-full h-full object-cover opacity-60"
                            />
                            <div className="absolute inset-0 bg-gradient-to-t from-slate-950 to-transparent" />
                            <button
                                onClick={onClose}
                                className="absolute top-4 right-4 p-2 bg-black/40 hover:bg-white/10 rounded-full text-white backdrop-blur-sm transition-colors"
                            >
                                <X size={20} />
                            </button>
                            <div className="absolute bottom-6 left-6">
                                <h2 className="text-3xl font-black text-white tracking-tight">{campaign.title}</h2>
                                <p className="text-slate-300 font-medium">{campaign.artist} • {campaign.type}</p>
                            </div>
                        </div>

                        <div className="p-6 space-y-8">
                            {/* Status Selector */}
                            <div className="space-y-3">
                                <label className="text-xs font-bold uppercase tracking-wider text-slate-500">Campaign Status</label>
                                <div className="flex gap-2">
                                    {['Draft', 'Scheduled', 'Live', 'Ended'].map(s => <StatusBadge key={s} s={s} />)}
                                </div>
                            </div>

                            {/* Progress Slider */}
                            <div className="space-y-3">
                                <div className="flex justify-between">
                                    <label className="text-xs font-bold uppercase tracking-wider text-slate-500">Progress</label>
                                    <span className="text-sm font-bold text-sonic-purple">{progress}%</span>
                                </div>
                                <input
                                    type="range"
                                    min="0"
                                    max="100"
                                    value={progress}
                                    onChange={(e) => setProgress(Number(e.target.value))}
                                    className="w-full h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-sonic-purple"
                                />
                            </div>

                            {/* Stats Grid */}
                            <div className="grid grid-cols-2 gap-4">
                                <div className="bg-white/5 p-4 rounded-2xl border border-white/5 space-y-1">
                                    <div className="flex items-center gap-2 text-slate-400">
                                        <BarChart2 size={16} />
                                        <span className="text-xs font-bold uppercase">Open Rate</span>
                                    </div>
                                    <p className="text-2xl font-bold text-white">{campaign.openRate}%</p>
                                </div>
                                <div className="bg-white/5 p-4 rounded-2xl border border-white/5 space-y-1">
                                    <div className="flex items-center gap-2 text-slate-400">
                                        <Calendar size={16} />
                                        <span className="text-xs font-bold uppercase">Release Date</span>
                                    </div>
                                    <p className="text-2xl font-bold text-white">{campaign.releaseDate}</p>
                                </div>
                            </div>

                            {/* Actions */}
                            <div className="flex justify-between items-center pt-4 border-t border-white/10">
                                <button className="text-red-500 hover:text-red-400 text-sm font-bold flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-red-500/10 transition-colors">
                                    <Trash2 size={16} />
                                    Delete Campaign
                                </button>
                                <div className="flex gap-3">
                                    <button onClick={onClose} className="px-5 py-2.5 rounded-xl font-bold text-slate-400 hover:text-white hover:bg-white/5 transition-all">
                                        Cancel
                                    </button>
                                    <button
                                        onClick={handleSave}
                                        className="px-6 py-2.5 bg-white text-black rounded-xl font-bold hover:bg-slate-200 transition-all flex items-center gap-2"
                                    >
                                        <Save size={18} />
                                        Save Changes
                                    </button>
                                </div>
                            </div>
                        </div>
                    </motion.div>
                </>
            )}
        </AnimatePresence>
    );
};
