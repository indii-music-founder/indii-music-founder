import React, { useState, useEffect } from 'react';
import { ExtendedGoldenMetadata } from '@/services/metadata/types';
import { AudioIntelligenceProfile } from '@/services/audio/types';
import { DDEXMapper } from '@/services/ddex/DDEXMapper';

interface MetadataEditorProps {
    initialMetadata?: Partial<ExtendedGoldenMetadata>;
    audioProfile?: AudioIntelligenceProfile;
    onSave: (metadata: ExtendedGoldenMetadata) => void;
}

export const MetadataEditor: React.FC<MetadataEditorProps> = ({ initialMetadata, audioProfile, onSave }) => {
    // Merge AI data if available and not overridden
    const [metadata, setMetadata] = useState<Partial<ExtendedGoldenMetadata>>(initialMetadata || {});

    useEffect(() => {
        if (audioProfile) {
            const aiMetadata = DDEXMapper.mapAudioProfileToMetadata(audioProfile);
            setMetadata(prev => ({
                ...prev,
                ...aiMetadata,
                // Preserve user-entered title/artist if they exist
                releaseTitle: prev.releaseTitle,
                trackTitle: prev.trackTitle,
            }));
        }
    }, [audioProfile]);

    const handleChange = (field: keyof ExtendedGoldenMetadata, value: any) => {
        setMetadata(prev => ({ ...prev, [field]: value }));
    };

    return (
        <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-6 shadow-2xl text-white">
            <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-purple-400 to-pink-400">
                    Release Metadata
                </h2>
                {audioProfile?.semantic && (
                    <div className="flex items-center gap-2 text-xs font-mono text-emerald-400 bg-emerald-400/10 px-3 py-1 rounded-full border border-emerald-400/20">
                        <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                        AI ENHANCED
                    </div>
                )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Core Info */}
                <div className="space-y-4">
                    <h3 className="text-sm font-semibold text-white/50 uppercase tracking-widest">Core Details</h3>

                    <div className="group">
                        <label className="block text-xs text-white/40 mb-1 group-focus-within:text-purple-400 transition-colors">Release Title</label>
                        <input
                            type="text"
                            className="w-full bg-black/20 border border-white/10 rounded-lg px-4 py-3 focus:outline-none focus:border-purple-500 transition-all font-medium placeholder-white/20"
                            placeholder="e.g. Midnight City"
                            value={metadata.releaseTitle || ''}
                            onChange={(e) => handleChange('releaseTitle', e.target.value)}
                        />
                    </div>

                    <div className="group">
                        <label className="block text-xs text-white/40 mb-1 group-focus-within:text-purple-400 transition-colors">Artist Name</label>
                        <input
                            type="text"
                            className="w-full bg-black/20 border border-white/10 rounded-lg px-4 py-3 focus:outline-none focus:border-purple-500 transition-all font-medium placeholder-white/20"
                            placeholder="e.g. M83"
                            value={metadata.artistName || ''}
                            onChange={(e) => handleChange('artistName', e.target.value)}
                        />
                    </div>
                </div>

                {/* Classification */}
                <div className="space-y-4">
                    <h3 className="text-sm font-semibold text-white/50 uppercase tracking-widest">Classification</h3>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="group">
                            <label className="block text-xs text-white/40 mb-1 group-focus-within:text-purple-400 transition-colors">Genre</label>
                            <input
                                type="text"
                                className="w-full bg-black/20 border border-white/10 rounded-lg px-4 py-3 focus:outline-none focus:border-purple-500 transition-all font-medium placeholder-white/20"
                                value={metadata.genre || ''}
                                onChange={(e) => handleChange('genre', e.target.value)}
                            />
                        </div>
                        <div className="group">
                            <label className="block text-xs text-white/40 mb-1 group-focus-within:text-purple-400 transition-colors">Sub-Genre</label>
                            <input
                                type="text"
                                className="w-full bg-black/20 border border-white/10 rounded-lg px-4 py-3 focus:outline-none focus:border-purple-500 transition-all font-medium placeholder-white/20"
                                value={metadata.subGenre || ''}
                                onChange={(e) => handleChange('subGenre', e.target.value)}
                            />
                        </div>
                    </div>

                    <div className="flex gap-4 items-center pt-2">
                        <div className="flex items-center gap-2">
                            <input
                                type="checkbox"
                                id="explicit"
                                className="w-5 h-5 rounded border-white/20 bg-white/5 text-purple-600 focus:ring-purple-500 focus:ring-offset-0"
                                checked={metadata.explicit || false}
                                onChange={(e) => handleChange('explicit', e.target.checked)}
                            />
                            <label htmlFor="explicit" className="text-sm text-white/70 select-none cursor-pointer">Explicit Content</label>
                        </div>

                        <div className="flex items-center gap-2">
                            {/* Language Selector could go here */}
                            <span className="text-xs text-white/30 uppercase px-2 py-1 border border-white/10 rounded">
                                {metadata.language || 'ENG'}
                            </span>
                        </div>
                    </div>
                </div>
            </div>

            {/* AI Insights Section */}
            {audioProfile?.semantic && (
                <div className="mt-8 pt-6 border-t border-white/5">
                    <h3 className="text-sm font-semibold text-white/50 uppercase tracking-widest mb-4">AI Analysis (CLIP)</h3>
                    <div className="flex flex-wrap gap-2">
                        {audioProfile.semantic.mood?.map((m, i) => (
                            <span key={i} className="px-3 py-1 bg-purple-500/10 border border-purple-500/20 rounded-full text-xs text-purple-300">
                                {m}
                            </span>
                        ))}
                        {audioProfile.semantic.instruments?.map((inst, i) => (
                            <span key={i} className="px-3 py-1 bg-blue-500/10 border border-blue-500/20 rounded-full text-xs text-blue-300">
                                {inst}
                            </span>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
};
