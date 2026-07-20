import { useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';

import {
    instagramAnalyticsService,
    type InstagramPageChoice,
} from '@/services/analytics/InstagramAnalyticsService';

type CallbackState =
    | { phase: 'connecting' }
    | { phase: 'select_page'; intentId: string; pages: InstagramPageChoice[] }
    | { phase: 'error'; message: string };

export function InstagramOAuthCallback() {
    const [params] = useSearchParams();
    const navigate = useNavigate();
    const started = useRef(false);
    const [state, setState] = useState<CallbackState>({ phase: 'connecting' });
    const [selectedPageId, setSelectedPageId] = useState('');
    const [finalizing, setFinalizing] = useState(false);

    const code = params.get('code');
    const oauthState = params.get('state');
    const providerError = params.get('error_description') ?? params.get('error');

    useEffect(() => {
        if (started.current) return;
        started.current = true;
        if (providerError) {
            setState({ phase: 'error', message: `Instagram authorization was declined: ${providerError}` });
            return;
        }
        if (!code || !oauthState) {
            setState({ phase: 'error', message: 'Instagram did not return a complete authorization response. Reconnect and try again.' });
            return;
        }
        void instagramAnalyticsService.beginCallback(code, oauthState)
            .then(result => {
                if (result.kind === 'connected') {
                    navigate('/analytics', { replace: true });
                    return;
                }
                setSelectedPageId(result.pages[0]?.facebookPageId ?? '');
                setState({ phase: 'select_page', intentId: result.intentId, pages: result.pages });
            })
            .catch(error => setState({
                phase: 'error',
                message: error instanceof Error ? error.message : 'Instagram connection failed. Reconnect and try again.',
            }));
    }, [code, navigate, oauthState, providerError]);

    async function finalizeSelection() {
        if (state.phase !== 'select_page' || !selectedPageId || finalizing) return;
        setFinalizing(true);
        try {
            await instagramAnalyticsService.finalizePageSelection(state.intentId, selectedPageId);
            navigate('/analytics', { replace: true });
        } catch (error) {
            setState({ phase: 'error', message: error instanceof Error ? error.message : 'Instagram Page selection failed. Reconnect and try again.' });
        } finally {
            setFinalizing(false);
        }
    }

    return (
        <main className="min-h-screen bg-black px-6 py-16 text-white">
            <section className="mx-auto max-w-lg rounded-2xl border border-white/10 bg-white/[0.03] p-6 shadow-2xl">
                <h1 className="text-xl font-semibold">Connect Instagram</h1>
                {state.phase === 'connecting' && <p className="mt-3 text-sm text-slate-300">Securely finishing your Instagram connection…</p>}
                {state.phase === 'error' && (
                    <>
                        <p role="alert" className="mt-3 text-sm text-red-300">{state.message}</p>
                        <button type="button" onClick={() => navigate('/analytics', { replace: true })} className="mt-5 rounded-lg border border-white/15 px-4 py-2 text-sm font-medium text-slate-200 hover:bg-white/10">Return to Analytics</button>
                    </>
                )}
                {state.phase === 'select_page' && (
                    <>
                        <p className="mt-3 text-sm text-slate-300">Choose the Facebook Page linked to the Instagram professional account you want indii to connect. Tokens stay on the server.</p>
                        <fieldset className="mt-5 space-y-3">
                            <legend className="text-sm font-medium">Available Pages</legend>
                            {state.pages.map(page => (
                                <label key={page.facebookPageId} className="flex cursor-pointer items-start gap-3 rounded-lg border border-white/10 p-3 hover:bg-white/5">
                                    <input type="radio" name="instagram-page" value={page.facebookPageId} checked={selectedPageId === page.facebookPageId} onChange={() => setSelectedPageId(page.facebookPageId)} />
                                    <span><span className="block text-sm font-medium">{page.facebookPageName}</span><span className="block text-xs text-slate-400">Instagram: @{page.instagramUsername ?? page.instagramBusinessAccountId}</span></span>
                                </label>
                            ))}
                        </fieldset>
                        <button type="button" disabled={!selectedPageId || finalizing} onClick={() => void finalizeSelection()} className="mt-5 rounded-lg bg-white px-4 py-2 text-sm font-semibold text-black disabled:cursor-not-allowed disabled:opacity-50">
                            {finalizing ? 'Connecting…' : 'Connect selected account'}
                        </button>
                    </>
                )}
            </section>
        </main>
    );
}
