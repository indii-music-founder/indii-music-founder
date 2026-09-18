import { describe, expect, it } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';

/**
 * ISSUE-1435 contract test:
 * Verifies that all httpsCallable names invoked by renderer marketing services
 * and marketing components exist in packages/firebase/src/index.ts.
 */
describe('Marketing Client-Backend Callable Contract (ISSUE-1435)', () => {
    it('ensures all marketing callables invoked by renderer are exported by backend index', () => {
        const repoRoot = path.resolve(__dirname, '../../../../../');
        const backendIndexPath = path.join(repoRoot, 'packages/firebase/src/index.ts');
        const backendIndexContent = fs.readFileSync(backendIndexPath, 'utf-8');

        // Extract exported identifiers from packages/firebase/src/index.ts
        const exportedFunctions = new Set<string>();

        // Match `export const name = ...` or `export function name`
        const exportConstMatches = backendIndexContent.matchAll(/export\s+(?:const|function)\s+([A-Za-z0-9_]+)/g);
        for (const match of exportConstMatches) {
            exportedFunctions.add(match[1]);
        }

        // Match `export { a, b, c } from '...'`
        const exportBraceMatches = backendIndexContent.matchAll(/export\s*\{([^}]+)\}/g);
        for (const match of exportBraceMatches) {
            const identifiers = match[1].split(',').map((id) => {
                const parts = id.trim().split(/\s+as\s+/);
                return parts[parts.length - 1].trim();
            }).filter(Boolean);
            for (const id of identifiers) {
                exportedFunctions.add(id);
            }
        }

        // List of all client-side callable names invoked in renderer marketing domain
        const marketingCallableNames = [
            // Ad Automation (Meta Ads)
            'createAdCampaign',
            'createAdSet',
            'createAd',
            'getAdInsights',
            'pauseAdCampaign',

            // Social Auto-Poster
            'dispatchSocialPost',
            'getSocialPostInsights',

            // Influencer Bounty
            'createInfluencerBounty',

            // Email Marketing
            'syncEmailList',
            'deployEmailCampaign',
            'getEmailCampaignStats',

            // SMS Marketing
            'sendSMSBlast',
            'getSMSDeliveryStatus',

            // Pre-Save Campaigns
            'createPreSaveCampaign',
            'getPreSaveCampaign',
            'listPreSaveCampaigns',
            'presaveRegister',

            // Fan Enrichment
            'enrichFanData',

            // Campaign Manager
            'executeCampaign',
        ];

        const missingFromBackend: string[] = [];

        for (const fnName of marketingCallableNames) {
            if (!exportedFunctions.has(fnName)) {
                missingFromBackend.push(fnName);
            }
        }

        expect(
            missingFromBackend,
            `Expected all marketing client callables to be exported from packages/firebase/src/index.ts, but found missing: ${missingFromBackend.join(', ')}`,
        ).toEqual([]);
    });

    it('verifies marketing services handle backend errors gracefully without unhandled rejections', async () => {
        const { httpsCallable } = await import('firebase/functions');
        vi.mocked(httpsCallable).mockReturnValueOnce(
            vi.fn().mockRejectedValue(new Error('functions/unavailable')) as unknown as ReturnType<typeof httpsCallable>,
        );

        const { adAutomationService } = await import('./AdAutomationService');
        const insights = await adAutomationService.getAdInsights('ad-test-unhandled');
        expect(insights.available).toBe(false);
        if (insights.available === false) {
            expect(insights.errorCode).toBe('INSIGHTS_UNAVAILABLE');
            expect(insights.reason).toContain('functions/unavailable');
        }
    });
});
