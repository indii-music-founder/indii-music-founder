import React, { useEffect, useRef, useState } from 'react';
import { AlertCircle, Calendar, Check, ImageDown, Loader2, Mail, Music, Phone, Share2 } from 'lucide-react';
import {
    preSaveCampaignService,
    type PreSaveCampaign,
    type PreSaveDsp,
} from '@/services/marketing/PreSaveCampaignService';
import { secureRandomAlphanumeric } from '@/utils/crypto-random';
import { countdownParts } from '@shared/share/countdown';
import {
    buildShareCardModel,
    shareCardFileName,
} from '@shared/share/shareCardTemplates';
import { renderShareCard } from '@shared/share/ShareCardRenderer';
import { shareOrDownloadImage } from '@shared/share/shareFile';
import { SIGNATURE_BUTTON_BASE, SIGNATURE_BUTTON_TONES } from '@shared/share/signatureButton';

const DSP_LABELS: Record<PreSaveDsp, string> = {
    spotify: 'Spotify',
    appleMusic: 'Apple Music',
    amazonMusic: 'Amazon Music',
};

const GOLD_TONE = SIGNATURE_BUTTON_TONES.gold;

function createLeadId(): string {
    if (typeof globalThis.crypto?.randomUUID === 'function') {
        return globalThis.crypto.randomUUID();
    }
    return `lead-${Date.now().toString(36)}-${secureRandomAlphanumeric(16)}`;
}

function padTwo(value: number): string {
    return String(value).padStart(2, '0');
}

function isCoarsePointerMobile(): boolean {
    return typeof window !== 'undefined'
        && typeof window.matchMedia === 'function'
        && window.matchMedia('(pointer: coarse)').matches;
}

/**
 * Fan-facing pre-save landing page with live release countdown,
 * viral drop sharing, fan story card export, and indii growth attribution.
 */
