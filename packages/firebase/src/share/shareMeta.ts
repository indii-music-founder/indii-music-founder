/**
 * shareMeta — per-page link previews for shareable URLs.
 *
 * Link unfurlers (iMessage, Slack, X, WhatsApp, Discord…) don't run our SPA,
 * so every link used to preview as the generic site card. Hosting rewrites
 * `/presave/**` (app) and `/passport/r/**` (landing) here; we fetch that
 * site's own built `index.html`, swap in page-specific og:/twitter: tags and
 * serve it. Humans get the normal app (same HTML, better tags) — no
 * user-agent sniffing, no redirect.
 *
 * Fails open: if anything about the entity can't be resolved, the page is
 * served with the site's default tags. If the shell itself can't be fetched,
 * a minimal page links onward.
 */
import { onRequest } from 'firebase-functions/v2/https';
import { logger } from 'firebase-functions/v2';
import { decodePassportShareStage, passportStageOgImagePath } from '@indii/shared';
import { getPublicPreSaveCampaign } from '../marketing/presaveCampaigns';
import { arcjetKey } from '../config/secrets';
import { protectAnonymousSignupRequest } from '../functions/security/arcjet';

const REGION = 'us-central1';
const SHELL_TTL_MS = 5 * 60_000;
const SHELL_FETCH_TIMEOUT_MS = 4_000;
const CACHE_SECONDS = 300;

/** Only our own hosts may be fetched as a shell (no SSRF via Host headers). */
const ALLOWED_HOST = /^(?:[a-z0-9-]+\.)*(?:indii\.music|web\.app|firebaseapp\.com)$/i;
const DEFAULT_ORIGIN = { presave: 'https://app.indii.music', passport: 'https://indii.music' } as const;

export interface ShareMeta {
    title: string;
    description: string;
    url: string;
    image: string;
    imageAlt: string;
    /** Omit for cover art of unknown size. */
    imageSize?: { width: number; height: number };
}

export type ShareRoute =
    | { kind: 'presave'; campaignId: string }
    | { kind: 'passport'; code: string };

export function parseShareRoute(path: string): ShareRoute | null {
    const presave = /^\/presave\/([A-Za-z0-9_-]{8,128})\/?$/.exec(path);
    if (presave) return { kind: 'presave', campaignId: presave[1] };
    const passport = /^\/passport\/r\/([A-Za-z0-9_-]{1,1024})\/?$/.exec(path);
    if (passport) return { kind: 'passport', code: passport[1] };
    return null;
}

export function resolveOrigin(forwardedHost: string | undefined, route: ShareRoute): string {
    const host = (forwardedHost ?? '').split(',')[0].trim().toLowerCase();
    return host && ALLOWED_HOST.test(host) ? `https://${host}` : DEFAULT_ORIGIN[route.kind];
}

const escapeAttr = (value: string) =>
    value.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

const escapeText = (value: string) => value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

