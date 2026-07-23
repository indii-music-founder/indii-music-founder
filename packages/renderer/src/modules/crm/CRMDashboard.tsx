import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useStore } from '@/core/store';
import { useShallow } from 'zustand/react/shallow';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { useToast } from '@/core/context/ToastContext';
import { 
    Plus, 
    Trash2, 
    Users, 
    Layers, 
    DollarSign, 
    TrendingUp, 
    X, 
    Tag, 
    Loader2, 
    AlertCircle, 
    CheckCircle,
    Calendar
} from 'lucide-react';
import { type Campaign } from '@/core/store/slices/crmSlice';

export default function CRMDashboard() {
    const [isModalOpen, setIsModalOpen] = useState(false);
    
    // Connect to Zustand store — select only what we use to prevent re-renders on unrelated state changes (ISSUE-1205)
    const { crm, subscribeToCampaigns, createCampaign, deleteCampaign } = useStore(
        useShallow((state) => ({
            crm: state.crm,
            subscribeToCampaigns: state.subscribeToCampaigns,
            createCampaign: state.createCampaign,
            deleteCampaign: state.deleteCampaign,
        }))
    );
    const { campaigns, loading, error } = crm;
    const toast = useToast();

    // Subscribe to Firestore campaigns collection on mount
    useEffect(() => {
        const unsubscribe = subscribeToCampaigns();
        return () => {
            if (unsubscribe) unsubscribe();
        };
    }, [subscribeToCampaigns]);

    // Form state
    const [campaignName, setCampaignName] = useState('');
    const [campaignType, setCampaignType] = useState<Campaign['type']>('Digital Vinyl');
    const [supply, setSupply] = useState('');
    const [price, setPrice] = useState('');
    const [deliverableUrl, setDeliverableUrl] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    const handleLaunch = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!campaignName || !supply || !price) return;

        // ISSUE-980: a drop with no real deliverable link cannot go live —
        // it saves as a draft instead of silently becoming "Active" with
        // nothing for a fan to discover, purchase, or unlock.
        const hasDeliverable = !!deliverableUrl.trim();

        // ISSUE-979: double-submit guard — a slow write must not launch twice.
        if (isSubmitting) return;
        setIsSubmitting(true);
        try {
            const id = await createCampaign({
                name: campaignName,
                type: campaignType,
                supply: parseInt(supply, 10),
                price: parseFloat(price),
                deliverableUrl: deliverableUrl.trim() || undefined,
                status: hasDeliverable ? 'active' : 'draft'
            });
            // ISSUE-979: the store action returns null on persistence failure
            // (offline, signed-out, rules, quota). Only a real document ID may
            // close the modal and clear the draft.
            if (!id) {
                toast.error('Launch failed — your drop was NOT saved. Fix the connection or sign-in and try again; your draft is untouched.');
                return;
            }
            toast.success(hasDeliverable
                ? 'Drop launched!'
                : 'Saved as a draft — add a deliverable link to launch it.');
            setIsModalOpen(false);
            setCampaignName('');
            setCampaignType('Digital Vinyl');
            setSupply('');
            setPrice('');
            setDeliverableUrl('');
        } catch (err) {
            console.error('Failed to create campaign:', err);
            toast.error('Launch failed — your drop was NOT saved. Your draft is untouched.');
        } finally {
            setIsSubmitting(false);
        }
    };

    // Calculate metrics — draft campaigns never count as active or projected live value.
    const totalCampaigns = campaigns.length;
    const activeCampaigns = campaigns.filter(c => c.status === 'active').length;
    const totalSupply = campaigns.reduce((acc, c) => acc + (c.supply || 0), 0);
    const projectedRevenue = campaigns
        .filter(c => c.status === 'active')
        .reduce((acc, c) => acc + ((c.supply || 0) * (c.price || 0)), 0);

    const getTypeColor = (type: Campaign['type']) => {
        switch (type) {
            case 'Digital Vinyl': return 'from-green-500/20 to-indigo-500/20 border-green-500/30 text-green-400';
            case 'Exclusive Audio': return 'from-blue-500/20 to-cyan-500/20 border-blue-500/30 text-blue-400';
            case 'VIP Package': return 'from-amber-500/20 to-orange-500/20 border-amber-500/30 text-amber-400';
            case 'Merch Bundle': return 'from-emerald-500/20 to-teal-500/20 border-emerald-500/30 text-emerald-400';
            default: return 'from-gray-500/20 to-slate-500/20 border-gray-500/30 text-gray-400';
        }
    };

    const getTypeBadgeColor = (type: Campaign['type']) => {
        switch (type) {
            case 'Digital Vinyl': return 'bg-green-500/10 text-green-400 border-green-500/20';
            case 'Exclusive Audio': return 'bg-blue-500/10 text-blue-400 border-blue-500/20';
            case 'VIP Package': return 'bg-amber-500/10 text-amber-400 border-amber-500/20';
            case 'Merch Bundle': return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20';
            default: return 'bg-gray-500/10 text-gray-400 border-gray-500/20';
        }
    };

    return (
        <div className="flex flex-col h-full w-full bg-surface text-text-primary p-6 gap-6 overflow-y-auto">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold bg-gradient-to-r from-text-primary via-text-primary to-text-secondary bg-clip-text">Superfan CRM</h1>
                    <p className="text-text-secondary mt-1 text-sm md:text-base">Manage your SoundLocker campaign ecosystem, sales, and fan drops.</p>
                </div>
                <button
                    onClick={() => setIsModalOpen(true)}
                    className="flex items-center gap-2 px-4 py-2.5 bg-accent-primary hover:bg-accent-secondary text-white rounded-lg font-medium transition-all duration-200 shadow-md shadow-accent-primary/20 hover:shadow-accent-secondary/30 active:scale-95"
                >
                    <Plus className="w-5 h-5" />
                    <span>New Drop</span>
                </button>
            </div>

            {/* Error Message */}
            {error && (
                <div className="flex items-center gap-3 p-4 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-sm">
                    <AlertCircle className="w-5 h-5 flex-shrink-0" />
                    <span>{error}</span>
                </div>
            )}

            {/* Stats Dashboard */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="p-4 bg-background/50 border border-border/80 rounded-2xl flex flex-col gap-2">
                    <div className="flex justify-between items-center text-text-secondary">
                        <span className="text-xs font-semibold uppercase tracking-wider">Total Campaigns</span>
                        <div className="p-2 bg-green-500/10 rounded-lg text-green-400">
                            <Layers className="w-4 h-4" />
                        </div>
                    </div>
                    <span className="text-2xl font-bold">{totalCampaigns}</span>
                </div>

                <div className="p-4 bg-background/50 border border-border/80 rounded-2xl flex flex-col gap-2">
                    <div className="flex justify-between items-center text-text-secondary">
                        <span className="text-xs font-semibold uppercase tracking-wider">Active Drops</span>
                        <div className="p-2 bg-emerald-500/10 rounded-lg text-emerald-400">
                            <CheckCircle className="w-4 h-4" />
                        </div>
                    </div>
                    <span className="text-2xl font-bold">{activeCampaigns}</span>
                </div>

                <div className="p-4 bg-background/50 border border-border/80 rounded-2xl flex flex-col gap-2">
                    <div className="flex justify-between items-center text-text-secondary">
                        <span className="text-xs font-semibold uppercase tracking-wider">Total Supply</span>
                        <div className="p-2 bg-blue-500/10 rounded-lg text-blue-400">
                            <Users className="w-4 h-4" />
                        </div>
                    </div>
                    <span className="text-2xl font-bold">{totalSupply.toLocaleString()}</span>
                </div>

                <div className="p-4 bg-background/50 border border-border/80 rounded-2xl flex flex-col gap-2">
                    <div className="flex justify-between items-center text-text-secondary">
                        <span className="text-xs font-semibold uppercase tracking-wider">Projected Value</span>
                        <div className="p-2 bg-amber-500/10 rounded-lg text-amber-400">
                            <DollarSign className="w-4 h-4" />
                        </div>
                    </div>
                    <span className="text-2xl font-bold">${projectedRevenue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                </div>
            </div>

            {/* Main Content Area */}
            <div className="flex-1">
                {loading && campaigns.length === 0 ? (
                    <div className="h-64 flex flex-col items-center justify-center gap-3 text-text-secondary">
                        <Loader2 className="w-8 h-8 animate-spin text-accent-primary" />
                        <span className="text-sm font-medium">Synchronizing CRM collections...</span>
                    </div>
                ) : campaigns.length === 0 ? (
                    <div className="h-80 flex flex-col items-center justify-center p-12 border border-dashed border-border rounded-2xl text-text-secondary bg-background/20 gap-4 text-center">
                        <div className="p-4 bg-background/60 border border-border rounded-full text-text-secondary/50">
                            <TrendingUp className="w-8 h-8" />
                        </div>
                        <div>
                            <h3 className="font-semibold text-lg text-text-primary">No active campaigns yet</h3>
                            <p className="text-sm text-text-secondary max-w-sm mt-1">Create your first Digital Vinyl, audio drop, or VIP bundle to start engaging with superfans.</p>
                        </div>
                        <button
                            onClick={() => setIsModalOpen(true)}
                            className="px-4 py-2 bg-background hover:bg-border border border-border text-text-primary rounded-lg font-medium transition-colors text-sm"
                        >
                            Create Drop
                        </button>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {campaigns.map(camp => (
                            <motion.div
                                key={camp.id}
                                layout
                                initial={{ opacity: 0, y: 12 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, scale: 0.95 }}
                                transition={{ duration: 0.2 }}
                                className={`group p-5 border bg-gradient-to-b ${getTypeColor(camp.type)} rounded-2xl flex flex-col gap-4 relative overflow-hidden transition-all duration-300 hover:shadow-lg`}
                            >
                                <div className="flex justify-between items-start gap-4">
                                    <div className="flex flex-col gap-1.5">
                                        <div className="flex items-center gap-2">
                                            <span className={`px-2 py-0.5 text-xs font-semibold rounded-md border ${getTypeBadgeColor(camp.type)}`}>
                                                {camp.type}
                                            </span>
                                            {camp.status === 'active' && (
                                                <span className="flex items-center gap-1 text-[10px] uppercase font-bold text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded border border-emerald-500/20">
                                                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                                                    Active
                                                </span>
                                            )}
                                            {camp.status === 'draft' && (
                                                <span className="flex items-center gap-1 text-[10px] uppercase font-bold text-amber-400 bg-amber-500/10 px-1.5 py-0.5 rounded border border-amber-500/20" title="No deliverable link — fans cannot discover, purchase, or unlock this drop yet">
                                                    Draft — Setup Incomplete
                                                </span>
                                            )}
                                        </div>
                                        <h3 className="font-bold text-lg text-text-primary group-hover:text-accent-primary transition-colors mt-1">
                                            {camp.name}
                                        </h3>
                                    </div>

                                    <button
                                        onClick={async (e) => {
                                            e.stopPropagation();
                                            const ok = await ConfirmDialog.call({
                                                title: 'Delete Campaign',
                                                message: `Are you sure you want to delete campaign "${camp.name}"? This cannot be undone.`,
                                                confirmText: 'Delete',
                                                variant: 'destructive'
                                            });
                                            if (ok) deleteCampaign(camp.id);
                                        }}
                                        className="p-1.5 hover:bg-red-500/10 hover:text-red-400 text-text-secondary/60 rounded-lg transition-colors"
                                        title="Delete Campaign"
                                    >
                                        <Trash2 className="w-4.5 h-4.5" />
                                    </button>
                                </div>

                                <div className="grid grid-cols-2 gap-4 border-t border-border/40 pt-4 mt-auto">
                                    <div className="flex flex-col">
                                        <span className="text-[10px] text-text-secondary uppercase tracking-wider font-medium">Total Supply</span>
                                        <span className="text-base font-bold text-text-primary mt-0.5">
                                            {camp.supply.toLocaleString()}
                                        </span>
                                    </div>
                                    <div className="flex flex-col">
                                        <span className="text-[10px] text-text-secondary uppercase tracking-wider font-medium">Unit Price</span>
                                        <span className="text-base font-bold text-text-primary mt-0.5">
                                            ${parseFloat(camp.price.toString()).toFixed(2)}
                                        </span>
                                    </div>
                                </div>

                                <div className="flex justify-between items-center text-xs text-text-secondary/80 border-t border-border/20 pt-3">
                                    <div className="flex items-center gap-1.5">
                                        <Calendar className="w-3.5 h-3.5" />
                                        <span>
                                            {camp.createdAt ? (
                                                new Date((camp.createdAt?.seconds || camp.createdAt) * 1000).toLocaleDateString(undefined, {
                                                    month: 'short',
                                                    day: 'numeric',
                                                    year: 'numeric'
                                                })
                                            ) : 'Just now'}
                                        </span>
                                    </div>
                                    <div className="flex items-center gap-1 text-accent-primary font-medium">
                                        <span>Total:</span>
                                        <span className="font-bold">${((camp.supply || 0) * (camp.price || 0)).toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
                                    </div>
                                </div>
                            </motion.div>
                        ))}
                    </div>
                )}
            </div>

            {/* New Drop Modal */}
            <AnimatePresence>
                {isModalOpen && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.95 }}
                            className="w-full max-w-md bg-surface border border-border rounded-2xl p-6 shadow-2xl flex flex-col gap-4 relative"
                        >
                            <button
                                onClick={() => setIsModalOpen(false)}
                                className="absolute top-4 right-4 p-1.5 hover:bg-border rounded-lg text-text-secondary transition-colors"
                            >
                                <X className="w-5 h-5" />
                            </button>

                            <div>
                                <h2 className="text-2xl font-bold flex items-center gap-2">
                                    <Tag className="w-5 h-5 text-accent-primary" />
                                    <span>Create Campaign</span>
                                </h2>
                                <p className="text-sm text-text-secondary mt-1">Launch a new Digital Vinyl or VIP drop for your superfans.</p>
                            </div>

                            <form onSubmit={handleLaunch} className="flex flex-col gap-4 mt-2">
                                <div className="flex flex-col gap-1.5">
                                    <label className="text-xs font-semibold text-text-secondary uppercase tracking-wider">Campaign Name</label>
                                    <input
                                        type="text"
                                        required
                                        value={campaignName}
                                        onChange={e => setCampaignName(e.target.value)}
                                        placeholder="e.g. Genesis Digital Vinyl Drop"
                                        className="px-3.5 py-2.5 bg-background border border-border rounded-xl focus:outline-none focus:border-accent-primary text-sm transition-all"
                                    />
                                </div>

                                <div className="flex flex-col gap-1.5">
                                    <label className="text-xs font-semibold text-text-secondary uppercase tracking-wider">Campaign Type</label>
                                    <select
                                        value={campaignType}
                                        onChange={e => setCampaignType(e.target.value as Campaign['type'])}
                                        className="px-3.5 py-2.5 bg-background border border-border rounded-xl focus:outline-none focus:border-accent-primary text-sm transition-all"
                                    >
                                        <option value="Digital Vinyl">Digital Vinyl</option>
                                        <option value="Exclusive Audio">Exclusive Audio</option>
                                        <option value="VIP Package">VIP Package</option>
                                        <option value="Merch Bundle">Merch Bundle</option>
                                    </select>
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div className="flex flex-col gap-1.5">
                                        <label className="text-xs font-semibold text-text-secondary uppercase tracking-wider">Supply</label>
                                        <input
                                            type="number"
                                            required
                                            min="1"
                                            placeholder="100"
                                            value={supply}
                                            onChange={e => setSupply(e.target.value)}
                                            className="px-3.5 py-2.5 bg-background border border-border rounded-xl focus:outline-none focus:border-accent-primary text-sm transition-all"
                                        />
                                    </div>

                                    <div className="flex flex-col gap-1.5">
                                        <label className="text-xs font-semibold text-text-secondary uppercase tracking-wider">Price (USD)</label>
                                        <input
                                            type="number"
                                            required
                                            min="0.01"
                                            step="0.01"
                                            placeholder="9.99"
                                            value={price}
                                            onChange={e => setPrice(e.target.value)}
                                            className="px-3.5 py-2.5 bg-background border border-border rounded-xl focus:outline-none focus:border-accent-primary text-sm transition-all"
                                        />
                                    </div>
                                </div>

                                <div className="flex flex-col gap-1.5">
                                    <label className="text-xs font-semibold text-text-secondary uppercase tracking-wider">
                                        Deliverable Link <span className="text-text-secondary/60 normal-case font-medium">(optional — required to go live)</span>
                                    </label>
                                    <input
                                        type="url"
                                        value={deliverableUrl}
                                        onChange={e => setDeliverableUrl(e.target.value)}
                                        placeholder="Where fans get this once they buy it (file link, store page, ticket page...)"
                                        className="px-3.5 py-2.5 bg-background border border-border rounded-xl focus:outline-none focus:border-accent-primary text-sm transition-all"
                                    />
                                    <p className="text-[11px] text-text-secondary/70">
                                        {deliverableUrl.trim()
                                            ? 'This drop will launch as Active.'
                                            : 'Without this, the drop saves as a Draft — fans cannot discover, purchase, or unlock anything until it\'s added.'}
                                    </p>
                                </div>

                                <div className="flex justify-end gap-3 mt-6">
                                    <button
                                        type="button"
                                        onClick={() => setIsModalOpen(false)}
                                        className="px-4 py-2 hover:bg-border rounded-xl font-medium transition-colors text-sm"
                                        disabled={isSubmitting}
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        type="submit"
                                        className="flex items-center justify-center gap-2 px-5 py-2 bg-accent-primary hover:bg-accent-secondary text-white rounded-xl font-semibold transition-all duration-200 text-sm disabled:opacity-50 disabled:pointer-events-none"
                                        disabled={isSubmitting || !campaignName || !supply || !price}
                                    >
                                        {isSubmitting ? (
                                            <>
                                                <Loader2 className="w-4 h-4 animate-spin" />
                                                <span>{deliverableUrl.trim() ? 'Launching...' : 'Saving...'}</span>
                                            </>
                                        ) : (
                                            <span>{deliverableUrl.trim() ? 'Launch Drop' : 'Save as Draft'}</span>
                                        )}
                                    </button>
                                </div>
                            </form>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </div>
    );
}
