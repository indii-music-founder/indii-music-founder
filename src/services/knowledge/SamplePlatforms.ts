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

export const SAMPLE_PLATFORMS: SamplePlatform[] = [
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

export const identifyPlatform = (input: string): SamplePlatform | null => {
    const normalized = input.toLowerCase();
    return SAMPLE_PLATFORMS.find(p => p.keywords.some(k => normalized.includes(k))) || null;
};
