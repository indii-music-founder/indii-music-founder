import { beforeEach, describe, expect, it, vi } from 'vitest';

const { sentry } = vi.hoisted(() => ({
    sentry: {
        init: vi.fn(),
        setUser: vi.fn(),
        close: vi.fn(async () => true),
        browserTracingIntegration: vi.fn(() => ({})),
        replayIntegration: vi.fn(() => ({})),
    },
}));
vi.mock('@sentry/react', () => sentry);

async function loadService() {
    vi.resetModules();
    vi.stubEnv('VITE_SENTRY_DSN', 'https://public@example.ingest.sentry.io/1');
    const consent = await import('@/services/privacy/consent');
    const service = await import('@/services/observability/SentryService');
    return { consent, service };
}

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

describe('SentryService privacy controls', () => {
    beforeEach(() => {
        localStorage.clear();
        Object.values(sentry).forEach((fn) => fn.mockClear());
    });

    it('omits the email from the Sentry user when Do Not Sell is on', async () => {
        const { consent, service } = await loadService();
        consent.updateConsentPreferences({ errorTracking: true, doNotSell: true });

        service.setSentryUser('u1', 'artist@example.com');
        await flush();

        expect(sentry.setUser).toHaveBeenLastCalledWith({ id: 'u1' });
    });

    it('includes the email when the user has not opted out', async () => {
        const { consent, service } = await loadService();
        consent.updateConsentPreferences({ errorTracking: true, doNotSell: false });

        service.setSentryUser('u1', 'artist@example.com');
        await flush();

        expect(sentry.setUser).toHaveBeenLastCalledWith({ id: 'u1', email: 'artist@example.com' });
    });

    it('strips contact details from outgoing events while opted out', async () => {
        const { consent, service } = await loadService();
        consent.updateConsentPreferences({ errorTracking: true, doNotSell: true });
        service.setSentryUser('u1');
        await flush();

        const { beforeSend } = sentry.init.mock.calls[0][0] as { beforeSend: (e: object) => { user?: object } };
        const event = beforeSend({ user: { id: 'u1', email: 'artist@example.com', ip_address: '1.2.3.4' } });

        expect(event.user).toEqual({ id: 'u1' });
    });

    it('shuts Sentry down when error-tracking consent is withdrawn', async () => {
        const { consent, service } = await loadService();
        consent.updateConsentPreferences({ errorTracking: true });
        service.setSentryUser('u1');
        await flush();

        consent.updateConsentPreferences({ errorTracking: false });
        await flush();

        expect(sentry.close).toHaveBeenCalled();
    });
});
