import React, { useEffect, useRef, useState } from 'react';
import { AlertCircle, Calendar, Loader2, Mail, Music, Phone } from 'lucide-react';
import {
    preSaveCampaignService,
    type PreSaveCampaign,
    type PreSaveDsp,
} from '@/services/marketing/PreSaveCampaignService';
import { secureRandomAlphanumeric } from '@/utils/crypto-random';

const DSP_LABELS: Record<PreSaveDsp, string> = {
    spotify: 'Spotify',
    appleMusic: 'Apple Music',
    amazonMusic: 'Amazon Music',
};

function createLeadId(): string {
    if (typeof globalThis.crypto?.randomUUID === 'function') {
        return globalThis.crypto.randomUUID();
    }
    return `lead-${Date.now().toString(36)}-${secureRandomAlphanumeric(16)}`;
}

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
    const leadIds = useRef<Partial<Record<PreSaveDsp, string>>>({});

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

    return (
        <main
            className="min-h-screen bg-black px-5 py-10 text-white"
            style={{ '--presave-accent': campaign.themeColor } as React.CSSProperties}
        >
            <div className="mx-auto flex max-w-lg flex-col items-center">
                <a href="https://indii.music" className="mb-8 text-sm font-semibold tracking-wide text-gray-500 hover:text-white">
                    indii.music
                </a>
                {campaign.coverArtUrl ? (
                    <img src={campaign.coverArtUrl} alt={`${campaign.title} cover art`} className="h-56 w-56 rounded-2xl object-cover shadow-2xl" />
                ) : (
                    <div className="flex h-56 w-56 items-center justify-center rounded-2xl border border-white/10 bg-white/5">
                        <Music size={64} className="text-gray-600" />
                    </div>
                )}

                <h1 className="mt-7 text-center text-3xl font-bold">{campaign.title}</h1>
                <p className="mt-2 flex items-center gap-2 text-sm text-gray-400">
                    <Calendar size={14} />
                    {new Date(campaign.releaseDate).toLocaleDateString('en-US', {
                        month: 'long',
                        day: 'numeric',
                        year: 'numeric',
                    })}
                </p>

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

                {submitError && (
                    <p role="alert" className="mt-4 flex items-center gap-2 text-sm text-red-400">
                        <AlertCircle size={15} /> {submitError}
                    </p>
                )}
                <p className="mt-8 text-center text-[11px] leading-relaxed text-gray-600">
                    Contact information is stored for this artist’s campaign and is never shown publicly.
                </p>
            </div>
        </main>
    );
}

export default PreSaveLandingPage;
