import { useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';

import { spotifyService } from '@/services/analytics/SpotifyService';
import { tikTokAnalyticsService } from '@/services/analytics/TikTokAnalyticsService';
import type { PlatformOAuthCallbackProvider } from './platformOAuthCallbackRoute';

const PROVIDER_LABELS: Readonly<Record<PlatformOAuthCallbackProvider, string>> = Object.freeze({
    spotify: 'Spotify',
    tiktok: 'TikTok',
});

interface PlatformOAuthCallbackProps {
    provider: PlatformOAuthCallbackProvider;
}

/** Complete an account-bound provider redirect from the real Studio callback URL. */
export function PlatformOAuthCallback({ provider }: PlatformOAuthCallbackProps) {
    const [params] = useSearchParams();
    const navigate = useNavigate();
    const started = useRef(false);
    const [exchangeError, setExchangeError] = useState<string | null>(null);
    const label = PROVIDER_LABELS[provider];

    const code = params.get('code');
    const oauthState = params.get('state');
    const providerError = params.get('error_description') ?? params.get('error');
    const inputError = providerError
        ? `${label} authorization was declined: ${providerError}`
        : !code || !oauthState
            ? `${label} did not return a complete authorization response. Reconnect and try again.`
            : null;
    const error = inputError ?? exchangeError;

    useEffect(() => {
        if (started.current) return;
        started.current = true;

        if (inputError || !code || !oauthState) return;

        const callback = provider === 'spotify'
            ? spotifyService.handleCallback(code, oauthState)
            : tikTokAnalyticsService.handleCallback(code, oauthState);

        void callback
            .then(() => navigate('/analytics', { replace: true }))
            .catch(callbackError => setExchangeError(
                callbackError instanceof Error
                    ? callbackError.message
                    : `${label} connection failed. Reconnect and try again.`,
            ));
    }, [code, inputError, label, navigate, oauthState, provider]);

    return (
        <main className="min-h-screen bg-black px-6 py-16 text-white">
            <section className="mx-auto max-w-lg rounded-2xl border border-white/10 bg-white/[0.03] p-6 shadow-2xl">
                <h1 className="text-xl font-semibold">Connect {label}</h1>
                {error ? (
                    <>
                        <p role="alert" className="mt-3 text-sm text-red-300">{error}</p>
                        <button
                            type="button"
                            onClick={() => navigate('/analytics', { replace: true })}
                            className="mt-5 rounded-lg border border-white/15 px-4 py-2 text-sm font-medium text-slate-200 hover:bg-white/10"
                        >
                            Return to Analytics
                        </button>
                    </>
                ) : (
                    <p className="mt-3 text-sm text-slate-300">
                        Securely finishing your {label} connection…
                    </p>
                )}
            </section>
        </main>
    );
}
