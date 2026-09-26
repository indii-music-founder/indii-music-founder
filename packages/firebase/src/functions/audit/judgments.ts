import {
    getServerTypesafeClient,
    TypesafeClientError,
    type TypesafeClient,
} from '../intelligence/typesafeClient';
import { typesafeApiKey } from '../../config/secrets';
import type { DeterministicFinding } from './catalogAudit';

/**
 * Audit triage judgments — server-side Jev refinement of deterministic audit
 * findings (Post-Mastering Administrative Engine P2; plan §2.2 J-A).
 *
 * House contract (mirrors the renderer's typesafeJudgments.ts):
 *  - questions and thresholds live HERE and only here (server-side surface);
 *  - the deterministic baseline always answers first — Jev only refines;
 *  - any failure falls back to the baseline and opens a cooldown so a missing
 *    TYPESAFE_API_KEY or outage cannot thrash the audit worker;
 *  - Jev can never create a finding or silence a deterministic `blocking`
 *    one — it only moves severity within warning/critical and can demote
 *    non-blocking noise to info (MONITOR_ONLY).
 */

export const RELEASE_BLOCKING_CONFIRM_MIN = 0.7;
export const RELEASE_BLOCKING_CLEAR_MAX = 0.4;
/** Jev must be at least this confident in MONITOR_ONLY to suppress noise. */
export const MONITOR_ONLY_SUPPRESS_MIN = 0.6;
export const JUDGMENT_FAILURE_COOLDOWN_MS = 5 * 60 * 1000;

export type AuditPriority = 'REGISTRATION' | 'SPLITS' | 'METADATA' | 'MONITOR_ONLY';

export interface AuditTriageVerdict {
    releaseBlocking: boolean;
    priority: AuditPriority;
    /** True only when Jev confidently says nothing here needs a task. */
    suppress: boolean;
    source: 'jev' | 'heuristic';
    confidence?: number;
}

let lastJudgmentFailureAt = 0;

function judgmentsAvailable(): boolean {
    return Date.now() - lastJudgmentFailureAt >= JUDGMENT_FAILURE_COOLDOWN_MS;
}

function noteJudgmentFailure(err: unknown, context: string): void {
    lastJudgmentFailureAt = Date.now();
    console.warn(
        `[auditJudgments] ${context} unavailable — deterministic baseline in use for ${JUDGMENT_FAILURE_COOLDOWN_MS / 1000}s:`,
        err instanceof TypesafeClientError ? `${err.kind}: ${err.message}` : err instanceof Error ? err.message : err,
    );
}

/** Test hook: clears the failure cooldown so suites stay order-independent. */
export function __resetAuditJudgmentCooldownForTests(): void {
    lastJudgmentFailureAt = 0;
}

/** Deterministic baseline — always available, no network, no flag. */
export function heuristicAuditTriage(results: DeterministicFinding[]): AuditTriageVerdict {
    const hasBlocking = results.some((result) => result.severity === 'blocking');
    const hasCritical = results.some((result) => result.severity === 'critical');
    // Priority names what to resolve first, even among warnings; only an
    // empty audit is MONITOR_ONLY. releaseBlocking tracks hard gates.
    const priority: AuditPriority = results.some((result) => result.taskType.startsWith('IDENTIFIER'))
        ? 'REGISTRATION'
        : results.some((result) => result.taskType.startsWith('SPLIT_'))
            ? 'SPLITS'
            : results.some((result) => result.taskType.startsWith('METADATA'))
                ? 'METADATA'
                : 'MONITOR_ONLY';
    return {
        releaseBlocking: hasBlocking || hasCritical,
        priority,
        suppress: false,
        source: 'heuristic',
    };
}

export interface TriageStateSummary {
    title?: string;
    entityTypes: string[];
    findingsSummary: { taskType: string; severity: string; count: number }[];
}

/**
 * Refine the heuristic verdict with a Jev Choice (priority) + Noul
 * (release-blocking). Malformed/ambiguous answers keep the heuristic.
 */