const META_TO_REPLACE = /<meta\s[^>]*?(?:property|name)\s*=\s*["'](?:og:[^"']*|twitter:(?!site)[^"']*|description)["'][^>]*>\s*/gis;

/** Replaces the shell's title/description/og:/twitter: tags (keeps twitter:site). */
export function injectShareMeta(html: string, meta: ShareMeta): string {
    const tags = [
        `<meta name="description" content="${escapeAttr(meta.description)}" />`,
        `<meta property="og:type" content="website" />`,
        `<meta property="og:site_name" content="indii.music" />`,
        `<meta property="og:url" content="${escapeAttr(meta.url)}" />`,
        `<meta property="og:title" content="${escapeAttr(meta.title)}" />`,
        `<meta property="og:description" content="${escapeAttr(meta.description)}" />`,
        `<meta property="og:image" content="${escapeAttr(meta.image)}" />`,
        `<meta property="og:image:alt" content="${escapeAttr(meta.imageAlt)}" />`,
        ...(meta.imageSize
            ? [
                `<meta property="og:image:width" content="${meta.imageSize.width}" />`,
                `<meta property="og:image:height" content="${meta.imageSize.height}" />`,
            ]
            : []),
        `<meta name="twitter:card" content="summary_large_image" />`,
        `<meta name="twitter:title" content="${escapeAttr(meta.title)}" />`,
        `<meta name="twitter:description" content="${escapeAttr(meta.description)}" />`,
        `<meta name="twitter:image" content="${escapeAttr(meta.image)}" />`,
    ].join('\n    ');

    const stripped = html
        .replace(META_TO_REPLACE, '')
        .replace(/<title>[\s\S]*?<\/title>/i, `<title>${escapeText(meta.title)}</title>`);
    return stripped.replace(/<\/head>/i, `    ${tags}\n  </head>`);
}

function formatReleaseDay(ms: number): string {
    return new Date(ms).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric', timeZone: 'UTC' });
}

export interface ShareMetaDeps {
    getPresave: (campaignId: string) => Promise<{ title: string; releaseDate: number; coverArtUrl: string }>;
    now?: () => number;
}

export async function resolveShareMeta(route: ShareRoute, origin: string, deps: ShareMetaDeps): Promise<ShareMeta | null> {
    if (route.kind === 'passport') {
        const stage = decodePassportShareStage(route.code);
        if (!stage) return null;
        return {
            title: `${stage.id} · Artist Passport`,
            description: 'A free 7-question check on rights, royalties and release readiness for independent artists. See where you stand.',
            url: `${origin}/passport/r/${route.code}`,
            image: `${origin}${passportStageOgImagePath(stage)}`,
            imageAlt: `Artist Passport ${stage.badge}: ${stage.id}`,
            imageSize: { width: 1200, height: 630 },
        };
    }

    const campaign = await deps.getPresave(route.campaignId);
    const released = campaign.releaseDate <= (deps.now ?? Date.now)();
    const day = formatReleaseDay(campaign.releaseDate);
    const hasCover = /^https:\/\//i.test(campaign.coverArtUrl);
    return {
        title: released ? `${campaign.title} — out now` : `Pre-save “${campaign.title}”`,
        description: released ? `Listen to ${campaign.title} on your favorite service.` : `Out ${day}. Pre-save it on Spotify, Apple Music or Amazon Music.`,
        url: `${origin}/presave/${route.campaignId}`,
        image: hasCover ? campaign.coverArtUrl : `${origin}/og-image.png`,
        imageAlt: hasCover ? `Cover art for ${campaign.title}` : 'indii.music',
        ...(hasCover ? {} : { imageSize: { width: 1200, height: 630 } }),
    };
}

const shellCache = new Map<string, { html: string; fetchedAt: number }>();

async function fetchShell(origin: string): Promise<string> {
    const cached = shellCache.get(origin);
    if (cached && Date.now() - cached.fetchedAt < SHELL_TTL_MS) return cached.html;
    const response = await fetch(`${origin}/`, { signal: AbortSignal.timeout(SHELL_FETCH_TIMEOUT_MS), redirect: 'error' });
    if (!response.ok) throw new Error(`Shell fetch failed: ${response.status}`);
    const html = await response.text();
    if (!/<\/head>/i.test(html)) throw new Error('Shell is not an HTML document');
    shellCache.set(origin, { html, fetchedAt: Date.now() });
    return html;
}

export const shareMeta = onRequest(
    // 512MiB is the shared cold-start floor enforced by `npm run check:functions` (see smartLink.ts).
    { region: REGION, timeoutSeconds: 30, memory: '512MiB', cpu: 'gcf_gen1', concurrency: 1, cors: false, secrets: [arcjetKey] },
    async (req, res) => {
        // These are ordinary page loads for fans (and link unfurlers), so use a
        // generous per-IP limit rather than the 10/min anonymous Arcjet window;
        // Hosting's CDN also absorbs repeats via s-maxage below.
        const protection = await protectAnonymousSignupRequest(
            ((req as { rawRequest?: unknown }).rawRequest ?? req) as never,
            'share-meta',
            'allow-low-risk-read',
            { mode: 'local-rate-limit', rateLimit: { bucket: 'share-meta', maxRequests: 120, windowMs: 60_000 } },
        );
        if (!protection.allowed) {
            res.status(protection.status || 429).send(protection.message || 'Rate limit exceeded');
            return;
        }

        if (req.method !== 'GET' && req.method !== 'HEAD') {
            res.status(405).set('Allow', 'GET, HEAD').send('Method Not Allowed');
            return;
        }
        const route = parseShareRoute(req.path);
        if (!route) {
            res.status(404).send('Not Found');
            return;
        }
        const origin = resolveOrigin(req.get('x-forwarded-host') ?? undefined, route);

        let shell: string;
        try {
            shell = await fetchShell(origin);
        } catch (error) {
            logger.warn('[shareMeta] shell unavailable', { origin, error: String(error) });
            const target = escapeAttr(route.kind === 'passport' ? `${origin}/passport` : origin);
            res.status(503).set('Cache-Control', 'no-store').type('html')
                .send(`<!doctype html><meta charset="utf-8"><title>indii.music</title><p><a href="${target}">Continue to indii.music</a></p>`);
            return;
        }

        let html = shell;
        try {
            const meta = await resolveShareMeta(route, origin, {
                getPresave: (id) => getPublicPreSaveCampaign(id),
            });
            if (meta) html = injectShareMeta(shell, meta);
        } catch (error) {
            // Unknown/expired campaign etc. — serve the app with default tags; it shows its own state.
            logger.info('[shareMeta] default tags', { kind: route.kind, error: String(error) });
        }

        res.status(200)
            .set('Cache-Control', `public, max-age=${CACHE_SECONDS}, s-maxage=${CACHE_SECONDS}`)
            .type('html')
            .send(html);
    },
);
