import { describe, it, expect } from 'vitest';
import { buildReferenceRolePrompt, compileCreativeEditManifest, type CreativeVaultScope } from '../creativeManifest';

describe('buildReferenceRolePrompt', () => {
    it('turns per-color roles into prompt guidance', () => {
        const prompt = buildReferenceRolePrompt(
            {
                purple: 'Use my actual hair and image please',
                red: 'add a little fly',
            },
            {
                purple: 'characters',
                red: 'style',
            },
            ['purple', 'red']
        );

        expect(prompt).toHaveLength(2);
        expect(prompt[0]).toContain('Purple (CHARACTERS)');
        expect(prompt[0]).toContain('Use this reference for the character');
        expect(prompt[1]).toContain('Red (STYLE)');
        expect(prompt[1]).toContain('Use this reference for style');
    });

    it('skips colors that do not have a usable role or definition', () => {
        const prompt = buildReferenceRolePrompt(
            { purple: '', red: 'something' },
            { red: 'objects', purple: 'masks' as unknown as CreativeVaultScope },
            ['purple', 'red']
        );

        expect(prompt).toHaveLength(1);
        expect(prompt[0]).toContain('Red (OBJECTS)');
    });

    it('prefers storage URIs over data URIs when compiling generated candidates', () => {
        const manifest = compileCreativeEditManifest({
            sessionId: 'creative-test',
            projectId: 'project-1',
            item: {
                id: 'item-1',
                url: 'data:image/png;base64,base-image',
                prompt: 'base prompt',
                type: 'image',
                timestamp: Date.now(),
                projectId: 'project-1',
            },
            prompt: 'Edit prompt',
            definitions: {},
            referenceImages: {},
            generatedCandidates: [
                {
                    id: 'cand-1',
                    url: 'data:image/png;base64,preview-only',
                    storageUri: 'gs://bucket/users/test-user/assets/cand-1',
                    prompt: 'Candidate prompt',
                },
            ],
            settings: {
                modelTier: 'fast',
                resolution: '1080p',
                grounding: false,
                aspectRatio: '1:1',
                highFidelity: false,
            },
        });

        expect(manifest.generatedCandidates).toEqual([
            'gs://bucket/users/test-user/assets/cand-1',
        ]);
    });
});
