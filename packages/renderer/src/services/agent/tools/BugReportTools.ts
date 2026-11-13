import { wrapTool, toolError, toolSuccess } from '../utils/ToolUtils';
import type { AnyToolFunction, AgentContext, ToolFunctionArgs } from '../types';
import type { ToolExecutionContext } from '../ToolExecutionContext';
import { logger } from '@/utils/logger';
import { toast } from '@/core/context/ToastContext';
import { importWithRetry } from '@/utils/dynamicImport';

/**
 * Bug and feature reporting tools.
 * Bug reports are saved to Firestore (bug_reports collection) and
 * forwarded to GitHub Issues via the reportBugFn Cloud Function.
 * GitHub token is server-side only (GCP Secret Manager) — no client config needed.
 */
export const BugReportTools: Record<string, AnyToolFunction> = {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    report_bug: wrapTool('report_bug', async (args: ToolFunctionArgs, _context?: AgentContext, toolContext?: ToolExecutionContext) => {
        const title = args.title as string | undefined;
        const description = args.description as string | undefined;
        const stepsToReproduce = (args.stepsToReproduce as string) || 'Not provided';
        const expectedBehavior = (args.expectedBehavior as string) || 'Not provided';
        const actualBehavior = (args.actualBehavior as string) || 'Not provided';
        const severity = (args.severity as 'critical' | 'major' | 'minor' | 'cosmetic') || 'major';
        const moduleArg = args.module as string | undefined;
        const errorMessage = args.errorMessage as string | undefined;

        if (!title || !description) {
            return toolError('Bug report requires at least a title and description.', 'MISSING_FIELDS');
        }

        const { useStore } = await importWithRetry(() => import('@/core/store'));
        const state = useStore.getState();

        const bugReport = {
            id: `bug-${Date.now()}-${crypto.randomUUID().split('-')[0]}`,
            title,
            description,
            stepsToReproduce,
            expectedBehavior,
            actualBehavior,
            severity,
            module: moduleArg || state.currentModule || 'unknown',
            errorMessage,
            reportedAt: new Date().toISOString(),
            reportedBy: 'agent',
            context: {
                projectId: state.currentProjectId,
                organizationId: state.currentOrganizationId,
                currentModule: state.currentModule,
                userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : 'electron',
            },
        };

        // Format as GitHub-compatible markdown
        const markdownBody = `## Bug Report

**Severity:** \`${bugReport.severity.toUpperCase()}\`
**Module:** \`${bugReport.module}\`
**Reported:** ${bugReport.reportedAt}
**Reporter:** Agent (automated)

### Description
${bugReport.description}

### Steps to Reproduce
${bugReport.stepsToReproduce}

### Expected Behavior
${bugReport.expectedBehavior}

### Actual Behavior
${bugReport.actualBehavior}

${bugReport.errorMessage ? `### Error Message\n\`\`\`\n${bugReport.errorMessage}\n\`\`\`` : ''}

### Environment
- Project: \`${bugReport.context.projectId || 'N/A'}\`
- Module: \`${bugReport.context.currentModule || 'N/A'}\`
- Platform: \`${bugReport.context.userAgent}\`

---
*This bug was automatically reported by the indii agent.*`;

        // 1. Persist + GitHub sync via the reportBugFn callable (ISSUE-031:
        // the server-side Admin SDK write is the ONLY durable path — the old
        // client-side write to `bug_reports` was denied by Firestore rules
        // (deny-all catch-all; that collection has no rule), silently created
        // nothing in production, and this tool still reported success.
        // Regression chain 2026-09-26: "documented" claims with zero durable
        // records behind them.
        let firestoreOk = false;
        let githubStatus: 'ok' | 'failed' | 'skipped' | 'merged_as_comment' = 'skipped';
        let issueUrl: string | undefined;
        let persistedBugId: string | undefined;
        let saveUnconfirmed = false;

        try {
            const { httpsCallable } = await importWithRetry(() => import('firebase/functions'));
            const { functions } = await importWithRetry(() => import('@/services/firebase'));
            const reportBug = httpsCallable<{
                title: string;
                description: string;
                stepsToReproduce?: string;
                expectedBehavior?: string;
                actualBehavior?: string;
                severity?: string;
                module?: string;
                errorMessage?: string;
            }, {
                firestore: 'ok' | 'failed';
                github: 'ok' | 'failed' | 'skipped' | 'merged_as_comment';
                issueUrl?: string;
                message: string;
                bugId?: string;
            }>(functions, 'reportBugFn');

            const result = await reportBug({
                title: bugReport.title,
                description: bugReport.description,
                stepsToReproduce: bugReport.stepsToReproduce,
                expectedBehavior: bugReport.expectedBehavior,
                actualBehavior: bugReport.actualBehavior,
                severity: bugReport.severity,
                module: bugReport.module,
                errorMessage: bugReport.errorMessage,
            });

            saveUnconfirmed = result.data.firestore !== 'ok' && result.data.firestore !== 'failed';
            firestoreOk = result.data.firestore === 'ok';
            const sync = result.data.github;
            githubStatus = sync === 'ok' || sync === 'merged_as_comment' || sync === 'failed' ? sync : 'skipped';
            issueUrl = typeof result.data.issueUrl === 'string' ? result.data.issueUrl.trim() || undefined : undefined;
            persistedBugId = typeof result.data.bugId === 'string' ? result.data.bugId.trim() || undefined : undefined;
            logger.info(`[BugReportTools] Cloud Function response: github=${githubStatus} firestore=${firestoreOk}`, result.data);
        } catch (cfErr: unknown) {
            saveUnconfirmed = true;
            logger.warn('[BugReportTools] Cloud Function call failed:', cfErr);
        }

        // 2. Honesty gate — the agent must NEVER tell the user a report was
        // filed when nothing durable happened. Durable = the callable's
        // Admin-SDK Firestore write succeeded.
        if (saveUnconfirmed) {
            const message = 'Bug report save could not be confirmed. Check the bug tracker before retrying to avoid a duplicate.';
            try {
                toast.warning(message);
            } catch (error) {
                logger.warn('[BugReportTools] Could not display the unconfirmed save warning:', error);
            }
            return toolError(message, 'SAVE_UNCONFIRMED');
        }
        if (!firestoreOk) {
            const message = 'The bug tracker could not save your report.';
            try {
                toast.error(message);
            } catch (error) {
                logger.warn('[BugReportTools] Could not display the save failure:', error);
            }
            return toolError(message, 'REPORT_SAVE_FAILED');
        }

        // 3. GitHub sync failure stays loud (silent-strand regression 2026-09-26:
        // a log line nobody read is not observability).
        if (githubStatus === 'failed' || githubStatus === 'skipped') {
            try {
                toast.warning('Bug report saved, but GitHub issue sync failed.');
            } catch (error) {
                logger.warn('[BugReportTools] Could not display the GitHub sync warning:', error);
            }
        }

        // Memory ingestion is best effort. The report is already saved.
        void importWithRetry(() => import('@/services/agent/memory/AlwaysOnMemoryEngine'))
            .then(({ alwaysOnMemoryEngine }) => alwaysOnMemoryEngine.ingest(
                `Bug reported: "${bugReport.title}" (${bugReport.severity}) in ${bugReport.module}. ${bugReport.description.substring(0, 100)}`,
                'system',
                'context'
            ))
            .catch(error => logger.warn('[BugReportTools] Failed to save bug to memory:', error));

        const reportReference = persistedBugId ? ` Report ID: ${persistedBugId}.` : '';
        const issueReference = issueUrl ? ` ${issueUrl}` : '';
        const syncMessage = githubStatus === 'merged_as_comment'
            ? `Added as a comment to an existing GitHub issue.${issueReference}`
            : githubStatus === 'ok'
                ? `Created a GitHub issue.${issueReference}`
                : 'GitHub sync did not complete.';
        const finalMessage = `Bug report saved to the project bug tracker: "${bugReport.title}" (${bugReport.severity}).${reportReference} ${syncMessage}`;

        return toolSuccess({
            bugId: persistedBugId,
            title: bugReport.title,
            issueUrl,
            githubStatus
        }, `${finalMessage}\n\n### ${bugReport.title} (${bugReport.severity})\n\n${markdownBody}`, { durableReceipt: true, receiptText: finalMessage });
    }),

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    request_feature: wrapTool('request_feature', async (args: ToolFunctionArgs, _context?: AgentContext, toolContext?: ToolExecutionContext) => {
        const title = args.title as string | undefined;
        const description = args.description as string | undefined;
        const useCase = (args.useCase as string) || 'Not provided';
        const priority = (args.priority as 'nice-to-have' | 'important' | 'critical') || 'nice-to-have';
        const category = (args.category as 'ux' | 'performance' | 'integration' | 'content' | 'other') || 'other';
        const moduleArg = args.module as string | undefined;

        if (!title || !description) {
            return toolError('Feature request requires at least a title and description.', 'MISSING_FIELDS');
        }

        const { useStore } = await importWithRetry(() => import('@/core/store'));
        const state = useStore.getState();

        const featureRequest = {
            id: `feat-${Date.now()}-${crypto.randomUUID().split('-')[0]}`,
            title,
            description,
            useCase,
            priority,
            category,
            module: moduleArg || state.currentModule || 'unknown',
            requestedAt: new Date().toISOString(),
            requestedBy: 'user-via-agent',
            status: 'open' as const,
            context: {
                projectId: state.currentProjectId,
                organizationId: state.currentOrganizationId,
                currentModule: state.currentModule,
                userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : 'electron',
            },
        };

        // Format as GitHub-compatible markdown
        const markdownBody = `## Feature Request

**Priority:** \`${featureRequest.priority.toUpperCase()}\`
**Category:** \`${featureRequest.category}\`
**Module:** \`${featureRequest.module}\`
**Requested:** ${featureRequest.requestedAt}

### Description
${featureRequest.description}

### Use Case
${featureRequest.useCase}

### Environment
- Project: \`${featureRequest.context.projectId || 'N/A'}\`
- Module: \`${featureRequest.context.currentModule || 'N/A'}\`
- Platform: \`${featureRequest.context.userAgent}\`

---
*This feature request was captured by the indii agent from an in-app conversation.*`;

        // 1. Save to Firestore
        try {
            const { FirestoreService } = await importWithRetry(() => import('@/services/FirestoreService'));
            const featureService = new FirestoreService<typeof featureRequest>('feature_requests');
            await featureService.add(featureRequest);
            logger.info(`[BugReportTools] Feature request saved: ${featureRequest.id} — "${featureRequest.title}"`);
        } catch (e: unknown) {
            logger.warn('[BugReportTools] Failed to persist feature request to Firestore:', e);
            return toolError(
                `Failed to record feature request in feedback tracker: ${e instanceof Error ? e.message : 'Database write error'}.`,
                'FEATURE_REQUEST_PERSISTENCE_FAILED'
            );
        }

        // 2. Save to Agent Memory
        try {
            const { alwaysOnMemoryEngine } = await importWithRetry(() => import('@/services/agent/memory/AlwaysOnMemoryEngine'));
            await alwaysOnMemoryEngine.ingest(
                `Feature requested: "${featureRequest.title}" (${featureRequest.priority}) for ${featureRequest.module}. ${featureRequest.description.substring(0, 100)}`,
                'system',
                'context'
            );
        } catch (e: unknown) {
            logger.warn('[BugReportTools] Failed to save feature request to memory:', e);
        }

        return toolSuccess({
            featureId: featureRequest.id,
            title: featureRequest.title
        }, `Feature request captured: "${featureRequest.title}" (${featureRequest.priority}). Saved to your feedback tracker.\n\n### ${featureRequest.title} (${featureRequest.priority})\n\n${markdownBody}`);
    })
} satisfies Record<string, AnyToolFunction>;
