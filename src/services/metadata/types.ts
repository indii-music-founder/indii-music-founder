
export interface RoyaltySplit {
    legalName: string;
    role: 'songwriter' | 'producer' | 'performer' | 'other';
    percentage: number; // 0-100
    email: string; // For rapid payment
}

export interface GoldenMetadata {
    // 1. Core Identity
    trackTitle: string;
    artistName: string;
    isrc: string; // International Standard Recording Code
    iswc?: string; // International Standard Musical Work Code (Optional but recommended)
    explicit: boolean;
    genre: string;

    // 2. The Economics
    splits: RoyaltySplit[];

    // 3. Rights Administration
    pro: 'ASCAP' | 'BMI' | 'SESAC' | 'GMR' | 'None';
    publisher: string;

    // 4. Verification
    isGolden: boolean; // Computed flag: true only if schema is valid and splits sum to 100%
}

export const INITIAL_METADATA: GoldenMetadata = {
    trackTitle: '',
    artistName: '',
    isrc: '',
    explicit: false,
    genre: '',
    splits: [{ legalName: 'Self', role: 'songwriter', percentage: 100, email: '' }],
    pro: 'None',
    publisher: 'Self-Published',
    isGolden: false
};
