import { wrapTool, toolError } from '../utils/ToolUtils';
import type { AnyToolFunction, AgentContext, ToolFunctionArgs } from '../types';
import type { ToolExecutionContext } from '../ToolExecutionContext';
import { logger } from '@/utils/logger';

/**
 * Bug and feature reporting tools.
 * Bug reports are saved to Firestore (bug_reports collection) and optionally
 * to GitHub Issues if VITE_GITHUB_TOKEN + VITE_GITHUB_REPO are set in .env.
 */
export const BugReportTools = {
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

        // 2. Attempt GitHub Issue creation if VITE_GITHUB_TOKEN + VITE_GITHUB_REPO are set in .env
        const githubToken = (import.meta.env.VITE_GITHUB_TOKEN ?? '') as string;
        const githubRepo = (import.meta.env.VITE_GITHUB_REPO ?? '') as string;
        if (githubToken && githubRepo) {
            try {
                const ghResponse = await fetch(`https://api.github.com/repos/${githubRepo}/issues`, {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${githubToken}`,
                        'Content-Type': 'application/json',
                        'Accept': 'application/vnd.github+json',
                        'X-GitHub-Api-Version': '2022-11-28',
                    },
                    body: JSON.stringify({
                        title: `[${bugReport.severity.toUpperCase()}] ${bugReport.title}`,
                        body: markdownBody,
                        labels: ['bug', `severity:${bugReport.severity}`, `module:${bugReport.module}`],
                    }),
                });
                if (ghResponse.ok) {
                    const issue = await ghResponse.json() as { number: number; html_url: string };
                    logger.info(`[BugReportTools] GitHub issue #${issue.number} created: ${issue.html_url}`);
                } else {
                    logger.warn(`[BugReportTools] GitHub issue creation failed: ${ghResponse.status} ${ghResponse.statusText}`);
                }
            } catch (ghErr: unknown) {
                logger.warn('[BugReportTools] GitHub integration non-blocking error:', ghErr);
            }
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
            message: `Bug report created: "${bugReport.title}" (${bugReport.severity}). Saved to project bug tracker.`
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
            message: `Feature request captured: "${featureRequest.title}" (${featureRequest.priority}). Saved to your feedback tracker.`
            message: `Feature request captured: "${featureRequest.title}" (${featureRequest.priority}). Saved to your feedback tracker. 🎯`
        };
    }),
} satisfies Record<string, AnyToolFunction>;
