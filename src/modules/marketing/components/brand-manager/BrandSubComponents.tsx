import React from 'react';
import {
    ChevronDown, Plus, Trash2, Clock, Globe, Instagram, Twitter,
    Youtube, Music, GripVertical, ExternalLink
} from 'lucide-react';
import { SocialLinks } from '@/types/User';
import type { TrackEntry } from './types';

// --- Career Stage Selector ---

export const CareerStageSelector = ({ value, onChange }: { value: string; onChange: (val: string) => void }) => {
    const stages = ['Emerging', 'Rising', 'Established', 'Icon'];
    return (
        <div className="relative group z-30 inline-block w-full">
            <select
                value={value || 'Emerging'}
                onChange={(e) => onChange(e.target.value)}
                className="w-full appearance-none bg-[#0a0a0a] border border-gray-800 rounded-lg px-3 py-2 text-sm font-bold text-white focus:border-dept-marketing/50 focus:ring-1 focus:ring-dept-marketing/20 outline-none cursor-pointer hover:border-gray-600 transition-colors"
            >
                {stages.map(s => <option key={s} value={s} className="bg-[#111] text-gray-200">{s}</option>)}
            </select>
            <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-dept-marketing pointer-events-none" />
        </div>
    );
};

// --- Font Selector ---

export const FontSelector = ({ value, onChange }: { value: string; onChange: (val: string) => void }) => {
    // Curated Google Fonts selection (Safe web fonts + popular Google Fonts)
    const fonts = [
        'Inter', 'Roboto', 'Open Sans', 'Lato', 'Montserrat',
        'Oswald', 'Playfair Display', 'Merriweather', 'Courier Prime',
        'Space Mono', 'Syne', 'Outfit'
    ];

    return (
        <div className="relative group">
            <select
                value={value || 'Inter'}
                onChange={(e) => onChange(e.target.value)}
                className="w-full bg-[#0a0a0a] border border-gray-800 rounded-lg pl-3 pr-8 py-1.5 text-xs font-bold text-white focus:border-dept-marketing/50 focus:ring-1 focus:ring-dept-marketing/20 outline-none appearance-none cursor-pointer hover:border-gray-600 transition-colors"
                style={{ fontFamily: value || 'Inter' }}
                aria-label="Select typography"
            >
                {fonts.map(f => (
                    <option key={f} value={f} style={{ fontFamily: f }} className="bg-[#111] py-2">
                        {f}
                    </option>
                ))}
            </select>
            <ChevronDown size={12} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none group-hover:text-white transition-colors" />
        </div>
    );
};

// --- Social Links Manager ---

export const SocialLinksManager = ({ socials, onChange }: { socials: SocialLinks; onChange: (s: SocialLinks) => void }) => {
    const platforms = [
        { key: 'instagram', icon: Instagram, label: 'Instagram' },
        { key: 'twitter', icon: Twitter, label: 'Twitter/X' },
        { key: 'youtube', icon: Youtube, label: 'YouTube' },
        { key: 'spotify', icon: Music, label: 'Spotify' },
        { key: 'website', icon: Globe, label: 'Website' },
    ] as const;

    const handleChange = (key: keyof SocialLinks, val: string) => {
        onChange({ ...socials, [key]: val });
    };

    return (
        <div className="space-y-3">
            {platforms.map(p => (
                <div key={p.key} className="flex items-center gap-3 group">
                    <div className="w-8 h-8 rounded-lg bg-[#0a0a0a] border border-gray-800 flex items-center justify-center text-gray-500 group-hover:text-white group-hover:border-gray-600 transition-all shrink-0">
                        <p.icon size={14} />
                    </div>
                    <input
                        type="text"
                        value={socials?.[p.key] || ''}
                        onChange={(e) => handleChange(p.key, e.target.value)}
                        placeholder={`Add ${p.label} URL...`}
                        className="flex-1 bg-transparent border-b border-gray-800 text-xs text-gray-300 py-1.5 focus:border-dept-marketing/50 focus:outline-none transition-colors placeholder:text-gray-700 font-medium min-w-0"
                    />
                    {socials?.[p.key] && (
                        <a href={socials[p.key]} target="_blank" rel="noreferrer" className="text-gray-600 hover:text-dept-marketing transition-colors shrink-0">
                            <ExternalLink size={12} />
                        </a>
                    )}
                </div>
            ))}
        </div>
    );
};

// --- Track List Editor ---

export const TrackListEditor = ({ tracks, onChange }: { tracks: TrackEntry[]; onChange: (t: TrackEntry[]) => void }) => {
    const addTrack = () => onChange([...tracks, { title: '', duration: '', collaborators: '' }]);
    const updateTrack = (idx: number, field: string, val: string) => {
        const newTracks = [...tracks];
        newTracks[idx] = { ...newTracks[idx], [field]: val } as TrackEntry;
        onChange(newTracks);
    };
    const removeTrack = (idx: number) => {
        const newTracks = [...tracks];
        newTracks.splice(idx, 1);
        onChange(newTracks);
    };

    return (
        <div className="space-y-2">
            {tracks?.map((track, idx) => (
                <div key={idx} className="flex items-center gap-3 bg-[#0a0a0a] p-2 rounded-lg border border-gray-800 group">
                    <GripVertical size={14} className="text-gray-600 cursor-grab" />
                    <span className="text-[10px] text-gray-500 font-mono w-4">{idx + 1}</span>
                    <input
                        value={track.title}
                        onChange={(e) => updateTrack(idx, 'title', e.target.value)}
                        className="flex-1 bg-transparent border-none text-sm text-white focus:ring-0 p-0 placeholder:text-gray-700 font-medium"
                        placeholder="Track Title"
                    />
                    <div className="flex items-center gap-2 bg-[#111] px-2 py-1 rounded text-gray-400">
                        <Clock size={10} />
                        <input
                            value={track.duration}
                            onChange={(e) => updateTrack(idx, 'duration', e.target.value)}
                            className="w-10 bg-transparent border-none text-xs focus:ring-0 p-0 text-center"
                            placeholder="0:00"
                        />
                    </div>
                    <button onClick={() => removeTrack(idx)} className="text-gray-600 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity">
                        <Trash2 size={12} />
                    </button>
                </div>
            ))}
            <button onClick={addTrack} className="w-full py-2 border border-dashed border-gray-800 rounded-lg text-xs text-gray-500 hover:text-gray-300 hover:border-gray-600 transition-all flex items-center justify-center gap-2">
                <Plus size={12} /> Add Track
            </button>
        </div>
    );
};
