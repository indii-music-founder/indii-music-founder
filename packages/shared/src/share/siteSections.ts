/**
 * Shareable sections of the indii.music home page ("Platform Guide & Wiki").
 *
 * Each section gets a path-based share URL (`/s/:id`) because URL fragments
 * never reach the server, so `/#pricing` can't carry its own link preview.
 * `/s/:id` is served by the shareMeta function with these tags and then
 * lands the visitor on `/#id`. Titles mirror the on-page headlines.
 */
export interface SiteSection {
    id: string;
    /** Short label for the share chip and the image eyebrow. */
    label: string;
    /** Headline as it appears on the page. */
    title: string;
    description: string;
}

export const SITE_SECTIONS: readonly SiteSection[] = [
    { id: 'now-what', label: 'Now what?', title: 'You make the music. We help you figure out what comes next.', description: 'Start with a free Artist Passport assessment of your rights, royalties and release readiness.' },
    { id: 'legacy-shift', label: 'The shift', title: 'Stop explaining your brand to generic software.', description: 'indii keeps your sound, story and catalog in context across every release task.' },
    { id: 'capabilities', label: 'Capabilities', title: 'Run the whole release. Keep the context connected.', description: 'Specialist agents for rights, distribution, marketing, finance and more, working from one picture of your career.' },
    { id: 'overlooked-work', label: 'The little things', title: 'The little things add up to a career.', description: 'Splits, metadata, registrations and deadlines: the work behind the music that independent artists carry alone.' },
    { id: 'conductor', label: 'Conductor', title: 'One direction. The whole system moves.', description: 'Give one direction and indii coordinates the release work across every department.' },
    { id: 'studio-preview', label: 'Studio', title: 'Start with finished music. Leave with a campaign.', description: 'See how indii studio turns a finished track into release assets, plans and campaigns.' },
    { id: 'principles', label: 'Principles', title: 'You stay the artist. You also stay in control.', description: 'indii is built for independent artists: your music, your rights, your decisions.' },
    { id: 'founder-access', label: 'Founding Owner', title: 'Founding Owner License.', description: 'Join the founding artists shaping indii.music.' },
    { id: 'pricing', label: 'Pricing', title: 'Choose the stage that fits your career now.', description: 'Plans for every stage of an independent music career.' },
] as const;

export function findSiteSection(id: string | undefined | null): SiteSection | null {
    if (!id) return null;
    return SITE_SECTIONS.find((section) => section.id === id) ?? null;
}

/** Public path of the pre-rendered 1200×630 preview image for a section. */
export function siteSectionOgImagePath(section: SiteSection): string {
    return `/og/section-${section.id}.jpg`;
}

export function siteSectionSharePath(section: SiteSection): string {
    return `/s/${section.id}`;
}
