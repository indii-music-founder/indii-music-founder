/**
 * Server-safe (no DOM) view of a shared Artist Passport code.
 *
 * The landing site encodes `/passport/r/:code` as base64url JSON of the
 * multiple-choice answers (see packages/landing/src/lib/passportShare.ts).
 * Link-preview rendering only needs the career stage, so this decodes just
 * that, against a whitelist, without trusting any free text in the code.
 */
export const PASSPORT_SHARE_STAGES = [
    { id: 'Just starting out', badge: 'STAGE 01', slug: 'stage-01' },
    { id: 'Building momentum', badge: 'STAGE 02', slug: 'stage-02' },
    { id: 'Established independent artist', badge: 'STAGE 03', slug: 'stage-03' },
    { id: 'Rebooting / Starting fresh', badge: 'STAGE 04', slug: 'stage-04' },
    { id: 'Producer / Songwriter stepping forward', badge: 'STAGE 05', slug: 'stage-05' },
    { id: 'Industry veteran / Catalog owner', badge: 'STAGE 06', slug: 'stage-06' },
] as const;

export type PassportShareStage = typeof PASSPORT_SHARE_STAGES[number];

const MAX_CODE_LENGTH = 1024;

function base64UrlToUtf8(code: string): string {
    const padded = code.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(code.length / 4) * 4, '=');
    const binary = atob(padded);
    const bytes = Uint8Array.from(binary, (ch) => ch.charCodeAt(0));
    return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
}

/** Returns the whitelisted stage a share code points at, or null. */
export function decodePassportShareStage(code: string | undefined | null): PassportShareStage | null {
    if (!code || code.length > MAX_CODE_LENGTH || !/^[A-Za-z0-9_-]+$/.test(code)) return null;
    try {
        const payload = JSON.parse(base64UrlToUtf8(code)) as { v?: unknown; c?: unknown };
        if (payload?.v !== 1 || typeof payload.c !== 'string') return null;
        return PASSPORT_SHARE_STAGES.find((stage) => stage.id === payload.c) ?? null;
    } catch {
        return null;
    }
}

/** Public path of the pre-rendered 1200×630 preview image for a stage. */
export function passportStageOgImagePath(stage: PassportShareStage): string {
    return `/og/passport-${stage.slug}.jpg`;
}
