import React, { useMemo, useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import {
    Music,
    Calendar,
    Link2,
    Copy,
    Share2,
    CheckCircle,
    Mail,
    Phone,
    Globe,
    ExternalLink,
    Loader2,
    AlertCircle,
} from 'lucide-react';
import {
    preSaveCampaignService,
    type PreSaveDsp,
    type PreSavePlatformLinks,
} from '@/services/marketing/PreSaveCampaignService';

interface DSPLink {
    key: PreSaveDsp;
    name: string;
    icon: string;
    url: string;
    placeholder: string;
}

const DSP_LINKS: DSPLink[] = [
    { key: 'spotify', name: 'Spotify', icon: '🎧', url: '', placeholder: 'https://open.spotify.com/album/...' },
    { key: 'appleMusic', name: 'Apple Music', icon: '', url: '', placeholder: 'https://music.apple.com/album/...' },
    { key: 'amazonMusic', name: 'Amazon Music', icon: '🎵', url: '', placeholder: 'https://music.amazon.com/albums/...' },
];

function isHttpsUrl(value: string): boolean {
    if (!value) return true;
    try {
        return new URL(value).protocol === 'https:';
    } catch {
        return false;
    }
}

export default function PreSaveCampaignBuilder() {
    const [trackTitle, setTrackTitle] = useState('');
    const [releaseDate, setReleaseDate] = useState('');
    const [coverArtUrl, setCoverArtUrl] = useState('');
    const [dspLinks, setDspLinks] = useState(DSP_LINKS.map(dsp => ({ ...dsp })));
    const [collectEmail, setCollectEmail] = useState(true);
    const [collectPhone, setCollectPhone] = useState(false);
    const [campaignId, setCampaignId] = useState<string | null>(null);
    const [isDirty, setIsDirty] = useState(false);
    const [isPublishing, setIsPublishing] = useState(false);
    const [publishError, setPublishError] = useState<string | null>(null);
    const [copied, setCopied] = useState(false);

    const publishedUrl = campaignId && !isDirty
        ? preSaveCampaignService.getCampaignUrl(campaignId)
        : null;
    const configuredLinks = useMemo(
        () => dspLinks.filter(dsp => dsp.url.trim().length > 0),
        [dspLinks],
    );

    const markDirty = () => {
        if (campaignId) setIsDirty(true);
        setPublishError(null);
    };

    const handleDspChange = (idx: number, value: string) => {
        markDirty();
        setDspLinks(previous => previous.map((dsp, index) => (
            index === idx ? { ...dsp, url: value } : dsp
        )));
    };

    const handlePublish = async () => {
        const title = trackTitle.trim();
        const links = dspLinks.reduce<PreSavePlatformLinks>((result, dsp) => {
            const url = dsp.url.trim();
            if (url) result[dsp.key] = url;
            return result;
        }, {});

        if (!title || !releaseDate || configuredLinks.length === 0) {
            setPublishError('Add a title, release date, and at least one DSP link before publishing.');
            return;
        }
        if (!dspLinks.every(dsp => isHttpsUrl(dsp.url.trim())) || !isHttpsUrl(coverArtUrl.trim())) {
            setPublishError('Campaign links must be valid HTTPS URLs.');
            return;
        }

        setIsPublishing(true);
        setPublishError(null);
        try {
            const persistedId = await preSaveCampaignService.createCampaign({
                title,
                releaseDate: new Date(`${releaseDate}T00:00:00`).getTime(),
                coverArtUrl: coverArtUrl.trim(),
                links,
                captureEmails: collectEmail,
                capturePhones: collectPhone,
                themeColor: '#22c55e',
            }, campaignId ?? undefined);
            setCampaignId(persistedId);
            setIsDirty(false);
        } catch {
            setPublishError('Campaign was not published. Nothing was shared or saved as live.');
        } finally {
            setIsPublishing(false);
        }
    };

    const handleCopyLink = async () => {
        if (!publishedUrl) return;
        await navigator.clipboard.writeText(publishedUrl);
        setCopied(true);
        window.setTimeout(() => setCopied(false), 2000);
    };

    const handleShare = async () => {
        if (!publishedUrl) return;
        const sharePayload = {
            title: trackTitle.trim() || 'Pre-Save Campaign',
            text: 'Open this pre-save campaign page.',
            url: publishedUrl,
        };
        if (typeof navigator !== 'undefined' && 'share' in navigator) {
            try {
                await navigator.share(sharePayload);
                return;
            } catch (error) {
                if ((error as DOMException)?.name === 'AbortError') return;
            }
        }
        await navigator.clipboard.writeText(publishedUrl);
        setCopied(true);
        window.setTimeout(() => setCopied(false), 2000);
    };

    return (
        <div className="flex max-w-2xl flex-col gap-6 p-6">
            <div>
                <h2 className="flex items-center gap-2 text-lg font-bold text-white">
                    <Music size={18} className="text-dept-marketing" />
                    Pre-Save Campaign Builder
                </h2>
                <p className="mt-1 text-xs text-gray-500">
                    Publish a real landing page and collect consented fan data before release.
                </p>
            </div>

            <div className="grid grid-cols-2 gap-3">
                <div>
                    <label htmlFor="presave-title" className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-gray-400">
                        Track / Release Title
                    </label>
                    <input
                        id="presave-title"
                        type="text"
                        value={trackTitle}
                        onChange={event => { markDirty(); setTrackTitle(event.target.value); }}
                        placeholder="e.g. Midnight Frequencies"
                        className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white outline-none placeholder-gray-600 focus:border-dept-marketing/50"
                    />
                </div>
                <div>
                    <label htmlFor="presave-release-date" className="mb-1.5 flex items-center gap-1 text-xs font-semibold uppercase tracking-wider text-gray-400">
                        <Calendar size={10} /> Release Date
                    </label>
                    <input
                        id="presave-release-date"
                        type="date"
                        value={releaseDate}
                        onChange={event => { markDirty(); setReleaseDate(event.target.value); }}
                        className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-gray-300 outline-none focus:border-dept-marketing/50"
                    />
                </div>
            </div>

            <div>
                <label htmlFor="presave-cover-art" className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-gray-400">
                    Cover Art URL <span className="normal-case text-gray-600">(optional)</span>
                </label>
                <input
                    id="presave-cover-art"
                    type="url"
                    value={coverArtUrl}
                    onChange={event => { markDirty(); setCoverArtUrl(event.target.value); }}
                    placeholder="https://.../cover.jpg"
                    className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs text-white outline-none placeholder-gray-700 focus:border-dept-marketing/50"
                />
            </div>

            <div>
                <div className="mb-2 flex items-center gap-1 text-xs font-semibold uppercase tracking-wider text-gray-400">
                    <Link2 size={10} /> DSP Pre-Add Links
                </div>
                <div className="space-y-2">
                    {dspLinks.map((dsp, index) => (
                        <div key={dsp.key} className="flex items-center gap-2">
                            <span className="w-6 flex-shrink-0 text-base">{dsp.icon}</span>
                            <label htmlFor={`presave-${dsp.key}`} className="w-20 flex-shrink-0 text-xs text-gray-400">
                                {dsp.name}
                            </label>
                            <input
                                id={`presave-${dsp.key}`}
                                type="url"
                                value={dsp.url}
                                onChange={event => handleDspChange(index, event.target.value)}
                                placeholder={dsp.placeholder}
                                className="flex-1 rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-white outline-none placeholder-gray-700 focus:border-dept-marketing/50"
                            />
                        </div>
                    ))}
                </div>
            </div>

            <div>
                <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-gray-400">Collect Fan Data</div>
                <div className="flex gap-3">
                    <button
                        type="button"
                        onClick={() => { markDirty(); setCollectEmail(value => !value); }}
                        aria-pressed={collectEmail}
                        className={`flex items-center gap-2 rounded-lg border px-4 py-2 text-sm font-medium transition-all ${collectEmail ? 'border-dept-marketing/30 bg-dept-marketing/15 text-dept-marketing' : 'border-white/10 bg-white/5 text-gray-500'}`}
                    >
                        <Mail size={13} /> Email {collectEmail && <CheckCircle size={11} />}
                    </button>
                    <button
                        type="button"
                        onClick={() => { markDirty(); setCollectPhone(value => !value); }}
                        aria-pressed={collectPhone}
                        className={`flex items-center gap-2 rounded-lg border px-4 py-2 text-sm font-medium transition-all ${collectPhone ? 'border-dept-marketing/30 bg-dept-marketing/15 text-dept-marketing' : 'border-white/10 bg-white/5 text-gray-500'}`}
                    >
                        <Phone size={13} /> Phone {collectPhone && <CheckCircle size={11} />}
                    </button>
                </div>
            </div>

            <div>
                <div className="mb-2 flex items-center gap-1 text-xs font-semibold uppercase tracking-wider text-gray-400">
                    <Globe size={10} /> Landing Page Preview
                </div>
                <div className="overflow-hidden rounded-xl border border-white/10 bg-[#0a0a0a]">
                    <div className="flex items-center gap-1.5 border-b border-white/5 bg-white/5 px-3 py-2">
                        <span className="h-2.5 w-2.5 rounded-full bg-red-500/60" />
                        <span className="h-2.5 w-2.5 rounded-full bg-yellow-500/60" />
                        <span className="h-2.5 w-2.5 rounded-full bg-green-500/60" />
                        <div className="mx-2 flex-1 rounded bg-white/5 px-2 py-0.5 font-mono text-[9px] text-gray-600">
                            {publishedUrl ?? 'Draft preview — not published'}
                        </div>
                        <ExternalLink size={9} className="text-gray-600" />
                    </div>
                    <div className="flex min-h-40 flex-col items-center gap-4 p-6">
                        {coverArtUrl && isHttpsUrl(coverArtUrl) ? (
                            <img src={coverArtUrl} alt="Campaign cover preview" className="h-24 w-24 rounded-xl object-cover" />
                        ) : (
                            <div className="flex h-24 w-24 items-center justify-center rounded-xl border border-white/10 bg-linear-to-br from-dept-marketing/30 to-green-600/30">
                                <Music size={28} className="text-dept-marketing/60" />
                            </div>
                        )}
                        <div className="text-center">
                            <p className="text-sm font-bold text-white">{trackTitle || 'Your Track Title'}</p>
                            <p className="mt-0.5 text-[10px] text-gray-500">
                                {releaseDate
                                    ? `Releasing ${new Date(`${releaseDate}T00:00:00`).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}`
                                    : 'Coming Soon'}
                            </p>
                        </div>
                        <div className="flex flex-wrap justify-center gap-2">
                            {configuredLinks.length > 0 ? configuredLinks.map(dsp => (
                                <div key={dsp.key} className="rounded-lg bg-white/10 px-3 py-1.5 text-[10px] font-medium text-gray-300">
                                    {dsp.icon} Pre-save on {dsp.name}
                                </div>
                            )) : <span className="text-[10px] text-gray-600">Add a DSP link to enable fan actions.</span>}
                        </div>
                    </div>
                </div>
            </div>

            <div className="rounded-xl border border-white/5 bg-white/[0.03] p-4">
                {publishedUrl ? (
                    <div className="flex items-center gap-4">
                        <div
                            role="img"
                            aria-label="Campaign QR code"
                            className="shrink-0 rounded-lg bg-white p-1.5"
                        >
                            <QRCodeSVG value={publishedUrl} size={72} />
                        </div>
                        <div className="min-w-0 flex-1">
                            <p className="mb-0.5 text-[10px] text-gray-500">Published campaign URL</p>
                            <p className="truncate font-mono text-xs text-dept-marketing">{publishedUrl}</p>
                            <div className="mt-2 flex gap-1.5">
                                <button type="button" onClick={() => void handleCopyLink()} className="flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-gray-300">
                                    {copied ? <CheckCircle size={12} className="text-green-400" /> : <Copy size={12} />}
                                    {copied ? 'Copied!' : 'Copy'}
                                </button>
                                <button type="button" onClick={() => void handleShare()} className="flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-gray-300">
                                    <Share2 size={12} /> Share
                                </button>
                            </div>
                        </div>
                    </div>
                ) : (
                    <p className="text-xs text-gray-500">Publish the campaign to create a shareable URL.</p>
                )}
                {isDirty && campaignId && (
                    <p className="mt-2 text-xs text-amber-400">Your published page is unchanged until these edits are published.</p>
                )}
                {publishError && (
                    <p role="alert" className="mt-3 flex items-center gap-2 text-xs text-red-400">
                        <AlertCircle size={13} /> {publishError}
                    </p>
                )}
                <button
                    type="button"
                    onClick={() => void handlePublish()}
                    disabled={isPublishing}
                    className="mt-4 flex items-center gap-2 rounded-lg bg-dept-marketing px-4 py-2 text-sm font-semibold text-black disabled:cursor-wait disabled:opacity-60"
                >
                    {isPublishing && <Loader2 size={14} className="animate-spin" />}
                    {campaignId ? 'Publish Changes' : 'Publish Campaign'}
                </button>
            </div>
        </div>
    );
}
