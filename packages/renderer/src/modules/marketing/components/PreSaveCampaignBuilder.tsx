import React, { useEffect, useMemo, useState } from 'react';
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
    Plus,
    Users,
    Bookmark,
    ArrowLeft,
    Edit3,
    QrCode,
} from 'lucide-react';
import {
    preSaveCampaignService,
    type PreSaveCampaign,
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

type ManagedCampaign = PreSaveCampaign & { leadCount: number; createdAt: number };

export default function PreSaveCampaignBuilder() {
    const [campaigns, setCampaigns] = useState<ManagedCampaign[]>([]);
    const [isLoadingList, setIsLoadingList] = useState(false);
    const [viewMode, setViewMode] = useState<'list' | 'builder'>('builder');

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
    const [activeQrModal, setActiveQrModal] = useState<string | null>(null);

    const loadCampaigns = async () => {
        setIsLoadingList(true);
        try {
            const list = await preSaveCampaignService.listCampaigns();
            setCampaigns(list);
            if (list.length > 0 && !campaignId) {
                setViewMode('list');
            }
        } catch {
            setCampaigns([]);
        } finally {
            setIsLoadingList(false);
        }
    };

    useEffect(() => {
        void loadCampaigns();
    }, []);

    const publishedUrl = campaignId && !isDirty
        ? preSaveCampaignService.getCampaignUrl(campaignId)
        : null;

    const configuredLinks = useMemo(
        () => dspLinks.filter(dsp => dsp.url.trim().length > 0),
        [dspLinks],
    );

    const totalLeads = useMemo(
        () => campaigns.reduce((acc, c) => acc + (c.leadCount || 0), 0),
        [campaigns],
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

    const handleEditCampaign = (c: ManagedCampaign) => {
        setCampaignId(c.id);
        setTrackTitle(c.title);
        const releaseDateFormatted = c.releaseDate
            ? new Date(c.releaseDate).toISOString().split('T')[0]
            : '';
        setReleaseDate(releaseDateFormatted ?? '');
        setCoverArtUrl(c.coverArtUrl || '');
        setCollectEmail(c.captureEmails);
        setCollectPhone(c.capturePhones);
        setDspLinks(DSP_LINKS.map(dsp => ({
            ...dsp,
            url: c.links[dsp.key] || '',
        })));
        setIsDirty(false);
        setPublishError(null);
        setViewMode('builder');
    };

    const handleNewCampaign = () => {
        setCampaignId(null);
        setTrackTitle('');
        setReleaseDate('');
        setCoverArtUrl('');
        setCollectEmail(true);
        setCollectPhone(false);
        setDspLinks(DSP_LINKS.map(dsp => ({ ...dsp })));
        setIsDirty(false);
        setPublishError(null);
        setViewMode('builder');
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
            await loadCampaigns();
        } catch {
            setPublishError('Campaign was not published. Nothing was shared or saved as live.');
        } finally {
            setIsPublishing(false);
        }
    };

    const handleCopyLink = async (url?: string) => {
        const targetUrl = url || publishedUrl;
        if (!targetUrl) return;
        await navigator.clipboard.writeText(targetUrl);
        setCopied(true);
        window.setTimeout(() => setCopied(false), 2000);
    };

    const handleShare = async (url?: string, title?: string) => {
        const targetUrl = url || publishedUrl;
        if (!targetUrl) return;
        const sharePayload = {
            title: title || trackTitle.trim() || 'Pre-Save Campaign',
            text: 'Open this pre-save campaign page.',
            url: targetUrl,
        };
        if (typeof navigator !== 'undefined' && 'share' in navigator) {
            try {
                await navigator.share(sharePayload);
                return;
            } catch (error) {
                if ((error as DOMException)?.name === 'AbortError') return;
            }
        }
        await navigator.clipboard.writeText(targetUrl);
        setCopied(true);
        window.setTimeout(() => setCopied(false), 2000);
    };

    return (
        <div className="flex max-w-4xl flex-col gap-6 p-6">
            {/* Navigation & Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="flex items-center gap-2 text-lg font-bold text-white">
                        <Bookmark size={18} className="text-dept-marketing" />
                        Smart-Link & Pre-Save Manager
                    </h2>
                    <p className="mt-1 text-xs text-gray-400">
                        Create, deploy, and analyze smart pre-save campaign pages to capture fan conversions.
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    {campaigns.length > 0 && (
                        <button
                            type="button"
                            onClick={() => setViewMode(viewMode === 'list' ? 'builder' : 'list')}
                            className="flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-gray-300 hover:bg-white/10"
                        >
                            {viewMode === 'list' ? (
                                <>
                                    <Plus size={14} /> New Campaign
                                </>
                            ) : (
                                <>
                                    <Bookmark size={14} /> All Campaigns ({campaigns.length})
                                </>
                            )}
                        </button>
                    )}
                </div>
            </div>

            {/* Campaign Overview Stats */}
            <div className="grid grid-cols-3 gap-3">
                <div className="rounded-xl border border-white/10 bg-white/5 p-4">
                    <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-gray-400">
                        <Bookmark size={12} className="text-dept-marketing" /> Active Smart Links
                    </div>
                    <p className="mt-2 text-2xl font-bold text-white">{campaigns.length}</p>
                </div>
                <div className="rounded-xl border border-white/10 bg-white/5 p-4">
                    <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-gray-400">
                        <Users size={12} className="text-green-400" /> Presaved Fans
                    </div>
                    <p className="mt-2 text-2xl font-bold text-white">{totalLeads}</p>
                </div>
                <div className="rounded-xl border border-white/10 bg-white/5 p-4">
                    <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-gray-400">
                        <Globe size={12} className="text-blue-400" /> Conversion Domain
                    </div>
                    <p className="mt-2 text-xs font-mono text-gray-300">app.indii.music/presave</p>
                </div>
            </div>

            {/* List View */}
            {viewMode === 'list' && (
                <div className="flex flex-col gap-4">
                    <div className="flex items-center justify-between">
                        <h3 className="text-sm font-bold text-white">Your Smart Links</h3>
                        <button
                            type="button"
                            onClick={handleNewCampaign}
                            className="flex items-center gap-1.5 rounded-lg bg-dept-marketing px-3 py-1.5 text-xs font-semibold text-black hover:bg-dept-marketing/90"
                        >
                            <Plus size={14} /> Create Smart Link
                        </button>
                    </div>

                    {isLoadingList ? (
                        <div className="flex items-center justify-center p-8 text-xs text-gray-500">
                            <Loader2 size={16} className="animate-spin mr-2" /> Loading campaigns...
                        </div>
                    ) : campaigns.length === 0 ? (
                        <div className="flex flex-col items-center justify-center rounded-xl border border-white/10 bg-white/5 p-8 text-center">
                            <Bookmark size={28} className="text-gray-600 mb-2" />
                            <p className="text-sm font-semibold text-white">No smart links created yet</p>
                            <p className="mt-1 text-xs text-gray-500 max-w-sm">
                                Create your first pre-save smart link to start capturing fan registrations across Spotify, Apple Music, and Amazon Music.
                            </p>
                            <button
                                type="button"
                                onClick={handleNewCampaign}
                                className="mt-4 flex items-center gap-1.5 rounded-lg bg-dept-marketing px-4 py-2 text-xs font-semibold text-black"
                            >
                                <Plus size={14} /> Create Your First Smart Link
                            </button>
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {campaigns.map(c => {
                                const url = preSaveCampaignService.getCampaignUrl(c.id);
                                return (
                                    <div
                                        key={c.id}
                                        className="flex items-center justify-between rounded-xl border border-white/10 bg-white/5 p-4 hover:border-white/20 transition-all"
                                    >
                                        <div className="flex items-center gap-4 min-w-0 flex-1">
                                            {c.coverArtUrl ? (
                                                <img src={c.coverArtUrl} alt={c.title} className="h-12 w-12 rounded-lg object-cover" />
                                            ) : (
                                                <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-white/10">
                                                    <Music size={20} className="text-dept-marketing" />
                                                </div>
                                            )}
                                            <div className="min-w-0 flex-1">
                                                <h4 className="text-sm font-bold text-white truncate">{c.title}</h4>
                                                <div className="mt-0.5 flex items-center gap-3 text-xs text-gray-400">
                                                    <span className="flex items-center gap-1">
                                                        <Calendar size={10} /> {new Date(c.releaseDate).toLocaleDateString()}
                                                    </span>
                                                    <span className="flex items-center gap-1 text-green-400">
                                                        <Users size={10} /> {c.leadCount} presaves
                                                    </span>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="flex items-center gap-2 shrink-0">
                                            <button
                                                type="button"
                                                onClick={() => setActiveQrModal(activeQrModal === c.id ? null : c.id)}
                                                className="rounded-lg border border-white/10 bg-white/5 p-2 text-gray-400 hover:text-white"
                                                title="View QR Code"
                                            >
                                                <QrCode size={14} />
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => void handleCopyLink(url)}
                                                className="rounded-lg border border-white/10 bg-white/5 p-2 text-gray-400 hover:text-white"
                                                title="Copy Link"
                                            >
                                                <Copy size={14} />
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => void handleShare(url, c.title)}
                                                className="rounded-lg border border-white/10 bg-white/5 p-2 text-gray-400 hover:text-white"
                                                title="Share Link"
                                            >
                                                <Share2 size={14} />
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => handleEditCampaign(c)}
                                                className="flex items-center gap-1 rounded-lg border border-dept-marketing/30 bg-dept-marketing/10 px-3 py-1.5 text-xs font-semibold text-dept-marketing hover:bg-dept-marketing/20"
                                            >
                                                <Edit3 size={12} /> Edit
                                            </button>
                                        </div>

                                        {activeQrModal === c.id && (
                                            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
                                                <div className="flex flex-col items-center gap-4 rounded-xl border border-white/10 bg-[#121212] p-6 shadow-2xl">
                                                    <h4 className="text-sm font-bold text-white">{c.title} — QR Code</h4>
                                                    <div className="rounded-lg bg-white p-3">
                                                        <QRCodeSVG value={url} size={160} />
                                                    </div>
                                                    <p className="font-mono text-xs text-dept-marketing">{url}</p>
                                                    <button
                                                        type="button"
                                                        onClick={() => setActiveQrModal(null)}
                                                        className="mt-2 rounded-lg bg-white/10 px-4 py-1.5 text-xs text-white"
                                                    >
                                                        Close
                                                    </button>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            )}

            {/* Builder / Edit View */}
            {viewMode === 'builder' && (
                <div className="flex max-w-2xl flex-col gap-6">
                    {campaigns.length > 0 && (
                        <button
                            type="button"
                            onClick={() => setViewMode('list')}
                            className="flex items-center gap-1 text-xs text-gray-400 hover:text-white"
                        >
                            <ArrowLeft size={12} /> Back to all smart links
                        </button>
                    )}

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
            )}
        </div>
    );
}
