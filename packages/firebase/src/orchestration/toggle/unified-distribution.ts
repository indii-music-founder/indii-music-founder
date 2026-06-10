import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { compileDDEXRelease } from '../../publishing/ddex-generator';
import { CampaignFSM } from '../fsm/machine';

/**
 * Unified Distribution Toggle Wrapper
 * Replaces sequential API calls with concurrent Promise.all execution for DSPs and Agencies.
 */
export const triggerUnifiedDistribution = onCall(async (request) => {
    if (!request.auth) throw new HttpsError('unauthenticated', 'User must be authenticated.');

    const { releaseId } = request.data;
    if (!releaseId) throw new HttpsError('invalid-argument', 'Missing releaseId.');

    const fsm = new CampaignFSM(releaseId);
    await fsm.transition('DISTRIBUTING');

    try {
        // 1. Prepare assets (DDEX Generation)
        const ddexPayload = await compileDDEXRelease(releaseId);

        // 2. Execute concurrent distribution using Promise.all
        // This is where we break away from piecemeal sequential integrations
        console.log(`Executing concurrent distribution for ${releaseId}...`);
        
        const distributionTasks = [
            dispatchToSpotify(ddexPayload),
            dispatchToAppleMusic(ddexPayload),
            dispatchToTidal(ddexPayload),
            dispatchToPerformanceRightsOrganizations(releaseId)
        ];

        const results = await Promise.allSettled(distributionTasks);

        const failures = results.filter(r => r.status === 'rejected');
        if (failures.length > 0) {
            console.error('Some distribution targets failed:', failures);
            await fsm.transition('FAILED', 'Partial distribution failure.');
            return { success: false, status: 'PARTIAL_FAILURE' };
        }

        await fsm.transition('MONITORING');
        return { success: true, status: 'DISTRIBUTED' };

    } catch (error: any) {
        console.error('Unified Distribution Error:', error);
        await fsm.transition('FAILED', error.message);
        throw new HttpsError('internal', 'Unified distribution failed.');
    }
});

// Stubs for external DSP dispatches
async function dispatchToSpotify(payload: string) { return Promise.resolve('spotify_ok'); }
async function dispatchToAppleMusic(payload: string) { return Promise.resolve('apple_ok'); }
async function dispatchToTidal(payload: string) { return Promise.resolve('tidal_ok'); }
async function dispatchToPerformanceRightsOrganizations(releaseId: string) { return Promise.resolve('pro_ok'); }
