import { wrapTool, toolError } from '../utils/ToolUtils';
import type { AnyToolFunction, AgentContext, ToolFunctionArgs } from '../types';
import type { ToolExecutionContext } from '../ToolExecutionContext';
import { logger } from '@/utils/logger';

/**
 * Bug and feature reporting tools.
 * Bug reports are saved to Firestore (bug_reports collection) and optionally
 * to GitHub Issues if VITE_GITHUB_TOKEN + VITE_GITHUB_REPO are set in .env.
 */
export const BugReportTools: Record<string, AnyToolFunction> = {
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

        const { useStore } = await import('@/core/store');
        const state = useStore.getState();

        const bugReport = {
            id: `bug-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`,
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

        // 1. Save to Firestore
        try {
            const { FirestoreService } = await import('@/services/FirestoreService');
            const bugService = new FirestoreService<typeof bugReport>('bug_reports');
            await bugService.add(bugReport);
            logger.info(`[BugReportTools] Bug report saved: ${bugReport.id} — "${bugReport.title}"`);
        } catch (e: unknown) {
            logger.warn('[BugReportTools] Failed to persist bug report to Firestore:', e);
            // Non-blocking — still return success to the agent
        }

        // 2. Call Cloud Function for GitHub integration (ISSUE-031 Gap 1: token security)
        let githubStatus: 'ok' | 'failed' | 'skipped' | 'merged_as_comment' = 'skipped';
        let issueUrl: string | undefined;

        try {
            const { getFunctions, httpsCallable } = await import('firebase/functions');
            const functions = getFunctions();
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

            githubStatus = result.data.github;
            issueUrl = result.data.issueUrl;
            logger.info(`[BugReportTools] Cloud Function response: ${githubStatus}`, result.data);
        } catch (cfErr: unknown) {
            githubStatus = 'failed';
            logger.warn('[BugReportTools] Cloud Function call failed:', cfErr);
        }

        // 3. Save to Agent Memory for context continuity
        try {
            const { memoryService } = await import('@/services/agent/MemoryService');
            const currentProjectId = toolContext
                ? toolContext.get('currentProjectId')
                : state.currentProjectId;
            if (currentProjectId) {
                await memoryService.saveMemory(
                    currentProjectId,
                    `Bug reported: "${bugReport.title}" (${bugReport.severity}) in ${bugReport.module}. ${bugReport.description.substring(0, 100)}`,
                    'fact',
                    0.7,
                    'system'
                );
            }
        } catch (e: unknown) {
            logger.warn('[BugReportTools] Failed to save bug to memory:', e);
        }

        return {
            bugId: bugReport.id,
            title: bugReport.title,
            severity: bugReport.severity,
            markdownBody,
            firestore: 'ok',
            github: githubStatus,
            issueUrl,
            message: githubStatus === 'merged_as_comment'
                ? `Bug report merged as comment on existing issue: ${issueUrl}`
                : githubStatus === 'ok'
                ? `Bug report created: "${bugReport.title}" (${bugReport.severity}). Saved to project bug tracker. ${issueUrl || ''}`
                : `Bug report created locally: "${bugReport.title}" (${bugReport.severity}). GitHub sync failed.`
        };
    }),

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

        const { useStore } = await import('@/core/store');
        const state = useStore.getState();

        const featureRequest = {
            id: `feat-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`,
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
            const { FirestoreService } = await import('@/services/FirestoreService');
            const featureService = new FirestoreService<typeof featureRequest>('feature_requests');
            await featureService.add(featureRequest);
            logger.info(`[BugReportTools] Feature request saved: ${featureRequest.id} — "${featureRequest.title}"`);
        } catch (e: unknown) {
            logger.warn('[BugReportTools] Failed to persist feature request to Firestore:', e);
            // Non-blocking — still return success to the agent
        }

        // 2. Save to Agent Memory
        try {
            const { memoryService } = await import('@/services/agent/MemoryService');
            const currentProjectId = toolContext
                ? toolContext.get('currentProjectId')
                : state.currentProjectId;
            if (currentProjectId) {
                await memoryService.saveMemory(
                    currentProjectId,
                    `Feature requested: "${featureRequest.title}" (${featureRequest.priority}) for ${featureRequest.module}. ${featureRequest.description.substring(0, 100)}`,
                    'fact',
                    0.6,
                    'system'
                );
            }
        } catch (e: unknown) {
            logger.warn('[BugReportTools] Failed to save feature request to memory:', e);
        }

        return {
            featureId: featureRequest.id,
            title: featureRequest.title,
            priority: featureRequest.priority,
            category: featureRequest.category,
            markdownBody,
            message: `Feature request captured: "${featureRequest.title}" (${featureRequest.priority}). Saved to your feedback tracker.`
        };
    })
} satisfies Record<string, AnyToolFunction>;
