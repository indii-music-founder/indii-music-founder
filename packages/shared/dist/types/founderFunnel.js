export const FOUNDER_FUNNEL_EVENTS = [
    'founder_site_view',
    'founder_preview_cta_clicked',
    'founder_auth_viewed',
    'founder_auth_submitted',
    'founder_auth_completed',
    'founder_walkthrough_started',
    'founder_walkthrough_completed',
    'founder_intro_panels_closed',
    'founder_tour_started',
    'founder_tour_completed',
    'founder_tour_dismissed',
    'founder_portal_viewed',
    'founder_checkout_viewed',
    'founder_boardroom_reached',
    'founder_agreement_reviewed',
    'founder_path_selected',
    'founder_pay_now_selected',
    'founder_talk_first_selected',
    'founder_interest_clicked',
];
export function createFounderFunnelEventRecord(input) {
    return {
        eventName: input.eventName,
        path: input.path,
        url: input.url,
        sessionId: input.sessionId,
        source: input.source ?? 'founder',
        userId: input.userId ?? null,
        email: input.email ?? null,
        detailsJson: JSON.stringify(input.details ?? {}),
        occurredAtMs: input.occurredAtMs ?? Date.now(),
    };
}
