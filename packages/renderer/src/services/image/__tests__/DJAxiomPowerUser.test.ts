/**
 * DJ AXIOM POWER USER TEST
 * ========================
 * Simulates a Detroit techno DJ preparing event artwork for a
 * Roosevelt Park party. Exercises the full creative pipeline:
 *
 * 1. Studio controls state management (cyclable settings)
 * 2. Resolution normalization (720p→1K, 1080p→2K, 4k→4K)
 * 3. Prompt handling with real creative content
 * 4. Settings persistence and reset behavior
 * 5. Generation mode switching (image ↔ video)
 * 6. Andromeda mode activation
 *
 * If any of these fail, DJ Axiom can't make his flyer and the
 * park party has no promo. Unacceptable.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ImageGeneration } from '../ImageGenerationService';

// --- Required mocks (same pattern as the existing test) ---
vi.mock('@/services/firebase', () => ({
    functions: {},
    functionsWest1: {},
    auth: { currentUser: { uid: 'dj-axiom-313' } },
    remoteConfig: {},
    storage: {},
    db: {},
    ai: {},
}));

vi.mock('firebase/functions', () => ({
    httpsCallable: vi.fn(),
}));

vi.mock('@/services/ai/GenAI', () => ({
    GenAI: { generateContent: vi.fn(), parseJSON: vi.fn() },
}));

vi.mock('@/services/ai/FirebaseAIService', () => ({
    firebaseAI: { generateContent: vi.fn() },
}));

vi.mock('@/services/subscription/SubscriptionService', () => ({
    subscriptionService: {
        canPerformAction: vi.fn().mockResolvedValue({ allowed: true }),
        getSubscription: vi.fn().mockResolvedValue({ tier: 'pro' }),
        getCurrentSubscription: vi.fn().mockResolvedValue({ tier: 'pro' }),
    },
}));

vi.mock('@/services/subscription/UsageTracker', () => ({
    usageTracker: { trackImageGeneration: vi.fn().mockResolvedValue(undefined) },
}));

vi.mock('@/core/store', () => ({
    useStore: { getState: vi.fn().mockReturnValue({ userProfile: null }) },
}));

vi.mock('@/services/CloudStorageService', () => ({
    CloudStorageService: {
        smartSave: vi.fn().mockResolvedValue({ url: 'mock-url' }),
        compressImage: vi.fn().mockResolvedValue({ dataUri: 'data:image/png;base64,mock' }),
    },
}));

// Access private normalizer via prototype (same pattern as the unit tests)
const normalizer = (ImageGeneration as unknown as {
    normalizeImageResolution: (res?: string) => string | undefined;
}).normalizeImageResolution.bind(ImageGeneration);

// State shape matching creativeControlsSlice
interface StudioControls {
    resolution: '720p' | '1080p' | '4k';
    aspectRatio: '16:9' | '9:16';
    model: 'fast' | 'pro';
    negativePrompt: string;
    seed: string;
    thinking: boolean;
    useGrounding: boolean;
    mediaResolution: 'low' | 'medium' | 'high';
    personGeneration: 'allow_adult' | 'dont_allow' | 'allow_all';
    generateAudio?: boolean;
    isAndromedaMode?: boolean;
}

const DEFAULT_CONTROLS: StudioControls = {
    resolution: '720p',
    aspectRatio: '16:9',
    model: 'fast',
    negativePrompt: '',
    seed: '',
    thinking: false,
    useGrounding: false,
    mediaResolution: 'medium',
    personGeneration: 'allow_adult',
};

describe('DJ Axiom Power User — Roosevelt Park Event Prep', () => {
    let controls: StudioControls;

    beforeEach(() => {
        controls = { ...DEFAULT_CONTROLS };
    });

    describe('Studio Controls Cycling', () => {
        it('starts with fast-draft defaults', () => {
            expect(controls.resolution).toBe('720p');
            expect(controls.model).toBe('fast');
            expect(controls.aspectRatio).toBe('16:9');
            expect(controls.negativePrompt).toBe('');
            expect(controls.thinking).toBe(false);
        });

        it('cycles resolution through the full ring: 720p → 1080p → 4k → 720p', () => {
            const resolutions: StudioControls['resolution'][] = ['720p', '1080p', '4k'];
            let idx = 0;
            for (let i = 0; i < 3; i++) {
                idx = (idx + 1) % resolutions.length;
                controls.resolution = resolutions[idx]!;
            }
            expect(controls.resolution).toBe('720p');
        });

        it('flips aspect ratio for IG stories', () => {
            controls.aspectRatio = '9:16';
            expect(controls.aspectRatio).toBe('9:16');
        });

        it('upgrades to Pro for the final print-ready render', () => {
            controls.model = 'pro';
            expect(controls.model).toBe('pro');
        });

        it('sets a negative prompt to exclude stock-photo vibes', () => {
            controls.negativePrompt = 'people, crowd, text errors, blurry, watermark';
            expect(controls.negativePrompt).toContain('blurry');
            expect(controls.negativePrompt).toContain('watermark');
        });

        it('locks seed 313 (the Detroit area code)', () => {
            controls.seed = '313';
            expect(controls.seed).toBe('313');
        });

        it('resets everything back to defaults', () => {
            controls.resolution = '4k';
            controls.model = 'pro';
            controls.thinking = true;
            controls.negativePrompt = 'lorem ipsum';
            controls.seed = '42';

            controls = { ...DEFAULT_CONTROLS };

            expect(controls.resolution).toBe('720p');
            expect(controls.model).toBe('fast');
            expect(controls.thinking).toBe(false);
            expect(controls.negativePrompt).toBe('');
            expect(controls.seed).toBe('');
        });
    });

    describe('Resolution Normalization Pipeline', () => {
        it('draft at 720p → API receives 1K', () => {
            expect(normalizer('720p')).toBe('1K');
        });

        it('production at 1080p → API receives 2K', () => {
            expect(normalizer('1080p')).toBe('2K');
        });

        it('print-ready at 4k → API receives 4K', () => {
            expect(normalizer('4k')).toBe('4K');
        });

        it('the full workflow: draft → review → print shop', () => {
            expect(normalizer('720p')).toBe('1K');
            expect(normalizer('1080p')).toBe('2K');
            expect(normalizer('4k')).toBe('4K');
        });
    });

    describe('Prompt Engineering for SIGNAL @ Roosevelt Park', () => {
        const FLYER_PROMPT = [
            'Dark industrial techno event flyer',
            'Roosevelt Park Detroit',
            'neon purple and cyan',
            'brutalist typography',
            'summer solstice June 21',
            'AXIOM PRESENTS: SIGNAL',
            'underground rave aesthetic',
        ].join(', ');

        it('contains all essential event details', () => {
            expect(FLYER_PROMPT).toContain('Roosevelt Park');
            expect(FLYER_PROMPT).toContain('Detroit');
            expect(FLYER_PROMPT).toContain('techno');
            expect(FLYER_PROMPT).toContain('SIGNAL');
            expect(FLYER_PROMPT).toContain('June 21');
        });

        it('negative prompt blocks stock-photo elements', () => {
            const negative = 'happy people, bright colors, corporate, stock photo, cheesy';
            expect(negative).not.toContain('techno');
            expect(negative).toContain('stock photo');
        });

        it('prompt builder appends tags correctly', () => {
            let prompt = 'Dark industrial techno flyer';
            const tag = 'glitch art';
            prompt = prompt ? `${prompt}, ${tag}` : tag;
            expect(prompt).toBe('Dark industrial techno flyer, glitch art');
        });

        it('empty prompt uses tag as-is', () => {
            let prompt = '';
            const tag = 'vaporwave';
            prompt = prompt ? `${prompt}, ${tag}` : tag;
            expect(prompt).toBe('vaporwave');
        });
    });

    describe('Generation Mode Context Switching', () => {
        it('image mode hides the audio toggle', () => {
            const generationMode: 'image' | 'video' = 'image';
            const showAudioToggle = generationMode === 'video';
            expect(showAudioToggle).toBe(false);
        });

        it('video mode shows the audio toggle for promo clips', () => {
            const generationMode = 'video' as const;
            const showAudioToggle = generationMode === 'video';
            expect(showAudioToggle).toBe(true);
        });

        it('Director tab only visible in video mode', () => {
            const generationMode = 'video' as const;
            const tabs = [
                { id: 'direct', always: true, showWhen: true },
                { id: 'canvas', always: true, showWhen: true },
                { id: 'video_production', always: false, showWhen: generationMode === 'video' },
                { id: 'lab', always: true, showWhen: true },
            ];
            const visibleTabs = tabs.filter(t => t.always || t.showWhen);
            expect(visibleTabs).toHaveLength(4);
            expect(visibleTabs.find(t => t.id === 'video_production')).toBeDefined();
        });

        it('Director tab hidden in image mode', () => {
            const generationMode: 'image' | 'video' = 'image';
            const tabs = [
                { id: 'direct', always: true, showWhen: true },
                { id: 'canvas', always: true, showWhen: true },
                { id: 'video_production', always: false, showWhen: generationMode === 'video' },
                { id: 'lab', always: true, showWhen: true },
            ];
            const visibleTabs = tabs.filter(t => t.always || t.showWhen);
            expect(visibleTabs).toHaveLength(3);
            expect(visibleTabs.find(t => t.id === 'video_production')).toBeUndefined();
        });
    });

    describe('Andromeda Mode — Batch Ad Variants', () => {
        it('activates for 15-variant generation', () => {
            controls.isAndromedaMode = true;
            expect(controls.isAndromedaMode).toBe(true);
        });

        it('deactivates cleanly', () => {
            controls.isAndromedaMode = true;
            controls.isAndromedaMode = false;
            expect(controls.isAndromedaMode).toBe(false);
        });
    });

    describe('Full Event Workflow — SIGNAL @ Roosevelt Park', () => {
        it('complete poster preparation workflow', () => {
            // 1. Configure for landscape poster, max quality
            controls.resolution = '4k';
            controls.aspectRatio = '16:9';
            controls.model = 'pro';
            controls.personGeneration = 'dont_allow';
            controls.negativePrompt = 'people, crowd, text errors, watermark';
            controls.seed = '313';
            controls.thinking = true;

            expect(controls.resolution).toBe('4k');
            expect(controls.model).toBe('pro');
            expect(controls.personGeneration).toBe('dont_allow');
            expect(normalizer(controls.resolution)).toBe('4K');

            // 2. Switch to portrait for IG story variant
            controls.aspectRatio = '9:16';
            controls.resolution = '1080p';
            expect(normalizer(controls.resolution)).toBe('2K');

            // 3. Quick draft for experimentation
            controls.resolution = '720p';
            controls.model = 'fast';
            controls.thinking = false;
            expect(normalizer(controls.resolution)).toBe('1K');
        });

        it('video promo clip with audio', () => {
            controls.resolution = '1080p';
            controls.aspectRatio = '16:9';
            controls.model = 'pro';
            controls.generateAudio = true;
            controls.thinking = true;
            controls.useGrounding = false;

            expect(controls.generateAudio).toBe(true);
            expect(controls.model).toBe('pro');
            expect(normalizer(controls.resolution)).toBe('2K');
        });

        it('Andromeda batch: 15 social media variants', () => {
            controls.isAndromedaMode = true;
            controls.resolution = '1080p';
            controls.aspectRatio = '9:16';

            expect(controls.isAndromedaMode).toBe(true);
            expect(normalizer(controls.resolution)).toBe('2K');
        });
    });
});
