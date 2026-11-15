import { describe, it, expect, vi, beforeEach } from 'vitest';

const generateImages = vi.fn();
const recordVersion = vi.fn();

vi.mock('@/services/image/ImageGenerationService', () => ({
    ImageGeneration: { generateImages: (...a: unknown[]) => generateImages(...a) }
}));

const fetchAsBase64 = vi.fn();
vi.mock('@/services/storage/safeStorageFetch', () => ({
    fetchAsBase64: (...a: unknown[]) => fetchAsBase64(...a),
}));

vi.mock('@/services/intelligence/AutonomousIntelligence', () => ({
    AutonomousIntelligence: { generateImage: vi.fn(async () => 'https://cdn.test/legacy.png') }
}));

vi.mock('@/services/assets/AssetVersionService', () => ({
    AssetVersionService: { recordVersion: (...a: unknown[]) => recordVersion(...a) }
}));

vi.mock('@/core/store', () => {
    const mockStore = {
        addToHistory: vi.fn(),
        currentProjectId: 'proj_1',
        studioControls: {},
        userProfile: {},
        uploadedImages: [{ id: 'up-logo-1', url: 'data:image/png;base64,VVBM' }],
        generatedHistory: [{ id: 'gal-1', url: 'data:image/png;base64,R0FM' }],
    };
    return { useStore: { getState: () => mockStore } };
});

import { CommerceTools, resolveAgentAssetUrl } from '@/services/agent/tools/CommerceTools';
import { DirectorTools } from '@/services/agent/tools/DirectorTools';
import { MerchandiseAgent } from '@/services/agent/MerchandiseAgent';
import type { AgentContext } from '@/services/agent/types';
import { useStore } from '@/core/store';
import { ARTWORK_FIDELITY_CLAUSE } from '@/services/mockup/MockupService';

const tool = (CommerceTools as unknown as {
    mockup_merchandise: (args: { productType: string; designIdea: string; artworkUrl?: string }, context?: AgentContext) => Promise<{ success: boolean; data: Record<string, unknown>; message: string }>;
}).mockup_merchandise;

const generateMockupTool = (CommerceTools as unknown as {
    generate_mockup: (args: { productType?: string; kind?: string; artworkUrl?: string; designIdea?: string }, context?: AgentContext) => Promise<{ success: boolean; data: Record<string, unknown>; message: string }>;
}).generate_mockup;

const generateImageTool = (DirectorTools as unknown as {
    generate_image: (args: { prompt: string }, context?: AgentContext) => Promise<{ success: boolean; message: string }>;
}).generate_image;

