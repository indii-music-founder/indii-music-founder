import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { compileDDEXRelease, dispatchPROPayload } from '../../publishing/ddex-generator';
import { CampaignFSM } from '../fsm/machine';
import { withCircuitBreaker } from '../circuit-breaker';
import { getStorage } from 'firebase-admin/storage';

/**
 * Unified Distribution Toggle Wrapper
 * Replaces sequential API calls with concurrent Promise.all execution for DSPs and Agencies.
 */
export const triggerUnifiedDistribution = onCall(async (request) => {
    if (!request.auth) throw new HttpsError('unauthenticated', 'User must be authenticated.');

    const { releaseId } = request.data as { releaseId: string };
    if (!releaseId) throw new HttpsError('invalid-argument', 'Missing releaseId.');

    const fsm = new CampaignFSM(releaseId);
    await fsm.transition('DISTRIBUTING');

    try {
        // 1. Prepare assets (DDEX Generation)
        const ddexPayload = await compileDDEXRelease(releaseId);

        // 2. Execute concurrent distribution staging using Promise.all
        // Staged for Delivery: XML payload generated and saved to Firebase Storage. 
        // Final SFTP/API dispatch to DSPs is pending upstream integration.
        console.log(`Staging concurrent distribution payloads for ${releaseId}...`);
        
        const distributionTasks = [
            withCircuitBreaker('SpotifyStage', () => stageForSpotify(ddexPayload, releaseId)),
            withCircuitBreaker('AppleMusicStage', () => stageForAppleMusic(ddexPayload, releaseId)),
            withCircuitBreaker('TidalStage', () => stageForTidal(ddexPayload, releaseId)),
            withCircuitBreaker('PROStage', () => stageForPerformanceRightsOrganizations(releaseId))
        ];

        const results = await Promise.allSettled(distributionTasks);

        const failures = results.filter(r => r.status === 'rejected');
        if (failures.length > 0) {
            console.error('Some distribution staging targets failed:', failures);
            await fsm.transition('FAILED', 'Partial distribution staging failure.');
            return { success: false, status: 'PARTIAL_FAILURE' };
        }

        await fsm.transition('MONITORING');
        return { success: true, status: 'STAGED' };

    } catch (error: unknown) {
        console.error('Unified Distribution Error:', error);
        const errorMessage = error instanceof Error ? error.message : String(error);
        await fsm.transition('FAILED', errorMessage);
        throw new HttpsError('internal', 'Unified distribution failed.');
    }
});

// Staged for Delivery: XML payload generated and saved to Firebase Storage.
// Final SFTP/API dispatch to DSPs is pending upstream integration.
async function stageForSpotify(payload: string, releaseId: string) {
    const bucket = getStorage().bucket();
    const destFile = bucket.file(`distribution/packages/${releaseId}/spotify.xml`);
    await destFile.save(payload, {
        contentType: 'application/xml',
        metadata: {
            cacheControl: 'public, max-age=31536000',
        }
    });
    return 'spotify_staged';
}

async function stageForAppleMusic(payload: string, releaseId: string) {
    const bucket = getStorage().bucket();
    const destFile = bucket.file(`distribution/packages/${releaseId}/apple.xml`);
    await destFile.save(payload, {
        contentType: 'application/xml',
    });
    return 'apple_staged';
}

async function stageForTidal(payload: string, releaseId: string) {
    const bucket = getStorage().bucket();
    const destFile = bucket.file(`distribution/packages/${releaseId}/tidal.xml`);
    await destFile.save(payload, {
        contentType: 'application/xml',
    });
    return 'tidal_staged';
}

async function stageForPerformanceRightsOrganizations(releaseId: string) {
    await dispatchPROPayload(releaseId);
    return 'pro_staged';
}
