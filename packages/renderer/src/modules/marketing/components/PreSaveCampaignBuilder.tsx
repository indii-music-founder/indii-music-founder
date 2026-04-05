import React, { useState } from 'react';
import {
    Music, Calendar, Link2, Copy, Share2, CheckCircle,
    Mail, Phone, QrCode, Globe, ExternalLink
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface DSPLink {
    name: string;
    icon: string;
    url: string;
    placeholder: string;
}

const DSP_LINKS: DSPLink[] = [
    { name: 'Spotify', icon: '🎧', url: '', placeholder: 'https://open.spotify.com/album/...' },
    { name: 'Apple Music', icon: '', url: '', placeholder: 'https://music.apple.com/album/...' },
    { name: 'Amazon Music', icon: '🎵', url: '', placeholder: 'https://music.amazon.com/albums/...' },
];

function slugify(text: string): string {
    return text
        .toLowerCase()
        .replace(/[^a-z0-9\s-]/g, '')
        .replace(/\s+/g, '-')
        .slice(0, 30);
}

export default function PreSaveCampaignBuilder() {
    const [trackTitle, setTrackTitle] = useState('');
    const [releaseDate, setReleaseDate] = useState('');
    const [dspLinks, setDspLinks] = useState(DSP_LINKS.map(d => ({ ...d })));
    const [collectEmail, setCollectEmail] = useState(true);
    const [collectPhone, setCollectPhone] = useState(false);
    const [copied, setCopied] = useState(false);

    const slug = slugify(trackTitle) || 'your-track';
    const campaignUrl = `indii.vip/presave/${slug}`;

    const handleDspChange = (idx: number, val: string) => {
        setDspLinks(prev => prev.map((d, i) => (i === idx ? { ...d, url: val } : d)));
    };

    const handleCopyLink = () => {
        void navigator.clipboard.writeText(`https://${campaignUrl}`);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    return (
        <div className="flex flex-col gap-6 p-6 max-w-2xl">
            {/* Header */}
            <div>
                <h2 className="text-lg font-bold text-white flex items-center gap-2">
                    <Music size={18} className="text-dept-marketing" />
                    Pre-Save Campaign Builder
                </h2>
                <p className="text-xs text-gray-500 mt-1">Build a pre-save landing page and collect fan data before release.</p>
            </div>

            {/* Release Info */}
            <div className="grid grid-cols-2 gap-3">
                <div>
                    <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1.5 block">
                        Track / Release Title
                    </label>
                    <input
                        type="text"
                        value={trackTitle}
                        onChange={e => setTrackTitle(e.target.value)}
                        placeholder="e.g. Midnight Frequencies"
                        className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm text-white placeholder-gray-600 focus:border-dept-marketing/50 outline-none"
                    />
                </div>
                <div>
                    <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1.5 flex items-center gap-1">
                        <Calendar size={10} /> Release Date
                    </label>
                    <input
                        type="date"
                        value={releaseDate}
                        onChange={e => setReleaseDate(e.target.value)}
                        className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm text-gray-300 focus:border-dept-marketing/50 outline-none"
                    />
                </div>
            </div>

            {/* DSP Links */}
            <div>
                <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2 flex items-center gap-1">
                    <Link2 size={10} /> DSP Pre-Add Links
                </label>
                <div className="space-y-2">
                    {dspLinks.map((dsp, idx) => (
                        <div key={dsp.name} className="flex items-center gap-2">
                            <span className="text-base w-6 flex-shrink-0">{dsp.icon}</span>
                            <span className="text-xs text-gray-400 w-20 flex-shrink-0">{dsp.name}</span>
                            <input
                                type="url"
                                value={dsp.url}
                                onChange={e => handleDspChange(idx, e.target.value)}
                                placeholder={dsp.placeholder}
                                className="flex-1 px-3 py-1.5 bg-white/5 border border-white/10 rounded-lg text-xs text-white placeholder-gray-700 focus:border-dept-marketing/50 outline-none"
                            />
                        </div>
                    ))}
                </div>
            </div>

            {/* Data Collection Toggles */}
            <div>
                <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2 block">
                    Collect Fan Data
                </label>
                <div className="flex gap-3">
                    <button
                        onClick={() => setCollectEmail(v => !v)}
                        className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                            collectEmail
                                ? 'bg-dept-marketing/15 border border-dept-marketing/30 text-dept-marketing'
                                : 'bg-white/5 border border-white/10 text-gray-500'
                        }`}
                    >
                        <Mail size={13} />
                        Email
                        {collectEmail && <CheckCircle size={11} />}
                    </button>
                    <button
                        onClick={() => setCollectPhone(v => !v)}
                        className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                            collectPhone
                                ? 'bg-dept-marketing/15 border border-dept-marketing/30 text-dept-marketing'
                                : 'bg-white/5 border border-white/10 text-gray-500'
                        }`}
                    >
                        <Phone size={13} />
                        Phone
                        {collectPhone && <CheckCircle size={11} />}
                    </button>
                </div>
            </div>

            {/* Landing Page Preview */}
            <div>
                <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2 flex items-center gap-1">
                    <Globe size={10} /> Landing Page Preview
                </label>
                <div className="rounded-xl border border-white/10 overflow-hidden bg-[#0a0a0a]">
                    {/* Browser Chrome */}
                    <div className="flex items-center gap-1.5 px-3 py-2 bg-white/5 border-b border-white/5">
                        <span className="w-2.5 h-2.5 rounded-full bg-red-500/60" />
                        <span className="w-2.5 h-2.5 rounded-full bg-yellow-500/60" />
                        <span className="w-2.5 h-2.5 rounded-full bg-green-500/60" />
                        <div className="flex-1 mx-2 px-2 py-0.5 bg-white/5 rounded text-[9px] text-gray-600 font-mono">
                            https://{campaignUrl}
                        </div>
                        <ExternalLink size={9} className="text-gray-600" />
                    </div>
                    {/* Page Content */}
                    <div className="p-6 flex flex-col items-center gap-4 min-h-40">
                        {/* Album art placeholder */}
                        <div className="w-24 h-24 rounded-xl bg-gradient-to-br from-dept-marketing/30 to-purple-600/30 border border-white/10 flex items-center justify-center">
                            <Music size={28} className="text-dept-marketing/60" />
                        </div>
                        <div className="text-center">
                            <p className="text-sm font-bold text-white">
                                {trackTitle || 'Your Track Title'}
                            </p>
                            <p className="text-[10px] text-gray-500 mt-0.5">
                                {releaseDate ? `Releasing ${new Date(releaseDate + 'T00:00:00').toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}` : 'Coming Soon'}
                            </p>
                        </div>
                        <div className="flex gap-2 flex-wrap justify-center">
                            {dspLinks.map(d => (
                                <div key={d.name} className="px-3 py-1.5 rounded-lg bg-white/10 text-[10px] text-gray-300 font-medium">
                                    {d.icon} Pre-save on {d.name}
                                </div>
                            ))}
                        </div>
                        {(collectEmail || collectPhone) && (
                            <div className="flex gap-2 mt-1">
                                {collectEmail && (
                                    <div className="px-3 py-1 rounded bg-white/5 border border-white/10 text-[9px] text-gray-600 flex items-center gap-1">
                                        <Mail size={8} /> email input
                                    </div>
                                )}
                                {collectPhone && (
                                    <div className="px-3 py-1 rounded bg-white/5 border border-white/10 text-[9px] text-gray-600 flex items-center gap-1">
                                        <Phone size={8} /> phone input
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Campaign URL + QR */}
            <div className="flex items-center gap-3 p-4 rounded-xl bg-white/[0.03] border border-white/5">
                {/* QR Code Placeholder */}
                <div className="w-14 h-14 rounded-lg bg-white/5 border border-white/10 flex-shrink-0 flex items-center justify-center">
                    <QrCode size={22} className="text-gray-600" />
                </div>
                <div className="flex-1 min-w-0">
                    <p className="text-[10px] text-gray-500 mb-0.5">Campaign URL</p>
                    <p className="text-xs font-mono text-dept-marketing truncate">https://{campaignUrl}</p>
                </div>
                <div className="flex flex-col gap-1.5">
                    <button
                        onClick={handleCopyLink}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-xs text-gray-300 hover:border-white/20 transition-all"
                    >
                        {copied ? <CheckCircle size={12} className="text-green-400" /> : <Copy size={12} />}
                        {copied ? 'Copied!' : 'Copy'}
                    </button>
                    <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-xs text-gray-300 hover:border-white/20 transition-all">
                        <Share2 size={12} />
                        Share
                    </button>
                </div>
            </div>
        </div>
    );
}
