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

        // 2. Execute concurrent distribution using Promise.all
        // This is where we break away from piecemeal sequential integrations
        console.log(`Executing concurrent distribution for ${releaseId}...`);
        
        const distributionTasks = [
            withCircuitBreaker('SpotifyDispatch', () => dispatchToSpotify(ddexPayload, releaseId)),
            withCircuitBreaker('AppleMusicDispatch', () => dispatchToAppleMusic(ddexPayload, releaseId)),
            withCircuitBreaker('TidalDispatch', () => dispatchToTidal(ddexPayload, releaseId)),
            withCircuitBreaker('PRODispatch', () => dispatchToPerformanceRightsOrganizations(releaseId))
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

// Real XML upload implementation to Firebase Storage
async function dispatchToSpotify(payload: string, releaseId: string) {
    const bucket = getStorage().bucket();
    const destFile = bucket.file(`distribution/packages/${releaseId}/spotify.xml`);
    await destFile.save(payload, {
        contentType: 'application/xml',
        metadata: {
            cacheControl: 'public, max-age=31536000',
        }
    });
    return 'spotify_uploaded';
}

async function dispatchToAppleMusic(payload: string, releaseId: string) {
    const bucket = getStorage().bucket();
    const destFile = bucket.file(`distribution/packages/${releaseId}/apple.xml`);
    await destFile.save(payload, {
        contentType: 'application/xml',
    });
    return 'apple_uploaded';
}

async function dispatchToTidal(payload: string, releaseId: string) {
    const bucket = getStorage().bucket();
    const destFile = bucket.file(`distribution/packages/${releaseId}/tidal.xml`);
    await destFile.save(payload, {
        contentType: 'application/xml',
    });
    return 'tidal_uploaded';
}

async function dispatchToPerformanceRightsOrganizations(releaseId: string) {
    await dispatchPROPayload(releaseId);
    return 'pro_dispatched';
}
