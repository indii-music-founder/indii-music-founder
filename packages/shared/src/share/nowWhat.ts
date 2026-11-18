/**
 * Canonical "Now what?" franchise hooks — single source of truth shared across
 * the landing page, Artist Passport deep links, share cards, and `shareMeta`.
 *
 * Each hook maps a real moment in an independent artist's career to a path-based
 * share URL (`/n/:id`) with its own link preview, then routes into the free
 * Artist Passport assessment (`/passport?entry=:id`).
 */
export interface NowWhatHook {
    id: string;
    /** Situation setup line before the "Now what?" turn. */
    situation: string;
    /** Full signature question shown on cards and previews. */
    hook: string;
    /** What indii helps the artist do next. */
    answer: string;
    /** Short label for badges and film reels. */
    moduleLabel: string;
}

export const NOW_WHAT_HOOKS: readonly NowWhatHook[] = [
    {
        id: 'first-song',
        situation: 'You finished your first song.',
        hook: 'You finished your first song. Now what?',
        answer: 'Document credits and ownership, then prepare your release.',
        moduleLabel: 'Release Readiness',
    },
    {
        id: 'already-released',
        situation: 'You released through DistroKid.',
        hook: 'You released through DistroKid. Now what?',
        answer: 'Review collection coverage, organize your catalog, and plan promotion.',
        moduleLabel: 'Rights & Catalog',
    },
    {
        id: 'local-band',
        situation: 'You’re a popular local band.',
        hook: 'You’re a popular local band. Now what?',
        answer: 'Prepare your EPK, booking terms, merchandise budget, and show finances.',
        moduleLabel: 'Booking & Merch',
    },
    {
        id: 'growing-audience',
        situation: 'People are listening.',
        hook: 'People are listening. Now what?',
        answer: 'Build direct fan relationships and a repeatable campaign.',
        moduleLabel: 'Campaign & Presave',
    },
    {
        id: 'earning-income',
        situation: 'Your music is making money.',
        hook: 'Your music is making money. Now what?',
        answer: 'Organize income, expenses, and collaborator splits.',
        moduleLabel: 'Finance & Splits',
    },
    {
        id: 'returning-artist',
        situation: 'You’re returning to music.',
        hook: 'You’re returning to music. Now what?',
        answer: 'Review your catalog and build a manageable restart plan.',
        moduleLabel: 'Catalog Recovery',
    },
] as const;

export function findNowWhatHook(id: string | undefined | null): NowWhatHook | null {
    if (!id) return null;
    return NOW_WHAT_HOOKS.find((hook) => hook.id === id) ?? null;
}

export function nowWhatSharePath(hook: NowWhatHook): string {
    return `/n/${hook.id}`;
}

export function nowWhatOgImagePath(hook: NowWhatHook): string {
    return `/og/now-what-${hook.id}.jpg`;
}

export function nowWhatVideoPath(hook: NowWhatHook): string {
    return `/videos/now-what/now-what-${hook.id}.mp4`;
}

export function nowWhatPosterPath(hook: NowWhatHook): string {
    return `/videos/now-what/now-what-${hook.id}-poster.jpg`;
}

export function nowWhatVttPath(hook: NowWhatHook): string {
    return `/videos/now-what/now-what-${hook.id}.vtt`;
}

export function nowWhatPassportPath(hook: NowWhatHook): string {
    return `/passport?entry=${encodeURIComponent(hook.id)}&source=now_what_share&utm_source=now_what_share`;
}
