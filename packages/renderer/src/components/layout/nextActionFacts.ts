import type { DashboardRelease, ReleaseStatus } from '@/services/distribution/types/distributor';
import type { EarningsSummary } from '@/services/revenue/schema';
import type { NextActionCandidate } from '@/config/typesafeJudgments';

/**
 * Derives next-action candidates strictly from account state that has
 * already been loaded. Every candidate's copy is built from real fields;
 * missing, loading, or empty sources contribute nothing. No candidates
 * means the banner must not render.
 */

const SUBMISSION_PENDING: ReadonlySet<ReleaseStatus> = new Set<ReleaseStatus>([
    'draft',
    'validating',
    'ready_for_manual_submission',
]);

export interface NextActionFactsInput {
    releases: DashboardRelease[] | null | undefined;
    releasesLoading: boolean;
    earnings: EarningsSummary | null | undefined;
    earningsLoading: boolean;
}

function describeTitles(titles: string[]): string {
    const quoted = titles.map(t => `'${t}'`);
    if (quoted.length === 1) return quoted[0];
    if (quoted.length === 2) return `${quoted[0]} and ${quoted[1]}`;
    return `${quoted[0]} and ${quoted.length - 1} more`;
}

export function deriveNextActionFacts(input: NextActionFactsInput): NextActionCandidate[] {
    const candidates: NextActionCandidate[] = [];

    if (!input.releasesLoading && Array.isArray(input.releases) && input.releases.length > 0) {
        const issues: Array<{ title: string; distributor: string; detail: string }> = [];
        const pending: string[] = [];

        for (const release of input.releases) {
            const title = release.title?.trim();
            if (!title) continue;
            const deployments = Object.entries(release.deployments ?? {});
            let isPending = false;
            for (const [distributor, deployment] of deployments) {
                if (!deployment) continue;
                if (deployment.error || deployment.status === 'takedown_requested') {
                    issues.push({
                        title,
                        distributor,
                        detail: deployment.error ? deployment.error : 'takedown requested',
                    });
                } else if (SUBMISSION_PENDING.has(deployment.status)) {
                    isPending = true;
                }
            }
            if (isPending) pending.push(title);
        }

        if (issues.length > 0) {
            const first = issues[0];
            const extra = issues.length > 1 ? ` (+${issues.length - 1} more)` : '';
            candidates.push({
                id: 'release_delivery_issue',
                targetModule: 'distribution',
                title: `Delivery issue: '${first.title}'`,
                description: `${first.distributor}: ${first.detail}${extra}.`,
                evidence: `${issues.length} deployment issue(s) across loaded releases`,
            });
        }

        if (pending.length > 0) {
            const unique = [...new Set(pending)];
            candidates.push({
                id: 'release_needs_submission',
                targetModule: 'distribution',
                title: `Finish submitting ${describeTitles(unique)}`,
                description: `${unique.length} release${unique.length === 1 ? '' : 's'} still in draft or awaiting submission.`,
                evidence: `${unique.length} release(s) with draft/validating/ready deployments`,
            });
        }
    }

    const earnings = input.earnings;
    if (!input.earningsLoading && earnings && earnings.totalStreams > 0) {
        const streams = earnings.totalStreams.toLocaleString('en-US');
        const net = earnings.totalNetRevenue.toLocaleString('en-US', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
        });
        candidates.push({
            id: 'review_earnings',
            targetModule: 'finance',
            title: 'Review earnings',
            description: `${streams} streams, ${earnings.currencyCode} ${net} net (${earnings.period.startDate} – ${earnings.period.endDate}).`,
            evidence: `earningsSummary.totalStreams=${earnings.totalStreams}`,
        });
    }

    return candidates;
}
