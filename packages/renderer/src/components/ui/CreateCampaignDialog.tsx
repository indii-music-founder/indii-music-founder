import { useState } from 'react';
import { createCallable } from 'react-call';
import { Modal } from './Modal';
import { useStore } from '@/core/store';
import { useShallow } from 'zustand/react/shallow';
import { useToast } from '@/core/context/ToastContext';
import { X, Tag, Loader2 } from 'lucide-react';
import { type Campaign } from '@/core/store/slices/crmSlice';
import { logger } from '@/utils/logger';

// ISSUE-1207: extracted from CRMDashboard.tsx's hand-rolled isModalOpen state
// into a react-call dialog, matching CampaignConfigDialog/ConnectDistributorModal.
// Returns true if a campaign was created (caller re-fetches nothing extra — the
// store subscription already reacts to the new Firestore doc), false if cancelled.
export const CreateCampaignDialog = createCallable<Record<string, never>, boolean>(({ call }) => {
    const { createCampaign } = useStore(
        useShallow((state) => ({ createCampaign: state.createCampaign }))
    );
    const toast = useToast();

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
            call.end(true);
        } catch (err) {
            logger.error('Failed to create campaign:', err);
            toast.error('Launch failed — your drop was NOT saved. Your draft is untouched.');
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <Modal isOpen={true} onClose={() => call.end(false)} titleId="create-campaign-title" maxWidth="max-w-md">
            <div className="p-6 flex flex-col gap-4 relative">
                <button
                    onClick={() => call.end(false)}
                    className="absolute top-4 right-4 p-1.5 hover:bg-border rounded-lg text-text-secondary transition-colors"
                >
                    <X className="w-5 h-5" />
                </button>

                <div>
                    <h2 id="create-campaign-title" className="text-2xl font-bold flex items-center gap-2">
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
                            onClick={() => call.end(false)}
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
            </div>
        </Modal>
    );
});
