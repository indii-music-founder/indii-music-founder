import React, { useState } from 'react';
import {
    FileText, Image as ImageIcon, Tag, Link2, Music,
    ExternalLink, Copy, Download, CheckCircle, Globe, Loader2
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface Track {
    title: string;
    year: string;
    streams: string;
}

const DEFAULT_BIO = `An independent artist blending soul, electronic, and hip-hop into a sound entirely their own. With a catalog spanning three EPs and dozens of live performances, they've carved a dedicated audience on the strength of raw emotion and genre-defying production.`;

const DEFAULT_TRACKS: Track[] = [
    { title: 'Midnight Frequencies', year: '2025', streams: '1.2M' },
    { title: 'Static Love', year: '2025', streams: '847K' },
    { title: 'Signal Loss', year: '2024', streams: '2.1M' },
];

const GENRE_OPTIONS = ['Hip-Hop', 'R&B', 'Electronic', 'Soul', 'Afrobeats', 'Pop', 'Alternative', 'Jazz'];

function slugify(text: string): string {
    return text.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '').slice(0, 24) || 'artist';
}

export default function EPKGenerator() {
    const [artistName, setArtistName] = useState('');
    const [bio, setBio] = useState(DEFAULT_BIO);
    const [genreTags, setGenreTags] = useState<string[]>(['Hip-Hop', 'Electronic']);
    const [spotifyUrl, setSpotifyUrl] = useState('');
    const [appleMusicUrl, setAppleMusicUrl] = useState('');
    const [instagramUrl, setInstagramUrl] = useState('');
    const [tracks] = useState<Track[]>(DEFAULT_TRACKS);
    const [generating, setGenerating] = useState(false);
    const [generated, setGenerated] = useState(false);
    const [copied, setCopied] = useState(false);

    const slug = slugify(artistName || 'your-artist');
    const epkUrl = `indii.vip/artist/${slug}/epk`;

    const toggleGenre = (g: string) => {
        setGenreTags(prev =>
            prev.includes(g) ? prev.filter(t => t !== g) : [...prev, g]
        );
    };

    const handleGenerate = () => {
        setGenerating(true);
        setTimeout(() => {
            setGenerating(false);
            setGenerated(true);
        }, 1800);
    };

    const handleCopyLink = () => {
        void navigator.clipboard.writeText(`https://${epkUrl}`);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    const handleDownloadPDF = () => {
        const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>EPK - ${artistName || 'Artist'}</title>
  <style>
    body { font-family: 'Helvetica Neue', sans-serif; max-width: 800px; margin: 0 auto; padding: 40px; background: #fff; color: #111; }
    h1 { font-size: 36px; font-weight: 800; margin-bottom: 4px; }
    .tags { display: flex; gap: 8px; flex-wrap: wrap; margin: 12px 0; }
    .tag { background: #f0f0f0; padding: 4px 12px; border-radius: 20px; font-size: 12px; font-weight: 600; }
    .bio { font-size: 15px; line-height: 1.8; color: #444; margin: 20px 0; }
    .section-title { font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.1em; color: #888; margin: 28px 0 12px; }
    .track { display: flex; justify-content: space-between; padding: 10px 0; border-bottom: 1px solid #eee; font-size: 14px; }
    .links a { display: inline-block; margin-right: 16px; color: #555; font-size: 13px; text-decoration: none; }
    .epk-url { font-size: 12px; color: #888; margin-top: 32px; }
  </style>
</head>
<body>
  <h1>${artistName || 'Artist Name'}</h1>
  <div class="tags">${genreTags.map(t => `<span class="tag">${t}</span>`).join('')}</div>
  <p class="bio">${bio}</p>
  <div class="section-title">Recent Releases</div>
  ${tracks.map(t => `<div class="track"><span>${t.title}</span><span>${t.year} &nbsp;·&nbsp; ${t.streams} streams</span></div>`).join('')}
  <div class="section-title">Links</div>
  <div class="links">
    ${spotifyUrl ? `<a href="${spotifyUrl}">Spotify</a>` : ''}
    ${appleMusicUrl ? `<a href="${appleMusicUrl}">Apple Music</a>` : ''}
    ${instagramUrl ? `<a href="${instagramUrl}">Instagram</a>` : ''}
  </div>
  <p class="epk-url">EPK: https://${epkUrl}</p>
</body>
</html>`;
        const blob = new Blob([html], { type: 'text/html' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `epk-${slug}.html`;
        a.click();
        URL.revokeObjectURL(url);
    };

    return (
        <div className="flex flex-col gap-6 p-6 max-w-2xl">
            {/* Header */}
            <div>
                <h2 className="text-lg font-bold text-white flex items-center gap-2">
                    <FileText size={18} className="text-dept-marketing" />
                    EPK Live Generator
                </h2>
                <p className="text-xs text-gray-500 mt-1">Generate a dynamic Electronic Press Kit live at your personal EPK URL.</p>
            </div>

            {/* Artist Name */}
            <div>
                <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1.5 block">Artist Name</label>
                <input
                    type="text"
                    value={artistName}
                    onChange={e => setArtistName(e.target.value)}
                    placeholder="Your Artist Name"
                    className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm text-white placeholder-gray-600 focus:border-dept-marketing/50 outline-none"
                />
            </div>

            {/* Press Photo */}
            <div>
                <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2 flex items-center gap-1">
                    <ImageIcon size={10} /> Press Photo
                </label>
                <div className="flex items-center gap-4">
                    <div className="w-20 h-20 rounded-xl bg-gradient-to-br from-dept-marketing/30 to-purple-600/20 border border-white/10 flex items-center justify-center flex-shrink-0">
                        <ImageIcon size={20} className="text-gray-600" />
                    </div>
                    <label className="flex-1 flex flex-col items-center py-3 rounded-xl border border-dashed border-white/10 hover:border-dept-marketing/30 text-xs text-gray-500 cursor-pointer hover:text-gray-400 transition-all bg-white/[0.02]">
                        Click to upload press photo
                        <input type="file" accept="image/*" className="sr-only" />
                    </label>
                </div>
            </div>

            {/* Bio */}
            <div>
                <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1.5 block">Artist Bio</label>
                <textarea
                    value={bio}
                    onChange={e => setBio(e.target.value)}
                    rows={4}
                    className="w-full px-3 py-2.5 bg-white/5 border border-white/10 rounded-xl text-sm text-white placeholder-gray-600 focus:border-dept-marketing/50 outline-none resize-none leading-relaxed"
                />
            </div>

            {/* Genre Tags */}
            <div>
                <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2 flex items-center gap-1">
                    <Tag size={10} /> Genre Tags
                </label>
                <div className="flex flex-wrap gap-1.5">
                    {GENRE_OPTIONS.map(g => (
                        <button
                            key={g}
                            onClick={() => toggleGenre(g)}
                            className={`px-3 py-1 rounded-full text-xs font-medium transition-all ${
                                genreTags.includes(g)
                                    ? 'bg-dept-marketing/20 border border-dept-marketing/40 text-dept-marketing'
                                    : 'bg-white/5 border border-white/10 text-gray-500 hover:border-white/20'
                            }`}
                        >
                            {g}
                        </button>
                    ))}
                </div>
            </div>

            {/* Social + DSP Links */}
            <div>
                <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2 flex items-center gap-1">
                    <Link2 size={10} /> Links
                </label>
                <div className="space-y-2">
                    {[
                        { label: 'Spotify', value: spotifyUrl, onChange: setSpotifyUrl, placeholder: 'https://open.spotify.com/artist/...' },
                        { label: 'Apple Music', value: appleMusicUrl, onChange: setAppleMusicUrl, placeholder: 'https://music.apple.com/artist/...' },
                        { label: 'Instagram', value: instagramUrl, onChange: setInstagramUrl, placeholder: 'https://instagram.com/...' },
                    ].map(l => (
                        <div key={l.label} className="flex items-center gap-2">
                            <span className="text-xs text-gray-500 w-20 flex-shrink-0">{l.label}</span>
                            <input
                                type="url"
                                value={l.value}
                                onChange={e => l.onChange(e.target.value)}
                                placeholder={l.placeholder}
                                className="flex-1 px-3 py-1.5 bg-white/5 border border-white/10 rounded-lg text-xs text-white placeholder-gray-700 focus:border-dept-marketing/50 outline-none"
                            />
                        </div>
                    ))}
                </div>
            </div>

            {/* Recent Releases */}
            <div>
                <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2 flex items-center gap-1">
                    <Music size={10} /> Recent Releases
                </label>
                <div className="space-y-1.5">
                    {tracks.map((t, i) => (
                        <div key={i} className="flex items-center justify-between p-2.5 rounded-lg bg-white/[0.03] border border-white/5">
                            <div className="flex items-center gap-2">
                                <div className="w-6 h-6 rounded bg-dept-marketing/20 flex items-center justify-center">
                                    <Music size={11} className="text-dept-marketing" />
                                </div>
                                <span className="text-sm text-white">{t.title}</span>
                                <span className="text-[10px] text-gray-600">{t.year}</span>
                            </div>
                            <span className="text-xs text-gray-500">{t.streams} streams</span>
                        </div>
                    ))}
                </div>
            </div>

            {/* Generate Button */}
            <button
                onClick={handleGenerate}
                disabled={generating}
                className="flex items-center justify-center gap-2 py-3 rounded-xl bg-dept-marketing text-white font-semibold text-sm hover:bg-dept-marketing/90 transition-all disabled:opacity-50 shadow-lg shadow-dept-marketing/20"
            >
                {generating ? (
                    <>
                        <Loader2 size={16} className="animate-spin" />
                        Generating EPK...
                    </>
                ) : (
                    <>
                        <Globe size={16} />
                        Generate EPK
                    </>
                )}
            </button>

            {/* EPK Preview + Actions */}
            <AnimatePresence>
                {generated && (
                    <motion.div
                        initial={{ opacity: 0, y: 12 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="flex flex-col gap-3"
                    >
                        {/* Browser Mockup */}
                        <div className="rounded-xl border border-white/10 overflow-hidden bg-[#0a0a0a]">
                            <div className="flex items-center gap-1.5 px-3 py-2 bg-white/5 border-b border-white/5">
                                <span className="w-2.5 h-2.5 rounded-full bg-red-500/60" />
                                <span className="w-2.5 h-2.5 rounded-full bg-yellow-500/60" />
                                <span className="w-2.5 h-2.5 rounded-full bg-green-500/60" />
                                <div className="flex-1 mx-2 px-2 py-0.5 bg-white/5 rounded text-[9px] text-gray-500 font-mono">
                                    https://{epkUrl}
                                </div>
                                <ExternalLink size={9} className="text-gray-600" />
                            </div>
                            <div className="p-5 flex gap-4">
                                <div className="w-16 h-16 rounded-xl bg-gradient-to-br from-dept-marketing/30 to-purple-600/20 border border-white/10 flex-shrink-0 flex items-center justify-center">
                                    <ImageIcon size={18} className="text-gray-600" />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className="text-sm font-bold text-white">{artistName || 'Artist Name'}</p>
                                    <div className="flex gap-1 flex-wrap mt-1">
                                        {genreTags.map(g => (
                                            <span key={g} className="px-1.5 py-0.5 rounded bg-dept-marketing/15 text-dept-marketing text-[9px] font-medium">{g}</span>
                                        ))}
                                    </div>
                                    <p className="text-[10px] text-gray-500 mt-1.5 line-clamp-2 leading-relaxed">{bio}</p>
                                </div>
                            </div>
                        </div>

                        {/* Actions */}
                        <div className="flex gap-2">
                            <button
                                onClick={handleCopyLink}
                                className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-white/5 border border-white/10 text-sm text-gray-300 hover:border-white/20 transition-all font-medium"
                            >
                                {copied ? <CheckCircle size={14} className="text-green-400" /> : <Copy size={14} />}
                                {copied ? 'Copied!' : 'Copy Link'}
                            </button>
                            <button
                                onClick={handleDownloadPDF}
                                className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-white/5 border border-white/10 text-sm text-gray-300 hover:border-white/20 transition-all font-medium"
                            >
                                <Download size={14} />
                                Download HTML
                            </button>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
