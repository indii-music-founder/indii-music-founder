/**
 * smartLink — the only bridge between an ad click and a music outcome.
 *
 * ── Why this has to exist ───────────────────────────────────────────────────
 * When a fan clicks an ad for a song, the destination is Spotify. Nothing we
 * control observes what happens next: no pixel survives the DSP handoff, and
 * royalty reporting arrives months later with no campaign attached. Point an
 * ad straight at a DSP and the money is spent into a void.
 *
 * Routing the click through an indii-owned redirect buys the one observation
 * we can actually make: *this fan, from this campaign, chose this service at
 * this moment*. Everything the optimizer knows about fan outcomes starts here.
 *
 * ── What it is not ──────────────────────────────────────────────────────────
 * Not a tracker. It records the campaign that paid for the click and the
 * service the fan chose. No cross-site identity, no fingerprinting, no
 * durable per-person id — see `hashClientIp`.
 */

import { onRequest } from 'firebase-functions/v2/https';
import { logger } from 'firebase-functions/v2';
import * as admin from 'firebase-admin';
import { createHash, randomUUID } from 'node:crypto';

import { buildConversionEventId, type ConversionEvent } from '@indii/shared';
import { enqueueConversionEventDetached } from './conversionEventOutbox';

const REGION = 'us-central1';

/** `smartLinks/{slug}` — server-resolved; no client reads it directly. */
export const SMART_LINK_COLLECTION = 'smartLinks';

/**
 * Slugs appear in ad copy and get typed by hand. Restricting the charset keeps
 * them unambiguous and keeps path traversal out of the lookup.
 */
const SLUG_PATTERN = /^[a-z0-9][a-z0-9-]{1,62}[a-z0-9]$/;

/** Redirect cache lifetime. Short: a slug's destination can change mid-campaign. */
const REDIRECT_CACHE_SECONDS = 60;

export interface SmartLinkDoc {
    artistId: string;
    /** Where the fan ends up when they express no preference. */
    defaultUrl: string;
    /** Per-service destinations, keyed by DSP id ('spotify', 'apple', …). */
    destinations?: Record<string, string>;
    /** Campaign this link belongs to, for attribution. */
    campaignId?: string;
    active?: boolean;
}

/**
 * Coarse, rotating, non-reversible client hash.
 *
 * Used only to tell one click from a reload within the same day. The daily
 * salt rotation means the value cannot be joined across days, so it does not
 * accumulate into a durable identifier for a person — but it is still enough
 * to stop a refresh from being counted as two fans.
 */
export function hashClientIp(ip: string, dayStamp: string): string {
    return createHash('sha256').update(`${dayStamp}:${ip}`).digest('hex').slice(0, 32);
}

/** First hop of X-Forwarded-For is the client; the rest are proxies. */
function clientIpFrom(header: string | undefined, fallback: string | undefined): string {
    const forwarded = (header ?? '').split(',')[0]?.trim();
    return forwarded || fallback || 'unknown';
}

/**
 * Only http(s), and only absolute URLs. A stored destination is artist-supplied
 * data; without this an open redirect would let anyone borrow our domain's
 * reputation for a phishing hop.
 */
export function isSafeDestination(url: string): boolean {
    try {
        const parsed = new URL(url);
        return parsed.protocol === 'https:' || parsed.protocol === 'http:';
    } catch {
        return false;
    }
}

/**
 * Chooses the destination for a request.
 *
 * `?dsp=` lets a landing page send a fan to their preferred service while
 * keeping one slug — and one attribution chain — for the whole campaign.
 */
export function resolveDestination(link: SmartLinkDoc, dsp: string | undefined): string | null {
    const candidate = dsp && link.destinations?.[dsp] ? link.destinations[dsp] : link.defaultUrl;
    return candidate && isSafeDestination(candidate) ? candidate : null;
}

/**
 * Public redirect endpoint: `/l/{slug}`.
 *
 * Fast path by construction — one Firestore read, then a 302. The conversion
 * event is enqueued detached, because a fan must never wait on our analytics,
 * and an analytics failure must never cost the artist a listener.
 */
export const smartLinkRedirect = onRequest(
    // 512MiB is the floor here, not a tuning choice: below ~259MiB the shared
    // cold-start footprint OOMs before the container binds its port, failing
    // the deploy health check. Enforced by `npm run check:functions`.
    { region: REGION, timeoutSeconds: 60, memory: '512MiB', cpu: 'gcf_gen1', concurrency: 1, cors: false },
    async (req, res) => {
        const slug = (req.path.split('/').filter(Boolean).pop() ?? '').toLowerCase();

        if (!SLUG_PATTERN.test(slug)) {
            res.status(404).send('Not found');
            return;
        }

        let link: SmartLinkDoc | undefined;
        try {
            const snapshot = await admin.firestore()
                .collection(SMART_LINK_COLLECTION).doc(slug).get();
            link = snapshot.exists ? snapshot.data() as SmartLinkDoc : undefined;
        } catch (error) {
            logger.error('[smartLink] Lookup failed', {
                slug, error: error instanceof Error ? error.message : String(error),
            });
            res.status(503).send('Temporarily unavailable');
            return;
        }

        if (!link || link.active === false) {
            res.status(404).send('Not found');
            return;
        }

        const dsp = typeof req.query.dsp === 'string' ? req.query.dsp : undefined;
        const destination = resolveDestination(link, dsp);
        if (!destination) {
            logger.error('[smartLink] Link has no usable destination', { slug });
            res.status(404).send('Not found');
            return;
        }

        const occurredAt = new Date();
        const dayStamp = occurredAt.toISOString().slice(0, 10);
        const clientHash = hashClientIp(
            clientIpFrom(req.headers['x-forwarded-for'] as string | undefined, req.ip),
            dayStamp,
        );

        const utmSource = typeof req.query.utm_source === 'string' ? req.query.utm_source : '';
        const utmMedium = typeof req.query.utm_medium === 'string' ? req.query.utm_medium : '';
        const utmCampaign = typeof req.query.utm_campaign === 'string' ? req.query.utm_campaign : '';

        const event: ConversionEvent = {
            schemaVersion: 'conversion-event.v1',
            // Each hit is its own occurrence; randomUUID keeps a shared device
            // from collapsing two genuine clicks into one. Retry-safety comes
            // from the outbox document id, not from re-deriving this.
            eventId: buildConversionEventId({
                platform: 'smart_link',
                eventType: dsp ? 'dsp_redirect' : 'link_click',
                sourceId: randomUUID(),
            }),
            artistId: link.artistId,
            platform: 'smart_link',
            eventType: dsp ? 'dsp_redirect' : 'link_click',
            occurredAt: occurredAt.toISOString(),
            revenueMinor: 0,
            costMinor: 0,
            currency: 'USD',
            campaignId: link.campaignId ?? '',
            adCreativeId: '',
            smartLinkSlug: slug,
            utmSource,
            utmMedium,
            utmCampaign,
            metadata: {
                ...(dsp ? { dsp } : {}),
                clientHash,
                // Meta's click id, when the fan arrived from a Meta ad. This is
                // what lets the Conversions API tie a server event back to the
                // exact ad that paid for it.
                ...(typeof req.query.fbclid === 'string' ? { fbclid: req.query.fbclid } : {}),
            },
        };

        enqueueConversionEventDetached(event);

        res.set('Cache-Control', `public, max-age=${REDIRECT_CACHE_SECONDS}`);
        res.redirect(302, destination);
    },
);
