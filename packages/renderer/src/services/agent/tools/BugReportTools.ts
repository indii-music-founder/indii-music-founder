import { wrapTool, toolError } from '../utils/ToolUtils';
import type { AnyToolFunction, AgentContext, ToolFunctionArgs } from '../types';
import type { ToolExecutionContext } from '../ToolExecutionContext';
import { logger } from '@/utils/logger';

/** GitHub issue creation can be enabled by adding a GITHUB_TOKEN to env. */
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

        try {
            const { FirestoreService } = await import('@/services/FirestoreService');
            const bugService = new FirestoreService<typeof bugReport>('bug_reports');
            await bugService.add(bugReport);
            logger.info(`[BugReportTools] Bug report saved: ${bugReport.id} — "${bugReport.title}"`);
        } catch (e: unknown) {
            logger.warn('[BugReportTools] Failed to persist bug report to Firestore:', e);
            // Non-blocking — still return success to the agent
        }

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
} satisfies Record<string, AnyToolFunction>;
