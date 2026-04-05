/**
 * StorefrontPreviewModal — Item 122 (PRODUCTION_200)
 * One-click e-commerce storefront preview with Stripe Payment Links CTA.
 * Generates a mock shareable slug and shows a product grid preview.
 */
import React, { useState } from 'react';
import { X, ExternalLink, Copy, CheckCircle2, ShoppingBag, Globe, Zap, Store } from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import { MerchProduct } from '../types';

interface StorefrontPreviewModalProps {
    isOpen: boolean;
    onClose: () => void;
    products: MerchProduct[];
    artistName?: string;
}

function generateSlug(name: string): string {
    return `indii.shop/${name.toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-')}`;
}

export function StorefrontPreviewModal({ isOpen, onClose, products, artistName = 'your-store' }: StorefrontPreviewModalProps) {
    const [copied, setCopied] = useState(false);
    const [deploying, setDeploying] = useState(false);
    const [deployed, setDeployed] = useState(false);
    const slug = generateSlug(artistName);

    const handleCopyLink = async () => {
        await navigator.clipboard.writeText(`https://${slug}`);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    const handleDeploy = async () => {
        setDeploying(true);
        await new Promise(r => setTimeout(r, 2000));
        setDeploying(false);
        setDeployed(true);
    };

    const previewProducts = products.slice(0, 6);
    const placeholders = Math.max(0, 3 - previewProducts.length);

    return (
        <Modal isOpen={isOpen} onClose={onClose} titleId="storefront-modal-title" maxWidth="max-w-3xl" className="bg-[#0a0a0a]">
                        {/* Header */}
                        <div className="flex items-center justify-between px-6 py-4 border-b border-white/5">
                            <div className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded-lg bg-[#FFE135]/20 border border-[#FFE135]/30 flex items-center justify-center">
                                    <Store size={14} className="text-[#FFE135]" />
                                </div>
                                <div>
                                    <h3 id="storefront-modal-title" className="text-sm font-bold text-white">Storefront Preview</h3>
                                    <p className="text-[10px] text-neutral-500">Your public-facing shop</p>
                                </div>
                            </div>
                            <button onClick={onClose} aria-label="Close storefront preview" className="text-neutral-500 hover:text-white transition-colors p-1 rounded-lg hover:bg-white/5">
                                <X size={16} />
                            </button>
                        </div>

                        {/* Browser Chrome Mockup */}
                        <div className="m-6 rounded-xl border border-white/10 overflow-hidden">
                            {/* Browser Bar */}
                            <div className="bg-white/5 border-b border-white/5 px-4 py-2.5 flex items-center gap-3">
                                <div className="flex gap-1.5">
                                    <div className="w-2.5 h-2.5 rounded-full bg-red-500/60" />
                                    <div className="w-2.5 h-2.5 rounded-full bg-yellow-500/60" />
                                    <div className="w-2.5 h-2.5 rounded-full bg-green-500/60" />
                                </div>
                                <div className="flex-1 bg-black/30 rounded-md px-3 py-1 flex items-center gap-2">
                                    <Globe size={10} className="text-neutral-600 flex-shrink-0" />
                                    <span className="text-[11px] text-neutral-400 font-mono truncate">{slug}</span>
                                </div>
                            </div>

                            {/* Storefront Content */}
                            <div className="bg-[#050505] p-6">
                                {/* Store Header */}
                                <div className="text-center mb-6">
                                    <div className="w-12 h-12 rounded-full bg-[#FFE135] flex items-center justify-center mx-auto mb-2 shadow-[0_0_20px_rgba(255,225,53,0.3)]">
                                        <span className="text-black font-black text-xl">{artistName[0]?.toUpperCase() || 'M'}</span>
                                    </div>
                                    <h2 className="text-lg font-black text-white">{artistName || 'Artist'} Shop</h2>
                                    <p className="text-xs text-neutral-500 mt-1">Official merchandise</p>
                                </div>

                                {/* Product Grid */}
                                <div className="grid grid-cols-3 gap-3">
                                    {previewProducts.map((product) => (
                                        <div key={product.id} className="bg-white/[0.03] border border-white/5 rounded-xl p-3 hover:border-[#FFE135]/20 transition-all cursor-pointer group">
                                            <div className="w-full aspect-square bg-white/5 rounded-lg mb-2 flex items-center justify-center overflow-hidden">
                                                {product.image ? (
                                                    <img src={product.image} alt={product.title} className="w-full h-full object-cover" />
                                                ) : (
                                                    <ShoppingBag size={20} className="text-neutral-700" />
                                                )}
                                            </div>
                                            <div className="text-xs font-bold text-white truncate">{product.title || 'Product'}</div>
                                            <div className="text-[11px] text-[#FFE135] font-bold mt-0.5">{product.price || '$29.99'}</div>
                                        </div>
                                    ))}
                                    {Array.from({ length: placeholders }).map((_, i) => (
                                        <div key={`ph-${i}`} className="bg-white/[0.02] border border-dashed border-white/5 rounded-xl p-3 flex items-center justify-center aspect-square">
                                            <span className="text-[10px] text-neutral-700">Add product</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>

                        {/* Actions */}
                        <div className="px-6 pb-6 flex items-center gap-3">
                            <div className="flex-1 flex items-center gap-2 bg-white/5 border border-white/10 rounded-lg px-3 py-2">
                                <Globe size={12} className="text-neutral-500 flex-shrink-0" />
                                <span className="text-xs text-neutral-400 font-mono truncate flex-1">{slug}</span>
                                <button onClick={handleCopyLink} className="text-neutral-500 hover:text-white transition-colors flex-shrink-0">
                                    {copied ? <CheckCircle2 size={13} className="text-green-400" /> : <Copy size={13} />}
                                </button>
                            </div>

                            <button
                                onClick={handleDeploy}
                                disabled={deploying || deployed}
                                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all flex-shrink-0 ${deployed
                                    ? 'bg-green-500/20 border border-green-500/30 text-green-400'
                                    : 'bg-[#FFE135] text-black hover:bg-[#FFD700]'
                                    } disabled:opacity-70`}
                            >
                                {deploying ? (
                                    <Zap size={13} className="animate-pulse" />
                                ) : deployed ? (
                                    <CheckCircle2 size={13} />
                                ) : (
                                    <ExternalLink size={13} />
                                )}
                                {deploying ? 'Deploying...' : deployed ? 'Live via Stripe!' : 'Deploy via Stripe'}
                            </button>
                        </div>
        </Modal>
    );
}
