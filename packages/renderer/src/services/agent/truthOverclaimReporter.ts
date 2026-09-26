import { logger } from '@/utils/logger';
import { toast } from '@/core/context/ToastContext';

/**
 * Auto-files a GitHub issue when the app itself detects a capability-truth
 * overclaim in a Boardroom/agent status response (issue #317: such critiques
 * should originate from the product, not from hand-filed side-agent accounts).
 *
 * Delivery rides the same pipeline as in-app bug reports: reportBugFn saves
 * to Firestore `bug_reports` and creates/merges the GitHub issue server-side
 * (title+module dedupe there merges repeat detections as comments).
 *
 * Client-side cooldown keeps a runaway detection loop from spamming GitHub:
 * one report per normalized signature per cooldown window, in-memory.
 */

const COOLDOWN_MS = 6 * 60 * 60 * 1000;

const ISSUE_TITLE = 'Boardroom status response overclaims capability truth';
const MODULE = 'boardroom';
const SEVERITY = 'major' as const;

const lastReportedAt = new Map<string, number>();

export interface OverclaimReportInput {
    /** The response snippet that triggered the detection. */
    snippet: string;
    /** Which detector fired: 'deterministic' | 'jev_guardrail'. */
    source: 'deterministic' | 'jev_guardrail';
    /** Matched pattern (deterministic) or Jev flag key. */
    signal?: string;
    /** Agent that produced the response, when known. */
    agentId?: string;
}

export function resetOverclaimCooldownForTests(): void {
    lastReportedAt.clear();
}

/** Test seam: whether this signature would report right now (no side effects). */
export function isOverclaimCooldownActive(signature: string, now = Date.now()): boolean {
    const last = lastReportedAt.get(signature);
    return last !== undefined && now - last < COOLDOWN_MS;
}

/**
 * Fire-and-forget. Never throws; never blocks the response path. Resolves to
 * the GitHub issue URL when one was created/merged, undefined otherwise.
 */
export function reportOverclaimIfNeeded(input: OverclaimReportInput): Promise<string | undefined> {
    const signature = `${input.source}:${(input.snippet || '').slice(0, 80).toLowerCase()}`;
    if (isOverclaimCooldownActive(signature)) {
        return Promise.resolve(undefined);
    }
    lastReportedAt.set(signature, Date.now());

    return (async () => {
        try {
            const { importWithRetry } = await import('@/utils/dynamicImport');
            const { httpsCallable } = await importWithRetry(() => import('firebase/functions'));
            const { functions } = await importWithRetry(() => import('@/services/firebase'));
            const reportBug = httpsCallable<{
                title: string;
                description: string;
                expectedBehavior?: string;
                actualBehavior?: string;
                severity?: string;
                module?: string;
            }, {
                github: string;
                issueUrl?: string;
                message: string;
            }>(functions, 'reportBugFn');

            const result = await reportBug({
                title: ISSUE_TITLE,
                module: MODULE,
                severity: SEVERITY,
                description: [
                    `The app's own truth guardrail intercepted a status response that overclaims capability/production readiness.`,
                    ``,
                    `**Detector:** ${input.source}${input.signal ? ` (\`${input.signal}\`)` : ''}`,
                    `**Agent:** ${input.agentId || 'unknown'}`,
                    `**Detected:** ${new Date().toISOString()}`,
                    ``,
                    `### Flagged snippet`,
                    `> ${input.snippet.slice(0, 400)}`,
                    ``,
                    `The response shown to the user was replaced with the grounded capability audit report.`,
                ].join('\n'),
                expectedBehavior: 'Status answers distinguish implemented, tested, live-verified, and still-gated capabilities, and never issue blanket all-verified claims without current evidence.',
                actualBehavior: 'Status response collapsed uncertainty into a completion claim (see snippet).',
            });

            if (result.data.github === 'ok' || result.data.github === 'merged_as_comment') {
                logger.info(`[TruthOverclaim] Overclaim report delivered: ${result.data.issueUrl}`);
                return result.data.issueUrl;
            }
            // Firestore saved server-side, GitHub half failed/skipped.
            logger.warn(`[TruthOverclaim] Overclaim report GitHub sync: ${result.data.github}`);
            toast.warning('Capability overclaim detected and recorded, but GitHub sync failed. DevOps: check GITHUB_TOKEN / GITHUB_REPO configuration.');
            return undefined;
        } catch (err: unknown) {
            logger.warn('[TruthOverclaim] Overclaim report failed (non-fatal):', err);
            toast.warning('Capability overclaim detected, but the report pipeline is unreachable. DevOps: check reportBugFn deployment.');
            return undefined;
        }
    })();
}
