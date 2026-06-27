import { describe, expect, it } from 'vitest';
import { compileCreativeEditManifest, summarizeCreativeEditManifest } from '../creativeManifest';

describe('creativeManifest', () => {
    it('routes typography-heavy prompts to Pro with a descriptive summary', () => {
        const manifest = compileCreativeEditManifest({
            sessionId: 'creative_test_session',
            projectId: 'project-1',
            item: { id: 'item-1', type: 'image', url: 'https://example.com/base.png', prompt: 'Base prompt', timestamp: 1, projectId: 'project-1' },
            prompt: 'Design a bold typography poster with a neon headline',
            definitions: { purple: 'Add large headline text' },
            referenceImages: {},
            generatedCandidates: [],
            settings: {
                modelTier: 'fast',
                resolution: '720p',
                aspectRatio: '16:9',
                grounding: false,
                highFidelity: false,
                imageSize: '2K',
            }
        });

        expect(manifest.route.id).toBe('typography');
        expect(manifest.settings.modelTier).toBe('fast');
        expect(summarizeCreativeEditManifest(manifest)).toContain('Typography / Layout');
    });

    it('marks multi-reference edits as reference blends', () => {
        const manifest = compileCreativeEditManifest({
            sessionId: 'creative_test_session',
            projectId: 'project-1',
            item: { id: 'item-1', type: 'image', url: 'https://example.com/base.png', prompt: 'Base prompt', timestamp: 1, projectId: 'project-1' },
            prompt: 'Blend these references into one image',
            definitions: { purple: 'Use reference 1', red: 'Use reference 2' },
            referenceImages: {
                purple: { mimeType: 'image/png', data: 'AAA' },
                red: { mimeType: 'image/png', data: 'BBB' },
            },
            referenceRoles: {
                purple: 'objects',
                red: 'style',
            },
            referenceAssetUris: {
                purple: 'gs://mock-bucket.appspot.com/users/test-user/vault/objects/purple.png',
                red: 'gs://mock-bucket.appspot.com/users/test-user/vault/style/red.png',
            },
            maskUris: ['gs://mock-bucket.appspot.com/sessions/creative_test_session/masks/mask.png'],
            generatedCandidates: [],
            settings: {
                modelTier: 'fast',
                resolution: '1080p',
                aspectRatio: '1:1',
                grounding: false,
                highFidelity: false,
                imageSize: '2K',
            }
        });

        expect(manifest.route.id).toBe('reference_blend');
        expect(manifest.references).toHaveLength(2);
        expect(manifest.references[0]?.role).toBe('objects');
        expect(manifest.references[1]?.role).toBe('style');
        expect(manifest.subjectVault.objects).toEqual(expect.arrayContaining([
            'gs://mock-bucket.appspot.com/users/test-user/vault/objects/purple.png',
        ]));
        expect(manifest.subjectVault.style).toEqual(expect.arrayContaining([
            'gs://mock-bucket.appspot.com/users/test-user/vault/style/red.png',
        ]));
        expect(manifest.maskUris).toHaveLength(1);
    });

    it('handles a blank editor state with a safe default route', () => {
        const manifest = compileCreativeEditManifest({
            sessionId: 'creative_blank_session',
            projectId: null,
            item: null,
            prompt: '',
            definitions: {},
            referenceImages: {},
            generatedCandidates: [],
            settings: {
                modelTier: 'fast',
                resolution: '720p',
                aspectRatio: '1:1',
                grounding: false,
                highFidelity: false,
                imageSize: '1K',
            }
        });

        expect(manifest.baseImageUri).toBeNull();
        expect(manifest.route.id).toBe('canvas_remix');
        expect(manifest.subjectVault.objects).toHaveLength(0);
        expect(manifest.chatHistory[0]?.parts).toBe('');
    });

    it('keeps a single-mask edit on the rapid path', () => {
        const manifest = compileCreativeEditManifest({
            sessionId: 'creative_mask_session',
            projectId: 'project-1',
            item: { id: 'item-2', type: 'image', url: 'https://example.com/mask.png', prompt: 'Mask prompt', timestamp: 1, projectId: 'project-1' },
            prompt: 'Remove the background',
            definitions: { purple: 'remove the background' },
            referenceImages: {},
            maskUris: ['gs://mock-bucket.appspot.com/sessions/creative_mask_session/masks/mask.png'],
            generatedCandidates: [],
            settings: {
                modelTier: 'fast',
                resolution: '720p',
                aspectRatio: '1:1',
                grounding: false,
                highFidelity: false,
                imageSize: '1K',
            }
        });

        expect(manifest.route.id).toBe('rapid_edit');
        expect(manifest.maskUris).toHaveLength(1);
    });
});
