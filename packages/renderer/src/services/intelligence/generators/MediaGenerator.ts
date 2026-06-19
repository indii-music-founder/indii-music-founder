/**
 * Media Generator — Video generation logic extracted from FirebaseIntelligenceService.
 * Disabled for security (raw CLIENT_API_KEY removed). 
 * Use VideoGenerationService which routes through the secure generateVideoV3 Cloud Function.
 */

import { AppErrorCode, AppException } from '@/shared/types/errors';

export async function generateVideo(
    client: any,
    options: any
): Promise<string> {
    throw new AppException(
        AppErrorCode.UNAUTHORIZED,
        'Client-side video generation is disabled for security. Please use VideoGenerationService which routes through secure Cloud Functions.'
    );
}

