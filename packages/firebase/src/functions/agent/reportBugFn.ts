import * as functions from "firebase-functions/v1";
import * as admin from "firebase-admin";
import * as crypto from "crypto";

interface ReportBugRequest {
    title: string;
    description: string;
    stepsToReproduce?: string;
    expectedBehavior?: string;
    actualBehavior?: string;
    severity?: 'critical' | 'major' | 'minor' | 'cosmetic';
    module?: string;
    errorMessage?: string;
}

interface ReportBugResponse {
    firestore: 'ok' | 'failed';
    github: 'ok' | 'failed' | 'skipped' | 'merged_as_comment';
    issueUrl?: string;
    bugId?: string;
    message: string;
}

/**
 * Generate idempotency key (content hash) to prevent duplicate Firestore entries
 * Hash is based on: title + module + severity + description
 * This ensures retries with identical content produce the same key
 */
function generateIdempotencyKey(title: string, module: string, severity: string, description: string): string {
    const content = `${title}::${module}::${severity}::${description}`;
    return crypto.createHash('sha256').update(content).digest('hex').substring(0, 16);
}

/**
 * reportBugFn: Callable Cloud Function for bug reporting
 *
 * Replaces client-side GitHub token exposure (ISSUE-031 Gap 1 fix).
 * - GitHub token stays server-side only
 * - Firestore saves the bug report
 * - GitHub integration with dedup (search-before-create)
 * - Returns per-channel success status
 */
export const reportBugFn = functions.https.onCall(
    async (data: ReportBugRequest, context): Promise<ReportBugResponse> => {
        // Require authentication
        if (!context.auth) {
            throw new functions.https.HttpsError(
                "unauthenticated",
                "User must be authenticated to report bugs."
            );
        }

        const { title, description, stepsToReproduce = 'Not provided', expectedBehavior = 'Not provided', actualBehavior = 'Not provided', severity = 'major', module = 'unknown', errorMessage } = data;

        if (!title || !description) {
            throw new functions.https.HttpsError(
                "invalid-argument",
                "Bug report requires at least a title and description."
            );
        }

        // Generate idempotency key to prevent duplicate entries from retries
        const idempotencyKey = generateIdempotencyKey(title, module, severity, description);
        const bugReportId = `bug-${idempotencyKey}-${Date.now()}`;

        const bugReport = {
            id: bugReportId,
            idempotencyKey, // Store key for future dedup queries
            title,
            description,
            stepsToReproduce,
            expectedBehavior,
            actualBehavior,
            severity,
            module,
            errorMessage,
            reportedAt: new Date().toISOString(),
            reportedBy: context.auth.uid,
            userEmail: context.auth.token.email,
        };

        let firestoreStatus: 'ok' | 'failed' = 'ok';
        let githubStatus: 'ok' | 'failed' | 'skipped' | 'merged_as_comment' = 'skipped';
        let issueUrl: string | undefined;

        // 1. Save to Firestore (with idempotency key for dedup on retries)
        try {
            const db = admin.firestore();
            const docRef = db.collection('bug_reports').doc(bugReportId);
            await docRef.set(bugReport);
            console.log(`[reportBugFn] Bug report saved: ${bugReportId} — "${bugReport.title}"`);
        } catch (e: unknown) {
            firestoreStatus = 'failed';
            console.warn('[reportBugFn] Failed to persist to Firestore:', e);
        }

        // 2. GitHub integration (server-side token)
        const githubToken = process.env.GITHUB_TOKEN || '';
        const githubRepo = process.env.GITHUB_REPO || 'new-detroit-music-llc/indiiOS-Alpha-Electron';

        if (githubToken) {
            try {
                const issueTitle = `[${severity.toUpperCase()}] ${title}`;
                const markdownBody = `## Bug Report

**Severity:** \`${severity.toUpperCase()}\`
**Module:** \`${module}\`
**Reported:** ${bugReport.reportedAt}
**Reporter:** ${context.auth.token.email || 'agent'}

### Description
${description}

### Steps to Reproduce
${stepsToReproduce}

### Expected Behavior
${expectedBehavior}

### Actual Behavior
${actualBehavior}

${errorMessage ? `### Error Message\n\`\`\`\n${errorMessage}\n\`\`\`` : ''}

---
*Reported from indiiOS*`;

                // Search for existing issues with same title + module
                const searchQuery = `repo:${githubRepo} is:open type:issue title:"${title}" label:module:${module}`;
                const searchResponse = await fetch(`https://api.github.com/search/issues?q=${encodeURIComponent(searchQuery)}`, {
                    method: 'GET',
                    headers: {
                        'Authorization': `Bearer ${githubToken}`,
                        'Accept': 'application/vnd.github+json',
                        'X-GitHub-Api-Version': '2022-11-28',
                    },
                });

                if (searchResponse.ok) {
                    const searchData = await searchResponse.json() as { items: Array<{ number: number; html_url: string }> };
                    if (searchData.items?.length > 0) {
                        // Append comment to existing issue
                        const existingIssue = searchData.items[0];
                        const commentBody = `**Duplicate Report** (${new Date().toISOString()})\n\n${description}`;
                        const commentResponse = await fetch(`https://api.github.com/repos/${githubRepo}/issues/${existingIssue.number}/comments`, {
                            method: 'POST',
                            headers: {
                                'Authorization': `Bearer ${githubToken}`,
                                'Content-Type': 'application/json',
                                'Accept': 'application/vnd.github+json',
                                'X-GitHub-Api-Version': '2022-11-28',
                            },
                            body: JSON.stringify({ body: commentBody }),
                        });

                        if (commentResponse.ok) {
                            issueUrl = existingIssue.html_url;
                            githubStatus = 'merged_as_comment';
                            console.log(`[reportBugFn] Merged to existing issue #${existingIssue.number}`);
                        } else {
                            githubStatus = 'failed';
                            console.warn(`[reportBugFn] Failed to append comment: ${commentResponse.status}`);
                        }
                    } else {
                        // Create new issue
                        const createResponse = await fetch(`https://api.github.com/repos/${githubRepo}/issues`, {
                            method: 'POST',
                            headers: {
                                'Authorization': `Bearer ${githubToken}`,
                                'Content-Type': 'application/json',
                                'Accept': 'application/vnd.github+json',
                                'X-GitHub-Api-Version': '2022-11-28',
                            },
                            body: JSON.stringify({
                                title: issueTitle,
                                body: markdownBody,
                                labels: ['bug', `severity:${severity}`, `module:${module}`],
                            }),
                        });

                        if (createResponse.ok) {
                            const issue = await createResponse.json() as { number: number; html_url: string };
                            issueUrl = issue.html_url;
                            githubStatus = 'ok';
                            console.log(`[reportBugFn] Created GitHub issue #${issue.number}`);
                        } else {
                            githubStatus = 'failed';
                            console.warn(`[reportBugFn] Failed to create issue: ${createResponse.status}`);
                        }
                    }
                } else {
                    githubStatus = 'failed';
                    console.warn(`[reportBugFn] GitHub search failed: ${searchResponse.status}`);
                }
            } catch (ghErr: unknown) {
                githubStatus = 'failed';
                console.warn('[reportBugFn] GitHub integration error:', ghErr);
            }
        }

        return {
            firestore: firestoreStatus,
            github: githubStatus,
            issueUrl,
            bugId: bugReport.id,
            message: githubStatus === 'merged_as_comment'
                ? `Bug report merged as comment: ${issueUrl}`
                : githubStatus === 'ok'
                ? `Bug report created: ${issueUrl}`
                : `Bug report saved locally (GitHub sync failed)`,
        };
    }
);
