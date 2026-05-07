import { describe, it, expect } from 'vitest';
import { BugReportTools } from '../packages/renderer/src/services/agent/tools/BugReportTools';

describe('BugReportTools - GitHub Proof of Life', () => {
    it('should successfully post a bug report to GitHub', async () => {
        // Log the token presence to ensure we loaded .env correctly
        console.log('GitHub Token length:', import.meta.env.VITE_GITHUB_TOKEN?.length || 0);
        console.log('GitHub Repo:', import.meta.env.VITE_GITHUB_REPO);

        const args = {
            title: 'Proof of Life: Automated Agent Bug Reporter Test',
            description: 'This is an automated test from the AI agent verifying that the GitHub issue reporting pipeline is fully operational.',
            stepsToReproduce: '1. Agent executes `report_bug` tool.\n2. GitHub API creates this issue.',
            expectedBehavior: 'A new issue should be successfully created with correct labels and formatting.',
            actualBehavior: 'Issue is successfully generated and formatted.',
            severity: 'minor',
            module: 'system_test',
            errorMessage: 'None - successful test execution.'
        };

        const result = await BugReportTools.report_bug(args);
        
        console.log('Tool Execution Result:', result);
        
        expect(result.success).toBe(true);
        expect(result.data.bugId).toBeDefined();
    }, 15000); // give it some time
});
