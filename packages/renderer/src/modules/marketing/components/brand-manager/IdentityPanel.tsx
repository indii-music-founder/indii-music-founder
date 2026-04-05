import React, { useState } from 'react';
import { Edit2, X, Check, Globe } from 'lucide-react';
import { motion } from 'motion/react';
import { useToast } from '@/core/context/ToastContext';
import { logger } from '@/utils/logger';
import { SocialLinksManager } from './BrandSubComponents';
import type { BrandManagerTabProps } from './types';

interface IdentityPanelProps extends BrandManagerTabProps {}

const IdentityPanel: React.FC<IdentityPanelProps> = ({
    userProfile,
    brandKit,
    updateBrandKit,
    saveBrandKit,
    setUserProfile,
}) => {
    const toast = useToast();
    const [isEditingBio, setIsEditingBio] = useState(false);
    const [bioDraft, setBioDraft] = useState('');

    const handleSaveBio = async () => {
        if (!userProfile?.id) {
            logger.error("[BrandManager] Save failed: No userProfile.id");
            return;
        }
        logger.info(`[BrandManager] Saving bio for user: ${userProfile.id}`, { bioDraft });

        try {
            const updatedProfile = { ...userProfile, bio: bioDraft };

            // This triggers ProfileSlice.setUserProfile -> saveProfileToStorage
            // which saves to LocalDB AND Firestore (if auth ID matches).
            setUserProfile(updatedProfile);

            logger.info("[BrandManager] Bio save triggered via ProfileSlice");
            setIsEditingBio(false);
            toast.success("Bio updated");
        } catch (e: unknown) {
            logger.error("[BrandManager] Bio save error:", e);
            toast.error("Failed to save bio");
        }
    };

    return (
        <motion.div
            key="identity"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
            className="grid grid-cols-1 lg:grid-cols-3 gap-6"
        >
            {/* Bio Card */}
            <div className="lg:col-span-2 space-y-6">
                <div className="p-6 rounded-xl border border-gray-800 bg-[#111]">
                    <div className="flex justify-between items-start mb-6">
                        <div>
                            <h3 className="text-lg font-bold text-gray-200 flex items-center gap-2">
                                Identity Bio
                            </h3>
                            <p className="text-[10px] text-gray-500 mt-1 uppercase tracking-widest font-bold">Public Perspective</p>
                        </div>
                        {!isEditingBio ? (
                            <button
                                onClick={() => { setBioDraft(userProfile?.bio || ''); setIsEditingBio(true); }}
                                className="p-2 hover:bg-white/5 rounded-lg text-gray-500 hover:text-white transition-all"
                                aria-label="Edit bio"
                            >
                                <Edit2 size={14} />
                            </button>
                        ) : (
                            <div className="flex gap-2">
                                <button
                                    onClick={() => setIsEditingBio(false)}
                                    className="p-2 hover:bg-red-500/10 rounded-lg text-red-500 transition-all border border-red-500/20"
                                    aria-label="Cancel editing"
                                >
                                    <X size={14} />
                                </button>
                                <button
                                    onClick={handleSaveBio}
                                    className="p-2 hover:bg-emerald-500/10 rounded-lg text-emerald-500 transition-all border border-emerald-500/20"
                                    aria-label="Save bio"
                                >
                                    <Check size={14} />
                                </button>
                            </div>
                        )}
                    </div>

                    {isEditingBio ? (
                        <textarea
                            value={bioDraft}
                            onChange={(e) => setBioDraft(e.target.value)}
                            className="w-full h-80 bg-black/40 border border-white/10 rounded-lg p-4 text-sm text-gray-300 focus:border-dept-marketing/50 focus:ring-1 focus:ring-dept-marketing/20 outline-none transition-all leading-relaxed custom-scrollbar"
                            placeholder="Tell your story..."
                        />
                    ) : (
                        <div className="prose prose-invert max-w-none text-gray-400 leading-relaxed whitespace-pre-wrap text-sm font-medium">
                            {userProfile?.bio || <span className="text-gray-600 italic">No bio written yet. Start by editing this section.</span>}
                        </div>
                    )}
                </div>
            </div>

            {/* Stats / Quick Info */}
            <div className="space-y-6">
                {/* Socials / Digital Footprint */}
                <div className="p-6 rounded-xl border border-gray-800 bg-[#111]">
                    <h3 className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-4 flex items-center gap-2">
                        <Globe size={12} /> Digital Footprint
                    </h3>
                    <SocialLinksManager
                        socials={brandKit.socials || {}}
                        onChange={(newSocials) => {
                            updateBrandKit({ socials: newSocials });
                            saveBrandKit({ socials: newSocials });
                        }}
                    />
                </div>

                <div className="p-6 rounded-xl border border-gray-800 bg-[#111]">
                    <h3 className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-6">Mission Stats</h3>
                    <div className="space-y-4">
                        <div className="p-3 rounded-lg bg-[#0a0a0a] border border-gray-800">
                            <label className="text-[9px] text-gray-500 font-bold uppercase tracking-wider block mb-2">Primary Aesthetic</label>
                            <div className="text-sm font-bold text-gray-200">
                                {brandKit.brandDescription || 'Not Defined'}
                            </div>
                        </div>
                        <div className="p-3 rounded-lg bg-[#0a0a0a] border border-gray-800">
                            <label className="text-[9px] text-gray-500 font-bold uppercase tracking-wider block mb-2">A&R Sentiment</label>
                            <div className="flex items-center gap-2">
                                <div className="h-1.5 flex-1 bg-white/5 rounded-full overflow-hidden">
                                    <div className="h-full bg-dept-marketing" style={{ width: '75%' }} />
                                </div>
                                <span className="text-[10px] font-bold text-dept-marketing">75%</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </motion.div>
    );
};

export default IdentityPanel;
