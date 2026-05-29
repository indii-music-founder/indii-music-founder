import { collection, getDocs } from 'firebase/firestore';
import { db } from '@/services/firebase';
import { logger } from '@/utils/logger';

export interface SamplePlatform {
    id: string;
    name: string;
    keywords: string[]; // Variations to match (e.g. "splice", "splice sounds")
    defaultLicenseType: 'Royalty-Free' | 'Clearance-Required' | 'Subscription-Based';
    termsSummary: string;
    color: string;
    requirements?: {
        creditRequired: boolean;
        reportingRequired: boolean;
    };
}

// Cache for loaded platforms
let platformsCache: SamplePlatform[] | null = null;

const isValidSamplePlatform = (data: unknown): data is Omit<SamplePlatform, 'id'> => {
    if (typeof data !== 'object' || data === null) return false;
    const d = data as Record<string, unknown>;
    return (
        typeof d.name === 'string' &&
        Array.isArray(d.keywords) &&
        ['Royalty-Free', 'Clearance-Required', 'Subscription-Based'].includes(d.defaultLicenseType as string)
    );
};

/**
 * Load sample platform terms from Firestore.
 */
export const loadSamplePlatforms = async (): Promise<SamplePlatform[]> => {
    if (platformsCache) return platformsCache;

    try {
        const snapshot = await getDocs(collection(db, 'sample_platforms'));
        if (!snapshot.empty) {
            const validPlatforms = snapshot.docs
                .filter(doc => isValidSamplePlatform(doc.data()))
                .map(doc => ({
                    id: doc.id,
                    ...doc.data()
                } as SamplePlatform));
            if (validPlatforms.length > 0) {
                platformsCache = validPlatforms;
                return platformsCache;
            }
        }
    } catch (error: unknown) {
        logger.error('[SamplePlatforms] Failed to load platform terms from Firestore:', error);
        throw error;
    }

    logger.warn('[SamplePlatforms] No sample platform terms configured in Firestore.');
    platformsCache = [];
    return platformsCache;
};

/**
 * Get cached platforms (sync).
 */
export const getSamplePlatforms = (): SamplePlatform[] => {
    return platformsCache || [];
};

const findPlatformByKeyword = (platforms: SamplePlatform[], input: string): SamplePlatform | null => {
    const normalized = input.toLowerCase();
    return platforms.find(p => p.keywords.some(k => normalized.includes(k))) || null;
};

/**
 * Identify a platform from input text (sync version)
 */
export const identifyPlatform = (input: string): SamplePlatform | null => {
    return findPlatformByKeyword(getSamplePlatforms(), input);
};

/**
 * Identify a platform from input text (async version that ensures platforms are loaded)
 */
export const identifyPlatformAsync = async (input: string): Promise<SamplePlatform | null> => {
    const platforms = await loadSamplePlatforms();
    return findPlatformByKeyword(platforms, input);
};

// Legacy export for backwards compatibility. Runtime data must come from Firestore.
export const SAMPLE_PLATFORMS: SamplePlatform[] = [];
