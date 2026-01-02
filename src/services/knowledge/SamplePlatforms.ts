import { collection, getDocs } from 'firebase/firestore';
import { db } from '@/services/firebase';
import { z } from 'zod';

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

const SamplePlatformSchema = z.object({
    name: z.string(),
    keywords: z.array(z.string()),
    defaultLicenseType: z.enum(['Royalty-Free', 'Clearance-Required', 'Subscription-Based']),
    termsSummary: z.string(),
    color: z.string(),
    requirements: z.object({
        creditRequired: z.boolean(),
        reportingRequired: z.boolean(),
    }).optional(),
}).passthrough();

// Fallback data when Firestore is unavailable
export const FALLBACK_PLATFORMS: SamplePlatform[] = [
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

/**
 * Load sample platforms from Firestore with fallback to static data
 */
export const loadSamplePlatforms = async (): Promise<SamplePlatform[]> => {
    if (platformsCache) return platformsCache;

    try {
        const snapshot = await getDocs(collection(db, 'sample_platforms'));
        if (!snapshot.empty) {
            const platforms: SamplePlatform[] = [];
            snapshot.docs.forEach(doc => {
                const data = doc.data();
                const result = SamplePlatformSchema.safeParse(data);
                if (result.success) {
                    platforms.push({
                        id: doc.id,
                        ...data
                    } as SamplePlatform);
                } else {
                    console.warn(`[SamplePlatforms] Invalid platform data in Firestore for ${doc.id}:`, result.error);
                }
            });

            if (platforms.length > 0) {
                platformsCache = platforms;
                return platformsCache;
            }
        }
    } catch (error) {
        console.warn('[SamplePlatforms] Failed to load from Firestore, using fallback:', error);
    }

    // Use fallback if Firestore unavailable or empty
    return FALLBACK_PLATFORMS;
};

/**
 * Get cached platforms (sync) - returns fallback if not yet loaded
 */
export const getSamplePlatforms = (): SamplePlatform[] => {
    return platformsCache || FALLBACK_PLATFORMS;
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
