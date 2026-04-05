import React from 'react';
import {
    Disc, Activity, Shield, Hash, Users,
    Image as ImageIcon
} from 'lucide-react';
import { motion } from 'motion/react';
import { useToast } from '@/core/context/ToastContext';
import { TrackListEditor } from './BrandSubComponents';
import type { BrandManagerTabProps, TrackEntry } from './types';

interface ReleasePanelProps extends BrandManagerTabProps {}

const ReleasePanel: React.FC<ReleasePanelProps> = ({
    userProfile,
    brandKit,
    updateBrandKit,
    saveBrandKit,
    release,
}) => {
    const toast = useToast();

    const handleUpdateRelease = (field: string, value: string | TrackEntry[]) => {
        const newRelease = { ...release, [field]: value };
        updateBrandKit({ releaseDetails: newRelease });
    };

    const handleSaveRelease = async () => {
        if (!userProfile?.id) return;
        try {
            await saveBrandKit({ releaseDetails: release });
            toast.success("Release details saved");
        } catch (_e: unknown) {
            toast.error("Failed to save release details");
        }
    };

    return (
        <motion.div
            key="release"
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.98 }}
            transition={{ duration: 0.2 }}
            className="bg-[#111] rounded-2xl border border-gray-800 overflow-hidden shadow-2xl relative"
        >
            {/* Header Section */}
            <div className="p-8 border-b border-gray-800 bg-[#0a0a0a] relative overflow-hidden">
                <div className="absolute top-0 right-0 p-32 bg-dept-marketing/5 blur-[80px] rounded-full pointer-events-none" />

                <div className="flex flex-col md:flex-row gap-8 relative z-10">
                    {/* Cover Art Placeholder */}
                    <div className="shrink-0 group">
                        <div className="w-48 h-48 bg-[#111] border border-gray-800 rounded shadow-2xl flex flex-col items-center justify-center text-gray-600 hover:border-dept-marketing/50 transition-colors cursor-pointer relative overflow-hidden">
                            {release.coverArtUrl ? (
                                <img src={release.coverArtUrl} alt="Cover" className="w-full h-full object-cover" />
                            ) : (
                                <>
                                    <ImageIcon size={32} className="mb-2 opacity-50 group-hover:opacity-100 transition-opacity" />
                                    <span className="text-[9px] font-bold uppercase tracking-widest text-center px-4">Upload Artwork<br />(3000x3000px)</span>
                                </>
                            )}
                        </div>
                    </div>

                    {/* Release Info */}
                    <div className="flex-1 space-y-4">
                        <div>
                            <div className="flex items-center justify-between mb-2">
                                <label className="text-[9px] text-dept-marketing font-bold uppercase tracking-[0.2em]">Mission Architect</label>
                                <input
                                    type="date"
                                    value={release.releaseDate || ''}
                                    onChange={(e) => { handleUpdateRelease('releaseDate', e.target.value); handleSaveRelease(); }}
                                    className="bg-transparent border-none text-[10px] uppercase font-bold text-gray-500 focus:text-white focus:ring-0 p-0 text-right"
                                />
                            </div>
                            <input
                                type="text"
                                value={release.title}
                                onChange={(e) => handleUpdateRelease('title', e.target.value)}
                                onBlur={handleSaveRelease}
                                className="text-5xl md:text-6xl font-black text-white bg-transparent border-none focus:ring-0 p-0 w-full placeholder:text-gray-800 tracking-tight leading-none"
                                placeholder="UNTITLED PROJECT"
                            />
                        </div>

                        <div className="flex flex-wrap items-center gap-4">
                            <div className="flex items-center gap-3 bg-white/5 border border-white/10 rounded-lg px-4 py-2">
                                <Disc size={14} className="text-dept-marketing" />
                                <select
                                    value={release.type}
                                    onChange={(e) => { handleUpdateRelease('type', e.target.value); handleSaveRelease(); }}
                                    className="bg-transparent border-none text-xs font-bold text-gray-200 focus:ring-0 p-0 min-w-[60px] cursor-pointer"
                                >
                                    <option value="Single" className="bg-[#111]">Single</option>
                                    <option value="EP" className="bg-[#111]">EP</option>
                                    <option value="Album" className="bg-[#111]">Album</option>
                                </select>
                            </div>
                            <div className="h-4 w-px bg-gray-800 hidden md:block" />
                            <div className="flex items-center gap-3 bg-[#151515] border border-gray-800 rounded-lg px-4 py-2 flex-1 max-w-sm hover:border-gray-700 transition-colors">
                                <Hash size={14} className="text-purple-500 opacity-50" />
                                <input
                                    type="text"
                                    value={release.genre}
                                    onChange={(e) => handleUpdateRelease('genre', e.target.value)}
                                    onBlur={handleSaveRelease}
                                    placeholder="Genre (e.g. Neo-Soul)"
                                    className="bg-transparent border-none text-white focus:ring-0 p-0 text-xs font-bold w-full placeholder:text-gray-600"
                                />
                            </div>
                            <div className="flex items-center gap-3 bg-[#151515] border border-gray-800 rounded-lg px-4 py-2 hover:border-gray-700 transition-colors">
                                <Users size={14} className="text-blue-500 opacity-50" />
                                <input
                                    type="text"
                                    value={release.artists}
                                    onChange={(e) => handleUpdateRelease('artists', e.target.value)}
                                    onBlur={handleSaveRelease}
                                    placeholder="feat. Artists"
                                    className="bg-transparent border-none text-white focus:ring-0 p-0 text-xs font-bold w-full placeholder:text-gray-600 min-w-[100px]"
                                />
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <div className="p-8 grid grid-cols-1 lg:grid-cols-12 gap-8">
                {/* Left Column: Vibes */}
                <div className="lg:col-span-7 space-y-6">
                    <div className="space-y-3">
                        <div className="flex items-center gap-2 text-gray-500 mb-2">
                            <Activity size={12} className="text-red-400" />
                            <span className="text-[10px] font-bold uppercase tracking-widest">Atmosphere & Mood</span>
                        </div>
                        <textarea
                            value={release.mood}
                            onChange={(e) => handleUpdateRelease('mood', e.target.value)}
                            onBlur={handleSaveRelease}
                            className="w-full h-24 bg-[#0a0a0a] border border-gray-800 rounded-xl p-4 text-xs font-medium text-gray-300 focus:border-dept-marketing/30 focus:ring-1 focus:ring-dept-marketing/10 outline-none resize-none custom-scrollbar leading-relaxed"
                            placeholder="Describe the sonic and visual atmosphere..."
                        />
                    </div>
                    <div className="space-y-3">
                        <div className="flex items-center gap-2 text-gray-500 mb-2">
                            <Shield size={12} className="text-blue-400" />
                            <span className="text-[10px] font-bold uppercase tracking-widest">Conceptual Themes</span>
                        </div>
                        <textarea
                            value={release.themes}
                            onChange={(e) => handleUpdateRelease('themes', e.target.value)}
                            onBlur={handleSaveRelease}
                            className="w-full h-24 bg-[#0a0a0a] border border-gray-800 rounded-xl p-4 text-xs font-medium text-gray-300 focus:border-dept-marketing/30 focus:ring-1 focus:ring-dept-marketing/10 outline-none resize-none custom-scrollbar leading-relaxed"
                            placeholder="Translate the artistry into narrative goals..."
                        />
                    </div>
                </div>

                {/* Right Column: Tracklist */}
                <div className="lg:col-span-5 border-l border-gray-800 pl-8 space-y-4">
                    <div className="flex items-center justify-between">
                        <h3 className="text-[10px] font-bold text-gray-500 uppercase tracking-widest flex items-center gap-2">
                            <Disc size={12} />
                            Tracklist ({release.tracks?.length || 0})
                        </h3>
                    </div>
                    {(release.type === 'EP' || release.type === 'Album') ? (
                        <TrackListEditor
                            tracks={release.tracks || []}
                            onChange={(newTracks) => { handleUpdateRelease('tracks', newTracks); handleSaveRelease(); }}
                        />
                    ) : (
                        <div className="p-8 border border-dashed border-gray-800 rounded-xl text-center">
                            <Disc size={24} className="mx-auto text-gray-700 mb-2" />
                            <p className="text-xs text-gray-500">Tracklist available for<br />EP & Album types.</p>
                        </div>
                    )}
                </div>
            </div>
        </motion.div>
    );
};

export default ReleasePanel;
