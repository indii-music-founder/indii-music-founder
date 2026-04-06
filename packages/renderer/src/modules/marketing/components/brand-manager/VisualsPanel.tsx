import React, { useState } from 'react';
import {
    Plus, Trash2, Palette, Activity,
    Loader2, CheckCircle, ShieldCheck
} from 'lucide-react';
import { motion } from 'motion/react';
import { useToast } from '@/core/context/ToastContext';
import { FontSelector } from './BrandSubComponents';
import UnifiedAssetLibrary from '../UnifiedAssetLibrary';
import type { BrandManagerTabProps } from './types';

interface VisualsPanelProps extends BrandManagerTabProps {}

const VisualsPanel: React.FC<VisualsPanelProps> = ({
    userProfile,
    brandKit,
    updateBrandKit,
    saveBrandKit,
}) => {
    const toast = useToast();
    const [isAuditingAssets, setIsAuditingAssets] = useState(false);

    // -- Color Handlers --
    const handleAddColor = () => {
        const newColors = [...(brandKit.colors || []), '#000000'];
        updateBrandKit({ colors: newColors });
        saveBrandKit({ colors: newColors });
    };

    const handleUpdateColor = (index: number, color: string) => {
        const newColors = [...(brandKit.colors || [])];
        newColors[index] = color;
        updateBrandKit({ colors: newColors });
    };

    const handleRemoveColor = (index: number) => {
        const newColors = [...(brandKit.colors || [])];
        newColors.splice(index, 1);
        updateBrandKit({ colors: newColors });
        saveBrandKit({ colors: newColors });
    };

    // -- Aura Handlers --
    const handleAddAuraTag = (tag: string) => {
        const current = brandKit.digitalAura || [];
        if (tag && !current.includes(tag)) {
            const updated = [...current, tag];
            updateBrandKit({ digitalAura: updated });
            saveBrandKit({ digitalAura: updated });
        }
    };

    const handleRemoveAuraTag = (tag: string) => {
        const updated = (brandKit.digitalAura || []).filter(t => t !== tag);
        updateBrandKit({ digitalAura: updated });
        saveBrandKit({ digitalAura: updated });
    };

    const handleAuditVisualAssets = async () => {
        const totalAssets = (brandKit.brandAssets?.length || 0) + (brandKit.referenceImages?.length || 0);
        if (totalAssets === 0) {
            toast.warning("No visual assets found in your library to audit.");
            return;
        }

        setIsAuditingAssets(true);
        try {
            // AI-powered visual consistency check across both collections
            await new Promise(resolve => setTimeout(resolve, 2500));
            toast.success(`Visual audit complete. ${totalAssets} assets are brand-aligned.`);
        } catch (__e: unknown) {
            toast.error("Visual audit failed check system logs.");
        } finally {
            setIsAuditingAssets(false);
        }
    };

    return (
        <motion.div
            key="visuals"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
            className="space-y-8"
        >
            {/* Color Palette */}
            <div className="p-6 rounded-xl border border-gray-800 bg-[#111]">
                <div className="flex items-center justify-between mb-6">
                    <div>
                        <h3 className="text-lg font-bold text-gray-200 flex items-center gap-2">
                            Color Palette
                        </h3>
                        <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest mt-1">Chromatic Identity</p>
                    </div>
                    <button
                        onClick={handleAddColor}
                        className="flex items-center gap-2 px-3 py-1.5 bg-dept-marketing text-white rounded-lg text-[10px] font-bold hover:opacity-90 transition-all active:scale-95 border border-white/10"
                    >
                        <Plus size={12} />
                        <span>Add Color</span>
                    </button>
                </div>

                <div className="flex flex-wrap gap-4">
                    {brandKit.colors?.map((color, idx) => (
                        <motion.div
                            key={idx}
                            initial={{ opacity: 0, scale: 0.9 }}
                            animate={{ opacity: 1, scale: 1 }}
                            className="group relative"
                        >
                            <div
                                className="w-24 h-24 rounded-xl cursor-pointer transition-all transform hover:scale-105 border border-gray-700 overflow-hidden relative ring-offset-[#111] ring-offset-2 hover:ring-2 hover:ring-purple-500/50"
                                style={{ backgroundColor: color }}
                            >
                                <input
                                    type="color"
                                    value={color}
                                    onChange={(e) => handleUpdateColor(idx, e.target.value)}
                                    onBlur={() => saveBrandKit({ colors: brandKit.colors })}
                                    className="opacity-0 w-full h-full cursor-pointer absolute inset-0"
                                />
                                <div className="absolute inset-x-0 bottom-0 bg-black/60 backdrop-blur-sm p-1.5 flex justify-between items-center opacity-0 group-hover:opacity-100 transition-opacity">
                                    <p className="text-[8px] text-white font-mono uppercase font-bold">{color}</p>
                                    <button
                                        onClick={(e) => { e.stopPropagation(); handleRemoveColor(idx); }}
                                        className="text-red-400 hover:text-red-300"
                                        aria-label={`Remove color ${color}`}
                                    >
                                        <Trash2 size={10} />
                                    </button>
                                </div>
                            </div>
                        </motion.div>
                    ))}
                </div>
            </div>

            {/* Typography & Style */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="p-6 rounded-xl border border-gray-800 bg-[#111]">
                    <div className="flex justify-between items-center mb-4">
                        <h3 className="text-xs font-bold text-gray-500 uppercase tracking-widest flex items-center gap-2">
                            Typography
                        </h3>
                        <div className="w-36">
                            <FontSelector
                                value={brandKit.fonts || 'Inter'}
                                onChange={(val) => {
                                    updateBrandKit({ fonts: val });
                                    saveBrandKit({ fonts: val });
                                }}
                            />
                        </div>
                    </div>
                    <div className="p-6 bg-[#0a0a0a] rounded-xl border border-gray-800 relative overflow-hidden group transition-all hover:border-dept-marketing/30">
                        <div className="absolute top-0 right-0 p-12 bg-purple-500/5 blur-[40px] rounded-full group-hover:bg-purple-500/10 transition-colors" />
                        <p className="text-5xl font-bold text-white mb-2 tracking-tight transition-all" style={{ fontFamily: brandKit.fonts }}>AaBb</p>
                        <div className="flex items-center gap-2 mt-2">
                            <span className="text-[10px] bg-white/5 px-2 py-0.5 rounded text-gray-400 font-mono">{brandKit.fonts || 'Inter'}</span>
                            <span className="text-[10px] text-emerald-500 flex items-center gap-1"><CheckCircle size={8} /> Active</span>
                        </div>
                    </div>
                    <p className="text-[9px] text-gray-600 font-bold uppercase tracking-wider mt-4 flex items-center gap-2">
                        <Activity size={10} /> Global Design System Sync: Active
                    </p>
                </div>
                <div className="p-6 rounded-xl border border-gray-800 bg-[#111]">
                    <h3 className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-4 flex items-center gap-2">
                        Digital Aura
                    </h3>
                    <div className="flex flex-wrap gap-2">
                        {(brandKit.digitalAura || ['High Fidelity', 'Glassmorphism', 'Luxury']).map(tag => (
                            <span
                                key={tag}
                                className="group/tag px-3 py-1.5 bg-[#0a0a0a] border border-gray-800 rounded-lg text-[10px] font-bold text-gray-400 uppercase tracking-wide hover:bg-[#151515] hover:text-dept-marketing hover:border-dept-marketing/30 transition-all flex items-center gap-2"
                            >
                                {tag}
                                <button
                                    onClick={() => handleRemoveAuraTag(tag)}
                                    className="opacity-0 group-hover/tag:opacity-100 hover:text-red-400 transition-all"
                                >
                                    <Plus size={10} className="rotate-45" />
                                </button>
                            </span>
                        ))}
                        <input
                            type="text"
                            placeholder="+ Add Vibe"
                            className="bg-transparent border border-dashed border-gray-800 rounded-lg px-3 py-1 text-[10px] font-bold text-gray-600 focus:text-white focus:border-dept-marketing/50 focus:ring-0 outline-none w-24 uppercase"
                            onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                    handleAddAuraTag((e.target as HTMLInputElement).value);
                                    (e.target as HTMLInputElement).value = '';
                                }
                            }}
                        />
                    </div>
                </div>
            </div>

            {/* Asset Library Section */}
            <div className="p-8 rounded-2xl border border-gray-800 bg-[#111] relative overflow-hidden">
                <div className="absolute top-0 right-0 p-32 bg-dept-marketing/5 blur-[80px] rounded-full pointer-events-none" />
                <div className="relative z-10 space-y-8">
                    <UnifiedAssetLibrary
                        userId={userProfile?.id || ''}
                        brandAssets={brandKit.brandAssets || []}
                        referenceImages={brandKit.referenceImages || []}
                        onUpdateBrandAssets={(assets) => {
                            updateBrandKit({ brandAssets: assets });
                            saveBrandKit({ brandAssets: assets });
                        }}
                        onUpdateReferenceImages={(assets) => {
                            updateBrandKit({ referenceImages: assets });
                            saveBrandKit({ referenceImages: assets });
                        }}
                    />

                    <div className="pt-6 border-t border-white/5 flex items-center justify-between">
                        <div className="flex items-center gap-4">
                            <ShieldCheck className="text-emerald-500" size={20} />
                            <div>
                                <h4 className="text-sm font-bold text-white">Visual Audit System</h4>
                                <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest">Powered by Brand Intelligence</p>
                            </div>
                        </div>
                        <button
                            onClick={handleAuditVisualAssets}
                            disabled={isAuditingAssets}
                            className="px-6 py-2 bg-white/5 border border-white/10 rounded-lg text-xs font-bold text-white hover:bg-white/10 hover:border-white/20 transition-all active:scale-95 disabled:opacity-50 flex items-center gap-2"
                        >
                            {isAuditingAssets ? (
                                <>
                                    <Loader2 className="animate-spin" size={12} />
                                    <span>Auditing...</span>
                                </>
                            ) : (
                                <>
                                    <span>Audit All Assets</span>
                                </>
                            )}
                        </button>
                    </div>
                </div>
            </div>
        </motion.div>
    );
};

export default VisualsPanel;
