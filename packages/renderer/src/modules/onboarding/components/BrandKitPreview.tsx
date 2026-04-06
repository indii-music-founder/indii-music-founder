import React from 'react';
import { Sparkles, Edit3, RotateCcw, Check } from 'lucide-react';
import type { UserProfile } from '@/types/User';

interface BrandKitPreviewProps {
    userProfile: UserProfile;
    isEditingBio: boolean;
    editedBio: string;
    isRegenerating: boolean;
    onEditBio: () => void;
    onSaveBio: () => void;
    onCancelEdit: () => void;
    onRegenerateBio: () => void;
    onBioChange: (val: string) => void;
}

export function BrandKitPreview({
    userProfile,
    isEditingBio,
    editedBio,
    isRegenerating,
    onEditBio,
    onSaveBio,
    onCancelEdit,
    onRegenerateBio,
    onBioChange
}: BrandKitPreviewProps) {
    return (
        <div className="bg-white/[0.03] border border-white/5 rounded-2xl p-6 shadow-2xl backdrop-blur-xl group hover:border-white/10 transition-all duration-500">
            <h3 className="text-white font-bold text-lg mb-6 flex items-center gap-3">
                <div className="p-2 bg-purple-500/10 rounded-lg border border-purple-500/20">
                    <Sparkles size={18} className="text-purple-400 group-hover:rotate-12 transition-transform" />
                </div>
                Artist Identity
            </h3>

            {/* Bio Section */}
            <div className="mb-6">
                <div className="flex justify-between items-center mb-3">
                    <p className="text-[10px] text-gray-500 font-bold uppercase tracking-[0.15em]">Official Bio</p>
                    {userProfile.bio && !isEditingBio && (
                        <div className="flex gap-1">
                            <button
                                onClick={onRegenerateBio}
                                disabled={isRegenerating}
                                className="p-1.5 text-gray-500 hover:text-purple-400 transition-colors disabled:opacity-50"
                                title="Regenerate Bio"
                            >
                                <RotateCcw size={14} className={isRegenerating ? 'animate-spin' : ''} />
                            </button>
                            <button
                                onClick={onEditBio}
                                className="p-1.5 text-gray-500 hover:text-white transition-colors"
                            >
                                <Edit3 size={14} />
                            </button>
                        </div>
                    )}
                </div>

                {userProfile.bio || isEditingBio ? (
                    <div className="bg-black/20 rounded-xl p-4 border border-white/5 group-hover:bg-black/30 transition-colors">
                        {isEditingBio ? (
                            <div className="space-y-3">
                                <textarea
                                    value={editedBio}
                                    onChange={(e) => onBioChange(e.target.value)}
                                    className="w-full h-32 bg-white/5 border border-white/10 rounded-lg p-3 text-sm text-white focus:outline-none focus:border-purple-500/50 resize-none font-medium leading-relaxed"
                                    placeholder="Write your artist bio..."
                                />
                                <div className="flex justify-end gap-2">
                                    <button
                                        onClick={onCancelEdit}
                                        className="px-3 py-1.5 text-xs text-gray-400 hover:text-white transition-colors font-semibold"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        onClick={onSaveBio}
                                        className="px-4 py-1.5 text-xs bg-white text-black rounded-lg hover:bg-gray-200 transition-all font-bold flex items-center gap-1.5 shadow-lg shadow-white/5"
                                    >
                                        <Check size={12} strokeWidth={3} /> Save
                                    </button>
                                </div>
                            </div>
                        ) : (
                            <p className="text-sm text-gray-300 leading-relaxed font-normal">{userProfile.bio}</p>
                        )}
                    </div>
                ) : (
                    <div className="py-8 text-center bg-white/[0.02] rounded-xl border border-dashed border-white/5">
                        <p className="text-sm text-gray-600 italic mb-4 font-medium">Bio will appear here...</p>
                        <button
                            onClick={onEditBio}
                            className="text-xs bg-white/5 text-purple-400 hover:bg-purple-500/10 px-4 py-2 rounded-lg border border-purple-500/20 transition-all font-bold"
                        >
                            + Add manually
                        </button>
                    </div>
                )}
            </div>

            {/* Latest Release Summary */}
            {(userProfile.brandKit?.releaseDetails?.title || userProfile.brandKit?.releaseDetails?.genre) && (
                <div className="mt-8 pt-6 border-t border-white/5">
                    <p className="text-[10px] text-gray-500 mb-3 uppercase font-bold tracking-[0.15em]">Vision Target</p>
                    {userProfile.brandKit?.releaseDetails?.title && (
                        <p className="text-sm text-white font-bold mb-3 tracking-tight">{userProfile.brandKit?.releaseDetails?.title}</p>
                    )}
                    <div className="flex gap-2 text-[10px] items-center">
                        {userProfile.brandKit?.releaseDetails?.genre && (
                            <span className="bg-white/5 px-2.5 py-1.5 rounded-md text-gray-300 font-bold border border-white/5 uppercase tracking-wider">{userProfile.brandKit?.releaseDetails?.genre}</span>
                        )}
                        {userProfile.brandKit?.releaseDetails?.type && (
                            <span className="bg-purple-500/10 px-2.5 py-1.5 rounded-md text-purple-300 font-bold border border-purple-500/20 uppercase tracking-wider">{userProfile.brandKit?.releaseDetails?.type}</span>
                        )}
                    </div>
                </div>
            )}

            {/* Color Palette Preview */}
            {userProfile.brandKit?.colors && userProfile.brandKit.colors.length > 0 && (
                <div className="mt-8 pt-6 border-t border-white/5">
                    <p className="text-[10px] text-gray-500 mb-3 uppercase font-bold tracking-[0.15em]">Atmosphere</p>
                    <div className="flex gap-2 flex-wrap">
                        {userProfile.brandKit.colors.map((color: string, idx: number) => (
                            <div
                                key={idx}
                                className="w-9 h-9 rounded-xl border border-white/10 shadow-lg hover:scale-110 transition-transform cursor-help"
                                style={{ backgroundColor: color }}
                                title={color}
                            />
                        ))}
                    </div>
                </div>
            )}

            {/* Aesthetic, Fonts & Avoid Preview */}
            {(userProfile.brandKit?.aestheticStyle || userProfile.brandKit?.fonts || userProfile.brandKit?.negativePrompt) && (
                <div className="mt-8 pt-6 border-t border-white/5 space-y-6">
                    {userProfile.brandKit?.aestheticStyle && (
                        <div>
                            <p className="text-[10px] text-gray-500 uppercase font-bold tracking-[0.15em] mb-2">Visual Language</p>
                            <span className="inline-block text-[11px] uppercase font-bold tracking-widest text-purple-400 bg-purple-500/10 px-3 py-2 rounded-lg border border-purple-500/20">
                                {userProfile.brandKit.aestheticStyle}
                            </span>
                        </div>
                    )}
                    {userProfile.brandKit?.fonts && (
                        <div>
                            <p className="text-[10px] text-gray-500 uppercase font-bold tracking-[0.15em] mb-2">Typography</p>
                            <p className="text-sm text-gray-300 font-medium leading-relaxed">{userProfile.brandKit.fonts}</p>
                        </div>
                    )}
                    {userProfile.brandKit?.negativePrompt && (
                        <div>
                            <p className="text-[10px] text-gray-500 uppercase font-bold tracking-[0.15em] mb-2">Off-Brand (Avoid)</p>
                            <p className="text-sm text-gray-400 italic font-medium leading-relaxed">"{userProfile.brandKit.negativePrompt}"</p>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