export function PreSaveLandingPage({
    campaignId,
    onRedirect = (url: string) => window.location.assign(url),
}: {
    campaignId: string;
    onRedirect?: (url: string) => void;
}) {
    const [campaign, setCampaign] = useState<PreSaveCampaign | null>(null);
    const [loading, setLoading] = useState(true);
    const [loadError, setLoadError] = useState(false);
    const [email, setEmail] = useState('');
    const [phone, setPhone] = useState('');
    const [consented, setConsented] = useState(false);
    const [submittingDsp, setSubmittingDsp] = useState<PreSaveDsp | null>(null);
    const [submitError, setSubmitError] = useState<string | null>(null);
    const [now, setNow] = useState<Date>(() => new Date());
    const [shareStatus, setShareStatus] = useState<'idle' | 'copied' | 'shared' | 'failed'>('idle');
    const [cardBusy, setCardBusy] = useState(false);
    const [cardStatus, setCardStatus] = useState<string | null>(null);
    const [cardError, setCardError] = useState<string | null>(null);
    const leadIds = useRef<Partial<Record<PreSaveDsp, string>>>({});
    const shareTimerRef = useRef<number | null>(null);

    useEffect(() => {
        let active = true;
        setLoading(true);
        setLoadError(false);
        preSaveCampaignService.getCampaign(campaignId)
            .then(result => {
                if (active) setCampaign(result);
            })
            .catch(() => {
                if (active) setLoadError(true);
            })
            .finally(() => {
                if (active) setLoading(false);
            });
        return () => { active = false; };
    }, [campaignId]);

    useEffect(() => () => {
        if (shareTimerRef.current !== null) {
            window.clearTimeout(shareTimerRef.current);
        }
    }, []);

    const countdown = campaign ? countdownParts(campaign.releaseDate, now) : null;
    const releaseDate = campaign?.releaseDate;
    const isOut = countdown?.isOut ?? true;

    useEffect(() => {
        if (releaseDate === undefined || isOut) return;
        const intervalId = window.setInterval(() => {
            setNow(new Date());
        }, 1000);
        return () => window.clearInterval(intervalId);
    }, [releaseDate, isOut]);

    const handlePreSave = async (dsp: PreSaveDsp, url: string) => {
        if (!campaign) return;
        const normalizedEmail = email.trim();
        const normalizedPhone = phone.trim();
        if (campaign.captureEmails && !/^\S+@\S+\.\S+$/.test(normalizedEmail)) {
            setSubmitError('Enter a valid email address.');
            return;
        }
        if (campaign.capturePhones && normalizedPhone.length < 5) {
            setSubmitError('Enter a valid phone number.');
            return;
        }
        if ((campaign.captureEmails || campaign.capturePhones) && !consented) {
            setSubmitError('Consent is required before contact information can be saved.');
            return;
        }

        const leadId = leadIds.current[dsp] ?? createLeadId();
        leadIds.current[dsp] = leadId;
        setSubmittingDsp(dsp);
        setSubmitError(null);
        const fbclid = new URLSearchParams(window.location.search).get('fbclid') ?? undefined;
        const result = await preSaveCampaignService.recordLead(campaign.id, {
            leadId,
            dsp,
            ...(campaign.captureEmails ? { email: normalizedEmail } : {}),
            ...(campaign.capturePhones ? { phone: normalizedPhone } : {}),
            optInMarketing: consented,
            ...(fbclid ? { fbclid } : {}),
        });
        setSubmittingDsp(null);
        if (result.presaved === false) {
            setSubmitError(result.message);
            return;
        }
        onRedirect(url);
    };

    const scheduleStatusReset = () => {
        if (shareTimerRef.current !== null) {
            window.clearTimeout(shareTimerRef.current);
        }
        shareTimerRef.current = window.setTimeout(() => {
            setShareStatus('idle');
            shareTimerRef.current = null;
        }, 2500);
    };

    const handleShareDrop = async () => {
        if (!campaign) return;
        const canonicalUrl = `${window.location.origin}/presave/${campaign.id}`;
        if (isCoarsePointerMobile() && typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
            try {
                await navigator.share({
                    title: campaign.title,
                    text: `Pre-save ${campaign.title}`,
                    url: canonicalUrl,
                });
                setShareStatus('shared');
                scheduleStatusReset();
                return;
            } catch (error) {
                if ((error as DOMException)?.name === 'AbortError') return;
                // Fall through to clipboard copy when Web Share is unavailable or denied.
            }
        }

        try {
            if (typeof navigator === 'undefined' || !navigator.clipboard?.writeText) {
                throw new Error('Clipboard unavailable');
            }
            await navigator.clipboard.writeText(canonicalUrl);
            setShareStatus('copied');
        } catch {
            setShareStatus('failed');
        }
        scheduleStatusReset();
    };

    const handleStoryCard = async () => {
        if (!campaign || cardBusy) return;
        const canonicalUrl = `${window.location.origin}/presave/${campaign.id}`;
        setCardBusy(true);
        setCardStatus(null);
        setCardError(null);
        try {
            const model = buildShareCardModel(
                {
                    kind: 'presave',
                    trackTitle: campaign.title,
                    releaseDate: campaign.releaseDate,
                    url: canonicalUrl,
                    coverArtUrl: campaign.coverArtUrl || undefined,
                    voice: 'fan',
                },
                { brandColors: [campaign.themeColor, '#FE2E9A'] },
            );
            const { blob } = await renderShareCard(model, 'story');
            const outcome = await shareOrDownloadImage(
                blob,
                shareCardFileName(model, 'story'),
                { title: campaign.title, text: model.callout },
            );
            if (outcome === 'shared') {
                setCardStatus('Story card shared');
            } else if (outcome === 'downloaded') {
                setCardStatus('Story card downloaded');
            }
        } catch (error) {
            setCardError(error instanceof Error ? error.message : 'Could not create story card.');
        } finally {
            setCardBusy(false);
        }
    };

    if (loading) {
        return (
            <main className="flex min-h-screen items-center justify-center bg-black text-white">
                <Loader2 aria-label="Loading campaign" className="animate-spin text-green-400" />
            </main>
        );
    }

    if (loadError || !campaign) {
        return (
            <main className="flex min-h-screen items-center justify-center bg-black px-6 text-white">
                <div className="max-w-md text-center">
                    <AlertCircle className="mx-auto mb-4 text-amber-400" size={34} />
                    <h1 className="text-xl font-semibold">This pre-save campaign is unavailable.</h1>
                    <p className="mt-2 text-sm text-gray-400">The link may be invalid, expired, or not published yet.</p>
                </div>
            </main>
        );
    }

    const availableLinks = (Object.entries(campaign.links) as Array<[PreSaveDsp, string]>)
        .filter((entry): entry is [PreSaveDsp, string] => Boolean(entry[1]));
    const utmHref = `https://indii.music/?utm_source=presave&utm_medium=fan_page&utm_campaign=${encodeURIComponent(campaign.id)}`;
    const parsedReleaseDate = new Date(campaign.releaseDate);
    const formattedReleaseDate = Number.isNaN(parsedReleaseDate.getTime())
        ? null
        : parsedReleaseDate.toLocaleDateString('en-US', {
            month: 'long',
            day: 'numeric',
            year: 'numeric',
        });

    const countdownTiles = countdown ? [
        { label: 'Days', value: padTwo(countdown.days) },
        { label: 'Hrs', value: padTwo(countdown.hours) },
        { label: 'Min', value: padTwo(countdown.minutes) },
        { label: 'Sec', value: padTwo(countdown.seconds) },
    ] : [];

    return (
        <main
            className="min-h-screen bg-black px-5 py-10 text-white"
            style={{ '--presave-accent': campaign.themeColor } as React.CSSProperties}
        >
            <div className="mx-auto flex max-w-lg flex-col items-center">
                <a href={utmHref} className="mb-8 text-sm font-semibold tracking-wide text-gray-500 hover:text-white">
                    indii.music
                </a>
                {campaign.coverArtUrl ? (
                    <img src={campaign.coverArtUrl} alt={`${campaign.title} cover art`} className="h-56 w-56 rounded-2xl object-cover shadow-2xl" />
                ) : (
                    <div className="flex h-56 w-56 items-center justify-center rounded-2xl border border-white/10 bg-white/5">
                        <Music size={64} className="text-gray-600" />
                    </div>
                )}

                <h1 className="mt-7 text-center text-xl font-bold">{campaign.title}</h1>
                {formattedReleaseDate && (
                    <p className="mt-2 flex items-center gap-2 text-sm text-gray-400">
                        <Calendar size={14} />
                        {formattedReleaseDate}
                    </p>
                )}

                {countdown && (
                    <div className="mt-5 w-full" aria-live="off">
                        <p className="sr-only">{countdown.accessibleLabel}</p>
                        {countdown.isOut ? (
                            <div
                                aria-hidden="true"
                                className="mx-auto inline-flex items-center justify-center rounded-full border bg-white/[0.04] px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.2em]"
                                style={{ borderColor: `${campaign.themeColor}66`, color: campaign.themeColor }}
                            >
                                Out now
                            </div>
                        ) : (
                            <div
                                aria-hidden="true"
                                className="mx-auto flex max-w-xs items-center justify-center gap-2"
                            >
                                {countdownTiles.map((tile, index) => (
                                    <React.Fragment key={tile.label}>
                                        <div
                                            className="flex min-w-[58px] flex-col items-center rounded-xl border bg-white/[0.03] px-2.5 py-2"
                                            style={{ borderColor: `${campaign.themeColor}40` }}
                                        >
                                            <span
                                                className="font-mono text-xl font-bold tabular-nums leading-none"
                                                style={{ color: campaign.themeColor }}
                                            >
                                                {tile.value}
                                            </span>
                                            <span className="mt-1 font-mono text-[10px] uppercase tracking-widest text-gray-500">
                                                {tile.label}
                                            </span>
                                        </div>
                                        {index < countdownTiles.length - 1 && (
                                            <span className="font-mono text-lg font-bold text-gray-600">:</span>
                                        )}
                                    </React.Fragment>
                                ))}
                            </div>
                        )}
                    </div>
                )}

                {(campaign.captureEmails || campaign.capturePhones) && (
                    <div className="mt-8 w-full space-y-4 rounded-2xl border border-white/10 bg-white/[0.03] p-5">
                        <p className="text-sm text-gray-300">Choose a platform after entering the requested contact details.</p>
                        {campaign.captureEmails && (
                            <label className="block text-xs font-semibold uppercase tracking-wide text-gray-400">
                                <span className="mb-1.5 flex items-center gap-2"><Mail size={13} /> Email</span>
                                <input
                                    type="email"
                                    value={email}
                                    onChange={event => setEmail(event.target.value)}
                                    autoComplete="email"
                                    className="w-full rounded-lg border border-white/10 bg-black/50 px-3 py-2.5 text-sm text-white outline-none focus:border-green-400/60"
                                />
                            </label>
                        )}
                        {campaign.capturePhones && (
                            <label className="block text-xs font-semibold uppercase tracking-wide text-gray-400">
                                <span className="mb-1.5 flex items-center gap-2"><Phone size={13} /> Phone</span>
                                <input
                                    type="tel"
                                    value={phone}
                                    onChange={event => setPhone(event.target.value)}
                                    autoComplete="tel"
                                    className="w-full rounded-lg border border-white/10 bg-black/50 px-3 py-2.5 text-sm text-white outline-none focus:border-green-400/60"
                                />
                            </label>
                        )}
                        <label className="flex items-start gap-3 text-xs leading-relaxed text-gray-400">
                            <input
                                type="checkbox"
                                checked={consented}
                                onChange={event => setConsented(event.target.checked)}
                                className="mt-0.5"
                            />
                            <span>
                                I agree to receive release updates from this artist. I can unsubscribe at any time. See the{' '}
                                <a href="/privacy" className="underline hover:text-white">Privacy Policy</a>.
                            </span>
                        </label>
                    </div>
                )}

                <div className="mt-6 grid w-full gap-3">
                    {availableLinks.map(([dsp, url]) => (
                        <button
                            key={dsp}
                            type="button"
                            disabled={submittingDsp !== null}
                            onClick={() => void handlePreSave(dsp, url)}
                            className="flex items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-semibold text-black disabled:cursor-wait disabled:opacity-60"
                            style={{ backgroundColor: campaign.themeColor }}
                        >
                            {submittingDsp === dsp && <Loader2 size={15} className="animate-spin" />}
                            Pre-save on {DSP_LABELS[dsp]}
                        </button>
                    ))}
                </div>

                <div className="mt-4 grid w-full grid-cols-1 gap-3 sm:grid-cols-2">
                    <button
                        type="button"
                        onClick={() => void handleShareDrop()}
                        className={`${SIGNATURE_BUTTON_BASE} ${GOLD_TONE.button} min-h-11 px-4 py-2.5 text-sm`}
                    >
                        {shareStatus === 'copied'
                            ? <Check size={15} className={GOLD_TONE.icon} />
                            : <Share2 size={15} className={GOLD_TONE.icon} />}
                        <span className={GOLD_TONE.label}>Share this drop</span>
                        <span aria-hidden="true" className={GOLD_TONE.sweep} />
                    </button>

                    <button
                        type="button"
                        disabled={cardBusy}
                        onClick={() => void handleStoryCard()}
                        className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-white/15 bg-white/5 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:border-white/30 hover:bg-white/10 disabled:cursor-wait disabled:opacity-60"
                    >
                        {cardBusy
                            ? <Loader2 size={15} className="animate-spin" />
                            : <ImageDown size={15} style={{ color: campaign.themeColor }} />}
                        {cardBusy ? 'Creating card…' : 'Story card'}
                    </button>
                </div>

                {shareStatus !== 'idle' && (
                    <p
                        role="status"
                        className={`mt-3 text-xs font-medium ${shareStatus === 'failed' ? 'text-red-400' : 'text-amber-300'}`}
                    >
                        {shareStatus === 'copied'
                            ? 'Link copied'
                            : shareStatus === 'shared'
                                ? 'Link shared'
                                : 'Copy failed'}
                    </p>
                )}

                {cardStatus && (
                    <p role="status" className="mt-2 text-xs font-medium text-emerald-300">
                        {cardStatus}
                    </p>
                )}

                {cardError && (
                    <p role="alert" className="mt-2 flex items-center gap-1.5 text-xs text-red-400">
                        <AlertCircle size={14} /> {cardError}
                    </p>
                )}

                {submitError && (
                    <p role="alert" className="mt-4 flex items-center gap-2 text-sm text-red-400">
                        <AlertCircle size={15} /> {submitError}
                    </p>
                )}
                <p className="mt-8 text-center text-[11px] leading-relaxed text-gray-600">
                    Contact information is stored for this artist’s campaign and is never shown publicly.
                </p>
                <a
                    href={utmHref}
                    className="mt-3 text-[11px] font-medium text-gray-500 transition-colors hover:text-gray-300"
                >
                    made with indii · indii.music
                </a>
            </div>
        </main>
    );
}

export default PreSaveLandingPage;
