import React, { useState } from 'react';
import { motion } from 'motion/react';
import { X, Sparkles, AlertCircle, Layers3, Users, Brush, ImagePlus } from 'lucide-react';
import { STUDIO_COLORS } from '../constants';
import type { CreativeVaultScope } from '../services/creativeManifest';
import { useStore } from '@/core/store';
import { useShallow } from 'zustand/react/shallow';
import { useToast } from '@/core/context/ToastContext';
import { fetchAsBase64 } from '@/services/storage/safeStorageFetch';
import { logger } from '@/utils/logger';
import type { BrandAsset } from '@/types/User';

interface EditDefinitionsPanelProps {
    isOpen: boolean;
    onClose: () => void;
    definitions: Record<string, string>;
    onUpdateDefinition: (colorId: string, prompt: string) => void;
    referenceImages?: Record<string, { mimeType: string, data: string } | null>;
    onUpdateReferenceImage?: (colorId: string, image: { mimeType: string, data: string } | null) => void;
    referenceRoles?: Record<string, CreativeVaultScope>;
    onUpdateReferenceRole?: (colorId: string, role: CreativeVaultScope) => void;
}

export default function EditDefinitionsPanel({
    isOpen,
    onClose,
    definitions,
    onUpdateDefinition,
    referenceImages = {},
    onUpdateReferenceImage,
    referenceRoles = {},
    onUpdateReferenceRole
}: EditDefinitionsPanelProps) {
    const toast = useToast();
    const [brandPickerColorId, setBrandPickerColorId] = useState<string | null>(null);
    const userProfile = useStore(useShallow(state => state.userProfile));

    if (!isOpen) return null;

    const brandAssets = [
        ...(userProfile?.brandKit?.brandAssets || []),
        ...(userProfile?.brandKit?.referenceImages || []),
    ];
    const activeColor = STUDIO_COLORS.find(color => color.id === brandPickerColorId) ?? null;

    const handleFileChange = (colorId: string, e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0] && onUpdateReferenceImage) {
            const file = e.target.files[0];
            const reader = new FileReader();
            reader.onload = (ev) => {
                if (ev.target?.result) {
                    const result = ev.target.result as string;
                    const match = result.match(/^data:(.+);base64,(.+)$/);
                    if (match) {
                        onUpdateReferenceImage(colorId, { mimeType: match[1] ?? '', data: match[2] ?? '' });
                    }
                }
            };
            reader.readAsDataURL(file);
        }
    };

    const handleSelectBrandAsset = async (asset: BrandAsset) => {
        if (!onUpdateReferenceImage || !brandPickerColorId) return;

        try {
            const { base64, mimeType } = await fetchAsBase64(asset.url);
            onUpdateReferenceImage(brandPickerColorId, { mimeType, data: base64 });
            toast.success('Brand HQ reference added.');
            setBrandPickerColorId(null);
        } catch (error) {
            logger.warn('[EditDefinitionsPanel] Failed to import Brand HQ asset', error);
            toast.error('Could not import Brand HQ asset.');
        }
    };

    return (
        <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
            className="absolute top-0 right-0 bottom-0 w-80 bg-[#1a1a1a] border-l border-gray-800 shadow-2xl z-40 flex flex-col"
        >
            <div className="flex items-center justify-between p-4 border-b border-gray-800 bg-[#111]">
                <h3 className="font-bold text-white flex items-center gap-2">
                    <Sparkles className="text-green-500" size={16} />
                    Edit Definitions
                </h3>
                <button
                    onClick={onClose}
                    aria-label="Close edit definitions"
                    className="text-gray-400 hover:text-white transition-colors focus-visible:ring-2 focus-visible:ring-green-500 rounded"
                >
                    <X size={18} />
                </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar">
                <div className="bg-blue-900/20 border border-blue-900/50 rounded-lg p-3 flex gap-3 items-start">
                    <AlertCircle className="text-blue-400 shrink-0 mt-0.5" size={16} />
                    <p className="text-xs text-blue-200">
                        Map each color to a specific edit instruction. Optionally attach a reference image (e.g. "Use these shoes") to guide the edit.
                    </p>
                </div>

                {STUDIO_COLORS.map((color) => (
                    <div key={color.id} className="bg-[#222] rounded-xl border border-gray-800 overflow-hidden group focus-within:border-gray-600 transition-colors">
                        <div className="flex items-center gap-3 p-3 border-b border-gray-800/50 bg-[#1f1f1f]">
                            <div
                                className="w-4 h-4 rounded-full border border-white/10 shadow-sm"
                                style={{ backgroundColor: color.hex }}
                            />
                            <span className="text-sm font-medium text-gray-300">{color.name}</span>
                        </div>
                        <div className="p-2 space-y-2">
                            <textarea
                                value={definitions[color.id] || ''}
                                onChange={(e) => onUpdateDefinition(color.id, e.target.value)}
                                placeholder={`e.g. Turn into ${color.name.toLowerCase()} neon lights...`}
                                aria-label={`Edit definition for ${color.name}`}
                                className="w-full bg-transparent text-sm text-white placeholder-gray-600 border-none outline-none resize-none h-20 focus:ring-0 focus-visible:ring-1 focus-visible:ring-green-500/50 rounded-sm"
                            />

                            {/* Reference Image Input */}
                            <div className="flex items-center gap-2">
                                {referenceImages[color.id] ? (
                                    <div className="relative w-12 h-12 rounded overflow-hidden border border-gray-700 group/img">
                                        <img
                                            src={`data:${referenceImages[color.id]!.mimeType};base64,${referenceImages[color.id]!.data}`}
                                            className="w-full h-full object-cover"
                                            alt="Ref"
                                        />
                                        <button
                                            onClick={() => onUpdateReferenceImage && onUpdateReferenceImage(color.id, null)}
                                            aria-label={`Remove reference image for ${color.name}`}
                                            className="absolute inset-0 bg-black/60 flex items-center justify-center opacity-0 group-hover/img:opacity-100 transition-opacity focus-visible:opacity-100 focus-visible:ring-2 focus-visible:ring-red-500"
                                        >
                                            <X size={12} className="text-white" />
                                        </button>
                                    </div>
                                ) : (
                                    onUpdateReferenceImage && (
                                        <div className="flex items-center gap-2">
                                            <label className="flex items-center gap-2 px-2 py-1.5 bg-gray-800 hover:bg-gray-700 rounded cursor-pointer transition-colors text-xs text-gray-400 border border-transparent hover:border-gray-600 focus-within:ring-2 focus-within:ring-green-500 focus-within:ring-offset-1 focus-within:ring-offset-[#1a1a1a]">
                                                <span className="text-[10px]">+ Ref Scan</span>
                                                <input
                                                    type="file"
                                                    accept="image/*"
                                                    className="sr-only"
                                                    onChange={(e) => handleFileChange(color.id, e)}
                                                />
                                            </label>
                                            <button
                                                type="button"
                                                onClick={() => setBrandPickerColorId(color.id)}
                                                className="flex items-center gap-1 px-2 py-1.5 bg-gray-800 hover:bg-gray-700 rounded text-xs text-gray-300 border border-transparent hover:border-gray-600 transition-colors"
                                            >
                                                <ImagePlus size={12} />
                                                Brand HQ
                                            </button>
                                        </div>
                                    )
                                )}
                            </div>

                            {onUpdateReferenceRole && (
                                <div className="flex flex-wrap gap-1 pt-1">
                                    {[
                                        { role: 'objects' as const, label: 'Object', icon: Layers3 },
                                        { role: 'characters' as const, label: 'Character', icon: Users },
                                        { role: 'style' as const, label: 'Style', icon: Brush },
                                    ].map(({ role, label, icon: Icon }) => {
                                        const active = (referenceRoles[color.id] || 'objects') === role;
                                        return (
                                            <button
                                                key={role}
                                                type="button"
                                                onClick={() => onUpdateReferenceRole(color.id, role)}
                                                className={`flex items-center gap-1 rounded-full border px-2 py-1 text-[9px] font-semibold uppercase tracking-wide transition-colors ${
                                                    active
                                                        ? 'border-amber-400/40 bg-amber-400/10 text-amber-200'
                                                        : 'border-white/8 bg-white/[0.03] text-gray-500 hover:border-white/15 hover:text-gray-300'
                                                }`}
                                            >
                                                <Icon size={10} />
                                                {label}
                                            </button>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    </div>
                ))}
            </div>

            <div className="p-4 border-t border-gray-800 bg-[#111]">
                <button
                    onClick={onClose}
                    className="w-full py-2 bg-gray-800 hover:bg-gray-700 text-white rounded-lg font-medium transition-colors text-sm"
                >
                    Done
                </button>
            </div>

            {brandPickerColorId && (
                <div
                    className="fixed inset-0 z-[9999] bg-black/85 backdrop-blur-xl flex items-center justify-center p-6"
                    onClick={() => setBrandPickerColorId(null)}
                >
                    <div
                        className="w-full max-w-3xl rounded-2xl border border-white/10 bg-[#0b0b0d] shadow-2xl overflow-hidden"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
                            <div>
                                <div className="text-sm font-bold text-white">Select Brand HQ Asset</div>
                                <div className="text-[11px] text-gray-400">
                                    Attach a Brand Manager asset to {activeColor?.name || 'this color'}.
                                </div>
                            </div>
                            <button
                                onClick={() => setBrandPickerColorId(null)}
                                aria-label="Close brand picker"
                                className="text-gray-500 hover:text-white transition-colors"
                            >
                                <X size={16} />
                            </button>
                        </div>
                        <div className="max-h-[60vh] overflow-y-auto p-4 custom-scrollbar">
                            {brandAssets.length > 0 ? (
                                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                                    {brandAssets.map((asset, index) => (
                                        <button
                                            key={asset.id || `${asset.url}-${index}`}
                                            type="button"
                                            onClick={() => handleSelectBrandAsset(asset)}
                                            className="group relative overflow-hidden rounded-xl border border-white/10 bg-black/50 text-left transition-colors hover:border-green-500/50 focus-visible:ring-2 focus-visible:ring-green-500"
                                            aria-label={`Select Brand HQ asset ${asset.description || index + 1}`}
                                        >
                                            <img
                                                src={asset.url}
                                                alt={asset.description || `Brand HQ asset ${index + 1}`}
                                                className="aspect-square w-full object-cover opacity-90 group-hover:opacity-100 transition-opacity"
                                            />
                                            <div className="absolute inset-x-0 bottom-0 bg-linear-to-t from-black/85 to-transparent px-3 py-2">
                                                <div className="text-[11px] font-medium text-white line-clamp-2">
                                                    {asset.description || 'Brand HQ asset'}
                                                </div>
                                            </div>
                                        </button>
                                    ))}
                                </div>
                            ) : (
                                <div className="rounded-xl border border-dashed border-white/10 bg-white/[0.03] p-6 text-center text-xs text-gray-500">
                                    No Brand HQ assets found in your profile.
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </motion.div>
    );
}
