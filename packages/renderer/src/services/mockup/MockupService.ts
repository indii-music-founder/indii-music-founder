/**
 * MockupService.ts
 *
 * Photorealistic product mockups from existing artwork (Workstream F1 —
 * docs/CREATIVE_FINALIZATION_TOOLS_PLAN.md §11).
 *
 * Template rules (enforced by test, F1.1):
 *  - Every locked template contains the ARTWORK FIDELITY CLAUSE verbatim.
 *  - The artwork itself is passed as a sourceImage reference to
 *    ImageGeneration — never re-described in prose only.
 *  - Model choice uses APPROVED_MODELS constants, never string literals
 *    (Ground Rule 6).
 */

import { ImageGeneration } from '@/services/image/ImageGenerationService';
import { APPROVED_MODELS } from '@/core/config/intelligence-models';
import { logger } from '@/utils/logger';

export type MockupKind = 'vinyl-12' | 'cd-jewel' | 'cassette' | 'tee' | 'hoodie' | 'poster' | 'story-card';
export type MockupScene = 'studio' | 'lifestyle' | 'flat';

export interface MockupRequest {
    artworkUrl: string;
    kind: MockupKind;
    colorway?: string;
    scene?: MockupScene;
    aspectRatio?: string;
}

export interface MockupResult {
    url: string;
    kind: MockupKind;
    promptUsed: string;
}

/**
 * The clause every template must contain verbatim: the mockup stages the
 * customer's artwork, it never redraws it.
 */
export const ARTWORK_FIDELITY_CLAUSE =
    'the provided artwork is reproduced EXACTLY as given — same colors, lettering, and proportions; do not redraw, reinterpret, or restyle it';

/** Default aspect ratio per kind (test-locked, F1.1). */
export const MOCKUP_ASPECTS: Record<MockupKind, string> = {
    'vinyl-12': '1:1',
    'cd-jewel': '1:1',
    'cassette': '1:1',
    'tee': '4:5',
    'hoodie': '4:5',
    'poster': '2:3',
    'story-card': '9:16'
};

const SCENE_STAGING: Record<MockupScene, string> = {
    studio: 'clean studio product photography, soft even lighting, neutral seamless backdrop',
    lifestyle: 'natural lifestyle context with realistic depth of field, believable materials',
    flat: 'top-down flat-lay on a subtle textured surface, tidy composition'
};

const SCENE_STUDIO_DEFAULT = 'clean studio product photography, soft even lighting, neutral seamless backdrop';
// Default staging baked into the exported templates so the fidelity clause +
// kind staging are always present in MOCKUP_PROMPTS themselves (F1.1 asserts
// on this map); generateMockup swaps in the requested scene.
export const MOCKUP_PROMPTS: Record<MockupKind, string> = {
    'vinyl-12': `Photorealistic 12-inch vinyl record product mockup: the artwork printed full-bleed on a square LP sleeve with the black vinyl disc partially slid out, realistic paper texture, light wear, precise print scale. ${SCENE_STUDIO_DEFAULT}, ${ARTWORK_FIDELITY_CLAUSE}.`,
    'cd-jewel': `Photorealistic CD jewel case product mockup: the artwork as the front insert booklet, clear polycarbonate case with realistic reflections, tray and disc visible. ${SCENE_STUDIO_DEFAULT}, ${ARTWORK_FIDELITY_CLAUSE}.`,
    'cassette': `Photorealistic cassette tape product mockup: the artwork printed on the Norelco box and J-card, clear-shell cassette with the artwork motif, realistic plastic texture. ${SCENE_STUDIO_DEFAULT}, ${ARTWORK_FIDELITY_CLAUSE}.`,
    'tee': `Photorealistic t-shirt product mockup: the artwork screen-printed on the chest of the shirt, correct fabric wrinkles and print grain, realistic drape. ${SCENE_STUDIO_DEFAULT}, ${ARTWORK_FIDELITY_CLAUSE}.`,
    'hoodie': `Photorealistic pullover hoodie product mockup: the artwork printed on the chest, realistic fleece texture, hood and drawstrings naturally placed. ${SCENE_STUDIO_DEFAULT}, ${ARTWORK_FIDELITY_CLAUSE}.`,
    'poster': `Photorealistic poster product mockup: the artwork printed edge-to-edge on a matte poster mounted flat on a wall, true proportions, subtle paper sheen. ${SCENE_STUDIO_DEFAULT}, ${ARTWORK_FIDELITY_CLAUSE}.`,
    'story-card': `Photorealistic social story card mockup: the artwork presented as a full-bleed vertical story frame on a phone-like canvas, crisp corners, no UI chrome. ${SCENE_STUDIO_DEFAULT}, ${ARTWORK_FIDELITY_CLAUSE}.`
};


export async function generateMockup(req: MockupRequest): Promise<MockupResult> {
    if (!req.artworkUrl) throw new Error('MockupService: artworkUrl is required');
    if (!MOCKUP_PROMPTS[req.kind]) {
        throw new Error(`MockupService: unknown mockup kind "${req.kind}". Valid: ${Object.keys(MOCKUP_PROMPTS).join(', ')}`);
    }

    const scene: MockupScene = req.scene ?? 'studio';
    const aspect = req.aspectRatio ?? MOCKUP_ASPECTS[req.kind];
    const colorway = req.colorway ? ` Product colorway: ${req.colorway}.` : '';

    const promptUsed = `${MOCKUP_PROMPTS[req.kind].replace(SCENE_STUDIO_DEFAULT, SCENE_STAGING[scene])} Output aspect ratio ${aspect}.${colorway}`;

    const sourceImages = await loadArtworkAsSource(req.artworkUrl);

    logger.info(`[MockupService] Generating ${req.kind} mockup (${scene}, ${aspect})`);
    const results = await ImageGeneration.generateImages({
        prompt: promptUsed,
        aspectRatio: aspect,
        model: APPROVED_MODELS.IMAGE_GEN,
        sourceImages,
        quality: 'hd'
    });

    const best = results?.[0];
    if (!best?.url) throw new Error('MockupService: image generation returned no result');

    return { url: best.url, kind: req.kind, promptUsed };
}

/** Accepts a data URI or hosted URL; always yields [{mimeType, data}] for ImageGeneration. */
async function loadArtworkAsSource(artworkUrl: string): Promise<Array<{ mimeType: string; data: string }>> {
    const dataUriMatch = /^data:(image\/[^;,]+);base64,([\s\S]+)$/.exec(artworkUrl);
    if (dataUriMatch) {
        return [{ mimeType: dataUriMatch[1]!, data: dataUriMatch[2]! }];
    }

    const res = await fetch(artworkUrl);
    if (!res.ok) throw new Error(`MockupService: failed to fetch artwork from ${artworkUrl} (HTTP ${res.status})`);
    const blob = await res.blob();
    const buffer = await blob.arrayBuffer();
    let binary = '';
    const bytes = new Uint8Array(buffer);
    const CHUNK = 0x8000;
    for (let i = 0; i < bytes.length; i += CHUNK) {
        binary += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
    }
    return [{ mimeType: blob.type || 'image/png', data: btoa(binary) }];
}