describe('mockup_merchandise with artwork (F1.3)', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        generateImages.mockResolvedValue([{ id: 'img1', url: 'https://cdn.test/mockup.png' }]);
    });

    it('routes artwork requests through MockupService: fidelity clause + sourceImages + no prose re-description', async () => {
        const res = await tool({ productType: 'vinyl', designIdea: 'ignored when artwork present', artworkUrl: 'data:image/png;base64,QUJD' });

        expect(res.success).toBe(true);
        expect(res.data.kind).toBe('vinyl-12');
        expect(res.data.artworkFidelity).toContain('sourceImages reference');

        const call = generateImages.mock.calls[0]![0] as { prompt: string; sourceImages: Array<{ mimeType: string; data: string }> };
        expect(call.prompt).toContain(ARTWORK_FIDELITY_CLAUSE);
        expect(call.sourceImages).toEqual([{ mimeType: 'image/png', data: 'QUJD' }]);
        expect(res.data.readyForPOD).toBe(false);
    });

    it('records a mockup history item + H1 version (producer hook)', async () => {
        await tool({ productType: 't-shirt', designIdea: 'x', artworkUrl: 'data:image/png;base64,QUJD' });

        const { addToHistory } = useStore.getState() as unknown as { addToHistory: ReturnType<typeof vi.fn> };
        expect(addToHistory).toHaveBeenCalledWith(expect.objectContaining({
            type: 'image',
            meta: expect.stringContaining('mockup'),
            tags: ['mockup', 'tee']
        }));
        expect(recordVersion).toHaveBeenCalledWith(expect.objectContaining({
            source: 'mockup',
            parentVersionId: null
        }));
    });

    it('falls back to the legacy text-described preview without artworkUrl', async () => {
        const res = await tool({ productType: 't-shirt', designIdea: 'skull with roses' });
        expect(res.success).toBe(true);
        expect(res.data.designPromptUsed).toContain('skull with roses');
        expect(generateImages).not.toHaveBeenCalled(); // legacy path uses AutonomousIntelligence
        expect(recordVersion).not.toHaveBeenCalled();
    });

    it('surfaces generation failures as tool errors', async () => {
        generateImages.mockRejectedValue(new Error('quota exceeded'));
        const res = await tool({ productType: 'poster', designIdea: 'x', artworkUrl: 'data:image/png;base64,QUJD' });
        expect(res.success).toBe(false);
        expect(res.message).toContain('quota exceeded');
    });

    it('resolves attachment-0, upload-0, and gallery-0 aliases via resolveAgentAssetUrl', async () => {
        await expect(
            resolveAgentAssetUrl('attachment-0', {
                attachments: [{ mimeType: 'image/png', base64: 'QVRU' }],
            } as AgentContext),
        ).resolves.toBe('data:image/png;base64,QVRU');
        await expect(resolveAgentAssetUrl('upload-0')).resolves.toBe('data:image/png;base64,VVBM');
        await expect(resolveAgentAssetUrl('gallery-0')).resolves.toBe('data:image/png;base64,R0FM');
    });

    it('routes generate_mockup with attachment-0 through MockupService with fidelity-locked sourceImages', async () => {
        const res = await generateMockupTool(
            { productType: 't-shirt', artworkUrl: 'attachment-0' },
            { attachments: [{ mimeType: 'image/png', base64: 'QVRU' }] } as AgentContext,
        );

        expect(res.success).toBe(true);
        expect(res.data.kind).toBe('tee');
        const call = generateImages.mock.calls[0]![0] as {
            prompt: string;
            sourceImages: Array<{ mimeType: string; data: string }>;
        };
        expect(call.prompt).toContain(ARTWORK_FIDELITY_CLAUSE);
        expect(call.sourceImages).toEqual([{ mimeType: 'image/png', data: 'QVRU' }]);
    });

    it('automatically uses the attached image in generate_mockup when artworkUrl is omitted', async () => {
        const res = await generateMockupTool(
            { productType: 't-shirt' },
            { attachments: [{ mimeType: 'image/png', base64: 'QVRU' }] } as AgentContext,
        );

        expect(res.success).toBe(true);
        expect(res.data.kind).toBe('tee');
        const call = generateImages.mock.calls[0]![0] as {
            prompt: string;
            sourceImages: Array<{ mimeType: string; data: string }>;
        };
        expect(call.prompt).toContain(ARTWORK_FIDELITY_CLAUSE);
        expect(call.sourceImages).toEqual([{ mimeType: 'image/png', data: 'QVRU' }]);
    });

    it('returns undefined when an explicit asset alias or ID fails to resolve instead of falling back to [0]', async () => {
        const ctx = {
            assetReferences: [{ id: 'a1', alias: 'asset-0', url: 'https://cdn.test/a1.png' }],
            attachments: [{ mimeType: 'image/png', base64: 'QVRU' }],
        } as AgentContext;

        await expect(resolveAgentAssetUrl('upload-99', ctx)).resolves.toBeUndefined();
        await expect(resolveAgentAssetUrl('nonexistent-id', ctx)).resolves.toBeUndefined();
    });

    it('ignores elided attachment payloads and elided data URLs in resolveAgentAssetUrl', async () => {
        const elidedCtx = {
            attachments: [{ mimeType: 'image/png', base64: '[elided 90KB for Firestore document limit]' }],
        } as AgentContext;

        await expect(resolveAgentAssetUrl('attachment-0', elidedCtx)).resolves.toBeUndefined();
        await expect(resolveAgentAssetUrl(undefined, elidedCtx)).resolves.toBeUndefined();
        await expect(resolveAgentAssetUrl('data:image/png;base64,[elided 90KB]')).resolves.toBeUndefined();
    });

    it('maps vinyl-12, cd-jewel, and story-card kind aliases accurately in generate_mockup', async () => {
        const ctx = { attachments: [{ mimeType: 'image/png', base64: 'QVRU' }] } as AgentContext;

        const vinyl = await generateMockupTool({ kind: 'vinyl-12', artworkUrl: 'attachment-0' }, ctx);
        const cd = await generateMockupTool({ kind: 'cd-jewel', artworkUrl: 'attachment-0' }, ctx);
        const story = await generateMockupTool({ kind: 'story-card', artworkUrl: 'attachment-0' }, ctx);

        expect(vinyl.success).toBe(true);
        expect(vinyl.data.kind).toBe('vinyl-12');
        expect(cd.success).toBe(true);
        expect(cd.data.kind).toBe('cd-jewel');
        expect(story.success).toBe(true);
        expect(story.data.kind).toBe('story-card');
    });

    it('forwards gs:// via referenceUris and https:// via fetchAsBase64 in DirectorTools.generate_image while ignoring elided payloads', async () => {
        fetchAsBase64.mockResolvedValueOnce({ mimeType: 'image/png', base64: 'SFRUUFM=' });

        await generateImageTool(
            { prompt: 'Render t-shirt studio shot' },
            { assetReferences: [{ id: 'gs-1', alias: 'asset-0', url: 'gs://indii-bucket/logo.png' }] } as AgentContext,
        );
        expect(generateImages.mock.calls[0]![0]).toMatchObject({
            referenceUris: ['gs://indii-bucket/logo.png'],
            sourceImages: undefined,
        });

        await generateImageTool(
            { prompt: 'Render t-shirt studio shot' },
            { assetReferences: [{ id: 'http-1', alias: 'asset-0', url: 'https://cdn.test/logo.png' }] } as AgentContext,
        );
        expect(fetchAsBase64).toHaveBeenCalledWith('https://cdn.test/logo.png');
        expect(generateImages.mock.calls[1]![0]).toMatchObject({
            sourceImages: [{ mimeType: 'image/png', data: 'SFRUUFM=' }],
            referenceUris: undefined,
        });

        await generateImageTool(
            { prompt: 'Render t-shirt studio shot' },
            { attachments: [{ mimeType: 'image/png', base64: '[elided 50KB]' }] } as AgentContext,
        );
        expect(generateImages.mock.calls[2]![0]).toMatchObject({
            sourceImages: undefined,
            referenceUris: undefined,
        });
    });

    it('attaches Zod schemas to generate_mockup and mockup_merchandise on MerchandiseAgent', () => {
        const agent = new MerchandiseAgent();
        const declarations = agent.tools.flatMap(tool => tool.functionDeclarations || []);
        const generateMockupDecl = declarations.find(decl => decl.name === 'generate_mockup');
        const mockupMerchDecl = declarations.find(decl => decl.name === 'mockup_merchandise');

        expect(generateMockupDecl?.schema).toBeDefined();
        expect(mockupMerchDecl?.schema).toBeDefined();

        expect(generateMockupDecl!.schema!.safeParse({ productType: 't-shirt', artworkUrl: 'attachment-0', scene: 'studio' }).success).toBe(true);
        expect(generateMockupDecl!.schema!.safeParse({ scene: 'invalid-scene' }).success).toBe(false);

        expect(mockupMerchDecl!.schema!.safeParse({ productType: 't-shirt', designIdea: 'Center chest logo' }).success).toBe(true);
        expect(mockupMerchDecl!.schema!.safeParse({ productType: '', designIdea: 'Center chest logo' }).success).toBe(false);
    });

    it('rejects unresolved explicit artwork sources instead of falling back to attachments or legacy text generation', async () => {
        const { AutonomousIntelligence } = await import('@/services/intelligence/AutonomousIntelligence');
        const ctx = {
            attachments: [{ mimeType: 'image/png', base64: 'QVRU' }],
        } as AgentContext;

        const genRes = await generateMockupTool(
            { productType: 't-shirt', artworkUrl: 'upload-99' },
            ctx,
        );
        const merchRes = await tool(
            { productType: 't-shirt', designIdea: 'logo tee', artworkUrl: 'upload-99' },
            ctx,
        );

        expect(genRes.success).toBe(false);
        expect(genRes.message).toContain('upload-99');
        expect(merchRes.success).toBe(false);
        expect(merchRes.message).toContain('upload-99');
        expect(generateImages).not.toHaveBeenCalled();
        expect(AutonomousIntelligence.generateImage).not.toHaveBeenCalled();
    });
});
