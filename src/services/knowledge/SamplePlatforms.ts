import { collection, getDocs } from 'firebase/firestore';
import { db } from '@/services/firebase';

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

// Fallback data when Firestore is unavailable
const FALLBACK_PLATFORMS: SamplePlatform[] = [
    {
        id: 'splice',
        name: 'Splice',
        keywords: ['splice', 'splice sounds'],
        defaultLicenseType: 'Royalty-Free',
        termsSummary: "Royalty-Free for commercial use. No per-use payment required.",
        color: 'text-blue-400',
        requirements: { creditRequired: false, reportingRequired: false }
    },
    {
        id: 'loopcloud',
        name: 'Loopcloud',
        keywords: ['loopcloud', 'loopmasters'],
        defaultLicenseType: 'Royalty-Free',
        termsSummary: "Royalty-Free for commercial use (Points spent purchased license).",
        color: 'text-indigo-400',
        requirements: { creditRequired: false, reportingRequired: false }
    },
    {
        id: 'tracklib',
        name: 'Tracklib',
        keywords: ['tracklib'],
        defaultLicenseType: 'Clearance-Required',
        termsSummary: "Requires License Purchase + Revenue Share. NOT Royalty-Free by default.",
        color: 'text-orange-500',
        requirements: { creditRequired: true, reportingRequired: true }
    },
    {
        id: 'logic-stock',
        name: 'Logic Pro / GarageBand Stock',
        keywords: ['logic', 'garageband', 'apple loops', 'logic pro'],
        defaultLicenseType: 'Royalty-Free',
        termsSummary: "Royalty-Free commercial use (standalone loops). Cannot resell as loops.",
        color: 'text-gray-400',
        requirements: { creditRequired: false, reportingRequired: false }
    },
    {
        id: 'ableton-stock',
        name: 'Ableton Stock',
        keywords: ['ableton', 'ableton live', 'ableton pack'],
        defaultLicenseType: 'Royalty-Free',
        termsSummary: "Royalty-Free commercial use. Cannot resell as loops.",
        color: 'text-gray-400',
        requirements: { creditRequired: false, reportingRequired: false }
    }
];

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
 * Load sample platforms from Firestore with fallback to static data
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
            platformsCache = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            } as SamplePlatform));
            return platformsCache;
        }
    } catch (error) {
        console.warn('[SamplePlatforms] Failed to load from Firestore, using fallback:', error);
    }

    // Use fallback if Firestore unavailable or empty
    platformsCache = FALLBACK_PLATFORMS;
    return platformsCache;
};

/**
 * Get cached platforms (sync) - returns fallback if not yet loaded
 */
export const getSamplePlatforms = (): SamplePlatform[] => {
    return platformsCache || FALLBACK_PLATFORMS;
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

/**
 * Identify a platform from input text (sync version)
 */
export const identifyPlatform = (input: string): SamplePlatform | null => {
    const normalized = input.toLowerCase();
    const platforms = getSamplePlatforms();
    return platforms.find(p => p.keywords.some(k => normalized.includes(k))) || null;
};

/**
 * Identify a platform from input text (async version that ensures platforms are loaded)
 */
export const identifyPlatformAsync = async (input: string): Promise<SamplePlatform | null> => {
    const platforms = await loadSamplePlatforms();
    const normalized = input.toLowerCase();
    return platforms.find(p => p.keywords.some(k => normalized.includes(k))) || null;
};

// Legacy export for backwards compatibility
export const SAMPLE_PLATFORMS = FALLBACK_PLATFORMS;