export async function triageAuditFindings(
    summary: TriageStateSummary,
    options?: { client?: TypesafeClient },
): Promise<AuditTriageVerdict> {
    const heuristic = heuristicAuditTriage(
        summary.findingsSummary.map((entry) => ({
            taskType: entry.taskType as DeterministicFinding['taskType'],
            severity: entry.severity as DeterministicFinding['severity'],
            findings: [],
        })),
    );
    if (!options?.client && !typesafeApiKey.value()) {
        return heuristic;
    }
    if (!judgmentsAvailable()) return heuristic;

    try {
        const client = options?.client ?? getServerTypesafeClient();
        const result = await client.judge({
            state: {
                title: summary.title ?? 'untitled',
                entityTypes: summary.entityTypes,
                findings: summary.findingsSummary,
                heuristicVerdict: heuristic,
            },
            questions: {
                priority: {
                    type: 'choice',
                    instructions:
                        'Given these deterministic audit findings for one music catalog entity, pick the single ' +
                        'highest-priority administrative class to resolve first: REGISTRATION, SPLITS, METADATA, or ' +
                        'MONITOR_ONLY. Format validity, sums, and identifier checksums are already established by ' +
                        'code — do not re-derive them.',
                    criteria: {
                        REGISTRATION:
                            'A missing/invalid identifier blocks a registration that other steps depend on (ISRC-ISWC pairing, IPI for PRO filings).',
                        SPLITS: 'Split sums, PRO affiliation, or IPI gaps block signature workflows.',
                        METADATA: 'Mandatory distributor fields are missing or conflict with embedded tags.',
                        MONITOR_ONLY: 'No finding is release-blocking; record and move on.',
                    },
                },
                release_blocking: {
                    type: 'noul',
                    instructions:
                        'Would a professional distributor reject delivery of this release as-is, considering only ' +
                        'the listed findings?',
                },
            },
        });

        const answers = result.answers;
        const priorityAnswer = answers['priority'] as { choice?: unknown } | string | undefined;
        const choice = typeof priorityAnswer === 'string' ? priorityAnswer : priorityAnswer?.choice;
        const blockingAnswer = answers['release_blocking'];
        const blockingProb =
            typeof blockingAnswer === 'number'
                ? blockingAnswer
                : Number((blockingAnswer as { noul?: unknown } | undefined)?.noul);

        if (!Number.isFinite(blockingProb) || typeof choice !== 'string') {
            return heuristic;
        }

        const validPriorities: AuditPriority[] = ['REGISTRATION', 'SPLITS', 'METADATA', 'MONITOR_ONLY'];
        const priority = (validPriorities as string[]).includes(choice) ? (choice as AuditPriority) : heuristic.priority;

        const releaseBlocking =
            blockingProb >= RELEASE_BLOCKING_CONFIRM_MIN
                ? true
                : blockingProb < RELEASE_BLOCKING_CLEAR_MAX
                    ? false
                    : heuristic.releaseBlocking; // ambiguous band — keep the heuristic

        // Deterministic hard failures always stay; Jev may only demote when it
        // confidently sees nothing release-blocking AND picks MONITOR_ONLY.
        const hasDeterministicBlocking = summary.findingsSummary.some(
            (entry) => entry.severity === 'blocking' && entry.count > 0,
        );
        const suppress =
            !hasDeterministicBlocking &&
            priority === 'MONITOR_ONLY' &&
            blockingProb < MONITOR_ONLY_SUPPRESS_MIN;

        return {
            releaseBlocking,
            priority,
            suppress,
            source: 'jev',
            confidence: blockingProb,
        };
    } catch (err: unknown) {
        noteJudgmentFailure(err, 'catalog audit triage judgment');
        return heuristic;
    }
}

/**
 * Severity policy applying a triage verdict to deterministic findings.
 * `blocking` findings are INVIOABLE — suppression and demotion stop there.
 */
export function applySeverityTriage(
    results: DeterministicFinding[],
    verdict: AuditTriageVerdict,
): DeterministicFinding[] {
    if (verdict.suppress) {
        return results.map((result) => ({
            ...result,
            severity: result.severity === 'blocking' ? result.severity : 'info',
        }));
    }
    if (verdict.source === 'jev' && verdict.releaseBlocking) {
        return results.map((result) => ({
            ...result,
            severity:
                result.severity === 'critical'
                    ? 'blocking'
                    : result.severity === 'warning'
                        ? 'critical'
                        : result.severity,
        }));
    }
    return results;
}
