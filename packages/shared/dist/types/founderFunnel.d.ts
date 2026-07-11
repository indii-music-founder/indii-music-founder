export declare const FOUNDER_FUNNEL_EVENTS: readonly ["founder_site_view", "founder_preview_cta_clicked", "founder_auth_viewed", "founder_auth_submitted", "founder_auth_completed", "founder_walkthrough_started", "founder_walkthrough_completed", "founder_intro_panels_closed", "founder_tour_started", "founder_tour_completed", "founder_tour_dismissed", "founder_portal_viewed", "founder_checkout_viewed", "founder_boardroom_reached", "founder_agreement_reviewed", "founder_path_selected", "founder_pay_now_selected", "founder_talk_first_selected", "founder_interest_clicked"];
export type FounderFunnelEventName = typeof FOUNDER_FUNNEL_EVENTS[number];
export interface FounderFunnelEventDetails {
    [key: string]: unknown;
}
export interface FounderFunnelEventInput {
    eventName: FounderFunnelEventName;
    path: string;
    url: string;
    sessionId: string;
    source?: 'founder' | 'public';
    userId?: string | null;
    email?: string | null;
    details?: FounderFunnelEventDetails;
    occurredAtMs?: number;
}
export interface FounderFunnelEventRecord {
    eventName: FounderFunnelEventName;
    path: string;
    url: string;
    sessionId: string;
    source: 'founder' | 'public';
    userId?: string | null;
    email?: string | null;
    detailsJson: string;
    occurredAtMs: number;
}
export declare function createFounderFunnelEventRecord(input: FounderFunnelEventInput): FounderFunnelEventRecord;
//# sourceMappingURL=founderFunnel.d.ts.map